import { useState } from 'react'
import { vi } from '@/lib/i18n'
import { displayRuleById } from '@/lib/localized-model'
import type { EvidenceRow, RunEvidence } from '@/lib/reconciliation-evidence'
import type { MethodologyRule } from '@/lib/methodology'

function sourceValues(record: EvidenceRow, evidence: RunEvidence) {
  if (record.input_values) {
    try {
      return JSON.parse(record.input_values) as unknown
    } catch {
      return record.input_values
    }
  }
  const ordinal = Number(record.source_record)
  if (Number.isSafeInteger(ordinal) && ordinal > 0)
    return evidence.tables.find(
      (table) => table.id === `uploaded:${record.source_file_id}`,
    )?.rows[ordinal - 1]
  return undefined
}
export function RecordProof({
  record,
  evidence,
  ruleId,
  onRule,
}: {
  record: EvidenceRow
  evidence: RunEvidence
  ruleId?: string
  onRule?: (id: string) => void
}) {
  const input = sourceValues(record, evidence)
  const applied = (record.applied_rule_ids ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
  const rules = (ruleId ? [ruleId] : applied).flatMap((id) => {
    const rule = displayRuleById.get(id)
    return rule ? [rule] : []
  })
  const output = Object.fromEntries(
    Object.entries(record).filter(([key]) => key !== 'input_values'),
  )
  return (
    <div className="mw-record-proof">
      <div className="mw-proof-step">
        <h4>{vi('INPUT')}</h4>
        {input ? (
          <pre>{JSON.stringify(input, null, 2)}</pre>
        ) : (
          <p>
            {vi(
              'Input cells for this record are outside the retained preview or unavailable. No values are inferred.',
            )}
          </p>
        )}
      </div>
      <div className="mw-proof-step">
        <h4>{vi('APPLIED LOGIC')}</h4>
        {rules.length ? (
          rules.map((rule) => (
            <div key={rule.id}>
              <button
                type="button"
                className="mw-source-link"
                onClick={() => onRule?.(rule.id)}
                disabled={!onRule}
              >
                {rule.title}
              </button>
              <p>{rule.logic}</p>
            </div>
          ))
        ) : (
          <p>
            {vi(
              'No record-level rule attribution was captured for this relation.',
            )}
          </p>
        )}
      </div>
      <div className="mw-proof-step">
        <h4>{vi('OUTPUT')}</h4>
        <pre>{JSON.stringify(output, null, 2)}</pre>
      </div>
      <div className="mw-proof-step">
        <h4>{vi('EXPLANATION')}</h4>
        <p>
          {vi(
            'These values were retained from the processing connection. This inspector does not recalculate amounts or recognition events.',
          )}
        </p>
        {record.source_file && (
          <p>
            {record.source_file} · {vi('Imported record')}{' '}
            {record.source_record ?? '—'}
          </p>
        )}
        <p>{vi(evidence.sourceRowNote)}</p>
      </div>
    </div>
  )
}
export function RuleRecordEvidence({
  rule,
  evidence,
  onRule,
}: {
  rule: MethodologyRule
  evidence: RunEvidence
  onRule: (id: string) => void
}) {
  const [selected, setSelected] = useState('')
  const candidates = evidence.tables.flatMap((table) =>
    table.rows.flatMap((row, index) => {
      const applied = (row.applied_rule_ids ?? '')
        .split(',')
        .map((id) => id.trim())
      return applied.includes(rule.id) || rule.evidenceTables.includes(table.id)
        ? [{ key: `${table.id}:${index}`, table, row, index }]
        : []
    }),
  )
  const current = candidates.find((entry) => entry.key === selected)
  return (
    <div>
      <p>
        {vi(
          'Choose a retained record to inspect input → logic → output. This is a bounded preview, not an affected-row count.',
        )}
      </p>
      <select
        className="mw-rule-sample"
        aria-label="Evidence record for selected rule"
        value={selected}
        onChange={(event) => setSelected(event.target.value)}
      >
        <option value="">{vi('Select a retained record')}</option>
        {candidates.map((entry) => (
          <option key={entry.key} value={entry.key}>
            {entry.table.label} ·{' '}
            {entry.row.transaction_id ??
              entry.row.receipt_no ??
              entry.row.web_order_id ??
              entry.row.journal_id ??
              `#${entry.index + 1}`}
            {entry.row.event_type ? ` · ${entry.row.event_type}` : ''}
          </option>
        ))}
      </select>
      {!candidates.length && (
        <p className="mw-muted">
          {vi(
            'No matching records were retained. This does not prove the rule was unused across the full dataset.',
          )}
        </p>
      )}
      {current && (
        <RecordProof
          record={current.row}
          evidence={evidence}
          ruleId={rule.id}
          onRule={onRule}
        />
      )}
    </div>
  )
}
