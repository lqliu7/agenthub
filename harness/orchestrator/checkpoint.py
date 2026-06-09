"""File-based checkpoint for LangGraph."""

import json
import time
from pathlib import Path
from typing import Optional

CHECKPOINT_DIR = Path(__file__).parent.parent / ".checkpoints"


class FileCheckpoint:
    """Simple JSON file checkpoint — one file per run."""

    def __init__(self, run_id: str):
        self.run_id = run_id
        self.dir = CHECKPOINT_DIR / run_id
        self.dir.mkdir(parents=True, exist_ok=True)
        self.path = self.dir / "state.json"

    def save(self, state: dict):
        data = {"ts": time.strftime("%Y-%m-%dT%H:%M:%S"), "state": state}
        self.path.write_text(json.dumps(data, ensure_ascii=False, indent=2, default=str))

    def load(self) -> Optional[dict]:
        if self.path.exists():
            data = json.loads(self.path.read_text())
            return data.get("state")
        return None

    def exists(self) -> bool:
        return self.path.exists()
