"""Packaged single-page application hosting."""

from pathlib import Path

from fastapi import FastAPI

WEB_DIR = Path(__file__).parent
STATIC_DIR = WEB_DIR / "static"
SPA_DIR = STATIC_DIR / "spa"


def mount_spa(app: FastAPI) -> None:
    """Mount the packaged SPA when its production directory is present."""

    if SPA_DIR.exists():
        app.frontend("/", directory=SPA_DIR, fallback="index.html")
