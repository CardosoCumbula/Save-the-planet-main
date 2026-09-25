"""Pytest bootstrap: make the ai-engine package importable and skip the venv."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))