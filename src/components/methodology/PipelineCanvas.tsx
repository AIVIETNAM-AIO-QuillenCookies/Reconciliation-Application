import { vi, vt } from '@/lib/i18n'
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import {
  Focus,
  Hand,
  Minus,
  Plus,
  RotateCcw,
  ChevronRight,
  GitBranch,
} from 'lucide-react'
import {
  STAGES,
  pipelineGraph,
  routeEdge,
  fitViewport,
  traceBranch,
  zoomViewport,
  type PipelineScope,
  type Viewport,
  type WorkspaceSelection,
} from '@/lib/model-workspace'
import { PipelineNode } from './PipelineNode'
import { PipelineEdge } from './PipelineEdge'

export function PipelineCanvas({
  selection,
  onSelect,
  scope,
  onScopeChange,
  source,
  onSourceChange,
  focusRequest,
  processingStage,
}: {
  selection: WorkspaceSelection | null
  onSelect: (s: WorkspaceSelection) => void
  scope: PipelineScope
  onScopeChange: (scope: PipelineScope) => void
  source: string
  onSourceChange: (source: string) => void
  focusRequest: { id: string; serial: number } | null
  processingStage?: string | null
}) {
  const graph = useMemo(() => pipelineGraph(scope, source), [scope, source])
  const edges = useMemo(
    () =>
      graph.edges.map((edge, i) => ({
        edge,
        points: routeEdge(edge, graph.positions, i),
      })),
    [graph],
  )
  const [view, setView] = useState<Viewport>({ x: 18, y: 8, zoom: 1 })
  const [panning, setPanning] = useState(false)
  const [mobileStage, setMobileStage] = useState<string>('source')
  const surface = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; view: Viewport } | null>(null)
  const dimensions = useRef({ width: 720, height: 500 })
  const marker = `mw-arrow-${useId().replaceAll(':', '')}`
  const seeds =
    selection?.kind === 'node'
      ? [selection.id]
      : selection?.kind === 'connection'
        ? graph.edges
            .filter((e) => e.id === selection.id)
            .flatMap((e) => [e.from, e.to])
        : []
  const branch = seeds.length ? traceBranch(seeds, graph.edges) : null
  const groups = [...STAGES, { id: 'reference', label: vi('References'), x: 0 }]
    .map((stage) => ({
      ...stage,
      nodes: graph.nodes.filter((n) =>
        stage.id === 'reference'
          ? n.source === 'Dim'
          : n.stage === stage.id && n.source !== 'Dim',
      ),
    }))
    .filter((stage) => stage.nodes.length)
  const fit = () =>
    setView(
      fitViewport(
        [...graph.positions.values()],
        dimensions.current.width,
        dimensions.current.height,
      ),
    )
  const zoom = (factor: number) =>
    setView((v) =>
      zoomViewport(v, factor, {
        x: dimensions.current.width / 2,
        y: dimensions.current.height / 2,
      }),
    )
  useEffect(() => {
    const element = surface.current
    if (!element) return
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect
      if (box?.width && box.height)
        dimensions.current = { width: box.width, height: box.height }
    })
    observer.observe(element)
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      if (event.ctrlKey || event.metaKey) {
        const rect = element.getBoundingClientRect()
        setView((v) =>
          zoomViewport(v, Math.exp(-event.deltaY * 0.005), {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          }),
        )
      } else
        setView((v) => ({ ...v, x: v.x - event.deltaX, y: v.y - event.deltaY }))
    }
    element.addEventListener('wheel', wheel, { passive: false })
    return () => {
      observer.disconnect()
      element.removeEventListener('wheel', wheel)
    }
  }, [])
  useEffect(() => {
    if (
      !focusRequest ||
      selection?.kind !== 'node' ||
      selection.id !== focusRequest.id
    )
      return
    const rect = graph.positions.get(focusRequest.id)
    if (!rect) return
    const frame = requestAnimationFrame(() => {
      const node = graph.nodes.find((n) => n.id === focusRequest.id)
      if (node) setMobileStage(node.source === 'Dim' ? 'reference' : node.stage)
      setView((v) => ({
        ...v,
        zoom: Math.max(0.85, v.zoom),
        x:
          dimensions.current.width / 2 -
          (rect.x + rect.width / 2) * Math.max(0.85, v.zoom),
        y:
          dimensions.current.height / 2 -
          (rect.y + rect.height / 2) * Math.max(0.85, v.zoom),
      }))
    })
    return () => cancelAnimationFrame(frame)
  }, [focusRequest, graph, selection])
  function keyboard(e: KeyboardEvent) {
    if (e.target !== e.currentTarget) return
    if (e.key === '+' || e.key === '=') zoom(1.2)
    else if (e.key === '-') zoom(1 / 1.2)
    else if (e.key.toLowerCase() === 'f') fit()
    else if (e.key === '0') setView({ x: 18, y: 8, zoom: 1 })
    else if (
      ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)
    )
      setView((v) => ({
        ...v,
        x:
          v.x + (e.key === 'ArrowLeft' ? 70 : e.key === 'ArrowRight' ? -70 : 0),
        y: v.y + (e.key === 'ArrowUp' ? 70 : e.key === 'ArrowDown' ? -70 : 0),
      }))
    else return
    e.preventDefault()
  }
  const focusNode = (id: string) => {
    const rect = graph.positions.get(id)!
    setView((v) => {
      const { width, height } = dimensions.current
      if (
        rect.x * v.zoom + v.x >= 0 &&
        (rect.x + rect.width) * v.zoom + v.x <= width &&
        rect.y * v.zoom + v.y >= 0 &&
        (rect.y + rect.height) * v.zoom + v.y <= height
      )
        return v
      return {
        ...v,
        x: width / 2 - (rect.x + rect.width / 2) * v.zoom,
        y: height / 2 - (rect.y + rect.height / 2) * v.zoom,
      }
    })
  }
  const empty = (
    <div className="mw-empty">
      <span className="mw-empty-icon">
        <GitBranch size={24} />
      </span>
      <h3>{vi('No nodes in this view')}</h3>
      <p>{vi('This source has no nodes in the selected view.')}</p>
      <button
        type="button"
        className="mw-text-button"
        onClick={() => {
          onScopeChange('flow')
          onSourceChange('All')
          setView({ x: 18, y: 8, zoom: 1 })
        }}
      >
        {' ' + vi('Return to primary flow') + ' '}
      </button>
    </div>
  )
  return (
    <section
      className="mw-pipeline"
      aria-label={vi('Interactive data pipeline')}
    >
      <div className="mw-panel-toolbar">
        <div className="mw-toolbar-cluster">
          <GitBranch size={15} />
          <select
            aria-label={vi('Pipeline view')}
            value={scope}
            onChange={(e) => {
              onScopeChange(e.target.value as PipelineScope)
              setView({ x: 18, y: 8, zoom: 1 })
            }}
          >
            <option value="flow">{vi('Primary flow')}</option>
            <option value="all">{vi('All connections & references')}</option>
            <option value="references">{vi('Reference lookups')}</option>
          </select>
          <span className="mw-toolbar-separator" />
          <select
            aria-label={vi('Focus source branch')}
            value={source}
            onChange={(e) => {
              onSourceChange(e.target.value)
              setView({ x: 18, y: 8, zoom: 0.9 })
            }}
          >
            <option value="All">{vi('All sources')}</option>
            {['POS', 'WEB', 'GL', 'Flash', 'Dim'].map((s) => (
              <option key={s} value={s}>
                {s === 'Flash' ? 'Sales Flash' : s}
              </option>
            ))}
          </select>
          <select
            aria-label={vi('Focus pipeline stage')}
            value=""
            onChange={(e) => {
              const stage = groups.find((s) => s.id === e.target.value)
              if (stage) {
                setMobileStage(stage.id)
                setView(
                  fitViewport(
                    stage.nodes.map((n) => graph.positions.get(n.id)!),
                    dimensions.current.width,
                    dimensions.current.height,
                  ),
                )
              }
            }}
          >
            <option value="">{vi('Jump to stage')}</option>
            {groups.map((s) => (
              <option key={s.id} value={s.id}>
                {vi(s.label)}
              </option>
            ))}
          </select>
        </div>
        <span className="mw-meta">
          {graph.nodes.length}
          {' ' + vi('nodes ·') + ' '}
          {graph.edges.length}
          {' ' + vi('connections') + ' '}
        </span>
      </div>
      <div
        ref={surface}
        className={`mw-canvas-surface ${panning ? 'is-panning' : ''}`}
        role="region"
        aria-label={vi(
          'Pipeline canvas. Drag to pan, use plus or minus to zoom, F to fit, and arrow keys to pan.',
        )}
        tabIndex={0}
        onKeyDown={keyboard}
        onPointerDown={(e) => {
          if (
            e.button !== 0 ||
            (e.target as Element).closest('button,[role="button"]')
          )
            return
          e.currentTarget.focus()
          e.currentTarget.setPointerCapture?.(e.pointerId)
          drag.current = { x: e.clientX, y: e.clientY, view }
          setPanning(true)
        }}
        onPointerMove={(e) => {
          if (drag.current)
            setView({
              ...drag.current.view,
              x: drag.current.view.x + e.clientX - drag.current.x,
              y: drag.current.view.y + e.clientY - drag.current.y,
            })
        }}
        onPointerUp={() => {
          drag.current = null
          setPanning(false)
        }}
        onPointerCancel={() => {
          drag.current = null
          setPanning(false)
        }}
        onLostPointerCapture={() => {
          drag.current = null
          setPanning(false)
        }}
      >
        {!graph.nodes.length && empty}
        <div
          className="mw-canvas-world"
          data-testid="pipeline-world"
          style={{
            width: graph.width,
            height: graph.height,
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
          }}
        >
          {scope === 'references' ? (
            <>
              <span className="mw-stage-label" style={{ left: 24 }}>
                {' ' + vi('Reference tables')}{' '}
                <span>
                  {graph.nodes.filter((n) => n.source === 'Dim').length}
                </span>
              </span>
              <span className="mw-stage-label" style={{ left: 452 }}>
                {' ' + vi('Source projections') + ' '}
              </span>
            </>
          ) : (
            STAGES.map((stage, i) => (
              <button
                type="button"
                key={stage.id}
                className="mw-stage-label"
                data-current={processingStage === stage.id || undefined}
                style={{ left: stage.x }}
                aria-label={vt`Focus ${vi(stage.label)} stage`}
                onClick={() =>
                  setView(
                    fitViewport(
                      graph.nodes
                        .filter(
                          (n) => n.stage === stage.id && n.source !== 'Dim',
                        )
                        .map((n) => graph.positions.get(n.id)!),
                      dimensions.current.width,
                      dimensions.current.height,
                    ),
                  )
                }
              >
                <span className="mw-stage-index">0{i + 1}</span>
                {vi(stage.label)}
                <span>
                  {
                    graph.nodes.filter(
                      (n) => n.stage === stage.id && n.source !== 'Dim',
                    ).length
                  }
                </span>
              </button>
            ))
          )}
          {scope === 'all' && (
            <span className="mw-reference-label">
              {' ' +
                vi('Optional reference tables · assigned in Import Wizard') +
                ' '}
            </span>
          )}
          <svg
            className="mw-edges"
            width={graph.width}
            height={graph.height}
            aria-label={vi('Pipeline connections')}
          >
            <defs>
              <marker
                id={marker}
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path
                  d="M 1 1 L 9 5 L 1 9"
                  fill="none"
                  stroke="context-stroke"
                  strokeWidth="1.5"
                />
              </marker>
            </defs>
            {edges.map(({ edge, points }) => (
              <PipelineEdge
                key={edge.id}
                edge={edge}
                points={points}
                markerId={marker}
                selected={
                  selection?.kind === 'connection' && selection.id === edge.id
                }
                highlighted={branch?.edges.has(edge.id) ?? false}
                muted={!!branch && !branch.edges.has(edge.id)}
                onSelect={() => onSelect({ kind: 'connection', id: edge.id })}
                onFocus={() =>
                  setView(
                    fitViewport(
                      [
                        graph.positions.get(edge.from)!,
                        graph.positions.get(edge.to)!,
                      ],
                      dimensions.current.width,
                      dimensions.current.height,
                    ),
                  )
                }
              />
            ))}
          </svg>
          {graph.nodes.map((node) => (
            <PipelineNode
              key={node.id}
              node={node}
              rect={graph.positions.get(node.id)}
              selected={selection?.kind === 'node' && selection.id === node.id}
              muted={!!branch && !branch.nodes.has(node.id)}
              onSelect={() => onSelect({ kind: 'node', id: node.id })}
              onFocus={() => focusNode(node.id)}
            />
          ))}
        </div>
        <div className="mw-canvas-hint">
          <Hand size={13} />
          {' ' + vi('Drag to explore')}
          <span>{vi('Ctrl + scroll to zoom')}</span>
        </div>
      </div>
      <div
        className="mw-mobile-overview"
        aria-label={vi('Pipeline grouped overview')}
      >
        {!graph.nodes.length && empty}
        {groups.map((stage) => {
          const nodes = stage.nodes
          return (
            <div className="mw-stage-group" key={stage.id}>
              <button
                type="button"
                aria-expanded={mobileStage === stage.id}
                onClick={() =>
                  setMobileStage(mobileStage === stage.id ? '' : stage.id)
                }
              >
                <span>{vi(stage.label)}</span>
                <span>
                  {nodes.length}
                  <ChevronRight size={14} />
                </span>
              </button>
              {mobileStage === stage.id && (
                <div className="mw-overview-nodes">
                  {nodes.map((node) => (
                    <PipelineNode
                      key={node.id}
                      node={node}
                      selected={
                        selection?.kind === 'node' && selection.id === node.id
                      }
                      onSelect={() => onSelect({ kind: 'node', id: node.id })}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <footer className="mw-canvas-footer">
        <span className="mw-meta">
          {scope === 'flow'
            ? vi(
                'Primary connections shown. Choose All connections to explore adjustments and lookups.',
              )
            : vi('View controls do not change processing configuration.')}
        </span>
        <div className="mw-viewport-controls">
          <button
            type="button"
            aria-label={vi('Zoom out')}
            disabled={view.zoom <= 0.25}
            onClick={() => zoom(1 / 1.2)}
          >
            <Minus size={14} />
          </button>
          <output aria-label={vi('Canvas zoom')}>
            {Math.round(view.zoom * 100)}%
          </output>
          <button
            type="button"
            aria-label={vi('Zoom in')}
            disabled={view.zoom >= 1.75}
            onClick={() => zoom(1.2)}
          >
            <Plus size={14} />
          </button>
          <span />
          <button type="button" onClick={fit} aria-label={vi('Fit view')}>
            <Focus size={14} />
            {' ' + vi('Fit view') + ' '}
          </button>
          <button
            type="button"
            onClick={() => setView({ x: 18, y: 8, zoom: 1 })}
            aria-label={vi('Reset view')}
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </footer>
    </section>
  )
}
