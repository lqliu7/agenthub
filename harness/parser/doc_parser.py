"""Parse test documents (.md) into structured TestPlan."""

import re
from pathlib import Path

from harness.schemas.test_plan import (
    TestPlan, Stage, StageType, Environment, EnvType,
    DockerConfig, VenvConfig, HardwareEntry, Requirements,
    Alternative, CodeIssue,
)


def parse_document(doc_path: str) -> TestPlan:
    """Parse a test document into a TestPlan. Uses heuristic extraction."""
    text = Path(doc_path).read_text(encoding="utf-8")
    lines = text.split("\n")

    name = _extract_title(lines)
    goal = _extract_goal(lines)
    hardware = _extract_hardware(lines)
    requirements = _extract_requirements(lines)
    environments, stages = _extract_stages(lines, text)
    code_issues = _check_code_issues(stages)

    return TestPlan(
        name=name,
        goal=goal,
        source_doc=doc_path,
        requirements=requirements,
        hardware_matrix=hardware,
        environments=environments,
        stages=stages,
    )


def _extract_title(lines: list[str]) -> str:
    for line in lines[:5]:
        if line.startswith("#"):
            return line.lstrip("# ").strip()
    return "Unnamed Test"


def _extract_goal(lines: list[str]) -> str:
    for i, line in enumerate(lines):
        if "目标" in line or "goal" in line.lower():
            # Next non-empty line is the goal
            for j in range(i + 1, min(i + 5, len(lines))):
                if lines[j].strip():
                    return lines[j].strip()
    return ""


def _extract_hardware(lines: list[str]) -> list[HardwareEntry]:
    hardware = []
    in_hardware = False
    for line in lines:
        if "推理硬件" in line or "测试硬件" in line:
            in_hardware = True
            continue
        if in_hardware:
            if line.strip().startswith("*") or line.strip().startswith("-"):
                name = re.sub(r"[*\-]\s*", "", line.strip())
                name = re.split(r"[（(]", name)[0].strip()
                if name:
                    hardware.append(HardwareEntry(name=name))
            elif line.strip() and not line.strip().startswith("*") and not line.strip().startswith("-"):
                if hardware:
                    break
    return hardware


def _extract_requirements(lines: list[str]) -> Requirements:
    cuda = ""
    for line in lines:
        m = re.search(r"CUDA\s*([\d.>=<]+)", line, re.IGNORECASE)
        if m:
            cuda = m.group(1)
            break
    return Requirements(cuda=cuda)


def _extract_stages(lines: list[str], full_text: str) -> tuple[list[Environment], list[Stage]]:
    """Extract environments and stages from document steps."""
    environments = []
    stages = []

    # Find step sections
    step_pattern = re.compile(r"^#+\s*步骤[一二三四五六七八九十\d]+[：:](.+)", re.MULTILINE)
    steps = list(step_pattern.finditer(full_text))

    # Detect if docker is needed
    if "docker" in full_text.lower():
        environments.append(Environment(
            env_id="main_container",
            env_type=EnvType.docker,
            docker=DockerConfig(gpu=True),
        ))
        stages.append(Stage(
            id="create_container",
            type=StageType.container_create,
            env_id="main_container",
        ))

    # Detect if venv is needed
    if "虚拟环境" in full_text or "venv" in full_text.lower():
        environments.append(Environment(
            env_id="venv_env",
            env_type=EnvType.venv,
            venv=VenvConfig(path="/workspace/venv"),
        ))
        stages.append(Stage(
            id="create_venv",
            type=StageType.venv_create,
            env_id="venv_env",
            depends_on=["create_container"] if "main_container" in [e.env_id for e in environments] else [],
        ))

    # Extract commands from code blocks
    code_blocks = re.findall(r"```[^\n]*\n(.*?)```", full_text, re.DOTALL)
    inline_commands = re.findall(r"^(?:pip|python|wget|tar|vllm|sed)\s+.+$", full_text, re.MULTILINE)
    all_commands = []
    for block in code_blocks:
        for line in block.strip().split("\n"):
            cmd = line.strip()
            if cmd and not cmd.startswith("#"):
                all_commands.append(cmd)
    all_commands.extend(inline_commands)

    # Classify commands into stages
    install_cmds = []
    service_cmds = []
    test_cmds = []
    download_cmds = []
    collect_cmds = []

    for cmd in all_commands:
        if cmd.startswith("pip ") or cmd.startswith("python -m pip"):
            install_cmds.append(cmd)
        elif "serve" in cmd or "server" in cmd:
            service_cmds.append(cmd)
        elif cmd.startswith("wget ") or cmd.startswith("tar "):
            download_cmds.append(cmd)
        elif "predict" in cmd or "test" in cmd.lower() or "run" in cmd.lower():
            test_cmds.append(cmd)
        elif cmd.startswith("tar -czf"):
            collect_cmds.append(cmd)

    # Build install stage
    if install_cmds:
        # Separate alternatives (commands from comments with version conditions)
        main_cmds, alts = _separate_alternatives(install_cmds, full_text)
        deps = [s.id for s in stages if s.type in (StageType.container_create, StageType.venv_create)]
        stages.append(Stage(
            id="install_deps",
            type=StageType.install,
            env_id=environments[0].env_id if environments else "",
            depends_on=deps,
            commands=main_cmds,
            alternatives=alts,
            verify="python -c 'import vllm; print(vllm.__version__)'",
        ))

    # Build download stage
    if download_cmds:
        stages.append(Stage(
            id="download_data",
            type=StageType.install,
            env_id=environments[0].env_id if environments else "",
            depends_on=[s.id for s in stages if s.type == StageType.container_create][:1],
            commands=download_cmds,
        ))

    # Build service stage
    if service_cmds:
        stages.append(Stage(
            id="start_service",
            type=StageType.service_start,
            env_id=environments[0].env_id if environments else "",
            depends_on=["install_deps"],
            commands=service_cmds[:1],
            health_check="curl -s http://127.0.0.1:8118/health",
            timeout=120,
        ))

    # Build test stages
    if test_cmds:
        deps = []
        if service_cmds:
            deps.append("start_service")
        if download_cmds:
            deps.append("download_data")
        stages.append(Stage(
            id="run_tests",
            type=StageType.test_run,
            env_id=environments[0].env_id if environments else "",
            depends_on=deps or ["install_deps"],
            commands=test_cmds,
            timeout=7200,
        ))

    # Build collect stage
    if collect_cmds:
        stages.append(Stage(
            id="collect_results",
            type=StageType.collect,
            env_id=environments[0].env_id if environments else "",
            depends_on=["run_tests"] if test_cmds else [],
            commands=collect_cmds,
        ))

    return environments, stages


def _separate_alternatives(commands: list[str], full_text: str) -> tuple[list[str], list[Alternative]]:
    """Separate main commands from conditional alternatives."""
    main = []
    alts = []
    # Check commands for cu129 pattern
    cu129_cmds = [c for c in commands if "cu129" in c]
    main = [c for c in commands if "cu129" not in c]

    # Also scan full text for commented-out alternative commands
    commented_cu129 = re.findall(r"^#\s*(pip install\s+.+cu129.+)$", full_text, re.MULTILINE)
    cu129_cmds.extend(commented_cu129)

    if cu129_cmds:
        alts.append(Alternative(condition="cuda_version < 13.0", commands=cu129_cmds))
    return main, alts


def _check_code_issues(stages: list[Stage]) -> list[CodeIssue]:
    """Check for common code issues in stage commands."""
    issues = []
    for stage in stages:
        for cmd in stage.commands:
            if "/path/to/" in cmd:
                stage.code_issues.append(CodeIssue(
                    type="placeholder_path",
                    detail=f"Placeholder path in: {cmd}",
                    auto_fix=False,
                ))
    return issues
