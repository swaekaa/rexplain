import os
import base64
from graphviz import Digraph


def generate_architecture_diagram(architecture, repo_name):

    base_dir = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "../../../repos")
    )

    output_file = os.path.join(base_dir, f"{repo_name}_architecture")

    dot = Digraph(comment="Architecture")

    # Add nodes
    for node in architecture["nodes"]:
        dot.node(node)

    # Add edges
    for src, dst in architecture["edges"]:
        dot.edge(src, dst)

    # Render PNG to disk temporarily
    dot.render(output_file, format="png", cleanup=True)

    png_path = output_file + ".png"

    # Read PNG and encode as base64 data URI
    with open(png_path, "rb") as f:
        encoded = base64.b64encode(f.read()).decode("utf-8")

    # Delete the temp PNG file immediately after encoding
    os.remove(png_path)

    return f"data:image/png;base64,{encoded}"