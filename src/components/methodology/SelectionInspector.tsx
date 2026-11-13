import { nodeTypeLabel } from '@/lib/localized-model'
import { LocalizedNote } from '@/components/LocalizedError'
import { displayRules as methodologyRules } from '@/lib/localized-model'
import {
  displayNodeById as nodeById,
  displayEdgeById as edgeById,
  displayRuleById as ruleById,
} from '@/lib/localized-model'
import { vi, vt, viMessage, displayValue } from '@/lib/i18n'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  Braces,
  Check,
  Copy,
  Database,
  GitBranch,
  MousePointer2,
  Table2,
  LockKeyhole,
} from 'lucide-react'

import {
  relatedNodeIds,
  ruleStatus,
  nodeType,
  type WorkspaceSelection,
  type WorkspaceTab,
} from '@/lib/model-workspace'
import type { RunEvidence } from '@/lib/reconciliation-evidence'
import { NodeIcon } from './PipelineNode'
import { RecordProof, RuleRecordEvidence } from './RecordProof'

function Section({
  title,
  children,
  expandable = false,
  count,
}: {
  title: string
  children: ReactNode
  expandable?: boolean
  count?: number
}) {
  return expandable ? (
    <details className="mw-inspector-section mw-disclosure">
      <summary>
        {title}
        {count != null && <span>{count}</span>}
      </summary>
      <div>{children}</div>
    </details>
  ) : (
    <section className="mw-inspector-section">
      <h3>
        {title}
        {count != null && <span>{count}</span>}
      </h3>
      {children}
    </section>
  )
}
function Expression({ text }: { text: string }) {
  const [feedback, setFeedback] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )
  return (
    <div className="mw-expression">
      <div>
        <span>{vi('EXPRESSION / IMPLEMENTATION')}</span>
        <button
          type="button"
          aria-label={vi('Copy expression')}
          disabled={!navigator.clipboard?.writeText}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text)
              setFeedback('Copied')
            } catch {
              setFeedback('Unable to copy')
            }
            if (timer.current) clearTimeout(timer.current)
            timer.current = setTimeout(() => setFeedback(''), 1800)
          }}
        >
          {feedback === 'Copied' ? <Check size={12} /> : <Copy size={12} />}
          {vi(feedback) || vi('Copy')}
        </button>
      </div>
      <pre data-technical="true">
        <code>{text}</code>
      </pre>
      <span className="sr-only" role="status">
        {vi(feedback)}
      </span>
    </div>
  )
}
export function SelectionInspector({
  selection,
  tab,
  evidence,
  onNode,
  onRule,
  onTable,
}: {
  selection: WorkspaceSelection | null
  tab: WorkspaceTab
  evidence?: RunEvidence
  onNode: (id: string) => void
  onRule: (id: string) => void
  onTable?: (id: string) => void
}) {
  const node =
    selection?.kind === 'node' ? nodeById.get(selection.id) : undefined
  const edge =
    selection?.kind === 'connection' ? edgeById.get(selection.id) : undefined
  const rule =
    selection?.kind === 'rule' ? ruleById.get(selection.id) : undefined
  const nodeRole = node
    ? (
        {
          dim_store: 'store',
          dim_date: 'calendar',
          fx_daily: 'fxDaily',
          fx_month_end: 'fxMonthEnd',
        } as const
      )[node.id as 'dim_store' | 'dim_date' | 'fx_daily' | 'fx_month_end']
    : undefined
  const nodeReference = nodeRole
    ? evidence?.masterConfiguration?.roles[nodeRole]
    : undefined
  const nodeTable =
    node &&
    evidence?.tables.find(
      (item) =>
        item.id === node.id ||
        (nodeReference?.usage === 'enabled' &&
          item.id === `dim:${nodeReference.sheetName}`),
    )
  const referenceRole = edge
    ? (
        {
          dim_store: 'store',
          dim_date: 'calendar',
          fx_daily: 'fxDaily',
          fx_month_end: 'fxMonthEnd',
        } as const
      )[edge.from as 'dim_store' | 'dim_date' | 'fx_daily' | 'fx_month_end']
    : undefined
  const executedJoins =
    evidence?.masterJoins?.filter(
      (join) =>
        join.role === referenceRole &&
        (!edge ||
          !nodeById.get(edge.to)?.source ||
          join.source === nodeById.get(edge.to)?.source),
    ) ?? []
  const table =
    selection?.kind === 'record'
      ? evidence?.tables.find((t) => t.id === selection.tableId)
      : selection?.kind === 'table'
        ? evidence?.tables.find((t) => t.id === selection.id)
        : undefined
  const record =
    selection?.kind === 'record' && selection.runId === evidence?.runId
      ? table?.rows[selection.rowIndex]
      : undefined
  const title =
    node?.title ??
    edge?.label ??
    rule?.title ??
    (record && selection?.kind === 'record'
      ? vt`Record ${selection.rowIndex + 1}`
      : table
        ? viMessage(table.label)
        : undefined)
  const type = node
    ? nodeTypeLabel(nodeType(node))
    : edge
      ? vi('Connection')
      : rule
        ? vi('Rule definition')
        : record
          ? vi('Evidence record')
          : vi('Evidence table')
  const links = (ids: string[]) => (
    <div className="mw-related-links">
      {ids.map((id) => {
        const n = nodeById.get(id)
        return (
          n && (
            <button type="button" key={id} onClick={() => onNode(id)}>
              <NodeIcon node={n} size={13} />
              <span>{n.title}</span>
              <ArrowUpRight size={12} />
            </button>
          )
        )
      })}
    </div>
  )
  return (
    <div className="mw-inspector-content">
      <div className="mw-inspector-label">
        <span>{vi('INSPECTOR')}</span>
        <LockKeyhole size={11} />
      </div>
      {!selection || !title ? (
        <div className="mw-inspector-empty">
          <span className="mw-inspector-empty-art">
            <MousePointer2 size={24} />
          </span>
          <h2>
            {tab === 'pipeline' || tab === 'sources'
              ? vi('Follow a connection')
              : tab === 'rules'
                ? vi('Every rule has a reason')
                : vi('Look inside a record')}
          </h2>
          <p>
            {tab === 'pipeline' || tab === 'sources'
              ? vi(
                  'Select a node or connection to explore its role in the reconciliation.',
                )
              : tab === 'rules'
                ? vi(
                    'Select a rule to see its inputs, behavior, and related pipeline nodes.',
                  )
                : vi(
                    'Select a retained record to inspect its values and run context.',
                  )}
          </p>
          <span>
            {tab === 'pipeline' || tab === 'sources'
              ? vi('Tip: use Fit view to see the full flow.')
              : tab === 'rules'
                ? vi('Search and filters only change this view.')
                : vi('Only successful-run evidence is shown.')}
          </span>
        </div>
      ) : (
        <>
          <header className="mw-inspector-header">
            <span className="mw-inspector-object-icon">
              {node ? (
                <NodeIcon node={node} size={20} />
              ) : edge ? (
                <GitBranch size={20} />
              ) : rule ? (
                <Braces size={20} />
              ) : (
                <Table2 size={20} />
              )}
            </span>
            <span className="mw-eyebrow">{type}</span>
            <h2>{title}</h2>
            <code>{node?.id ?? edge?.id ?? rule?.id ?? table?.id}</code>
            {rule && (
              <div className="mw-inspector-badges">
                <span
                  className={`mw-badge mw-status-${ruleStatus(rule.id, evidence).tone}`}
                >
                  {vi(ruleStatus(rule.id, evidence).label)}
                </span>
                <span className="mw-badge">{rule.group}</span>
              </div>
            )}
            {node?.source && (
              <div className="mw-inspector-badges">
                <span className="mw-badge">
                  {node.source === 'Flash' ? 'Sales Flash' : node.source}
                </span>
                <span className="mw-badge">
                  {node.implementation === 'implemented'
                    ? vi('Implemented')
                    : node.implementation === 'reference'
                      ? vi('Reference model')
                      : vi('Not implemented')}
                </span>
              </div>
            )}
          </header>
          <div className="mw-inspector-scroll" key={selection.id}>
            {node && (
              <>
                <Section title={vi('Role')}>
                  <p>{node.role}</p>
                </Section>
                <Section title={vi('Grain')}>
                  <p>{node.grain}</p>
                </Section>
                {node.keys.length > 0 && (
                  <Section title={vi('Keys')}>
                    <ul className="mw-key-list">
                      {node.keys.map((k) => (
                        <li key={k}>
                          <code>{k}</code>
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}
                {node.fields.length > 0 && (
                  <Section
                    title={vi('Schema')}
                    expandable
                    count={node.fields.length}
                  >
                    <dl className="mw-schema-list">
                      {node.fields.map((f, i) => (
                        <div key={`${f.name}-${i}`}>
                          <dt>
                            <code>{f.name}</code>
                          </dt>
                          <dd>
                            <span className="mw-field-type">{f.type}</span>
                            <p>{f.description}</p>
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </Section>
                )}
                {node.logic.length > 0 && (
                  <Section title={vi('Processing behavior')} expandable>
                    <ul className="mw-detail-list">
                      {node.logic.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </Section>
                )}
                {node.caution && (
                  <Section title={vi('Validation / edge cases')} expandable>
                    <p>{node.caution}</p>
                  </Section>
                )}
                {nodeTable && (
                  <Section title={vi('Retained run preview')}>
                    <p>
                      {nodeTable.rowCount.toLocaleString()} {vi('total rows')} ·{' '}
                      {nodeTable.rows.length} {vi('retained')}
                    </p>
                    <p className="mw-muted">{viMessage(nodeTable.grain)}</p>
                    {nodeTable.rows.slice(0, 2).map((row, index) => (
                      <dl
                        key={index}
                        className="mw-record-values mw-proof-step"
                      >
                        {Object.entries(row)
                          .filter(([key]) =>
                            [
                              'transaction_id',
                              'receipt_no',
                              'web_order_id',
                              'journal_id',
                              'event_type',
                              'posting_date',
                              'revenue_usd',
                              'net_usd_month_end',
                            ].includes(key),
                          )
                          .map(([key, value]) => (
                            <div key={key}>
                              <dt>{key}</dt>
                              <dd>{value ?? 'NULL'}</dd>
                            </div>
                          ))}
                      </dl>
                    ))}
                    {onTable && (
                      <button
                        type="button"
                        className="mw-source-link"
                        onClick={() => onTable(nodeTable.id)}
                      >
                        {vi('Explore retained output rows')}
                        <ArrowUpRight size={13} />
                      </button>
                    )}
                    {onTable &&
                      evidence?.files
                        .filter(
                          (file) =>
                            file.source === node.source &&
                            evidence.tables.some(
                              (table) => table.id === `uploaded:${file.fileId}`,
                            ),
                        )
                        .map((file) => (
                          <button
                            key={file.fileId}
                            type="button"
                            className="mw-source-link mt-2"
                            onClick={() => onTable(`uploaded:${file.fileId}`)}
                          >
                            {vi('Input')}: {file.fileName}
                            <ArrowUpRight size={13} />
                          </button>
                        ))}
                  </Section>
                )}
                <Section title={vi('Related rules')}>
                  <div className="mw-related-links">
                    {methodologyRules
                      .filter((r) => relatedNodeIds(r.id).includes(node.id))
                      .map((r) => (
                        <button
                          type="button"
                          key={r.id}
                          onClick={() => onRule(r.id)}
                        >
                          <Braces size={13} />
                          <span>{r.title}</span>
                          <ArrowUpRight size={12} />
                        </button>
                      ))}
                  </div>
                  {!methodologyRules.some((r) =>
                    relatedNodeIds(r.id).includes(node.id),
                  ) && (
                    <p className="mw-muted">
                      {' ' +
                        vi('No direct rule link is defined in the metadata.') +
                        ' '}
                    </p>
                  )}
                </Section>
              </>
            )}
            {edge && (
              <>
                <Section title={vi('Connected nodes')}>
                  <div className="mw-connection-endpoints">
                    {links([edge.from])}
                    <ArrowRight size={14} />
                    {links([edge.to])}
                  </div>
                </Section>
                <Section title={vi('Operation')}>
                  <p>{edge.operation}</p>
                </Section>
                {edge.keys.length > 0 && (
                  <Section title={vi('Key pairs / conditions')}>
                    <ul className="mw-key-list">
                      {edge.keys.map((k) => (
                        <li key={k}>
                          <code>{k}</code>
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}
                <Section title={vi('Cardinality')}>
                  <p>{edge.cardinality}</p>
                </Section>
                <Section title={vi('Applies when')}>
                  <p>{edge.condition}</p>
                </Section>
                <Section title={vi('Behavior')}>
                  <p>{edge.explanation}</p>
                </Section>
                {referenceRole && (
                  <Section title={vi('Actual configured joins')}>
                    {!executedJoins.length ? (
                      <p>
                        {vi(
                          'No matching relationship was executed in the current successful snapshot. The connection above describes supported behavior.',
                        )}
                      </p>
                    ) : (
                      executedJoins.map((join) => {
                        const config =
                          evidence?.masterConfiguration?.roles[join.role]
                        const relationship = config?.relationships.find(
                          (item) => item.id === join.relationshipId,
                        )
                        return (
                          <div
                            key={`${join.relationshipId}:${join.fileId}`}
                            className="mw-proof-step"
                          >
                            <h4>
                              {join.source} · {config?.sheetName}
                            </h4>
                            <p>
                              {
                                evidence?.files.find(
                                  (file) => file.fileId === join.fileId,
                                )?.fileName
                              }
                            </p>
                            <p>
                              {relationship?.keys
                                .map(
                                  (pair) =>
                                    `${pair.sourceField} → ${config?.columns[pair.referenceField]}`,
                                )
                                .join(' AND ')}
                            </p>
                            <p>
                              {vi(
                                'Left lookup · many-to-one · unmatched policy',
                              )}
                              : {relationship?.unmatched}
                            </p>
                            <p>
                              {vi('Returned fields')}:{' '}
                              {relationship?.outputs
                                .map((field) => config?.columns[field])
                                .join(', ')}
                            </p>
                            <p>
                              {join.rowsBefore} → {join.rowsAfter} {vi('rows')}{' '}
                              · {join.unmatchedRows} {vi('unmatched')}
                            </p>
                          </div>
                        )
                      })
                    )}
                  </Section>
                )}
              </>
            )}
            {rule && (
              <>
                <Section title={vi('Purpose')}>
                  <p>{rule.purpose}</p>
                </Section>
                <Section title={vi('Applies to')}>
                  <div className="mw-tag-list">
                    {rule.sourceIds.map((s) => (
                      <span className="mw-badge" key={s}>
                        {s === 'Flash' ? 'Sales Flash' : s}
                      </span>
                    ))}
                  </div>
                </Section>
                {rule.inputFields.length > 0 && (
                  <Section title={vi('Inputs')}>
                    <ul className="mw-key-list">
                      {rule.inputFields.map((f) => (
                        <li key={f}>
                          <code>{f}</code>
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}
                {rule.condition && (
                  <Section title={vi('Condition')}>
                    <p>{rule.condition}</p>
                  </Section>
                )}
                {rule.logic && (
                  <Section title={vi('Formula / behavior')}>
                    <p>{rule.logic}</p>
                  </Section>
                )}
                {rule.technical && (
                  <Section title={vi('Technical expression')} expandable>
                    <Expression text={rule.technical} />
                    {rule.technicalSource && (
                      <p className="mw-technical-source">
                        {viMessage(rule.technicalSource)}
                      </p>
                    )}
                  </Section>
                )}
                {rule.output && (
                  <Section title={vi('Outputs')}>
                    <p>{rule.output}</p>
                  </Section>
                )}
                {rule.nullError && (
                  <Section title={vi('Validation / edge cases')} expandable>
                    <p>{rule.nullError}</p>
                  </Section>
                )}
                <Section title={vi('Run evidence')} expandable>
                  <LocalizedNote
                    message={ruleStatus(rule.id, evidence).detail}
                  />
                </Section>
                {evidence && (
                  <Section title={vi('Inspect a real record')} expandable>
                    <RuleRecordEvidence
                      key={`${evidence.runId}:${rule.id}`}
                      rule={rule}
                      evidence={evidence}
                      onRule={onRule}
                    />
                  </Section>
                )}
                {relatedNodeIds(rule.id).length > 0 && (
                  <Section title={vi('Related pipeline nodes')}>
                    {links(relatedNodeIds(rule.id))}
                  </Section>
                )}
              </>
            )}
            {table && (
              <>
                <Section title={vi('Preview scope')}>
                  <p>{viMessage(table.grain)}</p>
                  <div className="mw-evidence-facts">
                    <span>
                      <strong>{table.rowCount.toLocaleString()}</strong>
                      {vi('Total rows') + ' '}
                    </span>
                    <span>
                      <strong>{table.rows.length}</strong>
                      {vi('Retained') + ' '}
                    </span>
                  </div>
                </Section>
                {record && (
                  <Section title={vi('Input → logic → output')} expandable>
                    <RecordProof
                      record={record}
                      evidence={evidence!}
                      onRule={onRule}
                    />
                  </Section>
                )}
                {record && (
                  <Section title={vi('Record values')}>
                    <dl className="mw-record-values">
                      {Object.entries(record).map(([key, value]) =>
                        key === 'input_values' && value ? (
                          <details key={key}>
                            <summary>{vi('Original input values')}</summary>
                            <pre data-technical="true">{value}</pre>
                          </details>
                        ) : (
                          <div key={key}>
                            <dt>{key}</dt>
                            <dd>
                              {value == null ? (
                                <i className="mw-null">NULL</i>
                              ) : (
                                displayValue(key, value)
                              )}
                            </dd>
                          </div>
                        ),
                      )}
                    </dl>
                  </Section>
                )}
                {!record && (
                  <Section
                    title={vi('Schema')}
                    expandable
                    count={table.columns.length}
                  >
                    <dl className="mw-schema-list">
                      {table.columns.map((c) => (
                        <div key={c.name}>
                          <dt>
                            <code>{c.name}</code>
                          </dt>
                          <dd>{c.type}</dd>
                        </div>
                      ))}
                    </dl>
                  </Section>
                )}
                <Section title={vi('Run context')} expandable>
                  <dl className="mw-context-list">
                    <dt>{vi('Run ID')}</dt>
                    <dd>
                      <code>{evidence?.runId}</code>
                    </dd>
                    <dt>{vi('Reporting period')}</dt>
                    <dd>
                      {evidence?.period.start} → {evidence?.period.end}
                    </dd>
                    <dt>{vi('Scope')}</dt>
                    <dd>{evidence && viMessage(evidence.scope)}</dd>
                  </dl>
                  <div className="mw-muted">
                    {evidence && (
                      <LocalizedNote message={evidence.sourceRowNote} />
                    )}
                  </div>
                </Section>
                {nodeById.has(table.id) && (
                  <Section title={vi('Related pipeline node')}>
                    {links([table.id])}
                  </Section>
                )}
              </>
            )}
          </div>
          <footer className="mw-inspector-footer">
            <Database size={12} />
            {' ' +
              vi('View only · Processing configuration is unchanged') +
              ' '}
          </footer>
        </>
      )}
    </div>
  )
}
