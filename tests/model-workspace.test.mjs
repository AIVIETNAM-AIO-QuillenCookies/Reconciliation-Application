import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  modelNodes,
  modelConnections,
  methodologyRules,
} from '../src/lib/methodology.ts'
import {
  pipelineGraph,
  routeEdge,
  segmentHitsRect,
  fitViewport,
  zoomViewport,
  traceBranch,
  filterRules,
  filterEvidenceRows,
  ruleStatus,
  relatedNodeIds,
} from '../src/lib/model-workspace.ts'

test('all graph presentations use stable metadata IDs and route orthogonally around nodes', () => {
  const original = JSON.stringify([
    modelNodes,
    modelConnections,
    methodologyRules,
  ])
  for (const scope of ['flow', 'all', 'references'])
    for (const source of ['All', 'POS', 'WEB', 'GL', 'Flash', 'Dim']) {
      const graph = pipelineGraph(scope, source)
      for (const [index, edge] of graph.edges.entries()) {
        assert.ok(modelConnections.some((e) => e.id === edge.id))
        const points = routeEdge(edge, graph.positions, index)
        for (let i = 1; i < points.length; i++) {
          assert.ok(
            points[i].x === points[i - 1].x || points[i].y === points[i - 1].y,
            `${edge.id} must be orthogonal`,
          )
          for (const [id, rect] of graph.positions)
            if (id !== edge.from && id !== edge.to)
              assert.equal(
                segmentHitsRect(points[i - 1], points[i], rect),
                false,
                `${scope}/${source}: ${edge.id} intersects ${id}`,
              )
        }
      }
    }
  assert.equal(pipelineGraph('all').nodes.length, modelNodes.length)
  assert.equal(pipelineGraph('all').edges.length, modelConnections.length)
  assert.equal(
    JSON.stringify([modelNodes, modelConnections, methodologyRules]),
    original,
  )
})
test('fit view contains all nodes at desktop viewport sizes and reflows for resize; zoom keeps the cursor anchor stable', () => {
  for (const [width, height] of [
    [710, 495],
    [775, 610],
    [950, 650],
  ]) {
    const rects = [...pipelineGraph('all').positions.values()]
    const view = fitViewport(rects, width, height)
    for (const r of rects) {
      assert.ok(r.x * view.zoom + view.x >= 0)
      assert.ok(r.y * view.zoom + view.y >= 0)
      assert.ok((r.x + r.width) * view.zoom + view.x <= width)
      assert.ok((r.y + r.height) * view.zoom + view.y <= height)
    }
  }
  const start = { x: 20, y: 30, zoom: 0.8 },
    at = { x: 370, y: 260 }
  const end = zoomViewport(start, 1.2, at)
  assert.ok(
    Math.abs((at.x - end.x) / end.zoom - (at.x - start.x) / start.zoom) < 1e-9,
  )
  assert.ok(
    Math.abs((at.y - end.y) / end.zoom - (at.y - start.y) / start.zoom) < 1e-9,
  )
  assert.equal(zoomViewport(start, 100, at).zoom, 1.75)
  assert.equal(zoomViewport(start, 0.001, at).zoom, 0.25)
})
test('branch highlighting follows upstream/downstream paths without adding peer source branches', () => {
  const branch = traceBranch(['raw_pos'])
  assert.ok(branch.nodes.has('results'))
  assert.ok(branch.nodes.has('dim_store'))
  assert.ok(!branch.nodes.has('raw_web'))
  assert.ok(!branch.edges.has('web-normalize'))
  assert.ok(relatedNodeIds('pos-dedup').includes('vw_pos'))
  assert.equal(
    modelConnections.find((edge) => edge.id === 'pos-bridge').from,
    'q_POS_Dup_Impact',
  )
  assert.equal(
    modelConnections.find((edge) => edge.id === 'pos-timing-bridge').from,
    'vw_pos',
  )
  assert.ok(
    modelNodes
      .find((node) => node.id === 'q_POS_Dup_Impact')
      .relation.includes('q_POS_Dup_Rows'),
  )
})
test('rules search/filter metadata without changing definitions or inventing run status', () => {
  const filters = { query: '', source: 'All', group: 'All' }
  assert.equal(filterRules(filters).length, methodologyRules.length)
  assert.deepEqual(
    filterRules({ ...filters, source: 'WEB', group: 'Amounts' }).map(
      (r) => r.id,
    ),
    ['net-precedence'],
  )
  assert.ok(
    filterRules({ ...filters, query: 'ROW_NUMBER' }).some(
      (r) => r.id === 'pos-dedup',
    ),
  )
  assert.equal(ruleStatus('pos-dedup').label, 'Definition')
  assert.equal(ruleStatus('report-fx').label, 'Definition')
  assert.equal(
    ruleStatus('pos-dedup', {
      ruleApplications: [
        { id: 'pos-dedup', status: 'applied', detail: 'Executed run evidence' },
      ],
    }).label,
    'Applied',
  )
})
test('evidence filtering retains source record ordinals and its original bounded scope', () => {
  const rows = [
    { source: 'POS', event_type: 'sale', transaction_id: '001' },
    { source: 'WEB', event_type: 'return', transaction_id: '002' },
  ]
  const table = { rows, rowCount: 400, truncated: true }
  const matches = filterEvidenceRows(table, {
    source: 'WEB',
    eventType: 'return',
    query: '002',
  })
  assert.deepEqual(
    matches.map((r) => r.index),
    [1],
  )
  assert.equal(matches[0].row, rows[1])
  assert.equal(table.rowCount, 400)
  assert.equal(
    filterEvidenceRows(table, { source: 'All', eventType: 'All', query: '003' })
      .length,
    0,
  )
})
