import { displayNodeById, nodeTypeLabel } from '@/lib/localized-model'
import { vt } from '@/lib/i18n'
import {
  Database,
  FileSpreadsheet,
  Layers3,
  GitBranch,
  Workflow,
  Table2,
  BarChart3,
} from 'lucide-react'
import type { ModelNode } from '@/lib/methodology'
import { nodeType, type Rect } from '@/lib/model-workspace'

export function NodeIcon({
  node,
  size = 16,
}: {
  node: ModelNode
  size?: number
}) {
  const Icon =
    node.source === 'Dim'
      ? Database
      : node.stage === 'source'
        ? FileSpreadsheet
        : node.stage === 'output'
          ? BarChart3
          : node.stage === 'recognition'
            ? GitBranch
            : node.stage === 'reconciliation'
              ? Table2
              : Workflow
  return <Icon size={size} aria-hidden="true" />
}
export function PipelineNode({
  node,
  rect,
  selected,
  muted,
  onSelect,
  onFocus,
}: {
  node: ModelNode
  rect?: Rect
  selected: boolean
  muted?: boolean
  onSelect: () => void
  onFocus?: () => void
}) {
  node = displayNodeById.get(node.id) ?? node
  return (
    <button
      type="button"
      data-node-id={node.id}
      className={`mw-node ${selected ? 'is-selected' : ''} ${muted ? 'is-muted' : ''}`}
      style={
        rect
          ? {
              left: rect.x,
              top: rect.y,
              width: rect.width,
              height: rect.height,
            }
          : undefined
      }
      aria-pressed={selected}
      aria-label={vt`Inspect node: ${node.title}`}
      onClick={onSelect}
      onFocus={onFocus}
    >
      {rect && (
        <>
          <i className="mw-handle mw-handle-left" />
          <i className="mw-handle mw-handle-right" />
          <i className="mw-handle mw-handle-top" />
          <i className="mw-handle mw-handle-bottom" />
        </>
      )}
      <span className="mw-node-top">
        <span
          className={`mw-node-icon mw-node-icon-${node.source?.toLowerCase() ?? node.stage}`}
        >
          <NodeIcon node={node} />
        </span>
        <span className="mw-node-badge">
          {node.source === 'Flash'
            ? 'Sales Flash'
            : (node.source ?? nodeTypeLabel(nodeType(node)))}
        </span>
        <Layers3 size={12} className="mw-node-kind" aria-hidden="true" />
      </span>
      <strong className="mw-node-title">{node.title}</strong>
      <span className="mw-node-grain" title={node.grain}>
        {node.grain}
      </span>
      <span className="mw-node-identifier">{node.id}</span>
    </button>
  )
}
