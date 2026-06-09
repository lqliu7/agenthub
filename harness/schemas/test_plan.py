"""TestPlan Pydantic schema — the structured intermediate representation."""

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class StageType(str, Enum):
    container_create = "container_create"
    venv_create = "venv_create"
    install = "install"
    service_start = "service_start"
    test_run = "test_run"
    collect = "collect"
    custom = "custom"


class EnvType(str, Enum):
    docker = "docker"
    venv = "venv"


class DockerConfig(BaseModel):
    image: str = ""
    gpu: bool = False
    shm_size: str = "16g"
    volumes: list[str] = Field(default_factory=list)
    env_vars: dict[str, str] = Field(default_factory=dict)


class VenvConfig(BaseModel):
    python: str = "python3"
    path: str = ""


class Environment(BaseModel):
    env_id: str
    env_type: EnvType
    docker: Optional[DockerConfig] = None
    venv: Optional[VenvConfig] = None


class Alternative(BaseModel):
    condition: str
    commands: list[str]


class CodeIssue(BaseModel):
    type: str  # missing_import, placeholder_path, syntax_error
    detail: str
    auto_fix: bool = False
    fix_command: str = ""


class Stage(BaseModel):
    id: str
    type: StageType
    env_id: str = ""
    depends_on: list[str] = Field(default_factory=list)
    commands: list[str] = Field(default_factory=list)
    alternatives: list[Alternative] = Field(default_factory=list)
    verify: Optional[str] = None
    health_check: Optional[str] = None
    timeout: int = 3600
    code_issues: list[CodeIssue] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict)


class HardwareEntry(BaseModel):
    name: str
    mcp_node: Optional[str] = None
    cuda_version: str = ""


class Requirements(BaseModel):
    cuda: str = ""
    gpu_memory_gb: int = 0
    extra: dict = Field(default_factory=dict)


class TestPlan(BaseModel):
    name: str
    goal: str
    source_doc: str
    requirements: Requirements = Field(default_factory=Requirements)
    hardware_matrix: list[HardwareEntry] = Field(default_factory=list)
    environments: list[Environment] = Field(default_factory=list)
    stages: list[Stage] = Field(default_factory=list)
    resolved_params: dict = Field(default_factory=dict)
