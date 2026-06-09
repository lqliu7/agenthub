"""LangGraph dynamic graph builder — constructs DAG from TestPlan stages."""

import time
from typing import Any

from langgraph.graph import StateGraph, END

from harness.orchestrator.state import HarnessState
from harness.orchestrator.nodes import execute_stage, McpClient
from harness.orchestrator.checkpoint import FileCheckpoint


def build_graph(test_plan: dict, mcp: McpClient = None) -> StateGraph:
    """Build a LangGraph from TestPlan stages and their dependencies."""
    stages = test_plan.get("stages", [])
    if not stages:
        raise ValueError("TestPlan has no stages")

    graph = StateGraph(HarnessState)
    stage_ids = {s["id"] for s in stages}
    mcp_client = mcp or McpClient()

    # Add a node for each stage
    for stage in stages:
        def make_node(s=stage):
            def node_fn(state: HarnessState) -> dict:
                # Skip if already completed (resume scenario)
                if s["id"] in (state.get("completed_stages") or []):
                    return {}

                state["current_stage"] = s["id"]
                result = execute_stage(s, state, mcp_client)

                # Update state
                stage_results = state.get("stage_results") or {}
                stage_results[s["id"]] = result
                updates = {"stage_results": stage_results, "current_stage": s["id"]}

                if result.get("status") == "ok":
                    updates["completed_stages"] = [s["id"]]
                    updates["report_sections"] = [{"stage_id": s["id"], "status": "PASS", **result}]
                else:
                    updates["errors"] = [{"stage_id": s["id"], **result}]
                    updates["report_sections"] = [{"stage_id": s["id"], "status": "FAIL", **result}]

                return updates
            return node_fn

        graph.add_node(stage["id"], make_node())

    # Add report node
    def report_node(state: HarnessState) -> dict:
        from harness.reporter import generate_report
        report = generate_report(state)
        return {"final_report": report}

    graph.add_node("generate_report", report_node)

    # Add edges based on depends_on
    roots = []
    for stage in stages:
        deps = stage.get("depends_on", [])
        if not deps:
            roots.append(stage["id"])
        else:
            for dep in deps:
                if dep in stage_ids:
                    graph.add_edge(dep, stage["id"])

    # Connect start to root nodes
    if len(roots) == 1:
        graph.set_entry_point(roots[0])
    else:
        # Multiple roots — need conditional entry
        graph.set_entry_point(roots[0])
        for root in roots[1:]:
            graph.add_edge("__start__", root)

    # Connect leaf nodes to report
    has_outgoing = set()
    for stage in stages:
        for dep in stage.get("depends_on", []):
            has_outgoing.add(dep)
    leaves = [s["id"] for s in stages if s["id"] not in has_outgoing]
    for leaf in leaves:
        graph.add_edge(leaf, "generate_report")

    graph.add_edge("generate_report", END)

    return graph.compile()


def run_harness(test_plan: dict, mcp: McpClient = None, run_id: str = None) -> dict:
    """Execute a full harness run."""
    run_id = run_id or f"run_{int(time.time())}"
    checkpoint = FileCheckpoint(run_id)

    # Initialize state
    initial_state = checkpoint.load() or {
        "test_plan": test_plan,
        "current_stage": "",
        "completed_stages": [],
        "stage_results": {},
        "environments": {},
        "report_sections": [],
        "errors": [],
        "network_config": {},
        "resolved_alternatives": {},
        "final_report": "",
    }

    graph = build_graph(test_plan, mcp)
    final_state = graph.invoke(initial_state)

    # Save final checkpoint
    checkpoint.save(final_state)
    return final_state
