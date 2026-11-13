import { vi } from '@/lib/i18n'
import { vt } from '@/lib/i18n'
import type { ModelConnection } from '@/lib/methodology'
import { edgePath, type Point } from '@/lib/model-workspace'

export function PipelineEdge({
  edge,
  points,
  selected,
  highlighted,
  muted,
  markerId,
  onSelect,
  onFocus,
}: {
  edge: ModelConnection
  points: Point[]
  selected: boolean
  highlighted: boolean
  muted: boolean
  markerId: string
  onSelect: () => void
  onFocus: () => void
}) {
  const path = edgePath(points)
  return (
    <g
      data-edge-id={edge.id}
      className={`mw-edge ${selected ? 'is-selected' : ''} ${highlighted ? 'is-highlighted' : ''} ${muted ? 'is-muted' : ''}`}
    >
      <path className="mw-edge-line" d={path} markerEnd={`url(#${markerId})`} />
      <path
        className="mw-edge-hit"
        d={path}
        tabIndex={0}
        role="button"
        aria-label={vt`Inspect connection: ${vi(edge.label)}`}
        aria-pressed={selected}
        onClick={onSelect}
        onFocus={(e) => {
          if (e.currentTarget.matches(':focus-visible')) onFocus()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onSelect()
          }
        }}
      >
        <title>{vi(edge.label)}</title>
      </path>
    </g>
  )
}
