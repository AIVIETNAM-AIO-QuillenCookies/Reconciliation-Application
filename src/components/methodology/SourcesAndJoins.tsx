import { useState } from 'react'
import {
  FileSpreadsheet,
  ArrowUpRight,
  ShieldCheck,
  Link2,
  Info,
} from 'lucide-react'
import { vi, viMessage } from '@/lib/i18n'
import { useAppStore } from '@/lib/store'
import { ONBOARDING_STEPS } from '@/lib/onboarding'
import { MAPPING_FIELDS, isFactSource } from '@/lib/data-mapping'
import {
  modelNodes,
  modelConnections,
  reportReferences,
} from '@/lib/methodology'
import { displayNodeById } from '@/lib/localized-model'
import { sourceStatus } from '@/lib/source-status'
import type { RunEvidence } from '@/lib/reconciliation-evidence'
import type { WorkspaceSelection } from '@/lib/model-workspace'
import type { Source } from '@/lib/uploads'
import { ReferenceSummary } from './ReferenceSummary'

const sourceRelations = {
  POS: 'raw_pos',
  WEB: 'raw_web',
  GL: 'raw_gl',
  Flash: 'vw_flash',
  Dim: 'dim_store',
}
export function SourcesAndJoins({
  evidence,
  onSelect,
}: {
  evidence?: RunEvidence
  onSelect: (selection: WorkspaceSelection) => void
}) {
  const { files, mappingDrafts, confirmedMappings, dimTables } = useAppStore()
  const [source, setSource] = useState<Source | 'All'>('All')
  const selectedFiles = files.filter(
    (file) => source === 'All' || file.source === source,
  )
  const nodes = modelNodes.filter(
    (node) => (source === 'All' || node.source === source) && node.source,
  )
  return (
    <section className="mw-sources" aria-label="Sources and joins">
      <div className="mw-panel-toolbar">
        <div className="mw-toolbar-cluster">
          <Link2 size={16} />
          <strong>{vi('Sources & joins')}</strong>
          <span className="mw-badge">
            {evidence ? vi('Successful run') : vi('Current selection')}
          </span>
        </div>
        <select
          aria-label="Filter source dictionary"
          value={source}
          onChange={(event) => setSource(event.target.value as Source | 'All')}
        >
          <option value="All">{vi('All sources')}</option>
          {ONBOARDING_STEPS.map((step) => (
            <option key={step.source} value={step.source}>
              {vi(step.label)}
            </option>
          ))}
        </select>
      </div>
      <div
        className="mw-sources-scroll"
        tabIndex={0}
        role="region"
        aria-label="Source inventory and table dictionary"
      >
        <div className="mw-source-notice">
          <ShieldCheck size={15} />
          <p>
            {evidence
              ? vi(
                  'Mappings below belong to the same successful run as the evidence.',
                )
              : vi(
                  'Current files and mapping drafts are shown below. They are not processed results.',
                )}
          </p>
        </div>
        {selectedFiles.length ? (
          <div className="mw-source-files">
            {selectedFiles.map((file) => {
              const config = evidence?.files.find(
                (entry) => entry.fileId === file.id,
              )
              const draft = mappingDrafts[file.id]
              const confirmed = confirmedMappings?.find(
                (entry) => entry.fileId === file.id,
              )
              const columns =
                config?.columns ?? confirmed?.columns ?? draft?.columns ?? {}
              const fields = isFactSource(file.source)
                ? MAPPING_FIELDS[file.source]
                : []
              const status = file.source
                ? sourceStatus(file.source, files, mappingDrafts)
                : { label: 'Unassigned source' }
              return (
                <article className="mw-source-file" key={file.id}>
                  <header>
                    <FileSpreadsheet size={17} />
                    <div>
                      <h3 title={file.file.name}>{file.file.name}</h3>
                      <p>
                        {vi(
                          ONBOARDING_STEPS.find(
                            (step) => step.source === file.source,
                          )?.label ?? file.source,
                        )}{' '}
                        ·{' '}
                        {config
                          ? vi('Run configuration')
                          : confirmed
                            ? vi('Confirmed mapping')
                            : vi('Draft mapping')}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="mw-small-button"
                      aria-label={`Inspect source ${file.source}`}
                      disabled={!file.source}
                      onClick={() => {
                        if (file.source)
                          onSelect({
                            kind: 'node',
                            id: sourceRelations[file.source],
                          })
                      }}
                    >
                      <ArrowUpRight size={14} />
                      {vi('Inspect')}
                    </button>
                  </header>
                  <div className="mw-source-facts">
                    <span>
                      {vi('Header row')}{' '}
                      <strong>
                        {config?.headerRow ?? file.headerRow ?? 1}
                      </strong>
                    </span>
                    <span>{vi(status.label)}</span>
                    <span>
                      {config?.netStrategy === 'supplied'
                        ? vi('Mapped net is authoritative')
                        : config?.netStrategy === 'gross-minus-discount'
                          ? vi('Net = gross − discount')
                          : file.source === 'Dim'
                            ? vi('Selected reference sheets')
                            : vi('USD amounts')}
                    </span>
                  </div>
                  {file.source === 'Dim' ? (
                    <ul className="mw-source-sheet-list">
                      {(
                        evidence?.tables.filter(
                          (table) => table.kind === 'dimension',
                        ) ??
                        dimTables.map((table) => ({
                          id: table.name,
                          label: table.name,
                          rowCount: table.rowCount,
                        }))
                      ).map((table) => (
                        <li key={table.id}>
                          <code>{table.label}</code>
                          <span>
                            {table.rowCount.toLocaleString()} {vi('rows')}
                          </span>
                        </li>
                      ))}
                      {!dimTables.length &&
                        !evidence?.tables.some(
                          (table) => table.kind === 'dimension',
                        ) && (
                          <li>
                            {vi(
                              'No dimension tables loaded for the current selection.',
                            )}
                          </li>
                        )}
                    </ul>
                  ) : (
                    <details className="mw-source-mapping">
                      <summary>
                        {vi('Field mapping')} · {Object.keys(columns).length}{' '}
                        {vi('selected')}
                      </summary>
                      <table className="mw-data-table">
                        <thead>
                          <tr>
                            <th>{vi('System field')}</th>
                            <th>{vi('Requirement')}</th>
                            <th>{vi('Selected source column')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fields.map((field) => (
                            <tr key={field.id}>
                              <td>
                                {vi(field.label)}
                                <code>{field.id}</code>
                              </td>
                              <td>
                                {vi(field.optional ? 'Optional' : 'Required')}
                              </td>
                              <td>{columns[field.id] ?? vi('Not mapped')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </details>
                  )}
                  {config?.notes.length ? (
                    <details className="mw-source-mapping">
                      <summary>{vi('Projection notes')}</summary>
                      <ul>
                        {config.notes.map((note, index) => (
                          <li key={index}>{viMessage(note)}</li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </article>
              )
            })}
          </div>
        ) : (
          <div className="mw-source-notice">
            <Info size={16} />
            <p>
              {vi(
                'No selected files in this source. The dictionary below describes the supported model.',
              )}
            </p>
          </div>
        )}
        <ReferenceSummary evidence={evidence} />
        <h2 className="mw-source-section-title">{vi('Table dictionary')}</h2>
        <table className="mw-data-table mw-dictionary">
          <thead>
            <tr>
              <th>{vi('Table / view')}</th>
              <th>{vi('Grain & keys')}</th>
              <th>{vi('Role')}</th>
              <th>{vi('Runtime availability')}</th>
            </tr>
          </thead>
          <tbody>
            {nodes.map((node) => {
              const display = displayNodeById.get(node.id) ?? node
              const table = evidence?.tables.find(
                (table) =>
                  table.id === node.id ||
                  table.id ===
                    `dim:${node.relation.replace(/^dim\./, '').replaceAll('"', '')}`,
              )
              return (
                <tr key={node.id}>
                  <td>
                    <button
                      type="button"
                      className="mw-source-link"
                      onClick={() => onSelect({ kind: 'node', id: node.id })}
                    >
                      {display.title}
                      <ArrowUpRight size={12} />
                    </button>
                    <code>{node.relation}</code>
                  </td>
                  <td>
                    {display.grain}
                    <small>{node.keys.join(' · ')}</small>
                  </td>
                  <td>{display.role}</td>
                  <td>
                    {table
                      ? `${table.rowCount.toLocaleString()} ${vi('rows in run')}`
                      : node.implementation === 'implemented'
                        ? vi(
                            'Supported definition; no matching retained relation',
                          )
                        : vi('Reference model; not a runtime table')}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <h2 className="mw-source-section-title">{vi('Join safeguards')}</h2>
        <div className="mw-source-safeguards">
          {modelConnections
            .filter((edge) => edge.keys.length > 0)
            .map((edge) => (
              <button
                key={edge.id}
                type="button"
                onClick={() => onSelect({ kind: 'connection', id: edge.id })}
              >
                <Link2 size={14} />
                <span>
                  <strong>{vi(edge.label)}</strong>
                  <small>
                    {vi(edge.operation)} · {vi(edge.cardinality)}
                  </small>
                </span>
                <ArrowUpRight size={13} />
              </button>
            ))}
        </div>
        <h2 className="mw-source-section-title">{vi('Report reference')}</h2>
        <p className="mw-source-reference-note">
          Báo cáo đối soát doanh thu · eDA_Sale, We Analyze.{' '}
          {vi(
            'Page references are supplied by the user; the original PDF is not included or independently verified. Report QC totals are never runtime results.',
          )}
        </p>
        <ul className="mw-source-references">
          {reportReferences.map((reference) => (
            <li key={reference.id}>
              <strong>{reference.pages}</strong>
              <span>{vi(reference.scope)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
