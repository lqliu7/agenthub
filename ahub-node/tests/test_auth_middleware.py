"""Unit tests for ahub-node auth middleware injection.

The current server.py monkey-patches only mcp.sse_app to attach
_AuthMiddleware. If we ever switch transports, auth silently disappears.
After the refactor, the _wrap factory must cover BOTH transports.
"""
import importlib
import sys
from pathlib import Path

import pytest

SERVER_DIR = Path("/nexus/agenthub/ahub-node")


@pytest.fixture
def server_module(monkeypatch, tmp_path):
    """Import a fresh server.py with a minimal valid config."""
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
    return importlib.import_module("server")


def test_auth_middleware_attached_to_streamable_http_app(server_module):
    app = server_module.mcp.streamable_http_app()
    middleware_classes = [m.cls.__name__ for m in app.user_middleware]
    assert "_AuthMiddleware" in middleware_classes


def test_auth_middleware_attached_to_sse_app(server_module):
    app = server_module.mcp.sse_app()
    middleware_classes = [m.cls.__name__ for m in app.user_middleware]
    assert "_AuthMiddleware" in middleware_classes


def test_default_transport_is_streamable_http(server_module):
    assert server_module.DEFAULT_TRANSPORT == "streamable-http"
