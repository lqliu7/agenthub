# MCP 传输层从 SSE 切换至 Streamable-HTTP — 设计 Spec

- **日期**：2026-06-25
- **作者**：AgentHub 维护者
- **状态**：Draft（待实现）
- **关联问题**：长任务超时 / 中断后，再次调用 MCP 工具返回 `MCP error -32602: Invalid request parameters`，必须重启 ahub-node 才能恢复。

---

## 1. 背景与根因

### 1.1 现象
Claude Code 通过 MCP SSE 连到 ahub-node。一旦发生：
- 长任务（如 `container_exec` 超过预期时长）被客户端 abort
- 网络抖动导致 SSE 流中断
- 客户端进程重启但服务端会话未清

后续任意工具调用稳定返回 `Invalid request parameters`，治理唯一手段是**重启 ahub-node 或重启 Claude Code**，运维成本高。

### 1.2 根因
当前实现使用 MCP **SSE transport**：
- SSE 是**有状态会话**：客户端 `GET /sse` 获取 `session_id`，后续 `POST /messages?session_id=...` 走该流推回响应。
- 长任务被中断 / 网络断开后，服务端的 session 状态被清，客户端持有的 `session_id` 已失效。
- FastMCP 内置 SSE 实现**无 heartbeat、无重连握手**；Claude Code MCP 客户端在 SSE 流断开后**不会主动重建**，仍带旧 session_id 发请求 → server 找不到 session → 返回 `-32602`。
- 服务端 `stateless_http=True` 这个 flag **只对 streamable-http transport 生效**，SSE 模式下不起作用，是配置假象。

### 1.3 已实测的可行性
| 检查项 | 结果 |
|---|---|
| Claude Code 版本 | `2.1.80`，`claude mcp add --transport http` 官方支持 |
| FastMCP 版本 | `mcp 1.27.2`，`run(transport="streamable-http")` 合法；`streamable_http_app` 属性存在 |
| Bearer header 注入 | 客户端支持 `-H "Authorization: ..."`；服务端中间件可同样挂在 streamable_http_app 上 |

结论：协议、客户端、服务端三方对齐，无版本阻塞。

---

## 2. 目标 / 非目标

### 2.1 目标
1. 长任务中断、网络抖动后，**下一次 MCP 工具调用立即可用**，无需重启 ahub-node 或 Claude Code。
2. 保留现有的 Bearer token 认证语义与 audit 日志行为。
3. 保留 7 个工具的对外签名与返回结构（`shell_exec` / `container_exec` / `container_manage` / `file_read` / `file_write` / `system_info` / `transfer_file`）。
4. 借机修正现有 `mcp.sse_app` monkey-patch hack，改为对 SSE 与 streamable-http **两种 ASGI app 都生效**的更干净注入方式。

### 2.2 非目标
- 不重写工具实现逻辑；不改安全策略 `BLOCKED_PAT` / `CONFIRM_PAT`。
- 不引入新的认证方案（如 OAuth）。
- 不增加 SSE 心跳改造（直接放弃 SSE 路径，无意义）。

---

## 3. 方案选择

| 方案 | 治本程度 | 复杂度 | 决策 |
|---|---|---|---|
| **A. 切换到 streamable-http**（每请求独立 HTTP，无残留 session_id） | ✅ 治本 | 小（服务端 ~10 行 + 配置 2 处） | **采用** |
| B. SSE + heartbeat 中间件 | 治标（客户端不主动重连仍要重启） | 中 | 拒绝 |
| C. 服务进程看门狗 | 不治根 | 小 | 拒绝 |

---

## 4. 设计详述

### 4.1 服务端改造（`/nexus/agenthub/ahub-node/server.py`）

#### 4.1.1 Auth 注入方式重构（核心）
当前实现（hack）：
```python
_original_sse_app = mcp.sse_app
def _authed_sse_app(*args, **kwargs):
    app = _original_sse_app(*args, **kwargs)
    app.add_middleware(_AuthMiddleware)
    return app
mcp.sse_app = _authed_sse_app
```
问题：仅劫持 `sse_app`，切换到 streamable-http 后该 hook 完全失效，会导致**鉴权裸奔**。

新实现（同时覆盖两种 transport）：
```python
if AUTH_TOKENS:
    from starlette.middleware.base import BaseHTTPMiddleware
    from starlette.responses import JSONResponse

    class _AuthMiddleware(BaseHTTPMiddleware):
        async def dispatch(self, request, call_next):
            # /health 不鉴权（如有）
            auth = request.headers.get("authorization", "")
            if auth.startswith("Bearer "):
                caller = AUTH_TOKENS.get(auth[7:])
                if caller:
                    audit.set_caller(caller)
                    return await call_next(request)
            return JSONResponse({"error": "unauthorized"}, status_code=401)

    def _wrap(app_factory):
        def _factory(*args, **kwargs):
            app = app_factory(*args, **kwargs)
            app.add_middleware(_AuthMiddleware)
            return app
        return _factory

    mcp.sse_app = _wrap(mcp.sse_app)
    mcp.streamable_http_app = _wrap(mcp.streamable_http_app)
```
**关键点**：同一个 `_AuthMiddleware` 通过工厂包装器同时绑到 `sse_app` 和 `streamable_http_app`，未来切回 SSE 或并存时无需再改。

#### 4.1.2 启动 transport 切换
```python
# 旧
mcp.run(transport="sse")
# 新
mcp.run(transport="streamable-http")
```

启动提示 URL 同步更新：
```python
# 旧
print(f'  "url": "http://{lan_ip}:{args.port}/sse"')
# 新
print(f'  "type": "http", "url": "http://{lan_ip}:{args.port}/mcp", "headers": {{"Authorization": "Bearer <token>"}}')
```

#### 4.1.3 stateless_http 现在生效
保持 `stateless_http=True`（在 streamable-http 下含义为：每个请求独立处理，不缓存 session 上下文，正符合本次目标）。

### 4.2 客户端配置（`/nexus/agenthub/.mcp.json`）
```json
{
  "mcpServers": {
    "node-A100-594": {
      "type": "http",
      "url": "http://10.67.178.142:9100/mcp",
      "headers": {
        "Authorization": "Bearer nexus_ahub"
      }
    }
  }
}
```
变更点：
- `"type": "sse"` → `"type": "http"`
- url 末尾 `/sse` → `/mcp`

### 4.3 文档同步
- `/nexus/agenthub/README.md` 中部署节点段落里的示例 mcp.json 同步改为 `type: http`、`/mcp` 路径。
- `/nexus/agenthub/CLAUDE.md` 若有 SSE 相关字句需更新（实施时检查）。

---

## 5. 兼容性与风险

| 风险 | 评估 | 缓解 |
|---|---|---|
| 老的 `.mcp.json`（type: sse）继续被某些用户使用 | 中 | server 同时保留 `sse_app` 路径（auth 已对两种都注入），切换由客户端配置主导；过渡期可双 transport 共存 |
| streamable-http 端点路径默认 `/mcp` 与现有 `/sse` 不同 | 低 | 文档明确说明；不重叠 |
| 中间件 monkey-patch 仍是属性替换 | 低 | 已抽出工厂函数，意图清晰；后续可考虑改为外层 ASGI Mount，本次不做 |
| 鉴权失效（重构错） | 高 → 低 | 保留 audit 路径；测试项强制覆盖 401 / 200 两种分支 |

---

## 6. 测试与验收

### 6.1 单元 / 集成
- 起 ahub-node（streamable-http），用 `httpx` 直连 `POST /mcp` 不带 token → 401。
- 带正确 token → 工具列表能正常拉到。
- 调用 `system_info` → 返回结构正确。

### 6.2 关键场景（治本验证）
1. **长任务中断后立即可用**：
   - `container_exec` 启动一个 30s 命令，5s 后 Ctrl-C 客户端 / kill claude 子进程。
   - 立刻起新的 Claude session（不重启 ahub-node），调用任意工具 → 应正常返回。
   - **判定**：不再出现 `Invalid request parameters`。
2. **并发**：两个 Claude 实例同时连，分别调用 → 互不干扰，audit 区分 caller。
3. **网络抖动**：iptables 临时丢包 5s 后恢复 → 客户端下次调用应重新建联成功。

### 6.3 回归
- 7 个工具全部冒烟一遍。
- 安全策略：触发 confirm 命令、blocked 命令各一次。
- audit 日志行数与 caller 字段保持原行为。

---

## 7. 实施步骤（高层）
1. 改 server.py：抽 `_wrap`，挂双 app；切换 `transport="streamable-http"`；更新启动提示。
2. 改 .mcp.json：type → http，url → /mcp。
3. 重启 ahub-node 服务。
4. 在 Claude Code 内 `/mcp` 查看连接状态，跑 §6 测试。
5. 同步 README / CLAUDE.md 文档。
6. 提交：`fix(mcp): switch transport to streamable-http to recover from broken sessions without restart`。

---

## 8. 回退方案
若 streamable-http 在某些客户端场景下出现新问题：
- 服务端单行回退 `transport="sse"`；客户端 `.mcp.json` 改回 `type: sse`、url `/sse`。
- 由于 auth 中间件已同时挂在 `sse_app` 上，无需重新打 patch。

---

## 9. Open Questions
- 是否需要把端点路径 `/mcp` 设为可配置（环境变量）？当前 mcp 库默认 `/mcp`，多数情况下无需自定义；本次不做。
- 是否同时暴露 `/health` 用于探活？建议下个迭代单独做。
