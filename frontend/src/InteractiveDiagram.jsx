/**
 * InteractiveDiagram.jsx
 * ----------------------
 * Full-featured React Flow diagram for RExplain.
 *
 * Features:
 *  - Zoom / pan / drag (built-in via React Flow)
 *  - 5 custom node types: layerNode, frameworkNode, folderNode, fileNode, routeNode
 *  - Click-to-inspect panel: description + related files list (with preview callback)
 *  - Animated tier-flow edges with custom labels
 *  - Dark/light theme aware (reads CSS variables)
 *  - Minimap + controls
 *  - Graceful fallback when graph data is empty
 */

import { useState, useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

// ── Layer colour palette ──────────────────────────────────────────────────────

const LAYER_COLORS = {
  frontend:  { border: "#bc8cff", bg: "#1a0d2e", accent: "#a855f7" },
  route:     { border: "#60a5fa", bg: "#0d1a2e", accent: "#3b82f6" },
  backend:   { border: "#60a5fa", bg: "#0d1a2e", accent: "#3b82f6" },
  service:   { border: "#34d399", bg: "#0d1f16", accent: "#10b981" },
  model:     { border: "#fbbf24", bg: "#1f180d", accent: "#f59e0b" },
  database:  { border: "#3fb950", bg: "#0d1f0d", accent: "#22c55e" },
  infra:     { border: "#ffa657", bg: "#1f150d", accent: "#f97316" },
};

const LAYER_COLOR_DEFAULT = { border: "#484f58", bg: "#161b22", accent: "#6e7681" };

function getLayer(layer) {
  return LAYER_COLORS[layer] || LAYER_COLOR_DEFAULT;
}

// ── HTTP method badge colours (mirrors App.js) ────────────────────────────────

function methodStyle(method) {
  const m = {
    GET:    { color: "#4ade80", bg: "rgba(74,222,128,0.1)" },
    POST:   { color: "#60a5fa", bg: "rgba(96,165,250,0.1)" },
    PUT:    { color: "#fb923c", bg: "rgba(251,146,60,0.1)"  },
    PATCH:  { color: "#c084fc", bg: "rgba(192,132,252,0.1)" },
    DELETE: { color: "#f87171", bg: "rgba(248,113,113,0.1)" },
  };
  return m[method] || { color: "#a3a3a3", bg: "rgba(255,255,255,0.05)" };
}

// ── Shared node wrapper ───────────────────────────────────────────────────────

function NodeShell({ layer, children, selected, compact = false, style = {} }) {
  const { border, bg } = getLayer(layer);
  return (
    <div
      style={{
        background: bg,
        border: `1.5px solid ${selected ? border : border + "55"}`,
        borderRadius: compact ? 8 : 12,
        padding: compact ? "8px 12px" : "12px 16px",
        minWidth: compact ? 140 : 180,
        maxWidth: 260,
        boxShadow: selected
          ? `0 0 0 2px ${border}66, 0 4px 24px rgba(0,0,0,0.5)`
          : "0 2px 12px rgba(0,0,0,0.4)",
        transition: "box-shadow 0.15s, border-color 0.15s",
        fontFamily: "Manrope, Inter, sans-serif",
        cursor: "pointer",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── layerNode ─────────────────────────────────────────────────────────────────

function LayerNode({ data, selected }) {
  const { accent, border } = getLayer(data.layer);
  return (
    <NodeShell layer={data.layer} selected={selected}>
      <Handle type="target" position={Position.Left}  style={{ background: border + "88", border: "none", width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right} style={{ background: border + "88", border: "none", width: 8, height: 8 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span
          className="material-symbols-outlined"
          style={{ fontSize: 18, color: accent }}
        >
          {data.icon}
        </span>
        <span
          style={{
            color: "#ffffff",
            fontWeight: 800,
            fontSize: 13,
            letterSpacing: "-0.01em",
          }}
        >
          {data.label}
        </span>
      </div>
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: accent + "99",
        }}
      >
        LAYER
      </div>
    </NodeShell>
  );
}

// ── frameworkNode ─────────────────────────────────────────────────────────────

function FrameworkNode({ data, selected }) {
  const { accent, border } = getLayer(data.layer);
  return (
    <NodeShell layer={data.layer} selected={selected} compact>
      <Handle type="target" position={Position.Left}  style={{ background: border + "88", border: "none", width: 6, height: 6 }} />
      <Handle type="source" position={Position.Right} style={{ background: border + "88", border: "none", width: 6, height: 6 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 14, color: accent }}>
          {data.icon}
        </span>
        <span style={{ color: "#e6edf3", fontWeight: 700, fontSize: 12 }}>
          {data.label}
        </span>
      </div>
    </NodeShell>
  );
}

// ── folderNode ────────────────────────────────────────────────────────────────

function FolderNode({ data, selected }) {
  const { accent, border } = getLayer(data.layer);
  return (
    <NodeShell layer={data.layer} selected={selected} compact>
      <Handle type="target" position={Position.Left}  style={{ background: border + "88", border: "none", width: 6, height: 6 }} />
      <Handle type="source" position={Position.Right} style={{ background: border + "88", border: "none", width: 6, height: 6 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 14, color: accent }}>
          folder
        </span>
        <span style={{ color: "#c9d1d9", fontWeight: 600, fontSize: 11, fontFamily: "monospace" }}>
          {data.label}
        </span>
      </div>
      {data.files?.length > 0 && (
        <div style={{ fontSize: 9, color: accent + "88", marginTop: 2 }}>
          {data.files.length} file{data.files.length !== 1 ? "s" : ""}
        </div>
      )}
    </NodeShell>
  );
}

// ── fileNode ──────────────────────────────────────────────────────────────────

function FileNode({ data, selected }) {
  const { accent, border } = getLayer(data.layer);
  return (
    <NodeShell layer={data.layer} selected={selected} compact style={{ minWidth: 110 }}>
      <Handle type="target" position={Position.Left}  style={{ background: border + "88", border: "none", width: 5, height: 5 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 12, color: accent }}>
          {data.icon}
        </span>
        <span style={{ color: "#c9d1d9", fontWeight: 600, fontSize: 11, fontFamily: "monospace" }}>
          {data.label}
        </span>
      </div>
    </NodeShell>
  );
}

// ── routeNode ─────────────────────────────────────────────────────────────────

function RouteNode({ data, selected }) {
  const { border } = getLayer("route");
  const meta = data.meta || {};
  const { color, bg } = methodStyle(meta.method);
  return (
    <NodeShell layer="route" selected={selected} compact style={{ minWidth: 180, maxWidth: 280 }}>
      <Handle type="target" position={Position.Left}  style={{ background: border + "88", border: "none", width: 5, height: 5 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span
          style={{
            background: bg,
            color,
            fontWeight: 800,
            fontSize: 8,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            padding: "2px 6px",
            borderRadius: 4,
            minWidth: 36,
            textAlign: "center",
          }}
        >
          {meta.method || "GET"}
        </span>
        <span style={{ color: "#c9d1d9", fontWeight: 500, fontSize: 11, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {meta.path || data.label}
        </span>
      </div>
    </NodeShell>
  );
}

// ── Custom node type map ──────────────────────────────────────────────────────

const NODE_TYPES = {
  layerNode:     LayerNode,
  frameworkNode: FrameworkNode,
  folderNode:    FolderNode,
  fileNode:      FileNode,
  routeNode:     RouteNode,
};

// ── Edge style factory ────────────────────────────────────────────────────────

function styledEdges(rawEdges) {
  return rawEdges.map((e) => {
    const isTier     = e.data?.edgeType === "tier-flow";
    const isContains = e.data?.edgeType === "contains";
    return {
      ...e,
      style: {
        stroke: isTier ? "#a855f7" : isContains ? "#484f5844" : "#388bfd44",
        strokeWidth: isTier ? 2 : 1,
      },
      labelStyle: {
        fill: "#a3a3a3",
        fontSize: 9,
        fontFamily: "Manrope, Inter, sans-serif",
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
      },
      labelBgStyle: {
        fill: "#0d1117",
        fillOpacity: 0.85,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: isTier ? "#a855f7" : "#484f58",
        width: isTier ? 16 : 10,
        height: isTier ? 16 : 10,
      },
      animated: isTier,
    };
  });
}

// ── Inspector panel ───────────────────────────────────────────────────────────

function Inspector({ node, onClose, onFileClick }) {
  if (!node) return null;
  const { data } = node;
  const { accent } = getLayer(data.layer);

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        width: 280,
        background: "#0d1117",
        border: `1.5px solid ${accent}55`,
        borderRadius: 14,
        padding: 16,
        zIndex: 100,
        fontFamily: "Manrope, Inter, sans-serif",
        boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px ${accent}22`,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: accent + "22",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15, color: accent }}>
              {data.icon}
            </span>
          </div>
          <div>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 12, lineHeight: 1.2 }}>
              {data.label}
            </div>
            <div
              style={{
                color: accent,
                fontSize: 8,
                fontWeight: 800,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginTop: 1,
              }}
            >
              {node.type?.replace("Node", "") || "node"}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "#484f58",
            cursor: "pointer",
            padding: 0,
            lineHeight: 1,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
        </button>
      </div>

      {/* Description */}
      <p
        style={{
          color: "#8b949e",
          fontSize: 11,
          lineHeight: 1.6,
          margin: "0 0 12px 0",
          borderBottom: "1px solid #30363d",
          paddingBottom: 12,
        }}
      >
        {data.description || "No description available."}
      </p>

      {/* HTTP method badge for routes */}
      {data.meta?.method && (
        <div style={{ marginBottom: 8 }}>
          {(() => {
            const { color, bg } = methodStyle(data.meta.method);
            return (
              <span
                style={{
                  background: bg,
                  color,
                  fontWeight: 800,
                  fontSize: 9,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  padding: "2px 8px",
                  borderRadius: 4,
                }}
              >
                {data.meta.method}
              </span>
            );
          })()}
          <code style={{ color: "#c9d1d9", fontSize: 11, marginLeft: 8, fontFamily: "monospace" }}>
            {data.meta.path}
          </code>
        </div>
      )}

      {/* Related files */}
      {data.files?.length > 0 && (
        <div>
          <div
            style={{
              color: "#484f58",
              fontSize: 8,
              fontWeight: 800,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            Related Files
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {data.files.slice(0, 6).map((f, i) => (
              <button
                key={i}
                onClick={() => onFileClick?.(f)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "#161b22",
                  border: "1px solid #30363d",
                  borderRadius: 6,
                  padding: "5px 8px",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "border-color 0.1s, background 0.1s",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = accent + "88";
                  e.currentTarget.style.background = accent + "11";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = "#30363d";
                  e.currentTarget.style.background = "#161b22";
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 11, color: "#484f58" }}>
                  description
                </span>
                <span style={{ color: "#c9d1d9", fontSize: 10, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {f}
                </span>
                <span className="material-symbols-outlined" style={{ fontSize: 10, color: "#484f58", marginLeft: "auto", flexShrink: 0 }}>
                  open_in_new
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Client-side fallback graph builder ───────────────────────────────────────
// Used when the backend returns no interactive_graph nodes (e.g. old cache entry).

function buildFallbackGraph(result) {
  if (!result) return { nodes: [], edges: [] };

  const fw   = result.framework_detection || {};
  const fe   = fw.frontend_framework;
  const be   = fw.backend_framework;
  const db   = fw.database;
  const routes = (result.api_routes || []).slice(0, 5);
  const files  = (result.important_files || []).slice(0, 4);

  const nodes = [];
  const edges = [];
  let ec = 0;
  const edge = (src, tgt, label = "", animated = false) =>
    edges.push({ id: `fe${++ec}`, source: src, target: tgt, type: "smoothstep",
                 animated, label, data: { edgeType: animated ? "tier-flow" : "contains" } });

  const ROW = { frontend: 0, route: 320, backend: 640, database: 960, infra: 320 };
  const COL = { frontend: 200, route: 80,  backend: 200, database: 200, infra: 480 };

  // Layer: Frontend
  if (fe) {
    nodes.push({ id: "l-frontend", type: "layerNode", position: { x: ROW.frontend, y: COL.frontend },
      data: { label: `Frontend · ${fe}`, description: "User interface layer", files: [], layer: "frontend", icon: "web_asset", meta: {} } });
  }

  // Layer: API Routes
  nodes.push({ id: "l-route", type: "layerNode", position: { x: ROW.route, y: COL.route },
    data: { label: "API Routes", description: "HTTP endpoints and controllers", files: [], layer: "route", icon: "route", meta: {} } });

  if (fe) edge("l-frontend", "l-route", "HTTP", true);

  // Layer: Backend
  nodes.push({ id: "l-backend", type: "layerNode", position: { x: ROW.backend, y: COL.backend },
    data: { label: be ? `Backend · ${be}` : "Backend", description: "Application logic layer", files: [], layer: "backend", icon: "dns", meta: {} } });
  edge("l-route", "l-backend", "dispatch", true);

  // Layer: Database
  if (db) {
    nodes.push({ id: "l-database", type: "layerNode", position: { x: ROW.database, y: COL.database },
      data: { label: `Database · ${db}`, description: "Persistence layer", files: [], layer: "database", icon: "database", meta: {} } });
    edge("l-backend", "l-database", "SQL / ORM", true);
  }

  // Route sub-nodes
  routes.forEach((r, i) => {
    const parts = r.split(" ", 2);
    const method = parts.length > 1 ? parts[0] : "GET";
    const path   = parts.length > 1 ? parts[1] : r;
    const rid = `route-${i}`;
    nodes.push({ id: rid, type: "routeNode", position: { x: ROW.route + 20, y: COL.route + 120 + i * 80 },
      data: { label: r, description: `HTTP ${method} endpoint`, files: [], layer: "route", icon: "route",
              meta: { method, path } } });
    edge("l-route", rid);
  });

  // File sub-nodes
  files.forEach((f, i) => {
    const name = f.split("/").pop();
    const layer = ["index.js", "App.js", "App.tsx", "package.json"].includes(name) ? "frontend" : "backend";
    const lid = layer === "frontend" ? "l-frontend" : "l-backend";
    const fid = `file-${i}`;
    nodes.push({ id: fid, type: "fileNode", position: { x: ROW[layer] + 20, y: COL[layer] + 200 + i * 80 },
      data: { label: name, description: f, files: [f], layer, icon: "description", meta: { path: f } } });
    if (nodes.find(n => n.id === lid)) edge(lid, fid);
  });

  return { nodes, edges };
}


// ── Main component ────────────────────────────────────────────────────────────

export default function InteractiveDiagram({ graphData, fallbackData, onFileClick }) {
  // Use backend graph if it has nodes; otherwise build a fallback from raw result fields
  const resolvedGraph = useMemo(() => {
    if (graphData?.nodes?.length) return graphData;
    if (fallbackData) return buildFallbackGraph(fallbackData);
    return { nodes: [], edges: [] };
  }, [graphData, fallbackData]);

  const rawNodes = useMemo(() => resolvedGraph.nodes, [resolvedGraph]);
  const rawEdges = useMemo(() => styledEdges(resolvedGraph.edges), [resolvedGraph]);

  // Stable key: forces ReactFlow to fully remount when graph data changes
  const graphKey = useMemo(() => rawNodes.map(n => n.id).join(","), [rawNodes]);

  const [nodes, setNodes, onNodesChange] = useNodesState(rawNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(rawEdges);
  const [selectedNode, setSelectedNode] = useState(null);

  const onNodeClick = useCallback((_, node) => {
    setSelectedNode(prev => prev?.id === node.id ? null : node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // Empty state
  if (!rawNodes.length) {
    return (
      <div
        style={{
          height: 420,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          opacity: 0.4,
          fontFamily: "Manrope, Inter, sans-serif",
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 40, color: "#484f58" }}>
          schema
        </span>
        <p style={{ color: "#8b949e", fontSize: 13, margin: 0 }}>
          No interactive graph data available
        </p>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", height: 520, width: "100%", borderRadius: 12, overflow: "hidden" }}>
      {/* Force React Flow control buttons to be visible regardless of global CSS resets */}
      <style>{`
        .react-flow__controls {
          box-shadow: none !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 4px !important;
        }
        .react-flow__controls-button {
          background: #161b22 !important;
          border: 1px solid #30363d !important;
          border-radius: 6px !important;
          width: 26px !important;
          height: 26px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          cursor: pointer !important;
          padding: 0 !important;
        }
        .react-flow__controls-button:hover {
          background: #21262d !important;
          border-color: #484f58 !important;
        }
        .react-flow__controls-button svg {
          fill: #8b949e !important;
          width: 12px !important;
          height: 12px !important;
          max-width: 12px !important;
          max-height: 12px !important;
        }
        .react-flow__controls-button:hover svg {
          fill: #e6edf3 !important;
        }
      `}</style>
      <ReactFlow
        key={graphKey}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={NODE_TYPES}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.2}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
        style={{ background: "#0d1117" }}
        defaultEdgeOptions={{ type: "smoothstep" }}
      >
        <Background
          color="#30363d"
          variant="dots"
          gap={20}
          size={1}
          style={{ opacity: 0.4 }}
        />
        <Controls
          position="bottom-left"
          style={{
            background: "transparent",
            border: "none",
            boxShadow: "none",
            gap: 4,
          }}
          showInteractive={false}
        />
        <MiniMap
          style={{
            background: "#0d1117",
            border: "1px solid #30363d",
            borderRadius: 8,
          }}
          nodeColor={(n) => {
            const { accent } = getLayer(n.data?.layer);
            return accent + "88";
          }}
          maskColor="rgba(0,0,0,0.5)"
        />

        {/* Legend */}
        <Panel position="top-left">
          <div
            style={{
              background: "#0d1117cc",
              border: "1px solid #30363d",
              borderRadius: 10,
              padding: "8px 12px",
              fontFamily: "Manrope, Inter, sans-serif",
              backdropFilter: "blur(8px)",
            }}
          >
            <div
              style={{
                fontSize: 8,
                fontWeight: 800,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#484f58",
                marginBottom: 6,
              }}
            >
              Legend
            </div>
            {[
              { layer: "frontend", label: "Frontend" },
              { layer: "route",    label: "API Routes" },
              { layer: "service",  label: "Services" },
              { layer: "model",    label: "Models" },
              { layer: "database", label: "Database" },
              { layer: "infra",    label: "Infra" },
            ].map(({ layer, label }) => {
              const { accent } = getLayer(layer);
              return (
                <div key={layer} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: accent }} />
                  <span style={{ fontSize: 10, color: "#8b949e", fontWeight: 600 }}>{label}</span>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* Hint */}
        <Panel position="bottom-left">
          <div
            style={{
              fontSize: 9,
              color: "#484f58",
              fontFamily: "Manrope, Inter, sans-serif",
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Click node to inspect · Drag to rearrange · Scroll to zoom
          </div>
        </Panel>
      </ReactFlow>

      {/* Inspector panel — rendered outside ReactFlow to avoid transform issues */}
      {selectedNode && (
        <Inspector
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
          onFileClick={onFileClick}
        />
      )}
    </div>
  );
}
