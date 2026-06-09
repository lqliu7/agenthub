"""CLI entry point: python -m harness run/parse/resume"""

import argparse
import json
import sys
import yaml

from harness.parser.doc_parser import parse_document
from harness.orchestrator.graph import run_harness
from harness.orchestrator.nodes import McpClient


def main():
    parser = argparse.ArgumentParser(description="Model Test Harness")
    sub = parser.add_subparsers(dest="command")

    # parse command
    p_parse = sub.add_parser("parse", help="Parse test document into TestPlan")
    p_parse.add_argument("doc", help="Path to test document (.md)")
    p_parse.add_argument("--format", choices=["yaml", "json"], default="yaml")

    # run command
    p_run = sub.add_parser("run", help="Run full test harness")
    p_run.add_argument("doc", help="Path to test document (.md)")
    p_run.add_argument("--dry-run", action="store_true", help="Show plan without executing")
    p_run.add_argument("--run-id", help="Custom run ID")

    # resume command
    p_resume = sub.add_parser("resume", help="Resume from checkpoint")
    p_resume.add_argument("--run-id", required=True)

    args = parser.parse_args()

    if args.command == "parse":
        plan = parse_document(args.doc)
        if args.format == "yaml":
            print(yaml.dump(plan.model_dump(), allow_unicode=True, default_flow_style=False))
        else:
            print(json.dumps(plan.model_dump(), indent=2, ensure_ascii=False))

    elif args.command == "run":
        plan = parse_document(args.doc)
        if args.dry_run:
            print("=== DRY RUN — Execution Plan ===\n")
            print(f"Name: {plan.name}")
            print(f"Goal: {plan.goal}")
            print(f"\nEnvironments: {len(plan.environments)}")
            for env in plan.environments:
                print(f"  - {env.env_id} ({env.env_type.value})")
            print(f"\nStages ({len(plan.stages)}):")
            for s in plan.stages:
                deps = f" [depends: {', '.join(s.depends_on)}]" if s.depends_on else ""
                print(f"  {s.id} ({s.type.value}){deps}")
                for cmd in s.commands[:3]:
                    print(f"    $ {cmd}")
                if len(s.commands) > 3:
                    print(f"    ... +{len(s.commands)-3} more")
            if plan.stages:
                issues = [i for s in plan.stages for i in s.code_issues]
                if issues:
                    print(f"\nCode Issues Found: {len(issues)}")
                    for issue in issues:
                        print(f"  [{issue.type}] {issue.detail}")
            return

        # Full run
        mcp = McpClient()  # Would be injected with real MCP tools in production
        state = run_harness(plan.model_dump(), mcp=mcp, run_id=args.run_id)
        print(state.get("final_report", "No report generated"))

    elif args.command == "resume":
        from harness.orchestrator.checkpoint import FileCheckpoint
        cp = FileCheckpoint(args.run_id)
        if not cp.exists():
            print(f"No checkpoint found for run_id: {args.run_id}")
            sys.exit(1)
        state = cp.load()
        mcp = McpClient()
        final = run_harness(state["test_plan"], mcp=mcp, run_id=args.run_id)
        print(final.get("final_report", "No report generated"))

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
