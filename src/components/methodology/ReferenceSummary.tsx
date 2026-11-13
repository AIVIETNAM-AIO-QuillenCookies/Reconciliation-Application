import {
  displayRoleLabels as ROLE_LABELS,
  displayPurposeLabels as PURPOSE_LABELS,
} from '@/lib/localized-model'
import { vi, vt } from '@/lib/i18n'
import { Database, ChevronDown, ArrowRight } from 'lucide-react'
import type { RunEvidence } from '@/lib/reconciliation-evidence'
import { REFERENCE_ROLES } from '@/lib/master-data'

export function ReferenceSummary({ evidence }: { evidence?: RunEvidence }) {
  const config = evidence?.masterConfiguration
  const enabled = config
    ? REFERENCE_ROLES.filter((role) => config.roles[role].usage === 'enabled')
    : []
  return (
    <details className="mw-reference-summary">
      <summary>
        <span className="mw-summary-title">
          <Database size={14} />
          {' ' + vi('Master / Dim relationships') + ' '}
        </span>
        <span className="mw-summary-meta">
          {!evidence
            ? vi('Awaiting successful run')
            : !config
              ? vi('No reference workbook used')
              : vt`${enabled.length} active roles · ${enabled.reduce((n, role) => n + config.roles[role].relationships.length, 0)} relationships`}
        </span>
        <ChevronDown size={14} />
      </summary>
      <div className="mw-reference-detail">
        <h2 className="sr-only">
          {vi('Confirmed Master / Dim relationships')}
        </h2>
        {!evidence ? (
          <p>
            {' ' +
              vi(
                'Run reconciliation to inspect the actual configuration and full-data validation evidence.',
              ) +
              ' '}
          </p>
        ) : !config ? (
          <p>{vi('No Master / Dim workbook used in this run.')}</p>
        ) : (
          <div className="mw-reference-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{vi('Role / worksheet')}</th>
                  <th>{vi('Header')}</th>
                  <th>{vi('Source → reference keys')}</th>
                  <th>{vi('Outputs / purpose')}</th>
                  <th>{vi('Executed evidence')}</th>
                </tr>
              </thead>
              <tbody>
                {REFERENCE_ROLES.map((role) => {
                  const ref = config.roles[role]
                  if (ref.usage !== 'enabled')
                    return (
                      <tr key={role}>
                        <td>{ROLE_LABELS[role]}</td>
                        <td colSpan={4}>
                          <span className="mw-badge">{vi('Not used')}</span>
                        </td>
                      </tr>
                    )
                  return ref.relationships.map((rel) => (
                    <tr key={rel.id}>
                      <td>
                        <strong>{ROLE_LABELS[role]}</strong>
                        <span>{ref.sheetName}</span>
                      </td>
                      <td>{config.sheets[ref.sheetName].headerRow}</td>
                      <td>
                        {rel.keys.map((key, i) => (
                          <span key={i}>
                            {i > 0 && <em>{vi('AND') + ' '}</em>}
                            {rel.source}.{key.sourceField}{' '}
                            <ArrowRight size={10} />{' '}
                            {ref.columns[key.referenceField]}
                          </span>
                        ))}
                      </td>
                      <td>
                        {rel.outputs.map((f) => ref.columns[f]).join(', ')}
                        <span>{PURPOSE_LABELS[rel.purpose]}</span>
                        <span>
                          {' ' + vi('Unmatched:')}{' '}
                          {rel.unmatched === 'keep'
                            ? vi('keep source row')
                            : 'chặn'}
                        </span>
                      </td>
                      <td>
                        {evidence.masterJoins
                          ?.filter((j) => j.relationshipId === rel.id)
                          .map((j) => (
                            <span key={j.fileId}>
                              {
                                evidence.files.find(
                                  (f) => f.fileId === j.fileId,
                                )?.fileName
                              }
                              : {j.rowsBefore} → {j.rowsAfter}
                              {' ' + vi('rows ·')} {j.unmatchedRows}
                              {' ' + vi('unmatched ·') + ' '}
                              {j.duplicateKeys}{' '}
                              {' ' + vi('duplicate keys · Applied') + ' '}
                            </span>
                          ))}
                      </td>
                    </tr>
                  ))
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </details>
  )
}
