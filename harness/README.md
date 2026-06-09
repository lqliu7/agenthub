# Model Test Harness

基于提测文档自动化执行模型测试的约束引擎。解析提测文档 → 生成执行计划 → 通过 MCP 操作远程机器 → 逐步执行 → 产出报告。

## 核心能力

| 能力 | 说明 |
|------|------|
| 文档解析 | 提测文档(.md) → 结构化 TestPlan（Pydantic 验证） |
| 动态编排 | TestPlan stages → LangGraph DAG，按依赖顺序执行 |
| 多环境支持 | Docker 容器 + Python venv，同一测试可用多个隔离环境 |
| GPU 智能选择 | 执行前自动检测空闲 GPU，锁定后全程 CUDA_VISIBLE_DEVICES 绑定 |
| 代理自动切换 | pip/hf 下载失败时自动切换代理(agent.baidu.com:8188)/镜像源重试 |
| 模型下载 | 检测到模型路径占位符时自动 hf download，支持代理切换 |
| 三级错误处理 | L1 自动修复 / L2 尝试一次 / L3 停止保留环境 |
| 断点恢复 | checkpoint 每步持久化，失败后可 resume 继续 |
| 阶段性报告 | 执行到哪报告到哪，失败也有完整报告 |
| 资源监控 | 测试期间后台 nvidia-smi dmon 记录 GPU 使用 |
| 环境保留 | 容器/venv 执行后不删除，可再进入排查 |

## 为什么能约束 Agent

Harness 的约束**不依赖 agent 自觉**，而是通过 6 层递进机制：

```
层级          载体                    约束方式         能否被 agent 绕过
─────────────────────────────────────────────────────────────────────
第 1 层   MCP 安全策略 (server.py)    服务端拦截        不能
第 2 层   schemas/test_plan.py       Pydantic 验证     不能（代码强制）
第 3 层   orchestrator/nodes.py      执行策略硬编码     不能（代码强制）
第 4 层   config.yaml                参数约束          不能（代码读取）
第 5 层   knowledge.yaml             错误分级策略       不能（代码匹配）
第 6 层   skill.md + CLAUDE.md       prompt 引导       理论上能，但无安全影响
```

**关键设计**：agent 只负责"启动 harness"，启动后所有决策由代码完成。service_start 必须 nohup、install 必须走代理策略、L3 必须停止 — 这些是 nodes.py 硬编码的，不是 prompt 建议。

## 文件结构

```
harness/
├── __init__.py
├── __main__.py              # CLI: python -m harness parse/run/resume
├── config.yaml              # MCP 连接 + 代理/镜像 + 超时参数
├── knowledge.yaml           # 已知错误模式 → 分级 → 修复方案（可手动扩充）
├── skill.md                 # Agent 行为约束（prompt 层）
├── requirements.txt         # langgraph, pyyaml
├── error_handler.py         # stderr 正则匹配 knowledge.yaml → L1/L2/L3
├── reporter.py              # Jinja2 报告渲染
├── schemas/
│   └── test_plan.py         # TestPlan Pydantic 模型（结构校验门槛）
├── parser/
│   └── doc_parser.py        # 提测文档 → TestPlan 提取
├── orchestrator/
│   ├── state.py             # HarnessState（LangGraph 共享状态）
│   ├── checkpoint.py        # JSON 文件 checkpoint（断点恢复）
│   ├── nodes.py             # 各 stage type 执行函数 + McpClient + GPU 选择
│   └── graph.py             # LangGraph 动态图构建 + run_harness 入口
├── templates/
│   └── report.md            # 报告 Jinja2 模板
└── tests/                   # 11 个测试（schemas + parser + error_handler）
```

## 各 Stage Type 的执行策略（nodes.py 硬编码）

| type | 策略 | 不可跳过的约束 |
|------|------|--------------|
| `container_create` | 调 MCP container_manage | 创建前自动选空闲 GPU |
| `venv_create` | python -m venv | 目录保留不删除 |
| `install` | pip/hf install + 代理切换 | 失败自动 export proxy=agent.baidu.com:8188 重试 |
| `service_start` | nohup 后台 + health_check 轮询 | 必须健康检查通过才进下一步 |
| `test_run` | 前台执行 + timeout | 启动 GPU 监控 + CUDA_VISIBLE_DEVICES 锁定 |
| `collect` | tar 打包 + 文件数校验 | 校验产出物完整性 |
| `custom` | 按命令顺序执行 | 兜底，无特殊策略 |

## 交互流程

```
用户: "按照 xxx.md 执行提测"
  │
  ├─ CLAUDE.md 规则: "必须通过 harness 编排引擎执行"
  │
  ▼
python -m harness run xxx.md
  │
  ├─ parser → TestPlan (Pydantic 验证)
  ├─ McpClient.system_info() → 匹配硬件 + 选空闲 GPU
  ├─ build_graph(TestPlan) → LangGraph DAG
  │
  ▼ 逐 Node 执行
  Node → nodes.py 执行 → MCP 工具 → 远程机器
    │
    ├─ 成功 → checkpoint → 下一个 Node
    └─ 失败 → error_handler.classify(stderr)
              ├─ L1: 自动修复重试（换代理/镜像/hf download）
              ├─ L2: 尝试一次
              └─ L3: 停止 → 保留环境 → 生成部分报告
  │
  ▼
generate_report → markdown 报告（含监控数据 + 异常汇总 + 环境保留信息）
```

## 使用

```bash
# 解析提测文档
python -m harness parse ocrvl_vllm_acc.md

# 预览执行计划（不真正执行）
python -m harness run ocrvl_vllm_acc.md --dry-run

# 执行
python -m harness run ocrvl_vllm_acc.md

# 从断点恢复
python -m harness resume --run-id run_1749465600
```

## 前置条件

- 远程机器启动 ahub-node 服务（`python server.py`）
- `config.yaml` 中 mcp.url 和 mcp.token 配置正确
- `pip install -r harness/requirements.txt`

## 扩展

- **添加先验知识**：编辑 `knowledge.yaml`，加入 pattern + level + solution
- **添加新代理/镜像**：编辑 `config.yaml` 的 network 段
- **添加新 stage type**：在 `nodes.py` 的 EXECUTORS dict 中注册新函数
- **新 MCP 节点**：修改 `config.yaml` 的 mcp.url/token
