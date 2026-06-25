# MCP Transport Switch to Streamable-HTTP — Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking. Follow TDD strictly: write failing test → run → see fail → minimal code → run → see pass → commit. Never write production code before its failing test.

**Goal:** Switch ahub-node MCP transport from SSE to streamable-http, refactor auth middleware to cover both transports, and update client config — eliminating the "Invalid request parameters" lockup after long-task interruption.

**Architecture:** Service side keeps FastMCP but flips `transport="streamable-http"`. Auth middleware injection is extracted to a `_wrap()` factory and applied to **both** `mcp.sse_app` and `mcp.streamable_http_app` so the auth boundary survives transport switches and partial rollback. Client `.mcp.json` switches `type: sse` → `type: http`, url `/sse` → `/mcp`.

**Tech Stack:** Python 3.10+, `mcp 1.27.2` (FastMCP), Starlette middleware, `httpx` (for tests), `pytest`.

**Reference Spec:** `/nexus/agenthub/docs/specs/2026-06-25-mcp-transport-switch-to-streamable-http.md`

---

## File Structure

- **Modify:** `/nexus/agenthub/ahub-node/server.py` — refactor auth injection; switch transport; update startup print.
- **Modify:** `/nexus/agenthub/.mcp.json` — `type: http`, url `/mcp`.
- **Modify:** `/nexus/agenthub/README.md` — sample `.mcp.json` block under 部署远程算力节点.
- **Create:** `/nexus/agenthub/ahub-node/tests/__init__.py` — empty package marker.
- **Create:** `/nexus/agenthub/ahub-node/tests/test_auth_middleware.py` — unit tests for the `_wrap` factory: auth applied to both SSE and streamable-http app, 401 / 200 branches, audit caller tagging.
- **Create:** `/nexus/agenthub/ahub-node/tests/test_transport_smoke.py` — integration smoke: boot server in-process, hit `/mcp` over HTTP with/without token.

Single responsibility per file:
- `server.py` already owns transport + auth wiring; the wrap factory stays adjacent to FastMCP construction.
- Tests split unit (middleware logic) vs integration (real ASGI server boot).

---

## Task 1: Lock current behavior with a failing test for dual-app auth

**Files:**
- Create: `/nexus/agenthub/ahub-node/tests/__init__.py`
- Create: `/nexus/agenthub/ahub-node/tests/test_auth_middleware.py`

- [ ] **Step 1: Create empty package marker**

```bash
mkdir -p /nexus/agenthub/ahub-node/tests
: > /nexus/agenthub/ahub-node/tests/__init__.py
```

- [ ] **Step 2: Write the failing test — auth attaches to BOTH sse_app and streamable_http_app**

Create `/nexus/agenthub/ahub-node/tests/test_auth_middleware.py`:

```python
"""Unit tests for ahub-node auth middleware injection.

Today's server.py monkey-patches only mcp.sse_app, which means a transport
switch silently disables auth. After refactor, _wrap must cover both
sse_app and streamable_http_app.
"""
import importlib
import sys
from pathlib import Path

import pytest

SERVER_DIR = Path("/nexus/agenthub/ahub-node")


@pytest.fixture
def server_module(monkeypatch, tmp_path):
    """Import a fresh server.py with a minimal config and a known token."""
    cfg = tmp_path / "config.yaml"
    cfg.write_text(
        "server:\n"
        "  host: 127.0.0.1\n"
        "  port: 9100\n"
        "auth:\n"
        "  tokens:\n"
        "    testtoken: tester\n"
        "security:\n"
        "  max_output_bytes: 1024\n"
        "  max_timeout_sec: 5\n"
        "  confirm_expire_sec: 60\n"
        "  blocked_patterns: []\n"
        "  confirm_patterns: []\n"
    )
    monkeypatch.setenv("AHUB_CONFIG", str(cfg))
    monkeypatch.syspath_prepend(str(SERVER_DIR))
    sys.modules.pop("server", None)
    return importlib.import_module("server")


def test_auth_middleware_attached_to_streamable_http_app(server_module):
    app = server_module.mcp.streamable_http_app()
    middleware_classes = [m.cls.__name__ for m in app.user_middleware]
    assert "_AuthMiddleware" in middleware_classes


def test_auth_middleware_attached_to_sse_app(server_module):
    app = server_module.mcp.sse_app()
    middleware_classes = [m.cls.__name__ for m in app.user_middleware]
    assert "_AuthMiddleware" in middleware_classes
```

- [ ] **Step 3: Run the test, see it fail**

```bash
cd /nexus/agenthub && pytest ahub-node/tests/test_auth_middleware.py -v
```

Expected: `test_auth_middleware_attached_to_streamable_http_app` FAILS (current code only wraps `sse_app`). The sse one may pass.

- [ ] **Step 4: Commit the failing test**

```bash
cd /nexus/agenthub && git add ahub-node/tests/__init__.py ahub-node/tests/test_auth_middleware.py
git commit -m "test(mcp): require auth middleware on both sse and streamable-http apps"
```

---

## Task 2: Refactor auth injection to a `_wrap` factory covering both apps

**Files:**
- Modify: `/nexus/agenthub/ahub-node/server.py` (lines around the current `_AuthMiddleware` block, replacing the `mcp.sse_app = _authed_sse_app` hack)

- [ ] **Step 1: Apply the refactor**

Replace this block in `server.py`:

```python
    # Wrap sse_app to inject auth middleware
    _original_sse_app = mcp.sse_app

    def _authed_sse_app(*args, **kwargs):
        app = _original_sse_app(*args, **kwargs)
        app.add_middleware(_AuthMiddleware)
        return app

    mcp.sse_app = _authed_sse_app
```

with:

```python
    # Inject auth middleware into BOTH transports so a transport switch
    # never silently disables authentication.
    def _wrap(app_factory):
        def _factory(*args, **kwargs):
            app = app_factory(*args, **kwargs)
            app.add_middleware(_AuthMiddleware)
            return app
        return _factory

    mcp.sse_app = _wrap(mcp.sse_app)
    mcp.streamable_http_app = _wrap(mcp.streamable_http_app)
```

- [ ] **Step 2: Re-run the unit tests, see them PASS**

```bash
cd /nexus/agenthub && pytest ahub-node/tests/test_auth_middleware.py -v
```

Expected: both tests pass.

- [ ] **Step 3: Commit**

```bash
cd /nexus/agenthub && git add ahub-node/server.py
git commit -m "fix(mcp): wrap auth middleware around both sse and streamable-http apps"
```

---

## Task 3: Integration smoke test for streamable-http transport

**Files:**
- Create: `/nexus/agenthub/ahub-node/tests/test_transport_smoke.py`

- [ ] **Step 1: Write the failing integration test**

```python
"""Integration smoke: boot the ASGI app for streamable-http and probe /mcp.

We do NOT run uvicorn; we ask Starlette's TestClient to drive the ASGI app
that FastMCP exposes. This avoids port flakiness and stays in-process.
"""
import importlib
import sys
from pathlib import Path

import pytest
from starlette.testclient import TestClient

SERVER_DIR = Path("/nexus/agenthub/ahub-node")


@pytest.fixture
def app(monkeypatch, tmp_path):
    cfg = tmp_path / "config.yaml"
    cfg.write_text(
        "server: {host: 127.0.0.1, port: 9100}\n"
        "auth: {tokens: {testtoken: tester}}\n"
        "security: {max_output_bytes: 1024, max_timeout_sec: 5,\n"
        "          confirm_expire_sec: 60, blocked_patterns: [], confirm_patterns: []}\n"
    )
    monkeypatch.setenv("AHUB_CONFIG", str(cfg))
    monkeypatch.syspath_prepend(str(SERVER_DIR))
    sys.modules.pop("server", None)
    server = importlib.import_module("server")
    return server.mcp.streamable_http_app()


def test_streamable_http_requires_auth(app):
    with TestClient(app) as client:
        # Any POST to /mcp without Bearer header must be rejected.
        resp = client.post("/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "ping"})
    assert resp.status_code == 401


def test_streamable_http_accepts_valid_token(app):
    with TestClient(app) as client:
        resp = client.post(
            "/mcp",
            headers={"Authorization": "Bearer testtoken",
                     "Accept": "application/json, text/event-stream"},
            json={"jsonrpc": "2.0", "id": 1, "method": "initialize",
                  "params": {"protocolVersion": "2025-03-26",
                             "capabilities": {},
                             "clientInfo": {"name": "pytest", "version": "0"}}},
        )
    # initialize must succeed (200 with JSON-RPC envelope or 202 streaming).
    assert resp.status_code in (200, 202), resp.text
```

- [ ] **Step 2: Run, see it fail**

```bash
cd /nexus/agenthub && pytest ahub-node/tests/test_transport_smoke.py -v
```

Expected: failure (e.g. 404 on `/mcp` if path differs in this FastMCP version) — but treat **any** non-pass as RED. The failure surfaces what we need.

If 404 appears, inspect the actual mount via:

```bash
python3 -c "from mcp.server.fastmcp import FastMCP; m=FastMCP('t'); app=m.streamable_http_app(); print([r.path for r in app.routes])"
```

- [ ] **Step 3: Adjust test path if FastMCP mounts elsewhere**

If routes show `/mcp/`, change the two `client.post("/mcp", ...)` to `"/mcp/"`. Re-run. The 401 test must show 401, the initialize test must show 200/202.

- [ ] **Step 4: Commit the integration test**

```bash
cd /nexus/agenthub && git add ahub-node/tests/test_transport_smoke.py
git commit -m "test(mcp): integration smoke for streamable-http /mcp endpoint"
```

---

## Task 4: Flip the production transport to streamable-http

**Files:**
- Modify: `/nexus/agenthub/ahub-node/server.py` (around `mcp.run(transport="sse")` and the startup banner)

- [ ] **Step 1: Add a failing test that the run transport defaults to streamable-http**

Append to `/nexus/agenthub/ahub-node/tests/test_auth_middleware.py`:

```python
def test_default_transport_is_streamable_http(server_module):
    # We expose the chosen transport via module-level constant for clarity.
    assert server_module.DEFAULT_TRANSPORT == "streamable-http"
```

Run:

```bash
cd /nexus/agenthub && pytest ahub-node/tests/test_auth_middleware.py::test_default_transport_is_streamable_http -v
```

Expected: FAIL (`DEFAULT_TRANSPORT` undefined).

- [ ] **Step 2: Apply the production change**

In `server.py`, add near the top of the file (after the `mcp = FastMCP(...)` block):

```python
DEFAULT_TRANSPORT = "streamable-http"
```

Replace the existing run line:

```python
mcp.run(transport="sse")
```

with:

```python
mcp.run(transport=DEFAULT_TRANSPORT)
```

Update the startup print so the suggested client config matches:

```python
print(f"\n  Claude Code .mcp.json:")
print(f'  "node": {{ "type": "http", "url": "http://{lan_ip}:{args.port}/mcp",')
print(f'             "headers": {{ "Authorization": "Bearer <token>" }} }}')
```

- [ ] **Step 3: Run the test, see it pass**

```bash
cd /nexus/agenthub && pytest ahub-node/tests/test_auth_middleware.py -v
```

Expected: all three pass.

- [ ] **Step 4: Commit**

```bash
cd /nexus/agenthub && git add ahub-node/server.py ahub-node/tests/test_auth_middleware.py
git commit -m "feat(mcp): default transport to streamable-http"
```

---

## Task 5: Update client .mcp.json

**Files:**
- Modify: `/nexus/agenthub/.mcp.json`

- [ ] **Step 1: Replace content**

Write `/nexus/agenthub/.mcp.json`:

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

- [ ] **Step 2: Verify JSON is valid**

```bash
python3 -c "import json,sys; json.load(open('/nexus/agenthub/.mcp.json'))" && echo OK
```

Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
cd /nexus/agenthub && git add .mcp.json
git commit -m "chore(mcp): switch client config to streamable-http transport"
```

---

## Task 6: Update README.md sample mcp.json

**Files:**
- Modify: `/nexus/agenthub/README.md` (the `### 部署远程算力节点` JSON block)

- [ ] **Step 1: Replace block**

Find:

```json
{
  "mcpServers": {
    "node-A100": {
      "type": "sse",
      "url": "http://<目标机器IP>:9100/sse"
    }
  }
}
```

Replace with:

```json
{
  "mcpServers": {
    "node-A100": {
      "type": "http",
      "url": "http://<目标机器IP>:9100/mcp",
      "headers": {
        "Authorization": "Bearer <token>"
      }
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd /nexus/agenthub && git add README.md
git commit -m "docs(mcp): update README sample config to streamable-http"
```

---

## Task 7: Live validation against the running node (manual gate)

**Files:** none (operational verification)

- [ ] **Step 1: Restart ahub-node on the target host**

```bash
# on the GPU host (e.g. node-A100-594):
pkill -f "ahub-node/server.py" || true
nohup python3 /path/to/agenthub/ahub-node/server.py --port 9100 \
      > /tmp/ahub-node.log 2>&1 &
tail -n 20 /tmp/ahub-node.log
```

Expected: log shows `Listening: http://...:9100` and a `.mcp.json` snippet with `type: http`, `url: .../mcp`.

- [ ] **Step 2: From the AgentHub controller machine, in Claude Code**

Run `/mcp` to list MCP servers. Confirm `node-A100-594` is **connected** under HTTP transport.

- [ ] **Step 3: Treatment-of-root-cause test**

Invoke `container_exec` with a 30-second sleep, abort it after 5s (Ctrl-C). Without restarting ahub-node, immediately invoke `system_info`.

Expected: `system_info` returns successfully. **No** `MCP error -32602: Invalid request parameters`.

- [ ] **Step 4: Smoke each tool once**

`system_info` → `shell_exec("uname -a")` → `container_manage(action="list")` → `file_read` on a known file → `file_write` to /tmp → `container_exec` echo → `transfer_file` round trip.

- [ ] **Step 5: Auth regression**

Temporarily remove `headers` from `.mcp.json`, reload MCP. Expected: connection refused / 401. Restore.

- [ ] **Step 6: Final commit if any docs needed amending**

```bash
cd /nexus/agenthub && git status
# If clean, push:
git push
```

---

## Self-Review

- **Spec coverage**: §1 root cause → Task 4 (transport flip). §2.1 goal 1 (no-restart) → Task 7 step 3. §2.1 goal 2 (auth/audit preserved) → Tasks 1–2 + Task 7 step 5. §2.1 goal 3 (tool signatures intact) → Task 7 step 4. §2.1 goal 4 (hack removed) → Task 2. §4.1.1 dual-app wrap → Tasks 1–2. §4.1.2 transport switch → Task 4. §4.2 client config → Task 5. §4.3 doc sync → Task 6. §6.2 治本验证 → Task 7. §8 回退 → unchanged code path; reverting `DEFAULT_TRANSPORT` + `.mcp.json` is sufficient because auth is dual-wrapped.
- **Placeholder scan**: none — every step shows exact commands or code.
- **Type/name consistency**: `_wrap`, `_AuthMiddleware`, `DEFAULT_TRANSPORT`, `streamable_http_app` used identically across tasks.
