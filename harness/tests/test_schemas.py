"""Tests for schemas validation."""

import pytest
from harness.schemas.test_plan import TestPlan, Stage, StageType, Environment, EnvType, DockerConfig


def test_minimal_test_plan():
    plan = TestPlan(name="test", goal="test goal", source_doc="test.md")
    assert plan.name == "test"
    assert plan.stages == []


def test_full_test_plan():
    plan = TestPlan(
        name="OCR VL Test",
        goal="Precision alignment test",
        source_doc="ocrvl_vllm_acc.md",
        environments=[
            Environment(env_id="main", env_type=EnvType.docker, docker=DockerConfig(image="python:3.10", gpu=True))
        ],
        stages=[
            Stage(id="create", type=StageType.container_create, env_id="main"),
            Stage(id="install", type=StageType.install, env_id="main", depends_on=["create"],
                  commands=["pip install vllm"], verify="python -c 'import vllm'"),
            Stage(id="serve", type=StageType.service_start, env_id="main", depends_on=["install"],
                  commands=["vllm serve model"], health_check="curl localhost:8118/health", timeout=120),
        ],
    )
    assert len(plan.stages) == 3
    assert plan.stages[2].health_check is not None


def test_stage_type_custom():
    stage = Stage(id="custom_step", type=StageType.custom, commands=["echo hello"])
    assert stage.type == StageType.custom
