"""
architecture_builder.py
-----------------------
Converts detected framework data into an architecture graph dict.

Phase 10 upgrade:
  - Stores framework names in dedicated keys (fe_fw_name / be_fw_name / db_fw_name)
    so the diagram generator can label cluster entry-points meaningfully.
  - 'nodes' and 'edges' arrays are kept for backwards compatibility.
"""


def build_architecture(framework_data: dict) -> dict:

    frontend = framework_data.get("frontend_framework")
    backend  = framework_data.get("backend_framework")
    database = framework_data.get("database")

    nodes: list[str] = []
    edges: list[tuple[str, str]] = []

    if frontend:
        nodes.append(frontend)
    if backend:
        nodes.append(backend)
    if database:
        nodes.append(database)

    if frontend and backend:
        edges.append((frontend, backend))
    if backend and database:
        edges.append((backend, database))

    return {
        "nodes":       nodes,
        "edges":       edges,
        # Named keys for the diagram generator clusters
        "fe_fw_name":  frontend,
        "be_fw_name":  backend,
        "db_fw_name":  database,
        # Passed through for the diagram — same as fw_key + "_name" convention
        "frontend_framework_name": frontend,
        "backend_framework_name":  backend,
        "database_name":           database,
    }