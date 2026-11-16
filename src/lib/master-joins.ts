import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm'
import { quote, keySQL } from './reconciliation-accounting.ts'
import { dateSQL } from './reconciliation-sql.ts'
import {
  REFERENCE_ROLES,
  ROLE_LABELS,
  type MasterConfiguration,
  type JoinValidation,
  type JoinKeyPair,
  type MasterRelationship,
} from './master-data.ts'
import type { FactSource } from './uploads.ts'
import { quoteLiteral as sqlLiteral } from './sql-quoting.ts'

// `sqlLiteral` remains part of this module's public API for existing importers.
export { sqlLiteral }
const text = (s: string) => `NULLIF(TRIM(CAST(${s} AS VARCHAR)), '')`
function periodSQL(s: string): string {
  return `COALESCE(strftime(${dateSQL(text(s))}, '%Y-%m'), CASE WHEN regexp_full_match(${text(s)}, '[0-9]{4}-[0-9]{2}') AND TRY_STRPTIME(${text(s)} || '-01', '%Y-%m-%d') IS NOT NULL THEN ${text(s)} WHEN regexp_full_match(${text(s)}, '[0-9]{6}') THEN strftime(TRY_STRPTIME(${text(s)}, '%Y%m'), '%Y-%m') END)`
}
const typed = (s: string, type: JoinKeyPair['type']) =>
  type === 'text'
    ? keySQL(text(s))
    : type === 'date'
      ? dateSQL(text(s))
      : periodSQL(s)
function sourceColumn(
  rel: MasterRelationship,
  field: JoinKeyPair['sourceField'],
  columns: Record<string, string>,
): string {
  const resolved =
    field === 'recognition_period'
      ? rel.source === 'WEB'
        ? 'delivery_date'
        : rel.source === 'POS' && columns.posting_date
          ? 'posting_date'
          : 'date'
      : field
  const column = columns[resolved]
  if (!column)
    throw new Error(
      `${rel.source}: map ${resolved} in every source file before checking joins.`,
    )
  return `input.${quote(column)}`
}

/** Validate full registered relations before returning any SQL that can alter accounting fields. */
export async function buildMasterJoins(
  connection: AsyncDuckDBConnection,
  options: {
    config: MasterConfiguration
    source: FactSource
    fileId: string
    path: string
    columns: Record<string, string>
    signal?: AbortSignal
    onCheck?: (context: {
      role: (typeof REFERENCE_ROLES)[number]
      relationshipId: string
      source: FactSource
      fileId: string
    }) => void
    onResult?: (report: JoinValidation) => void
  },
) {
  const { config, source, fileId, path, columns, signal } = options
  const ordinal = `__master_row_${crypto.randomUUID().replaceAll('-', '')}`
  let from = `(SELECT *, ROW_NUMBER() OVER () AS ${quote(ordinal)} FROM read_csv_auto(${sqlLiteral(path)}, header=true, all_varchar=true)) AS input`
  const overrides: Record<string, string> = {}
  const outputs: string[] = []
  const reports: JoinValidation[] = []
  const sourceExpression = (
    rel: MasterRelationship,
    field: JoinKeyPair['sourceField'],
    role: string,
  ) => {
    if (role === 'store' || role === 'calendar')
      return sourceColumn(rel, field, columns)
    const target =
      field === 'recognition_period'
        ? source === 'POS'
          ? 'posting_date'
          : source === 'WEB'
            ? 'delivery_date'
            : 'date'
        : field
    const canonical =
      target === 'date'
        ? source === 'POS'
          ? 'business_date'
          : source === 'WEB'
            ? 'order_date'
            : source === 'GL'
              ? 'posting_date'
              : 'month_end_date'
        : target
    return (
      overrides[canonical] ??
      (source === 'POS' && canonical === 'posting_date' && !columns.posting_date
        ? overrides.business_date
        : undefined) ??
      sourceColumn(rel, field, columns)
    )
  }
  for (const role of REFERENCE_ROLES) {
    const ref = config.roles[role]
    if (ref.usage !== 'enabled') continue
    const table = `dim.${quote(ref.sheetName)}`
    const schema = await connection.query(`SELECT * FROM ${table} LIMIT 0`)
    const available = schema.schema.fields.map((f) => f.name)
    for (const column of Object.values(ref.columns))
      if (column && !available.includes(column))
        throw new Error(
          `${ROLE_LABELS[role]}: selected column no longer exists: ${column}`,
        )
    for (const [relIndex, rel] of ref.relationships.entries()) {
      if (rel.source !== source) continue
      signal?.throwIfAborted()
      options.onCheck?.({ role, relationshipId: rel.id, source, fileId })
      const alias = `ref_${role}_${relIndex}`
      const reference = (field: string, a = alias) =>
        `${a}.${quote(ref.columns[field as keyof typeof ref.columns]!)}`
      const sourceKeys = rel.keys.map((k) =>
        sourceExpression(rel, k.sourceField, role),
      )
      // An explicit unallocated GL posting is a technical group, not a missing
      // real-store lookup. Preserve the raw blank key until GL normalization.
      const unallocatedGL =
        source === 'GL' &&
        role === 'store' &&
        columns.channel &&
        columns.store_key
          ? `COALESCE((UPPER(${text(`input.${quote(columns.channel)}`)}) = 'UNALLOCATED' AND (${text(`input.${quote(columns.store_key)}`)} IS NULL OR ${keySQL(text(`input.${quote(columns.store_key)}`))} = '-1')), FALSE)`
          : 'FALSE'
      const refKeys = rel.keys.map((k) => reference(k.referenceField))
      const normalized = refKeys.map((s, i) => typed(s, rel.keys[i].type))
      const condition = normalized
        .map((s, i) => `${typed(sourceKeys[i], rel.keys[i].type)} = ${s}`)
        .join(' AND ')
      const input = `read_csv_auto(${sqlLiteral(path)}, header=true, all_varchar=true) AS input`
      // POS lookup failures remain diagnosable on the source row. A repeated
      // reference key is excluded from this join, never collapsed into a value.
      const safeTable =
        source === 'POS'
          ? `(SELECT *, COUNT(*) OVER (PARTITION BY ${rel.keys.map((key) => typed(quote(ref.columns[key.referenceField]!), key.type)).join(', ')}) AS __pos_reference_key_count FROM ${table})`
          : table
      const safeCondition =
        source === 'POS'
          ? `${condition} AND ${alias}.__pos_reference_key_count = 1`
          : condition
      const joined = `${from} LEFT JOIN ${safeTable} AS ${alias} ON ${safeCondition}`
      const count = async (query: string) => {
        signal?.throwIfAborted()
        return Number((await connection.query(query)).toArray()[0].n)
      }
      const referenceRows = await count(`SELECT COUNT(*) AS n FROM ${table}`)
      const blankReferenceKeys = await count(
        `SELECT COUNT(*) AS n FROM ${table} AS ${alias} WHERE ${refKeys.map((s) => `${text(s)} IS NULL`).join(' OR ')}`,
      )
      const invalidReferenceKeys = await count(
        `SELECT COUNT(*) AS n FROM ${table} AS ${alias} WHERE ${normalized.map((s, i) => `(${text(refKeys[i])} IS NOT NULL AND ${s} IS NULL)`).join(' OR ')}`,
      )
      const duplicateKeys = await count(
        `SELECT COUNT(*) AS n FROM (SELECT ${normalized.join(', ')} FROM ${table} AS ${alias} GROUP BY ${normalized.join(', ')} HAVING COUNT(*) > 1)`,
      )
      const invalidSourceKeys = await count(
        `SELECT COUNT(*) AS n FROM ${from} WHERE (${sourceKeys.map((s, i) => `${typed(s, rel.keys[i].type)} IS NULL`).join(' OR ')}) AND NOT ${unallocatedGL}`,
      )
      const unmatchedWhere = `${normalized[0]} IS NULL AND NOT ${unallocatedGL}`
      const unmatchedRows = await count(
        `SELECT COUNT(*) AS n FROM ${joined} WHERE ${unmatchedWhere}`,
      )
      const samples = await connection.query(
        `SELECT DISTINCT ${sourceKeys.map((s, i) => `CAST(${s} AS VARCHAR) AS ${quote(`key${i}`)}`).join(', ')} FROM ${joined} WHERE ${unmatchedWhere} LIMIT 5`,
      )
      const unmatchedSamples = samples
        .toArray()
        .map((row) =>
          JSON.stringify(
            sourceKeys.map((_, i) =>
              row[`key${i}`] == null ? null : String(row[`key${i}`]),
            ),
          ),
        )
      const rowsBefore = await count(`SELECT COUNT(*) AS n FROM ${input}`)
      const rowsAfter = await count(`SELECT COUNT(*) AS n FROM ${joined}`)
      const errors: string[] = []
      if (duplicateKeys)
        errors.push(
          `${duplicateKeys} duplicate reference key groups; lookup would multiply source rows.`,
        )
      if (blankReferenceKeys)
        errors.push(
          `${blankReferenceKeys} reference rows have blank required keys.`,
        )
      if (invalidReferenceKeys || invalidSourceKeys)
        errors.push(
          `Incompatible or blank keys: ${invalidReferenceKeys} reference, ${invalidSourceKeys} source rows.`,
        )
      if (unmatchedRows && rel.unmatched === 'error')
        errors.push(`${unmatchedRows} source rows have no reference match.`)
      if (rowsBefore !== rowsAfter)
        errors.push(`Row count changed from ${rowsBefore} to ${rowsAfter}.`)
      // Validate selected outputs according to their real use; never coerce invalid rates/dates to zero.
      const typedOutputs = [
        ...new Set([
          ...rel.outputs.filter(
            (field) =>
              ['rate', 'posting_date'].includes(field) ||
              (field === 'date' && rel.purpose === 'calendar-date'),
          ),
          ...(role === 'fxDaily' || role === 'fxMonthEnd' ? ['rate'] : []),
        ]),
      ]
      for (const field of typedOutputs) {
        const expr = reference(field)
        const invalid =
          field === 'rate'
            ? `(TRY_CAST(${text(expr)} AS DECIMAL(24,10)) IS NULL OR TRY_CAST(${text(expr)} AS DECIMAL(24,10)) <= 0)`
            : `${dateSQL(text(expr))} IS NULL`
        const n = await count(
          `SELECT COUNT(*) AS n FROM ${table} AS ${alias} WHERE ${invalid}`,
        )
        if (n) errors.push(`${n} invalid ${field} values in reference output.`)
      }
      if (rel.purpose === 'store-map') {
        const n = await count(
          `SELECT COUNT(*) AS n FROM ${table} AS ${alias} WHERE ${text(reference('finance_store_code'))} IS NULL`,
        )
        if (n) errors.push(`${n} blank Finance store code outputs.`)
      }
      reports.push({
        role,
        relationshipId: rel.id,
        source,
        fileId,
        referenceRows,
        duplicateKeys,
        blankReferenceKeys,
        invalidReferenceKeys,
        invalidSourceKeys,
        unmatchedRows,
        unmatchedSamples,
        rowsBefore,
        rowsAfter,
        errors,
      })
      options.onResult?.(reports.at(-1)!)
      // A failed reference is never included in subsequent lookups or accounting.
      if (errors.length && source !== 'POS') continue
      from += ` LEFT JOIN ${safeTable} AS ${alias} ON ${safeCondition}`
      if (source === 'POS') {
        const matches = `(SELECT COUNT(*) FROM ${table} AS ${alias} WHERE ${condition})`
        const rate = ref.columns.rate
          ? `TRY_CAST(${text(reference('rate'))} AS DECIMAL(24,10))`
          : 'NULL::DECIMAL(24,10)'
        const invalidOutput =
          role === 'store'
            ? `${text(reference('finance_store_code'))} IS NULL`
            : role === 'fxDaily' || role === 'fxMonthEnd'
              ? `${rate} IS NULL OR ${rate} <= 0`
              : 'FALSE'
        const missingStatus =
          role === 'store' && rel.unmatched === 'keep'
            ? 'unmatched-kept'
            : 'missing'
        const status = `CASE WHEN ${matches} > 1 THEN 'duplicate' WHEN ${matches} = 0 THEN '${missingStatus}' WHEN ${invalidOutput} THEN 'invalid' ELSE 'matched' END`
        if (role === 'store') overrides.store_lookup_status = status
        if (role === 'fxDaily' || role === 'fxMonthEnd') {
          const basis = role === 'fxDaily' ? 'daily' : 'month_end'
          overrides[`fx_rate_${basis}`] = rate
          overrides[`fx_${basis}_status`] = status
          overrides[`fx_${basis}_key`] = sourceKeys
            .map(
              (s, i) =>
                `${sqlLiteral(rel.keys[i].sourceField + '=')} || COALESCE(CAST(${typed(s, rel.keys[i].type)} AS VARCHAR), 'NULL')`,
            )
            .join(" || ' | ' || ")
        }
      }
      for (const field of rel.outputs)
        outputs.push(
          `CAST(${reference(field)} AS VARCHAR) AS ${quote(`master_${role}_${relIndex}_${field}`)}`,
        )
      if (rel.purpose === 'store-map')
        overrides.store_key = `COALESCE(${keySQL(text(reference('finance_store_code')))}, ${columns.store_key ? keySQL(sourceColumn(rel, 'store_key', columns)) : source === 'WEB' ? sqlLiteral('999999') : 'NULL::VARCHAR'})`
      if (rel.purpose === 'calendar-posting')
        overrides.posting_date = `COALESCE(${dateSQL(text(reference('posting_date')))}, ${dateSQL(sourceColumn(rel, columns.posting_date ? 'posting_date' : 'date', columns))})`
      if (source === 'POS' && rel.purpose === 'calendar-posting')
        overrides.posting_date_source = `CASE WHEN ${dateSQL(text(reference('posting_date')))} IS NOT NULL THEN 'configured-calendar' ELSE '${columns.posting_date ? 'mapped-posting-date' : 'business-date-fallback'}' END`
      if (rel.purpose === 'calendar-date') {
        const target = rel.dateTarget!
        const name =
          target === 'date'
            ? source === 'POS'
              ? 'business_date'
              : source === 'WEB'
                ? 'order_date'
                : source === 'GL'
                  ? 'posting_date'
                  : 'month_end_date'
            : target
        overrides[name] =
          `COALESCE(${dateSQL(text(reference('date')))}, ${columns[target] ? dateSQL(sourceColumn(rel, target, columns)) : 'NULL::DATE'})`
      }
    }
  }
  return {
    from,
    overrides,
    outputs,
    reports,
    ordinal: `input.${quote(ordinal)}`,
    safeForProjection: source === 'POS',
  }
}
