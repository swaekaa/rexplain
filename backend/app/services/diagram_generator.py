"""
diagram_generator.py
--------------------
Generates a professional clustered architecture diagram using Graphviz.

Phase 10 upgrade:
  - Subgraph clusters: Frontend / Backend / Database / Infra
  - Detects actual subdirectories to populate each cluster
  - Falls back to framework-name nodes when no folder info available
  - Dark-themed Graphviz attributes for contrast
"""

from __future__ import annotations

import os
import base64
from graphviz import Digraph


# ---------------------------------------------------------------------------
# Cluster definitions
# ---------------------------------------------------------------------------

# Each cluster maps to:
#   label    — human-readable title shown in the diagram
#   color    — cluster border / label colour (Graphviz named or hex)
#   bg       — cluster fill colour
#   folders  — set of folder names that belong to this cluster

_CLUSTERS = [
    {
        "id":      "cluster_frontend",
        "label":   "Frontend",
        "color":   "#bc8cff",
        "bg":      "#1a0d2e",
        "folders": {"components", "pages", "hooks", "store", "context",
                    "assets", "styles", "layouts", "public", "src",
                    "client", "ui", "views", "lib", "types", "routes_fe"},
        "fw_key":  "frontend_framework",
    },
    {
        "id":      "cluster_backend",
        "label":   "Backend",
        "color":   "#388bfd",
        "bg":      "#0d1a2e",
        "folders": {"routes", "route", "controllers", "services", "service",
                    "middleware", "api", "core", "handlers", "tasks",
                    "workers", "jobs", "utils", "helpers", "schemas",
                    "validators", "events", "graphql", "grpc", "cmd",
                    "internal", "pkg", "server"},
        "fw_key":  "backend_framework",
    },
    {
        "id":      "cluster_database",
        "label":   "Database",
        "color":   "#3fb950",
        "bg":      "#0d1f0d",
        "folders": {"models", "model", "repositories", "repository",
                    "migrations", "alembic", "prisma", "db", "database",
                    "data", "fixtures", "cache"},
        "fw_key":  "database",
    },
    {
        "id":      "cluster_infra",
        "label":   "Infrastructure",
        "color":   "#ffa657",
        "bg":      "#1f150d",
        "folders": {".github", "workflows", "docker", "k8s", "terraform",
                    "ansible", "scripts", "bin", "build", "dist",
                    "notebooks", "docs", "doc", "examples"},
        "fw_key":  None,
    },
]

# Typical infra signal files
_INFRA_FILES = {
    "Dockerfile", "docker-compose.yml", "docker-compose.yaml",
    ".github/workflows", "terraform", "ansible", "Makefile",
    "fly.toml", "render.yaml", "heroku.yml", "netlify.toml",
    "vercel.json", "serverless.yml",
}


def _detect_present_folders(paths: list[str]) -> set[str]:
    """Return the set of unique top-level folder names from Tree paths."""
    folders: set[str] = set()
    for path in paths:
        parts = path.split("/")
        if len(parts) > 1:
            folders.add(parts[0].lower())
    return folders


def generate_architecture_diagram(
    architecture: dict,
    repo_name: str,
    *,
    # Optional enrichment data from Phase 10
    file_tree_paths: list[str] | None = None,
) -> str:
    """
    Render a clustered Graphviz diagram and return a base64 PNG data URI.

    Parameters
    ----------
    architecture       : dict with 'nodes' and 'edges' (from architecture_builder)
    repo_name          : used for temp file naming
    file_tree_paths    : full list of repo paths from GitHub Trees API (optional).
                         When provided, clusters are populated from real folder names.
    """
    base_dir = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "../../../repos")
    )

    output_file = os.path.join(base_dir, f"{repo_name}_architecture")

    # ── Global graph attributes ──────────────────────────────────────────────
    dot = Digraph(
        comment=f"{repo_name} Architecture",
        format="png",
    )
    dot.attr(
        rankdir="LR",
        bgcolor="#0d1117",
        fontname="Helvetica Neue,Helvetica,Arial,sans-serif",
        fontsize="13",
        fontcolor="#e6edf3",
        splines="ortho",
        nodesep="0.6",
        ranksep="1.2",
        pad="0.5",
    )
    dot.attr("node",
        shape="box",
        style="filled,rounded",
        fillcolor="#161b22",
        fontcolor="#e6edf3",
        fontname="Helvetica Neue,Helvetica,Arial,sans-serif",
        fontsize="12",
        color="#30363d",
        margin="0.20,0.10",
    )
    dot.attr("edge",
        color="#484f58",
        arrowsize="0.7",
        penwidth="1.2",
    )

    # ── Determine which clusters have content ────────────────────────────────
    present_folders: set[str] = set()
    if file_tree_paths:
        present_folders = _detect_present_folders(file_tree_paths)

    # Pull detected framework names directly from the architecture dict.
    # architecture_builder stores them as fe_fw_name / be_fw_name / database_name.
    fe_name: str | None = architecture.get("fe_fw_name") or architecture.get("frontend_framework_name")
    be_name: str | None = architecture.get("be_fw_name") or architecture.get("backend_framework_name")
    db_name: str | None = architecture.get("db_fw_name") or architecture.get("database_name")

    # Map cluster id → its detected framework name (None if not detected)
    _cluster_fw: dict[str, str | None] = {
        "cluster_frontend":  fe_name,
        "cluster_backend":   be_name,
        "cluster_database":  db_name,
        "cluster_infra":     None,
    }

    cluster_entry_nodes: dict[str, str] = {}   # cluster_id → first node name (for edges)
    cluster_exit_nodes:  dict[str, str] = {}   # cluster_id → last node name (for edges)

    for cluster in _CLUSTERS:
        cid       = cluster["id"]
        clabel    = cluster["label"]
        ccolor    = cluster["color"]
        cbg       = cluster["bg"]
        c_folders = cluster["folders"]
        fw_key    = cluster["fw_key"]

        # ── Collect items for this cluster ───────────────────────────────────
        items: list[str] = []

        # 1. Real folder names that belong here
        for f in sorted(present_folders & c_folders):
            items.append(f)

        # 2. Framework name for this specific cluster (only if detected)
        fw_name = _cluster_fw.get(cid)  # None when not detected
        if fw_name and fw_name not in items:
            items.insert(0, fw_name)

        # 3. No further fallback — if a framework wasn't detected we leave
        #    this cluster empty so it is skipped cleanly (see `continue` below).

        # 4. Infra cluster special-case: check file list for Dockerfile etc.
        if cid == "cluster_infra" and file_tree_paths:
            infra_found = [
                p.split("/")[-1]
                for p in file_tree_paths
                if any(sig in p for sig in _INFRA_FILES)
                and p.split("/")[-1] not in items
            ]
            items.extend(infra_found[:5])   # cap at 5

        if not items:
            continue   # skip empty clusters

        # ── Build subgraph ───────────────────────────────────────────────────
        with dot.subgraph(name=cid) as c:
            c.attr(
                label=clabel,
                style="filled,rounded",
                color=ccolor,
                fillcolor=cbg,
                fontcolor=ccolor,
                fontsize="14",
                fontname="Helvetica Neue,Helvetica,Arial,sans-serif",
                penwidth="2.0",
            )
            prev_node = None
            for item in items:
                node_id = f"{cid}_{item.replace(' ', '_').replace('/', '_')}"
                c.node(
                    node_id,
                    label=item,
                    color=ccolor + "88",
                    fillcolor=cbg,
                    fontcolor="#e6edf3",
                )
                if prev_node:
                    c.edge(prev_node, node_id,
                           style="invis")   # invisible rank-ordering edge
                prev_node = node_id

            # Record entry / exit nodes for inter-cluster edges
            first_id = f"{cid}_{items[0].replace(' ', '_').replace('/', '_')}"
            last_id  = f"{cid}_{items[-1].replace(' ', '_').replace('/', '_')}"
            cluster_entry_nodes[cid] = first_id
            cluster_exit_nodes[cid]  = last_id

    # ── Inter-cluster edges (semantic flow) ──────────────────────────────────
    edge_pairs = [
        ("cluster_frontend",  "cluster_backend"),
        ("cluster_backend",   "cluster_database"),
        ("cluster_backend",   "cluster_infra"),
        ("cluster_frontend",  "cluster_infra"),
    ]

    for src_cid, dst_cid in edge_pairs:
        src = cluster_exit_nodes.get(src_cid)
        dst = cluster_entry_nodes.get(dst_cid)
        if src and dst:
            dot.edge(
                src, dst,
                color="#388bfd88",
                penwidth="1.5",
                arrowsize="0.8",
                ltail=src_cid,
                lhead=dst_cid,
            )

    # Mark graph as compound so ltail / lhead work
    dot.attr(compound="true")

    # ── Fallback: if NO clusters were populated, render the flat node graph ──
    if not cluster_entry_nodes:
        for node in architecture.get("nodes", []):
            dot.node(node)
        for src, dst in architecture.get("edges", []):
            dot.edge(src, dst)

    # ── Render to PNG ─────────────────────────────────────────────────────────
    dot.render(output_file, format="png", cleanup=True)

    png_path = output_file + ".png"
    with open(png_path, "rb") as f:
        encoded = base64.b64encode(f.read()).decode("utf-8")

    os.remove(png_path)

    return f"data:image/png;base64,{encoded}"