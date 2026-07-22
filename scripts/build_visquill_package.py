#!/usr/bin/env python3
"""Synchronize the GitHub Pages-ready VisQuill deployment folder."""

from __future__ import annotations

import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "visquill-lens"

FILES = (
    "index.html",
    "viewer.js",
    "map.json",
    "data.json",
    "school-details.json",
    "enhancements.js",
    "enhancements.css",
)


def main() -> None:
    TARGET.mkdir(parents=True, exist_ok=True)
    for name in FILES:
        shutil.copy2(ROOT / name, TARGET / name)
    print(f"Synchronized enhanced VisQuill export at {TARGET}")


if __name__ == "__main__":
    main()
