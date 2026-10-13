"""Catch-all Vercel entry point for FastAPI routes."""

import sys
from pathlib import Path
from urllib.parse import parse_qs


ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.app.main import app as fastapi_app


async def app(scope, receive, send):
    if scope["type"] == "http":
        query = parse_qs(scope.get("query_string", b"").decode())
        route = query.get("...path", [""])[0]
        if route:
            scope = dict(scope)
            scope["path"] = f"/{route}"
            scope["raw_path"] = scope["path"].encode()
    await fastapi_app(scope, receive, send)


__all__ = ["app"]
