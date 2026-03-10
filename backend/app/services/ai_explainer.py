def generate_repo_explanation(framework_data, scan_data):

    backend = framework_data.get("backend_framework")
    frontend = framework_data.get("frontend_framework")
    database = framework_data.get("database")

    total_files = scan_data.get("total_files")

    explanation = []

    explanation.append(f"This repository contains approximately {total_files} files.")

    if frontend and backend:
        explanation.append(
            f"The project uses {frontend} for the frontend and {backend} for the backend."
        )

    elif backend:
        explanation.append(
            f"The backend of this project is built using {backend}."
        )

    if database:
        explanation.append(
            f"{database} is used for database interactions."
        )

    explanation.append(
        "The architecture appears to follow a typical client-server design."
    )

    return " ".join(explanation)