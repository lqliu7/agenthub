"""Tests for document parser."""

import pytest
from pathlib import Path

from harness.parser.doc_parser import parse_document


SAMPLE_DOC = Path(__file__).parent.parent.parent / "ocrvl_vllm_acc.md"


@pytest.mark.skipif(not SAMPLE_DOC.exists(), reason="Sample doc not found")
def test_parse_ocrvl_doc():
    plan = parse_document(str(SAMPLE_DOC))
    assert plan.name != ""
    assert plan.goal != ""
    assert len(plan.stages) > 0
    assert len(plan.hardware_matrix) > 0
    # Should detect docker usage
    assert any(e.env_type.value == "docker" for e in plan.environments)


@pytest.mark.skipif(not SAMPLE_DOC.exists(), reason="Sample doc not found")
def test_hardware_extraction():
    plan = parse_document(str(SAMPLE_DOC))
    names = [h.name for h in plan.hardware_matrix]
    assert "A100" in names


@pytest.mark.skipif(not SAMPLE_DOC.exists(), reason="Sample doc not found")
def test_alternatives_detected():
    plan = parse_document(str(SAMPLE_DOC))
    # Should detect cu129 alternatives
    install_stages = [s for s in plan.stages if s.type.value == "install"]
    has_alts = any(s.alternatives for s in install_stages)
    assert has_alts, "Should detect cu129 alternative commands"
