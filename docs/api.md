# API 文档 / API Reference

[中文](#中文) | [English](#english)

---

## 中文

### 认证

所有 API 请求需携带 Bearer Token。

```bash
# 登录获取 Token
curl -X POST http://localhost:8310/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"yourpassword"}'
# 返回: {"token":"..."}

# 后续请求携带 Token
curl -H "Authorization: Bearer <token>" http://localhost:8310/api/active-sessions
```

Token 有效期 30 天，存储在客户端 `localStorage`。

修改 Web 登录密码：

```bash
curl -X POST http://localhost:8310/api/change-password \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"currentPassword":"oldpassword","newPassword":"newpassword123"}'
```

密码会以 scrypt 哈希保存到 `~/.agenthub/auth.json`。修改成功后现有 Web Token 失效，需要重新登录；本地 `~/.agenthub/local.token` 不受影响。

---

### REST API

#### 获取/保存 Web 设置

```
GET /api/settings
POST /api/settings
```

`POST /api/settings` 请求体：

```json
{
  "settings": {
    "fileBrowserDefaultPath": "/",
    "shellDefaultCwd": "/",
    "newConversationDefaultDir": "~",
    "uiStyle": "studio",
    "colorTheme": "aurora",
    "iconStyle": "sharp",
    "language": "zh",
    "fontSize": 13
  }
}
```

设置会持久化到 `~/.agenthub/web-settings.json`（权限 600）。默认外观为 Studio + Aurora + Material（`iconStyle: "sharp"`）。首次打开新版 Web 端时，如果后端尚无设置文件，前端会把当前 `localStorage` 设置迁移到后端。

#### 获取活跃会话列表

```
GET /api/active-sessions
```

响应：

```json
[{
  "sessionId": "uuid",
  "name": "paddle",
  "workingDir": "/paddle",
  "alive": true,
  "exitCode": null,
  "createdAt": 1700000000000,
  "lastActiveAt": 1700000060000,
  "logPath": "/root/.agenthub/logs/uuid.log",
  "socketPath": "/root/.agenthub/sockets/uuid.sock",
  "clientCount": 2
}]
```

#### 获取会话日志

```
GET /api/session-log/:sessionId
```

响应：`text/plain`，最后 9000 行原始 PTY 输出（含 ANSI 转义码）。

#### 获取 Agent 历史项目

```
GET /api/projects?agent=claude
GET /api/projects?agent=codex
```

#### 获取项目下的历史会话

```
GET /api/sessions/:projectId?agent=claude
GET /api/sessions/:projectId?agent=codex
```

#### 读取文档（无需认证）

```
GET /docs                  # 文档列表
GET /docs/:name            # 读取指定文档（如 usage.md）
```

#### 文件系统（需认证）

```
GET /api/fs/list?path=~&hidden=false
```

响应：`{ path, entries: [{ name, type, size, mtime, ext }] }`

- `type`：`"dir"` | `"file"`
- 白名单路径：默认 `/`（可通过 `FS_ROOTS` 扩展）

```
GET /api/fs/read?path=/path/to/file&maxBytes=102400
```

响应：
- 文本：`{ path, type: "text", content, truncated, size }`
- 图片：`{ path, type: "image", dataUrl, size }`（base64 data URL）
- 超限/不支持：`{ path, type: "image_too_large"|"unsupported", size }`

```
GET /api/fs/stat?path=/path/to/file
```

响应：`{ path, name, type, size, mtime, mode }`

```
POST /api/fs/mkdir
```

请求：`{ "path": "/target/dir", "name": "new-folder" }`
响应：`{ path, name, type: "dir", size, mtime, mode }`

```
POST /api/fs/upload?path=/target/dir
```

请求：`application/octet-stream`，文件名放在 `X-Filename` header。
响应：`{ path, name, type, size, mtime, mode }`

```
GET /api/fs/download?path=/path/to/file
```

响应：二进制文件流。

---

### WebSocket API

连接：`ws://<host>:<port>/ws?token=<token>`

连接后服务端立即推送：`{"type":"session_list","sessions":[...]}`

#### 客户端 → 服务端

| 消息类型 | 说明 | 参数 |
|---------|------|------|
| `start` | 创建新会话 | `workingDir`, `name`, `resumeSessionId?`, `cols`, `rows` |
| `attach` | 接入已有会话 | `sessionId` |
| `resize` | 调整终端尺寸 | `cols`, `rows` |
| `shell_start` | 创建不持久化临时 shell | `cwd`, `cols`, `rows` |
| `shell_input` | 写入临时 shell stdin | `data` |
| `shell_resize` | 调整临时 shell 尺寸 | `cols`, `rows` |
| `shell_kill` | 关闭临时 shell | — |
| `kill` | 终止会话 | `sessionId` |
| `delete` | 删除会话记录 | `sessionId` |
| `rename` | 重命名会话 | `sessionId`, `name` |
| 原始字符串 | 键盘输入 → PTY stdin | — |

#### 服务端 → 客户端

| 消息类型 | 说明 |
|---------|------|
| 原始字符串 | PTY 输出，直接写入 xterm.js |
| `session_id` | 会话创建/接入确认，含 `sessionId`、`name` |
| `session_list` | 会话列表更新（任何变更时广播） |
| `replay_start` / `replay_end` | Scrollback 回放边界 |
| `exit` | PTY 进程退出，含 `exitCode` |
| `error` | 错误信息 |
| `shell_ready` | 临时 shell 创建完成，含 `cwd` |
| `shell_exit` | 临时 shell 已退出，含 `exitCode` |
| `shell_error` | 临时 shell 错误信息 |

---

### Unix Socket 协议

路径：`~/.agenthub/sockets/<sessionId>.sock`

连接后服务端推送 scrollback buffer，之后为全双工 PTY 流。

**OOB Resize 帧**（调整终端尺寸）：

```
\x00RESIZE:<cols>:<rows>\n
```

示例：`\x00RESIZE:120:30\n`

---

## English

### Authentication

All API requests require a Bearer Token.

```bash
# Get token
curl -X POST http://localhost:8310/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"yourpassword"}'
# Returns: {"token":"..."}

# Use token
curl -H "Authorization: Bearer <token>" http://localhost:8310/api/active-sessions
```

Tokens are valid for 30 days and stored in the client's `localStorage`.

Change the Web login password:

```bash
curl -X POST http://localhost:8310/api/change-password \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"currentPassword":"oldpassword","newPassword":"newpassword123"}'
```

The password is stored as a scrypt hash in `~/.agenthub/auth.json`. After a successful change, existing Web tokens are invalidated and the browser must sign in again; the local `~/.agenthub/local.token` is unaffected.

---

### REST API

#### Get / Save Web Settings

```
GET /api/settings
POST /api/settings
```

`POST /api/settings` body:

```json
{
  "settings": {
    "fileBrowserDefaultPath": "/",
    "shellDefaultCwd": "/",
    "newConversationDefaultDir": "~",
    "uiStyle": "studio",
    "colorTheme": "aurora",
    "iconStyle": "sharp",
    "language": "en",
    "fontSize": 13
  }
}
```

Settings are persisted to `~/.agenthub/web-settings.json` (chmod 600). The default appearance is Studio + Aurora + Material (`iconStyle: "sharp"`). On first launch with no backend settings file, the Web client migrates the current `localStorage` settings to the backend.

#### List Active Sessions

```
GET /api/active-sessions
```

Response:

```json
[{
  "sessionId": "uuid",
  "name": "paddle",
  "workingDir": "/paddle",
  "alive": true,
  "exitCode": null,
  "createdAt": 1700000000000,
  "lastActiveAt": 1700000060000,
  "logPath": "/root/.agenthub/logs/uuid.log",
  "socketPath": "/root/.agenthub/sockets/uuid.sock",
  "clientCount": 2
}]
```

#### Get Session Log

```
GET /api/session-log/:sessionId
```

Response: `text/plain`, last 9000 lines of raw PTY output (including ANSI escape codes).

#### Get Agent History Projects

```
GET /api/projects?agent=claude
GET /api/projects?agent=codex
```

#### Get Sessions in a Project

```
GET /api/sessions/:projectId?agent=claude
GET /api/sessions/:projectId?agent=codex
```

#### Read Documentation (no auth required)

```
GET /docs                  # List docs
GET /docs/:name            # Read a doc (e.g. usage.md)
```

#### File System (auth required)

```
GET /api/fs/list?path=~&hidden=false
```

Response: `{ path, entries: [{ name, type, size, mtime, ext }] }`

- `type`: `"dir"` | `"file"`
- Whitelist roots: `/` by default (extendable via `FS_ROOTS`)

```
GET /api/fs/read?path=/path/to/file&maxBytes=102400
```

Response:
- Text: `{ path, type: "text", content, truncated, size }`
- Image: `{ path, type: "image", dataUrl, size }` (base64 data URL)
- Too large / unsupported: `{ path, type: "image_too_large"|"unsupported", size }`

```
GET /api/fs/stat?path=/path/to/file
```

Response: `{ path, name, type, size, mtime, mode }`

```
POST /api/fs/mkdir
```

Request: `{ "path": "/target/dir", "name": "new-folder" }`
Response: `{ path, name, type: "dir", size, mtime, mode }`

```
POST /api/fs/upload?path=/target/dir
```

Request: `application/octet-stream`, with the filename in the `X-Filename` header.
Response: `{ path, name, type, size, mtime, mode }`

```
GET /api/fs/download?path=/path/to/file
```

Response: binary file stream.

---

### WebSocket API

Connect: `ws://<host>:<port>/ws?token=<token>`

On connect, the server immediately sends: `{"type":"session_list","sessions":[...]}`

#### Client → Server

| Message type | Description | Parameters |
|-------------|-------------|------------|
| `start` | Create new session | `workingDir`, `name`, `resumeSessionId?`, `cols`, `rows` |
| `attach` | Attach to existing session | `sessionId` |
| `resize` | Resize terminal | `cols`, `rows` |
| `shell_start` | Create a non-persistent temporary shell | `cwd`, `cols`, `rows` |
| `shell_input` | Write to temporary shell stdin | `data` |
| `shell_resize` | Resize temporary shell | `cols`, `rows` |
| `shell_kill` | Close temporary shell | — |
| `kill` | Kill session PTY | `sessionId` |
| `delete` | Delete session record | `sessionId` |
| `rename` | Rename session | `sessionId`, `name` |
| Raw string | Keyboard input → PTY stdin | — |

#### Server → Client

| Message type | Description |
|-------------|-------------|
| Raw string | PTY output, written directly to xterm.js |
| `session_id` | Session created/attached, includes `sessionId`, `name` |
| `session_list` | Session list update (broadcast on any change) |
| `replay_start` / `replay_end` | Scrollback replay boundaries |
| `exit` | PTY process exited, includes `exitCode` |
| `error` | Error message |
| `shell_ready` | Temporary shell is ready, includes `cwd` |
| `shell_exit` | Temporary shell exited, includes `exitCode` |
| `shell_error` | Temporary shell error message |

---

### Unix Socket Protocol

Path: `~/.agenthub/sockets/<sessionId>.sock`

On connect, the server sends the scrollback buffer, then full-duplex PTY stream.

**OOB Resize Frame**:

```
\x00RESIZE:<cols>:<rows>\n
```

Example: `\x00RESIZE:120:30\n`

---

## License / 许可证

Apache 2.0 — see [LICENSE](../LICENSE)
