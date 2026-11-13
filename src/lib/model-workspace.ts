import {
  modelNodes,
  modelConnections,
  methodologyRules,
  type ModelNode,
  type ModelConnection,
} from './methodology.ts'
import type { EvidenceTable, RunEvidence } from './reconciliation-evidence.ts'

/** Presentation only. Nothing in this module is consumed by the accounting pipeline. */
export type WorkspaceTab = 'pipeline' | 'sources' | 'evidence' | 'rules'
export type WorkspaceSelection =
  | { kind: 'node' | 'connection' | 'rule'; id: string }
  | {
      kind: 'record'
      id: string
      tableId: string
      rowIndex: number
      runId: string
    }
  | { kind: 'table'; id: string; runId: string }
export type PipelineScope = 'flow' | 'all' | 'references'
export interface Viewport {
  x: number
  y: number
  zoom: number
}
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}
export interface RuleFilters {
  query: string
  source: string
  group: string
}
export interface EvidenceFilters {
  query: string
  source: string
  eventType: string
  schema: boolean
}
export const EMPTY_RULE_FILTERS: RuleFilters = {
  query: '',
  source: 'All',
  group: 'All',
}
export const EMPTY_EVIDENCE_FILTERS: EvidenceFilters = {
  query: '',
  source: 'All',
  eventType: 'All',
  schema: false,
}
export const STAGES = [
  { id: 'source', label: 'Sources', x: 24 },
  { id: 'cleaning', label: 'Normalize', x: 282 },
  { id: 'recognition', label: 'Recognition', x: 540 },
  { id: 'reconciliation', label: 'Reconciliation', x: 798 },
  { id: 'output', label: 'Outputs', x: 1056 },
] as const
const rows: Record<string, number> = {
  raw_pos: 76,
  raw_web: 256,
  raw_gl: 436,
  vw_flash: 616,
  pos_ranked: 76,
  vw_pos: 220,
  vw_web: 364,
  vw_gl: 508,
  q_POS_Dup_Impact: 652,
  expected_events: 220,
  expected_daily: 76,
  gl_daily: 256,
  daily_comparison: 436,
  bridge: 616,
  results: 616,
}
const primaryEdges = new Set([
  'pos-normalize',
  'pos-keep',
  'pos-audit',
  'pos-bridge',
  'pos-timing-bridge',
  'web-normalize',
  'gl-normalize',
  'pos-events',
  'web-events',
  'events-daily',
  'gl-daily',
  'compare-expected',
  'compare-gl',
  'comparison-bridge',
  'bridge-results',
  'flash-bridge',
])
export const nodeById = new Map(modelNodes.map((n) => [n.id, n]))
export const edgeById = new Map(modelConnections.map((e) => [e.id, e]))
export const ruleById = new Map(methodologyRules.map((r) => [r.id, r]))
export const ruleGroups = [...new Set(methodologyRules.map((r) => r.group))]
export function relatedNodeIds(ruleId: string): string[] {
  const rule = ruleById.get(ruleId)
  if (!rule) return []
  const ids = rule.evidenceTables.filter((id) => nodeById.has(id))
  if (ids.length) return ids
  // Documentation-only links to existing metadata, never execution dependencies.
  const links: Record<string, string[]> = {
    'header-selection': ['raw_pos', 'raw_web', 'raw_gl', 'vw_flash'],
    'report-store-month': ['gl_daily'],
    'report-working-day': ['dim_date'],
    'report-fx': ['fx_daily', 'fx_month_end'],
  }
  return links[ruleId] ?? []
}
export function filterRules(filters: RuleFilters) {
  const query = filters.query.trim().toLowerCase()
  return methodologyRules.filter(
    (r) =>
      (filters.source === 'All' ||
        r.sourceIds.some((s) => s === filters.source)) &&
      (filters.group === 'All' || r.group === filters.group) &&
      (!query ||
        [
          r.title,
          r.purpose,
          r.logic,
          r.condition,
          r.output,
          r.nullError,
          r.technical,
          ...r.inputFields,
        ]
          .join(' ')
          .toLowerCase()
          .includes(query)),
  )
}
export function filterEvidenceRows(
  table: EvidenceTable | undefined,
  filters: EvidenceFilters,
) {
  return (table?.rows ?? [])
    .map((row, index) => ({ row, index }))
    .filter(
      ({ row }) =>
        (filters.source === 'All' || row.source === filters.source) &&
        (filters.eventType === 'All' || row.event_type === filters.eventType) &&
        Object.values(row)
          .join(' ')
          .toLowerCase()
          .includes(filters.query.toLowerCase()),
    )
}
export function ruleStatus(id: string, evidence?: RunEvidence) {
  const actual = evidence?.ruleApplications.find((r) => r.id === id)
  if (actual)
    return {
      label:
        actual.status === 'applied'
          ? 'Applied'
          : actual.status === 'not-applicable'
            ? 'Not applicable'
            : 'Not evaluated',
      tone: actual.status === 'applied' ? 'green' : 'neutral',
      detail: actual.detail,
    }
  const rule = ruleById.get(id)
  return {
    label:
      rule?.implementation === 'unsupported'
        ? 'Not implemented'
        : rule?.implementation === 'reference'
          ? 'Reference'
          : 'Definition',
    tone: 'neutral',
    detail: evidence
      ? 'No execution evidence recorded for this rule.'
      : 'Run reconciliation to inspect actual application evidence.',
  }
}
export function pipelineGraph(scope: PipelineScope, source = 'All') {
  let nodes =
    scope === 'references'
      ? modelNodes.filter(
          (n) =>
            n.source === 'Dim' ||
            ['raw_pos', 'raw_web', 'raw_gl'].includes(n.id),
        )
      : modelNodes.filter((n) => scope === 'all' || n.source !== 'Dim')
  let edges = modelConnections.filter(
    (e) =>
      nodes.some((n) => n.id === e.from) &&
      nodes.some((n) => n.id === e.to) &&
      (scope !== 'flow' || primaryEdges.has(e.id)),
  )
  if (source !== 'All') {
    const roots = nodes.filter((n) => n.source === source).map((n) => n.id)
    const related = traceBranch(roots, edges)
    nodes = nodes.filter((n) => related.nodes.has(n.id))
    edges = edges.filter(
      (e) =>
        nodes.some((n) => n.id === e.from) && nodes.some((n) => n.id === e.to),
    )
  }
  const positions = new Map<string, Rect>()
  for (const node of nodes) {
    if (scope === 'references') {
      const refs = ['dim_store', 'dim_date', 'fx_daily', 'fx_month_end']
      positions.set(node.id, {
        x: node.source === 'Dim' ? 24 : 452,
        y:
          76 +
          Math.max(
            0,
            (node.source === 'Dim'
              ? refs
              : ['raw_pos', 'raw_web', 'raw_gl']
            ).indexOf(node.id),
          ) *
            160,
        width: 208,
        height: 122,
      })
    } else if (node.source === 'Dim') {
      positions.set(node.id, {
        x:
          24 +
          ['dim_store', 'dim_date', 'fx_daily', 'fx_month_end'].indexOf(
            node.id,
          ) *
            258,
        y: 836,
        width: 208,
        height: 122,
      })
    } else
      positions.set(node.id, {
        x: STAGES.find((s) => s.id === node.stage)!.x,
        y: rows[node.id] ?? 76,
        width: 208,
        height: 122,
      })
  }
  return {
    nodes,
    edges,
    positions,
    width: scope === 'references' ? 720 : 1300,
    height: scope === 'all' ? 990 : 810,
  }
}
export function traceBranch(
  seeds: string[],
  edges: ModelConnection[] = modelConnections,
) {
  const upstream = new Set(seeds),
    downstream = new Set(seeds)
  for (let pass = 0; pass < modelNodes.length; pass++)
    for (const e of edges) {
      if (upstream.has(e.to)) upstream.add(e.from)
      if (downstream.has(e.from)) downstream.add(e.to)
    }
  const nodes = new Set([...upstream, ...downstream])
  return {
    nodes,
    edges: new Set(
      edges
        .filter((e) => nodes.has(e.from) && nodes.has(e.to))
        .map((e) => e.id),
    ),
  }
}
export type Point = { x: number; y: number }
export function segmentHitsRect(a: Point, b: Point, r: Rect) {
  return a.x === b.x
    ? a.x > r.x &&
        a.x < r.x + r.width &&
        Math.max(a.y, b.y) > r.y &&
        Math.min(a.y, b.y) < r.y + r.height
    : a.y === b.y &&
        a.y > r.y &&
        a.y < r.y + r.height &&
        Math.max(a.x, b.x) > r.x &&
        Math.min(a.x, b.x) < r.x + r.width
}
/** Route in column gutters and free horizontal lanes, never through another node. */
export function routeEdge(
  edge: ModelConnection,
  positions: Map<string, Rect>,
  index: number,
): Point[] {
  const a = positions.get(edge.from)!,
    b = positions.get(edge.to)!
  if (a.x === b.x && a.y < b.y) {
    const start = { x: a.x + a.width / 2, y: a.y + a.height },
      end = { x: b.x + b.width / 2, y: b.y }
    if (
      ![...positions.entries()].some(
        ([id, r]) =>
          id !== edge.from && id !== edge.to && segmentHitsRect(start, end, r),
      )
    )
      return [start, end]
    const gutter = a.x + a.width + 20 + (index % 3) * 4
    return [
      start,
      { x: start.x, y: start.y + 12 },
      { x: gutter, y: start.y + 12 },
      { x: gutter, y: end.y - 12 },
      { x: end.x, y: end.y - 12 },
      end,
    ]
  }
  const start = { x: a.x + a.width, y: a.y + a.height / 2 },
    end = { x: b.x, y: b.y + b.height / 2 }
  const left = start.x + 14,
    right = end.x - 14 - (index % 3) * 4
  const obstacles = [...positions.values()]
  const clear = (points: Point[]) =>
    points.every(
      (p, i) =>
        i === 0 || !obstacles.some((r) => segmentHitsRect(points[i - 1], p, r)),
    )
  const direct = [start, { x: right, y: start.y }, { x: right, y: end.y }, end]
  if (end.x > start.x && clear(direct)) return direct
  const lanes = [
    32,
    ...obstacles.flatMap((r) => [
      r.y - 20 - (index % 4) * 3,
      r.y + r.height + 20 + (index % 4) * 3,
    ]),
  ]
  const candidates = lanes
    .map((y) => [
      start,
      { x: left, y: start.y },
      { x: left, y },
      { x: right, y },
      { x: right, y: end.y },
      end,
    ])
    .filter(clear)
  candidates.sort((p, q) => length(p) - length(q))
  return candidates[0] ?? direct
}
const length = (points: Point[]) =>
  points.reduce(
    (n, p, i) =>
      i
        ? n + Math.abs(p.x - points[i - 1].x) + Math.abs(p.y - points[i - 1].y)
        : n,
    0,
  )
export function edgePath(points: Point[]): string {
  return points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ')
}
export function fitViewport(
  rects: Rect[],
  width: number,
  height: number,
): Viewport {
  if (!rects.length || width <= 0 || height <= 0)
    return { x: 20, y: 20, zoom: 1 }
  const x = Math.min(...rects.map((r) => r.x)) - 16,
    y = Math.min(...rects.map((r) => r.y)) - 50
  const w = Math.max(...rects.map((r) => r.x + r.width)) - x + 20,
    h = Math.max(...rects.map((r) => r.y + r.height)) - y + 24
  const zoom = Math.max(
    0.25,
    Math.min(1.25, (width - 40) / w, (height - 40) / h),
  )
  return {
    x: (width - w * zoom) / 2 - x * zoom,
    y: (height - h * zoom) / 2 - y * zoom,
    zoom,
  }
}
export function zoomViewport(
  view: Viewport,
  factor: number,
  at: Point,
): Viewport {
  const zoom = Math.max(0.25, Math.min(1.75, view.zoom * factor))
  return {
    zoom,
    x: at.x - ((at.x - view.x) * zoom) / view.zoom,
    y: at.y - ((at.y - view.y) * zoom) / view.zoom,
  }
}
export function nodeType(node: ModelNode) {
  return node.source === 'Dim'
    ? 'Reference'
    : node.stage === 'source'
      ? 'Source'
      : node.stage === 'output'
        ? 'Output'
        : node.stage === 'recognition'
          ? 'Event view'
          : node.stage === 'reconciliation'
            ? 'Aggregate'
            : 'Transform'
}
