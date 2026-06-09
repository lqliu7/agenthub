"""Error handler — matches stderr against knowledge.yaml patterns."""

import re
from pathlib import Path
from typing import Optional

import yaml


class ErrorMatch:
    def __init__(self, level: str, solution: Optional[str], params: dict = None, pattern: str = ""):
        self.level = level
        self.solution = solution
        self.params = params or {}
        self.pattern = pattern


class ErrorHandler:
    def __init__(self, knowledge_path: str = None):
        if knowledge_path is None:
            knowledge_path = str(Path(__file__).parent / "knowledge.yaml")
        with open(knowledge_path) as f:
            data = yaml.safe_load(f)
        self.rules = data.get("known_issues", [])
        self._compiled = [(re.compile(r["pattern"], re.IGNORECASE), r) for r in self.rules]

    def classify(self, stderr: str) -> ErrorMatch:
        """Match stderr against known patterns. Returns ErrorMatch with level and solution."""
        for regex, rule in self._compiled:
            if regex.search(stderr):
                return ErrorMatch(
                    level=rule["level"],
                    solution=rule.get("solution"),
                    params=rule.get("params", {}),
                    pattern=rule["pattern"],
                )
        return ErrorMatch(level="L3", solution=None)
