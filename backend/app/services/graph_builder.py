"""
graph_builder.py
----------------
Converts analysis pipeline data into a structured React Flow-compatible
graph with typed nodes, semantic edges, and rich metadata.

Node types
----------
  layer        — top-level tier (Frontend / Backend / Database / Infra)
  framework    — specific framework detected (React, FastAPI, PostgreSQL…)
  folder       — real repo folder (routes/, services/, models/…)
  file         — important individual file (main.py, package.json…)
  route        — detected API route (GET /users, POST /auth…)

Edge types
----------
  tier-flow    — inter-layer data flow (Frontend → Backend → Database)
  contains     — parent → child within a layer
  calls        — logical call relationship (Backend → Service → Model)

Output shape (React Flow compatible)
-------------------------------------
  {
    "nodes": [
      {
        "id": str,
        "type": "layerNode" | "frameworkNode" | "folderNode" | "fileNode" | "routeNode",
        "data": {
          "label": str,
          "description": str,
          "files": list[str],        # clickable related files
          "layer": str,              # colour-group key
          "icon": str,               # Material Symbols name
          "meta": dict,              # arbitrary extra metadata
        },
        "position": {"x": int, "y": int},   # default layout, overridable
      }
    ],
    "edges": [
      {
        "id": str,
        "source": str,
        "target": str,
        "type": "smoothstep",
        "animated": bool,
        "label": str,
        "data": {"edgeType": str},
      }
    ]
  }
"""

from __future__ import annotations

import re
from typing import Any


# ── Layer colour keys (matched in the React component) ───────────────────────

LAYER_FRONTEND  = "frontend"
LAYER_BACKEND   = "backend"
LAYER_DATABASE  = "database"
LAYER_INFRA     = "infra"
LAYER_SERVICE   = "service"
LAYER_MODEL     = "model"
LAYER_ROUTE     = "route"


# ── Folder → layer mapping ────────────────────────────────────────────────────

_FOLDER_LAYER: dict[str, str] = {
    # Frontend
    "components":  LAYER_FRONTEND,
    "pages":       LAYER_FRONTEND,
    "hooks":       LAYER_FRONTEND,
    "store":       LAYER_FRONTEND,
    "context":     LAYER_FRONTEND,
    "assets":      LAYER_FRONTEND,
    "styles":      LAYER_FRONTEND,
    "layouts":     LAYER_FRONTEND,
    "public":      LAYER_FRONTEND,
    "src":         LAYER_FRONTEND,
    "client":      LAYER_FRONTEND,
    "ui":          LAYER_FRONTEND,
    "views":       LAYER_FRONTEND,
    "lib":         LAYER_FRONTEND,
    # Backend
    "routes":      LAYER_ROUTE,
    "controllers": LAYER_ROUTE,
    "api":         LAYER_ROUTE,
    "handlers":    LAYER_ROUTE,
    "services":    LAYER_SERVICE,
    "service":     LAYER_SERVICE,
    "middleware":  LAYER_BACKEND,
    "core":        LAYER_BACKEND,
    "tasks":       LAYER_BACKEND,
    "workers":     LAYER_BACKEND,
    "utils":       LAYER_BACKEND,
    "helpers":     LAYER_BACKEND,
    "schemas":     LAYER_BACKEND,
    "validators":  LAYER_BACKEND,
    "graphql":     LAYER_ROUTE,
    "cmd":         LAYER_BACKEND,
    "internal":    LAYER_BACKEND,
    "pkg":         LAYER_BACKEND,
    "server":      LAYER_BACKEND,
    # Models / DB
    "models":      LAYER_MODEL,
    "model":       LAYER_MODEL,
    "repositories": LAYER_MODEL,
    "repository":  LAYER_MODEL,
    "migrations":  LAYER_DATABASE,
    "alembic":     LAYER_DATABASE,
    "prisma":      LAYER_DATABASE,
    "db":          LAYER_DATABASE,
    "database":    LAYER_DATABASE,
    "data":        LAYER_DATABASE,
    "fixtures":    LAYER_DATABASE,
    "cache":       LAYER_DATABASE,
    # Infra
    ".github":     LAYER_INFRA,
    "workflows":   LAYER_INFRA,
    "docker":      LAYER_INFRA,
    "k8s":         LAYER_INFRA,
    "terraform":   LAYER_INFRA,
    "scripts":     LAYER_INFRA,
    "bin":         LAYER_INFRA,
    "docs":        LAYER_INFRA,
    "doc":         LAYER_INFRA,
    "examples":    LAYER_INFRA,
    "notebooks":   LAYER_INFRA,
}

_LAYER_ICON: dict[str, str] = {
    LAYER_FRONTEND:  "web_asset",
    LAYER_BACKEND:   "dns",
    LAYER_DATABASE:  "database",
    LAYER_INFRA:     "cloud",
    LAYER_SERVICE:   "settings",
    LAYER_MODEL:     "table_rows",
    LAYER_ROUTE:     "route",
}

_LAYER_DESC: dict[str, str] = {
    LAYER_FRONTEND:  "User interface layer — components, pages, assets",
    LAYER_BACKEND:   "Application logic layer — core processing and middleware",
    LAYER_DATABASE:  "Persistence layer — models, migrations, query logic",
    LAYER_INFRA:     "Infrastructure layer — CI/CD, containers, deployment configs",
    LAYER_SERVICE:   "Service layer — business logic, external API clients",
    LAYER_MODEL:     "Data model layer — ORM definitions, schema types",
    LAYER_ROUTE:     "API route layer — HTTP handlers, controllers, GraphQL resolvers",
}

_FILE_ICON: dict[str, str] = {
    ".py":         "code",
    ".js":         "javascript",
    ".ts":         "javascript",
    ".tsx":        "web",
    ".jsx":        "web",
    ".json":       "data_object",
    ".yaml":       "settings",
    ".yml":        "settings",
    ".toml":       "settings",
    ".md":         "description",
    "Dockerfile":  "deployed_code",
    ".env":        "lock",
    ".sh":         "terminal",
}


def _file_icon(filename: str) -> str:
    for key, icon in _FILE_ICON.items():
        if filename.endswith(key) or filename == key:
            return icon
    return "description"


def _safe_id(*parts: str) -> str:
    raw = "_".join(str(p) for p in parts)
    return re.sub(r"[^a-zA-Z0-9_-]", "_", raw)


# ── Layout constants ──────────────────────────────────────────────────────────
# Nodes are pre-positioned so React Flow renders a sensible default layout.
# Users can drag them anywhere.

_LAYER_X: dict[str, int] = {
    LAYER_FRONTEND:  0,
    LAYER_ROUTE:     320,
    LAYER_BACKEND:   320,
    LAYER_SERVICE:   640,
    LAYER_MODEL:     960,
    LAYER_DATABASE:  1280,
    LAYER_INFRA:     640,
}

_LAYER_Y_BASE: dict[str, int] = {
    LAYER_FRONTEND:  200,
    LAYER_ROUTE:     100,
    LAYER_BACKEND:   400,
    LAYER_SERVICE:   200,
    LAYER_MODEL:     200,
    LAYER_DATABASE:  200,
    LAYER_INFRA:     550,
}


# ── Public builder ────────────────────────────────────────────────────────────

def build_interactive_graph(
    *,
    framework_data: dict,
    scan_data: dict,
    api_routes: list[str],
    important_files: list[str],
    folder_explanations: dict,
    entry_points: list[str],
    file_tree_paths: list[str] | None = None,
) -> dict:
    """
    Build a React Flow graph dict from analysis pipeline data.

    Returns {"nodes": [...], "edges": [...]}
    """
    nodes: list[dict] = []
    edges: list[dict] = []
    edge_counter = [0]
    seen_node_ids: set[str] = set()  # O(1) duplicate guard

    def _edge(source: str, target: str, label: str = "", animated: bool = False,
               edge_type: str = "tier-flow") -> None:
        edge_counter[0] += 1
        edges.append({
            "id":       f"e{edge_counter[0]}",
            "source":   source,
            "target":   target,
            "type":     "smoothstep",
            "animated": animated,
            "label":    label,
            "data":     {"edgeType": edge_type},
        })

    # ── Layer nodes (the 6 top-level boxes) ───────────────────────────────────
    layer_order = [
        LAYER_FRONTEND, LAYER_ROUTE, LAYER_BACKEND,
        LAYER_SERVICE, LAYER_MODEL, LAYER_DATABASE, LAYER_INFRA,
    ]

    fw = framework_data or {}
    fe_name  = fw.get("frontend_framework") or ""
    be_name  = fw.get("backend_framework") or ""
    db_name  = fw.get("database") or ""

    _layer_labels: dict[str, str] = {
        LAYER_FRONTEND:  f"Frontend{f' · {fe_name}' if fe_name else ''}",
        LAYER_ROUTE:     "API Routes",
        LAYER_BACKEND:   f"Backend{f' · {be_name}' if be_name else ''}",
        LAYER_SERVICE:   "Services",
        LAYER_MODEL:     "Models",
        LAYER_DATABASE:  f"Database{f' · {db_name}' if db_name else ''}",
        LAYER_INFRA:     "Infrastructure",
    }

    # Determine which layers are populated (have folders or files assigned)
    populated_layers: set[str] = set()

    # scan folders to determine populated layers
    scan_folders: set[str] = set()
    if file_tree_paths:
        for path in file_tree_paths:
            parts = path.split("/")
            if len(parts) > 1:
                scan_folders.add(parts[0].lower())
    # Also pull from scan_data key_files
    for kf in scan_data.get("key_files", []):
        parts = kf.split("/")
        if len(parts) > 1:
            scan_folders.add(parts[0].lower())

    for folder in scan_folders:
        layer = _FOLDER_LAYER.get(folder)
        if layer:
            populated_layers.add(layer)

    # Always include frontend + backend + database if frameworks detected
    if fe_name:
        populated_layers.add(LAYER_FRONTEND)
    if be_name:
        populated_layers.add(LAYER_BACKEND)
        populated_layers.add(LAYER_SERVICE)
        populated_layers.add(LAYER_ROUTE)
    if db_name:
        populated_layers.add(LAYER_DATABASE)
        populated_layers.add(LAYER_MODEL)
    # At minimum show backend + database
    if not populated_layers:
        populated_layers = {LAYER_BACKEND, LAYER_DATABASE}

    # Add infra if any infra files found
    infra_signals = {
        "Dockerfile", "docker-compose.yml", "render.yaml",
        ".github", "fly.toml", "Makefile",
    }
    if file_tree_paths and any(
        any(sig in p for sig in infra_signals) for p in file_tree_paths
    ):
        populated_layers.add(LAYER_INFRA)

    active_layers = [l for l in layer_order if l in populated_layers]

    layer_ids: dict[str, str] = {}
    y_counter: dict[str, int] = {}

    for layer in active_layers:
        lid = _safe_id("layer", layer)
        layer_ids[layer] = lid
        y_counter[layer] = 0
        seen_node_ids.add(lid)
        nodes.append({
            "id":   lid,
            "type": "layerNode",
            "data": {
                "label":       _layer_labels[layer],
                "description": _LAYER_DESC[layer],
                "files":       [],
                "layer":       layer,
                "icon":        _LAYER_ICON[layer],
                "meta":        {},
            },
            "position": {
                "x": _LAYER_X.get(layer, 0),
                "y": _LAYER_Y_BASE.get(layer, 200),
            },
        })

    # ── Tier-flow edges between layer nodes ───────────────────────────────────
    tier_flow = [
        (LAYER_FRONTEND, LAYER_ROUTE,    "HTTP request"),
        (LAYER_ROUTE,    LAYER_BACKEND,  "dispatch"),
        (LAYER_BACKEND,  LAYER_SERVICE,  "calls"),
        (LAYER_SERVICE,  LAYER_MODEL,    "query"),
        (LAYER_MODEL,    LAYER_DATABASE, "SQL / ORM"),
        (LAYER_INFRA,    LAYER_BACKEND,  "deploys"),
    ]
    for src_layer, dst_layer, lbl in tier_flow:
        if src_layer in layer_ids and dst_layer in layer_ids:
            _edge(layer_ids[src_layer], layer_ids[dst_layer],
                  label=lbl, animated=True, edge_type="tier-flow")

    # ── Framework sub-nodes ───────────────────────────────────────────────────
    framework_map = [
        (fe_name,  LAYER_FRONTEND, "Frontend framework"),
        (be_name,  LAYER_BACKEND,  "Backend framework"),
        (db_name,  LAYER_DATABASE, "Database engine"),
    ]
    for fw_name, layer, desc in framework_map:
        if not fw_name or layer not in layer_ids:
            continue
        fid = _safe_id("fw", fw_name)
        y_counter[layer] = y_counter.get(layer, 0) + 120
        nodes.append({
            "id":   fid,
            "type": "frameworkNode",
            "data": {
                "label":       fw_name,
                "description": desc,
                "files":       [],
                "layer":       layer,
                "icon":        _LAYER_ICON.get(layer, "category"),
                "meta":        {},
            },
            "position": {
                "x": _LAYER_X.get(layer, 0) + 20,
                "y": _LAYER_Y_BASE.get(layer, 200) + y_counter[layer],
            },
        })
        _edge(layer_ids[layer], fid, edge_type="contains")

    # ── Folder sub-nodes ──────────────────────────────────────────────────────
    folder_y: dict[str, int] = {}

    for folder in sorted(scan_folders):
        layer = _FOLDER_LAYER.get(folder)
        if not layer or layer not in layer_ids:
            continue
        fid = _safe_id("folder", folder)
        if fid in seen_node_ids:
            continue
        seen_node_ids.add(fid)

        desc = folder_explanations.get(folder, f"/{folder} directory")
        folder_y[layer] = folder_y.get(layer, 0) + 110

        nodes.append({
            "id":   fid,
            "type": "folderNode",
            "data": {
                "label":       f"/{folder}",
                "description": desc,
                "files":       [
                    p for p in (file_tree_paths or [])
                    if p.startswith(folder + "/")
                ][:8],
                "layer":       layer,
                "icon":        "folder",
                "meta":        {"folder": folder},
            },
            "position": {
                "x": _LAYER_X.get(layer, 0) + 20,
                "y": _LAYER_Y_BASE.get(layer, 200) + 240 + folder_y[layer],
            },
        })
        _edge(layer_ids[layer], fid, edge_type="contains")

    # ── Important file nodes ───────────────────────────────────────────────────
    file_layer_map = {
        "main.py":        LAYER_BACKEND,
        "app.py":         LAYER_BACKEND,
        "server.py":      LAYER_BACKEND,
        "index.js":       LAYER_FRONTEND,
        "index.ts":       LAYER_FRONTEND,
        "App.js":         LAYER_FRONTEND,
        "App.tsx":        LAYER_FRONTEND,
        "package.json":   LAYER_FRONTEND,
        "requirements.txt": LAYER_BACKEND,
        "Dockerfile":     LAYER_INFRA,
        "docker-compose.yml": LAYER_INFRA,
        ".env":           LAYER_BACKEND,
        ".env.example":   LAYER_BACKEND,
        "pyproject.toml": LAYER_BACKEND,
        "go.mod":         LAYER_BACKEND,
        "Cargo.toml":     LAYER_BACKEND,
    }
    file_y: dict[str, int] = {}
    for file_path in important_files[:12]:
        basename = file_path.split("/")[-1]
        layer = file_layer_map.get(basename)
        if not layer:
            # Try to infer from folder
            parts = file_path.split("/")
            if len(parts) > 1:
                layer = _FOLDER_LAYER.get(parts[0].lower())
        if not layer or layer not in layer_ids:
            layer = LAYER_BACKEND if LAYER_BACKEND in layer_ids else None
        if not layer:
            continue

        fid = _safe_id("file", file_path)
        if fid in seen_node_ids:
            continue
        seen_node_ids.add(fid)

        file_y[layer] = file_y.get(layer, 0) + 100

        nodes.append({
            "id":   fid,
            "type": "fileNode",
            "data": {
                "label":       basename,
                "description": file_path,
                "files":       [file_path],
                "layer":       layer,
                "icon":        _file_icon(basename),
                "meta":        {"path": file_path},
            },
            "position": {
                "x": _LAYER_X.get(layer, 0) + 160,
                "y": _LAYER_Y_BASE.get(layer, 200) + 500 + file_y[layer],
            },
        })
        _edge(layer_ids[layer], fid, edge_type="contains")

    # ── API Route nodes (max 8 to avoid cluttering the graph) ─────────────────
    if LAYER_ROUTE in layer_ids:
        route_lid = layer_ids[LAYER_ROUTE]
        for i, route_str in enumerate(api_routes[:8]):
            rid = _safe_id("route", str(i), route_str[:30])
            parts = route_str.split(" ", 1)
            method = parts[0] if len(parts) > 1 else "GET"
            path   = parts[1] if len(parts) > 1 else route_str

            nodes.append({
                "id":   rid,
                "type": "routeNode",
                "data": {
                    "label":       f"{method} {path}",
                    "description": f"HTTP {method} endpoint: {path}",
                    "files":       [],
                    "layer":       LAYER_ROUTE,
                    "icon":        "route",
                    "meta":        {"method": method, "path": path},
                },
                "position": {
                    "x": _LAYER_X.get(LAYER_ROUTE, 320) + 20,
                    "y": _LAYER_Y_BASE.get(LAYER_ROUTE, 100) + 130 + i * 90,
                },
            })
            _edge(route_lid, rid, edge_type="contains")

    return {"nodes": nodes, "edges": edges}
