def build_architecture(framework_data):

    architecture = {
        "nodes": [],
        "edges": []
    }

    frontend = framework_data.get("frontend_framework")
    backend = framework_data.get("backend_framework")
    database = framework_data.get("database")

    if frontend:
        architecture["nodes"].append(frontend)

    if backend:
        architecture["nodes"].append(backend)

    if database:
        architecture["nodes"].append(database)

    if frontend and backend:
        architecture["edges"].append((frontend, backend))

    if backend and database:
        architecture["edges"].append((backend, database))

    return architecture