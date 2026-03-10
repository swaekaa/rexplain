import os

def detect_frameworks(repo_path):

    detected = {
        "backend_framework": None,
        "frontend_framework": None,
        "database": None
    }

    for root, dirs, files in os.walk(repo_path):

        for file in files:

            path = os.path.join(root, file)

            # Detect Python frameworks
            if file.endswith(".py"):
                try:
                    with open(path, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read()

                        if "fastapi" in content.lower():
                            detected["backend_framework"] = "FastAPI"

                        if "flask" in content.lower():
                            detected["backend_framework"] = "Flask"

                        if "django" in content.lower():
                            detected["backend_framework"] = "Django"

                        if "sqlalchemy" in content.lower():
                            detected["database"] = "SQLAlchemy"

                except:
                    pass


            # Detect frontend
            if file == "package.json":

                try:
                    with open(path, "r", encoding="utf-8") as f:
                        content = f.read().lower()

                        if "react" in content:
                            detected["frontend_framework"] = "React"

                        if "vue" in content:
                            detected["frontend_framework"] = "Vue"

                        if "angular" in content:
                            detected["frontend_framework"] = "Angular"

                except:
                    pass

    return detected