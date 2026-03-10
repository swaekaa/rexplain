import os
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

    dot.render(output_file, format="png", cleanup=True)

    return output_file + ".png"