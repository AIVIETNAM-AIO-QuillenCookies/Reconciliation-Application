import { vi, vt, viMessage, displayValue } from '@/lib/i18n'
import {
  Search,
  Table2,
  Columns3,
  ArrowUpRight,
  X,
  LoaderCircle,
} from 'lucide-react'
import type {
  EvidenceTable as Table,
  RunEvidence,
} from '@/lib/reconciliation-evidence'
import {
  filterEvidenceRows,
  type EvidenceFilters,
  type WorkspaceSelection,
} from '@/lib/model-workspace'

export function EvidenceTable({
  evidence,
  table,
  onTableChange,
  selection,
  onSelect,
  filters,
  onFiltersChange,
  processing,
}: {
  evidence?: RunEvidence
  table?: Table
  onTableChange: (id: string) => void
  selection: WorkspaceSelection | null
  onSelect: (s: WorkspaceSelection) => void
  filters: EvidenceFilters
  onFiltersChange: (filters: EvidenceFilters) => void
  processing: boolean
}) {
  const filtered = filterEvidenceRows(table, filters)
  const eventTypes = [
    ...new Set(
      table?.rows.flatMap((r) => (r.event_type ? [r.event_type] : [])) ?? [],
    ),
  ]
  const preferred = [
    'source',
    'transaction_id',
    'line_no',
    'event_type',
    'recognition_date',
    'store_key',
    'revenue_usd',
    'source_file',
    'source_record',
  ]
  const names = table?.columns.map((c) => c.name) ?? []
  const columns = [
    ...preferred.filter((n) => names.includes(n)),
    ...names.filter((n) => !preferred.includes(n) && n !== 'input_values'),
  ]
  const selectRow = (index: number) => {
    if (table && evidence)
      onSelect({
        kind: 'record',
        id: `${evidence.runId}:${table.id}:${index}`,
        tableId: table.id,
        rowIndex: index,
        runId: evidence.runId,
      })
  }
  return (
    <section className="mw-evidence" aria-label={vi('Run evidence explorer')}>
      <div className="mw-panel-toolbar">
        <div className="mw-toolbar-cluster">
          <Table2 size={15} />
          <select
            aria-label={vi('Table or logical view')}
            value={table?.id ?? ''}
            disabled={!evidence || !evidence.tables.length}
            onChange={(e) => onTableChange(e.target.value)}
          >
            {!evidence?.tables.length && (
              <option value="">{vi('No processed snapshot')}</option>
            )}
            {evidence?.tables.map((t) => (
              <option key={t.id} value={t.id}>
                {viMessage(t.label)}
              </option>
            ))}
          </select>
          {table && (
            <span className="mw-badge">
              {table.kind === 'logical' ? vi('Logical view') : vi(table.kind)}
            </span>
          )}
        </div>
        <button
          type="button"
          className={`mw-small-button ${filters.schema ? 'is-active' : ''}`}
          aria-pressed={filters.schema}
          disabled={!table}
          onClick={() =>
            onFiltersChange({ ...filters, schema: !filters.schema })
          }
        >
          <Columns3 size={14} />
          {filters.schema ? vi('View rows') : vi('View schema')}
        </button>
      </div>
      {!evidence || !table ? (
        <div className="mw-empty">
          <span className="mw-empty-icon">
            {processing ? (
              <LoaderCircle className="mw-spinner" size={25} />
            ) : (
              <Table2 size={25} />
            )}
          </span>
          <span className="mw-eyebrow">{vi('RUN EVIDENCE')}</span>
          <h3>
            {processing
              ? vi('Preparing your run evidence')
              : vi('Explore your next successful run')}
          </h3>
          <p>
            {processing
              ? vi('Evidence appears after processing completes successfully.')
              : vi(
                  'Recognition events and source records appear after reconciliation. Pipeline and rule definitions are available now.',
                )}
          </p>
          <span className="mw-badge">
            {processing ? vi('Processing') : vi('No processed snapshot')}
          </span>
        </div>
      ) : (
        <>
          <div className="mw-evidence-filters">
            <div className="mw-search">
              <Search size={14} />
              <input
                aria-label={vi('Search bounded preview')}
                placeholder={vi('Search retained rows…')}
                value={filters.query}
                onChange={(e) =>
                  onFiltersChange({ ...filters, query: e.target.value })
                }
              />
              {filters.query && (
                <button
                  type="button"
                  aria-label={vi('Clear evidence search')}
                  onClick={() => onFiltersChange({ ...filters, query: '' })}
                >
                  <X size={13} />
                </button>
              )}
            </div>
            {names.includes('source') && (
              <select
                aria-label={vi('Filter preview source')}
                value={filters.source}
                onChange={(e) =>
                  onFiltersChange({ ...filters, source: e.target.value })
                }
              >
                {['All', 'POS', 'WEB', 'GL', 'Flash'].map((s) => (
                  <option key={s} value={s}>
                    {s === 'All'
                      ? vi('All sources')
                      : s === 'Flash'
                        ? 'Sales Flash'
                        : s === 'Flash'
                          ? 'Sales Flash'
                          : s === 'Flash'
                            ? 'Sales Flash'
                            : s}
                  </option>
                ))}
              </select>
            )}
            {eventTypes.length > 0 && (
              <select
                aria-label={vi('Filter event type')}
                value={filters.eventType}
                onChange={(e) =>
                  onFiltersChange({ ...filters, eventType: e.target.value })
                }
              >
                <option value="All">{vi('All event types')}</option>
                {eventTypes.map((t) => (
                  <option key={t} value={t}>
                    {displayValue('event_type', t)}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="mw-evidence-caption">
            <span>
              <strong>{table.rowCount.toLocaleString()}</strong>
              {' ' + vi('total rows') + ' '}
              <span> / </span>
              <strong>{table.rows.length}</strong>
              {' ' + vi('retained')}
              <span> / </span>
              <strong>{filtered.length}</strong>
              {' ' + vi('matching') + ' '}
            </span>
            <span className="mw-badge">{vi('Bounded preview')}</span>
          </div>
          <div
            className="mw-table-scroll"
            tabIndex={0}
            role="region"
            aria-label={
              filters.schema
                ? vi('Evidence schema')
                : vi('Evidence preview rows')
            }
          >
            {filters.schema ? (
              <table className="mw-data-table">
                <thead>
                  <tr>
                    <th>{vi('Field')}</th>
                    <th>{vi('SQL type')}</th>
                  </tr>
                </thead>
                <tbody>
                  {table.columns.map((c) => (
                    <tr key={c.name}>
                      <td>
                        <code>{c.name}</code>
                      </td>
                      <td>
                        <span className="mw-badge">{c.type}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="mw-data-table">
                <thead>
                  <tr>
                    <th className="mw-row-number">#</th>
                    {columns.map((n) => (
                      <th
                        key={n}
                        className={numericColumn(n) ? 'mw-number' : ''}
                      >
                        {n}
                      </th>
                    ))}
                    <th aria-label={vi('Record inspector')} />
                  </tr>
                </thead>
                <tbody>
                  {filtered.length ? (
                    filtered.map(({ row, index }) => (
                      <tr
                        key={index}
                        aria-selected={
                          selection?.kind === 'record' &&
                          selection.rowIndex === index &&
                          selection.tableId === table.id
                        }
                        className={
                          selection?.kind === 'record' &&
                          selection.rowIndex === index &&
                          selection.tableId === table.id
                            ? 'is-selected'
                            : ''
                        }
                        onClick={() => selectRow(index)}
                      >
                        <td className="mw-row-number">
                          <button
                            type="button"
                            aria-label={vt`Inspect record ${index + 1} from ${viMessage(table.label)}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              selectRow(index)
                            }}
                          >
                            {index + 1}
                          </button>
                        </td>
                        {columns.map((n) => (
                          <td
                            key={n}
                            className={numericColumn(n) ? 'mw-number' : ''}
                          >
                            <span
                              title={
                                row[n] == null
                                  ? 'NULL'
                                  : displayValue(n, row[n])
                              }
                            >
                              {row[n] == null ? (
                                <i className="mw-null">NULL</i>
                              ) : n === 'event_type' || n === 'source' ? (
                                <span className="mw-badge">
                                  {displayValue(n, row[n])}
                                </span>
                              ) : (
                                displayValue(n, row[n])
                              )}
                            </span>
                          </td>
                        ))}
                        <td>
                          <button
                            type="button"
                            className="mw-row-inspect"
                            aria-label={vt`Open record ${index + 1} inspector`}
                            onClick={(e) => {
                              e.stopPropagation()
                              selectRow(index)
                            }}
                          >
                            <ArrowUpRight size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={columns.length + 2}
                        className="mw-table-empty"
                      >
                        {table.rows.length
                          ? vi('No retained rows match these filters.')
                          : vi('This relation contains no rows.')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
          <footer className="mw-panel-footer">
            <span>
              {' ' + vi('Up to') + ' '}
              {evidence.previewLimit}
              {' ' +
                vi(
                  'retained rows per relation. Filters apply only to this preview.',
                ) +
                ' '}
            </span>
            <span className="mw-muted">{viMessage(table.grain)}</span>
          </footer>
        </>
      )}
    </section>
  )
}
function numericColumn(name: string) {
  return /amount|revenue|net|discount|cents|variance|count|rate/.test(name)
}
