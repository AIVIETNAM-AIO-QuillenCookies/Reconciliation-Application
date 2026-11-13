import {
  modelNodes,
  modelConnections,
  methodologyRules,
  reportReferences,
} from '@/lib/methodology'
import {
  buildWaterfall,
  type ReconciliationPeriod,
  type ReconciliationResult,
} from '@/lib/reconciliation-types'
import type { RunEvidence } from '@/lib/reconciliation-evidence'
import type { QueuedFile } from '@/lib/uploads'
import type { ConfirmedFileMapping } from '@/lib/data-mapping'
import { formatUSD } from '@/lib/format-money'
import { ruleStatus } from '@/lib/model-workspace'
import '@/methodology-print.css'

export function PrintDocument({
  evidence,
  result,
  period,
  files = [],
  confirmedMappings,
}: {
  evidence?: RunEvidence
  result?: ReconciliationResult | null
  period: ReconciliationPeriod
  files?: readonly QueuedFile[]
  confirmedMappings?: readonly ConfirmedFileMapping[] | null
}) {
  return (
    <article
      className="mw-print-document"
      aria-label="Printable rules and data model"
    >
      <header>
        <p className="mw-print-brand">reconcile.</p>
        <h1>Rules & Data Model</h1>
        <p>
          Reporting period: {period.start} → {period.end}
        </p>
        <p>
          {evidence
            ? `Successful run ${evidence.runId}`
            : 'Configuration and definitions only. No successful runtime evidence is available.'}
        </p>
        <p>
          Browser-only workspace. Financial files and results are retained in
          the current tab only.
        </p>
      </header>
      <section>
        <h2>1. Sources and current configuration</h2>
        <p>
          Draft configuration is not proof of execution. Runtime configurations
          below are recorded with the same successful result snapshot.
        </p>
        <table className="mw-print-table">
          <thead>
            <tr>
              <th>Source / file</th>
              <th>Header / mapping state</th>
              <th>Fields and selected columns</th>
            </tr>
          </thead>
          <tbody>
            {files.length ? (
              files.map((file) => {
                const run = evidence?.files.find(
                  (entry) => entry.fileId === file.id,
                )
                const confirmed = confirmedMappings?.find(
                  (entry) => entry.fileId === file.id,
                )
                return (
                  <tr key={file.id}>
                    <td>
                      <strong>{file.source || 'Unassigned'}</strong>
                      <br />
                      {file.file.name}
                    </td>
                    <td>
                      Header {run?.headerRow ?? file.headerRow ?? 1}
                      <br />
                      {run
                        ? 'Executed configuration'
                        : confirmed
                          ? 'Confirmed; no current run'
                          : 'Draft selection'}
                      {run?.netStrategy && (
                        <p>Net strategy: {run.netStrategy}</p>
                      )}
                    </td>
                    <td>
                      {Object.entries(
                        run?.columns ?? confirmed?.columns ?? {},
                      ).map(([field, column]) => (
                        <p key={field}>
                          <code>{field}</code> → {column}
                        </p>
                      ))}
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={3}>No files selected.</td>
              </tr>
            )}
          </tbody>
        </table>
        {evidence?.masterConfiguration && (
          <>
            <h3>Confirmed Master / Dim configuration</h3>
            {Object.entries(evidence.masterConfiguration.roles).map(
              ([role, config]) => (
                <div key={role} className="mw-print-block">
                  <h4>
                    {role} · {config.usage}
                  </h4>
                  {config.usage === 'enabled' && (
                    <>
                      <p>
                        Worksheet: {config.sheetName}; header:{' '}
                        {
                          evidence.masterConfiguration?.sheets[config.sheetName]
                            ?.headerRow
                        }
                      </p>
                      <p>
                        Columns:{' '}
                        {Object.entries(config.columns)
                          .map(([field, column]) => `${field} → ${column}`)
                          .join('; ')}
                      </p>
                      {config.relationships.map((relationship) => (
                        <p key={relationship.id}>
                          {relationship.source}:{' '}
                          {relationship.keys
                            .map(
                              (pair) =>
                                `${pair.sourceField} → ${config.columns[pair.referenceField]}`,
                            )
                            .join(' AND ')}
                          . Left lookup, validated many-to-one. Purpose:{' '}
                          {relationship.purpose}. Unmatched policy:{' '}
                          {relationship.unmatched}. Returned fields:{' '}
                          {relationship.outputs
                            .map((field) => config.columns[field])
                            .join(', ')}
                          .
                        </p>
                      ))}
                    </>
                  )}
                </div>
              ),
            )}
          </>
        )}
        {evidence?.masterJoins?.length ? (
          <table className="mw-print-table">
            <thead>
              <tr>
                <th>Executed relationship</th>
                <th>Row preservation</th>
                <th>Quality evidence</th>
              </tr>
            </thead>
            <tbody>
              {evidence.masterJoins.map((join) => (
                <tr key={`${join.relationshipId}:${join.fileId}`}>
                  <td>
                    {join.role} · {join.source}
                    <br />
                    {
                      evidence.files.find((file) => file.fileId === join.fileId)
                        ?.fileName
                    }
                  </td>
                  <td>
                    {join.rowsBefore} → {join.rowsAfter}
                  </td>
                  <td>
                    {join.unmatchedRows} unmatched; {join.duplicateKeys}{' '}
                    duplicate keys
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>
      <section>
        <h2>2. Pipeline and table dictionary</h2>
        <p>
          Source files → cleaning and normalization → recognition events → daily
          aggregation and reconciliation → Dashboard / Exception Log.
        </p>
        <p>
          Recognition events are a logical view scoped to the processing
          connection. GL remains a separate ledger aggregate. Monthly Flash is
          never joined to each transaction or calendar day.
        </p>
        <table className="mw-print-table">
          <thead>
            <tr>
              <th>Table / relation</th>
              <th>Grain, keys and business role</th>
              <th>Schema / implementation</th>
            </tr>
          </thead>
          <tbody>
            {modelNodes.map((node) => (
              <tr key={node.id}>
                <td>
                  <strong>{node.title}</strong>
                  <br />
                  <code>{node.relation}</code>
                </td>
                <td>
                  {node.grain}
                  <p>
                    Keys:{' '}
                    {node.keys.join('; ') || 'Not a keyed source relation'}
                  </p>
                  <p>{node.role}</p>
                  {node.caution && <p>{node.caution}</p>}
                </td>
                <td>
                  {node.implementation}
                  <p>
                    {node.fields
                      .map((field) => `${field.name}: ${field.type}`)
                      .join('; ')}
                  </p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section>
        <h2>3. Connections, joins and cardinality</h2>
        <table className="mw-print-table">
          <thead>
            <tr>
              <th>Connection</th>
              <th>Operation / keys</th>
              <th>Cardinality and conditions</th>
            </tr>
          </thead>
          <tbody>
            {modelConnections.map((connection) => (
              <tr key={connection.id}>
                <td>
                  <strong>{connection.label}</strong>
                  <br />
                  {connection.from} → {connection.to}
                </td>
                <td>
                  {connection.operation}
                  <p>{connection.keys.join(' AND ') || 'No row-level join'}</p>
                </td>
                <td>
                  {connection.cardinality}
                  <p>{connection.condition}</p>
                  <p>{connection.explanation}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section>
        <h2>4. Rule catalogue and runtime status</h2>
        {methodologyRules.map((rule) => {
          const status = ruleStatus(rule.id, evidence)
          return (
            <div className="mw-print-rule" key={rule.id}>
              <h3>{rule.title}</h3>
              <p>
                <code>{rule.id}</code> · {rule.implementation} · Current
                snapshot: {status.label}
              </p>
              <p>
                <strong>Purpose:</strong> {rule.purpose}
              </p>
              <p>
                <strong>Input:</strong> {rule.inputFields.join(', ')}
              </p>
              <p>
                <strong>Condition:</strong> {rule.condition}
              </p>
              <p>
                <strong>Logic:</strong> {rule.logic}
              </p>
              <p>
                <strong>Output:</strong> {rule.output}
              </p>
              <p>
                <strong>Null / error:</strong> {rule.nullError}
              </p>
              <p>
                <strong>Evidence:</strong> {status.detail}
              </p>
              {rule.technical && <pre>{rule.technical}</pre>}
              <p className="mw-print-muted">
                Implementation reference: {rule.technicalSource}
              </p>
            </div>
          )
        })}
      </section>
      <section>
        <h2>5. Current reconciliation and validation evidence</h2>
        {result?.cents && evidence ? (
          <>
            <p>
              Run ID: {evidence.runId}. All amounts below use authoritative
              integer cents.
            </p>
            <table className="mw-print-table">
              <thead>
                <tr>
                  <th>Bridge bucket</th>
                  <th>Impact / total (USD)</th>
                  <th>Running revenue (USD)</th>
                </tr>
              </thead>
              <tbody>
                {buildWaterfall(result).map((step) => (
                  <tr key={step.key}>
                    <td>{step.label}</td>
                    <td className="mw-print-number">
                      {formatUSD(step.amountCents)}
                    </td>
                    <td className="mw-print-number">
                      {formatUSD(step.endCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>
              Headline variance = Flash − GL. Daily SQL variance = GL − expected
              source. Exception delta = source − GL. These conventions are
              intentionally different.
            </p>
            <p>
              {result.duplicatePOSLines} discarded POS export lines;{' '}
              {result.missingGLEntries} missing-GL store-day groups;{' '}
              {result.dailyDifferenceCount} nonzero daily groups;{' '}
              {result.exceptions.length} exception cases before the Exception
              Log threshold.
            </p>
            <h3>Executed row and key checks</h3>
            <table className="mw-print-table">
              <thead>
                <tr>
                  <th>Validation</th>
                  <th>Observed result</th>
                </tr>
              </thead>
              <tbody>
                {evidence.validations.map((validation) => (
                  <tr key={validation.id}>
                    <td>{validation.message}</td>
                    <td>
                      {validation.status}; {validation.invalidCount} invalid
                      rows / groups
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>
              A zero residual does not prove zero source errors. Report QC
              totals are not substituted for runtime evidence.
            </p>
          </>
        ) : (
          <p>
            No successful current snapshot. No PASS/FAIL, financial totals or
            affected-row counts are inferred.
          </p>
        )}
      </section>
      <section>
        <h2>6. Bounded input and output previews</h2>
        {evidence ? (
          <>
            <p>{evidence.scope}</p>
            <p>{evidence.sourceRowNote}</p>
            {evidence.tables.map((table) => {
              const preference = [
                'source',
                'transaction_id',
                'receipt_no',
                'web_order_id',
                'journal_id',
                'event_type',
                'recognition_date',
                'posting_date',
                'store_key',
                'revenue_usd',
                'net_usd_month_end',
                'amount_usd',
                'source_record',
              ]
              const columns = preference
                .filter((name) =>
                  table.columns.some((column) => column.name === name),
                )
                .slice(0, 6)
              const fields = columns.length
                ? columns
                : table.columns.slice(0, 5).map((column) => column.name)
              return (
                <div key={table.id} className="mw-print-preview">
                  <h3>{table.label}</h3>
                  <p>
                    <code>{table.id}</code> · {table.rowCount} total rows ·{' '}
                    {table.rows.length} retained · first{' '}
                    {Math.min(5, table.rows.length)} retained rows printed.
                    Grain: {table.grain}
                  </p>
                  <table className="mw-print-table">
                    <thead>
                      <tr>
                        {fields.map((field) => (
                          <th key={field}>{field}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {table.rows.slice(0, 5).map((row, index) => (
                        <tr key={index}>
                          {fields.map((field) => (
                            <td key={field}>{row[field] ?? 'Unavailable'}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mw-print-muted">
                    Complete retained schema and additional fields are available
                    in the interactive explorer. Search covers retained rows,
                    not the full dataset.
                  </p>
                </div>
              )
            })}
          </>
        ) : (
          <p>Previews appear only after a successful processing run.</p>
        )}
      </section>
      <section>
        <h2>7. Report provenance and interpretation</h2>
        <p>
          Reference: “Báo cáo đối soát doanh thu” — eDA_Sale, We Analyze. The
          following page ranges and report descriptions were provided by the
          user; the original PDF is not included or independently verified.
        </p>
        <ul>
          {reportReferences.map((reference) => (
            <li key={reference.id}>
              Pages {reference.pages}: {reference.scope}
            </li>
          ))}
        </ul>
        <p>
          The report store-month threshold |difference| &gt; 200 USD AND
          |difference / GL| &gt; 1% is a reference rule. The current Exception
          Log uses its own strict default |delta| &gt; 200 USD for traceable
          cases. No 1% condition is silently added. The GL = 0 percentage
          denominator requires separate interpretation.
        </p>
        <p>
          Working-day offsets and explicit USD = local amount / usd_to_ccy
          conversion are not inferred. Supplied USD net is authoritative,
          including zero. Unmapped net uses gross minus discount; invalid mapped
          cells fail. Shipping, FX, rounding or channel adjustments remain
          Unexplained unless an implemented rule and defensible evidence
          classify them.
        </p>
      </section>
      <footer>reconcile. · Rules & Data Model · Browser-local snapshot</footer>
    </article>
  )
}
