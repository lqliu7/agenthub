"""Integration smoke: drive the streamable-http ASGI app via TestClient.

We avoid uvicorn / sockets to keep the test fast and deterministic.
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
        "server:\n"
        "  host: 127.0.0.1\n"
        "  port: 9100\n"
        "  tokens:\n"
        "    - token: testtoken\n"
        "      name: tester\n"
        "security:\n"
        "  max_output_bytes: 1024\n"
        "  max_timeout: 5\n"
        "  confirm_expire_seconds: 60\n"
        "  blocked_paths: []\n"
        "  blocked_patterns: []\n"
        "  confirm_patterns: []\n"
    )
    monkeypatch.setenv("AHUB_NODE_CONFIG", str(cfg))
    monkeypatch.syspath_prepend(str(SERVER_DIR))
    sys.modules.pop("server", None)
    server = importlib.import_module("server")
    return server.mcp.streamable_http_app()


def test_streamable_http_requires_auth(app):
    with TestClient(app) as client:
        resp = client.post(
            "/mcp",
            headers={"Accept": "application/json, text/event-stream"},
            json={"jsonrpc": "2.0", "id": 1, "method": "ping"},
        )
    assert resp.status_code == 401, resp.text


def test_streamable_http_accepts_valid_token(app):
    with TestClient(app) as client:
        resp = client.post(
            "/mcp",
            headers={
                "Authorization": "Bearer testtoken",
                "Accept": "application/json, text/event-stream",
            },
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2025-03-26",
                    "capabilities": {},
                    "clientInfo": {"name": "pytest", "version": "0"},
                },
            },
        )
    assert resp.status_code in (200, 202), resp.text
