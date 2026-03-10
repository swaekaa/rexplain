import os
from collections import defaultdict

def scan_repository(repo_path):

    language_counts = defaultdict(int)
    key_files = []
    total_files = 0

    important_names = [
        "main.py",
        "app.py",
        "server.py",
        "index.js",
        "package.json",
        "requirements.txt"
    ]

    for root, dirs, files in os.walk(repo_path):
        for file in files:

            total_files += 1

            ext = os.path.splitext(file)[1]

            if ext:
                language_counts[ext] += 1

            if file in important_names:
                key_files.append(os.path.join(root, file))

    return {
        "total_files": total_files,
        "languages": dict(language_counts),
        "key_files": key_files[:10]
    }