import type {
  FilePreview,
  MappingDrafts,
  MappingFieldId,
} from './data-mapping.ts'
import { MAPPING_FIELDS } from './data-mapping.ts'
import type { FactSource, QueuedFile } from './uploads.ts'
import { isValidHeaderRow } from './header-row.ts'

export const REFERENCE_ROLES = [
  'store',
  'calendar',
  'fxDaily',
  'fxMonthEnd',
] as const
export type ReferenceRole = (typeof REFERENCE_ROLES)[number]
export type ReferenceField =
  | 'pos_store_id'
  | 'finance_store_code'
  | 'country'
  | 'currency'
  | 'date'
  | 'date_key'
  | 'period'
  | 'working_day'
  | 'posting_date'
  | 'rate'
export type SourceField = MappingFieldId | 'recognition_period'
export type LookupPurpose =
  'store-map' | 'calendar-date' | 'calendar-posting' | 'enrich' | 'validate'
export interface JoinKeyPair {
  sourceField: SourceField
  referenceField: ReferenceField
  type: 'text' | 'date' | 'period'
}
export interface MasterRelationship {
  id: string
  source: FactSource
  keys: JoinKeyPair[]
  outputs: ReferenceField[]
  purpose: LookupPurpose
  unmatched: 'error' | 'keep'
  /** Destination for an explicitly configured calendar-date lookup. */
  dateTarget?: 'date' | 'posting_date' | 'delivery_date' | 'return_date'
}
export interface ReferenceConfig {
  usage: 'unconfigured' | 'not-used' | 'enabled'
  sheetName: string
  columns: Partial<Record<ReferenceField, string>>
  relationships: MasterRelationship[]
}
export interface MasterSheetDraft {
  headerRow: number
  preview: FilePreview | null
  error: string | null
}
export interface MasterConfiguration {
  revision: number
  fileId: string
  sheets: Record<string, { headerRow: number }>
  roles: Record<ReferenceRole, ReferenceConfig>
}
export interface MasterDraft extends MasterConfiguration {
  sheets: Record<string, MasterSheetDraft>
}
export interface JoinValidation {
  role: ReferenceRole
  relationshipId: string
  source: FactSource
  fileId: string
  referenceRows: number
  duplicateKeys: number
  blankReferenceKeys: number
  invalidReferenceKeys: number
  invalidSourceKeys: number
  unmatchedRows: number
  unmatchedSamples: string[]
  rowsBefore: number
  rowsAfter: number
  errors: string[]
}
export interface MasterValidation {
  fingerprint: string
  scope: 'full'
  passed: boolean
  joins: JoinValidation[]
  errors: string[]
}
export const ROLE_LABELS: Record<ReferenceRole, string> = {
  store: 'Store Master',
  calendar: 'Calendar',
  fxDaily: 'FX Daily',
  fxMonthEnd: 'FX Month End',
}
export const REFERENCE_FIELDS: Record<
  ReferenceRole,
  { id: ReferenceField; label: string; description: string }[]
> = {
  store: [
    {
      id: 'pos_store_id',
      label: 'POS store ID',
      description: 'Source store identifier; text preserves leading zeros.',
    },
    {
      id: 'finance_store_code',
      label: 'Finance store code',
      description: 'Ledger store code returned by store mapping.',
    },
    {
      id: 'country',
      label: 'Country',
      description: 'Optional store attribute.',
    },
    {
      id: 'currency',
      label: 'Currency',
      description: 'Optional store currency.',
    },
  ],
  calendar: [
    {
      id: 'date_key',
      label: 'Calendar key',
      description:
        'Optional surrogate key, separate from the actual calendar date.',
    },
    {
      id: 'date',
      label: 'Date',
      description:
        'Calendar date or date key, as selected in the relationship.',
    },
    {
      id: 'period',
      label: 'Period',
      description: 'Reporting period returned by lookup.',
    },
    {
      id: 'posting_date',
      label: 'Posting date',
      description:
        'Explicit recognition date; no working-day offset is inferred.',
    },
    {
      id: 'working_day',
      label: 'Working-day flag',
      description:
        'Optional attribute; required only if selected as an output.',
    },
  ],
  fxDaily: [
    { id: 'date', label: 'Rate date', description: 'Daily FX rate date.' },
    {
      id: 'currency',
      label: 'Currency',
      description: 'Rate currency; part of the composite key.',
    },
    {
      id: 'rate',
      label: 'Exchange-rate value',
      description:
        'Local currency per 1 USD (usd_to_ccy). POS local amounts divide by the confirmed daily rate; supplied USD net remains authoritative.',
    },
  ],
  fxMonthEnd: [
    {
      id: 'period',
      label: 'Rate period',
      description: 'YYYY-MM, YYYYMM, or a date within the rate month.',
    },
    {
      id: 'currency',
      label: 'Currency',
      description: 'Rate currency; part of the composite key.',
    },
    {
      id: 'rate',
      label: 'Exchange-rate value',
      description:
        'Local currency per 1 USD (usd_to_ccy). POS derived accounting net divides by the confirmed recognition-period rate; supplied USD net remains authoritative.',
    },
  ],
}
export const PURPOSE_LABELS: Record<LookupPurpose, string> = {
  'store-map': 'Resolve Finance store code',
  'calendar-date': 'Resolve source date',
  'calendar-posting': 'Set POS posting date from calendar',
  enrich: 'Return attributes (left lookup)',
  validate: 'Validate reference coverage only',
}
export function createMasterDraft(
  fileId: string,
  previews: FilePreview[],
): MasterDraft {
  return {
    revision: 0,
    fileId,
    sheets: Object.fromEntries(
      previews.map((p) => [
        p.sheetName ?? 'CSV',
        {
          headerRow: p.headerRow ?? 1,
          preview: p.error ? null : p,
          error: p.error ?? null,
        },
      ]),
    ),
    roles: Object.fromEntries(
      REFERENCE_ROLES.map((role) => [
        role,
        {
          usage: 'unconfigured',
          sheetName: '',
          columns: {},
          relationships: [],
        },
      ]),
    ) as unknown as MasterDraft['roles'],
  }
}
export function masterSnapshot(
  draft: MasterConfiguration,
): MasterConfiguration {
  return JSON.parse(
    JSON.stringify({
      revision: draft.revision,
      fileId: draft.fileId,
      sheets: Object.fromEntries(
        Object.entries(draft.sheets).map(([name, sheet]) => [
          name,
          { headerRow: sheet.headerRow },
        ]),
      ),
      roles: draft.roles,
    }),
  )
}
export function masterFingerprint(
  config: MasterConfiguration,
  files: readonly QueuedFile[],
  mappings: unknown,
): string {
  return JSON.stringify([
    masterSnapshot(config),
    files.map((f) => [
      f.id,
      f.source,
      f.headerRow ?? 1,
      f.file.name,
      f.file.size,
      f.file.lastModified,
    ]),
    mappings,
  ])
}
export function requiredReferenceFields(
  role: ReferenceRole,
  config: ReferenceConfig,
): Set<ReferenceField> {
  const fields = new Set<ReferenceField>()
  for (const rel of config.relationships) {
    rel.keys.forEach((key) => fields.add(key.referenceField))
    rel.outputs.forEach((field) => fields.add(field))
    if (rel.purpose === 'store-map') fields.add('finance_store_code')
    if (rel.purpose === 'calendar-date') fields.add('date')
    if (rel.purpose === 'calendar-posting') fields.add('posting_date')
  }
  if (role === 'fxDaily' || role === 'fxMonthEnd') {
    fields.add(role === 'fxDaily' ? 'date' : 'period')
    fields.add('currency')
    fields.add('rate')
  }
  return fields
}
export function defaultRelationship(role: ReferenceRole): MasterRelationship {
  return {
    id: crypto.randomUUID(),
    source: 'POS',
    keys:
      role === 'store'
        ? [
            {
              sourceField: 'store_key',
              referenceField: 'pos_store_id',
              type: 'text',
            },
          ]
        : role === 'calendar'
          ? [{ sourceField: 'date', referenceField: 'date', type: 'date' }]
          : [
              {
                sourceField: role === 'fxDaily' ? 'date' : 'recognition_period',
                referenceField: role === 'fxDaily' ? 'date' : 'period',
                type: role === 'fxDaily' ? 'date' : 'period',
              },
              {
                sourceField: 'currency',
                referenceField: 'currency',
                type: 'text',
              },
            ],
    outputs:
      role === 'store'
        ? ['finance_store_code']
        : role === 'calendar'
          ? ['period']
          : ['rate'],
    purpose: role === 'store' ? 'store-map' : 'enrich',
    unmatched: 'error',
    dateTarget: 'date',
  }
}
export function masterConfigurationIssues(
  config?: MasterConfiguration,
  drafts?: MappingDrafts,
  files?: readonly QueuedFile[],
): string[] {
  if (!config)
    return ['Choose reference roles and configure their mappings and joins.']
  const issues: string[] = []
  let enabled = 0
  const destinations = new Set<string>()
  const ids = new Set<string>()
  for (const role of REFERENCE_ROLES) {
    const ref = config.roles[role]
    if (!ref || !['enabled', 'not-used'].includes(ref.usage)) {
      issues.push(`${ROLE_LABELS[role]}: select Use or Not used.`)
      continue
    }
    if (ref.usage === 'not-used') continue
    enabled++
    const sheet = config.sheets[ref.sheetName]
    const preview = (sheet as MasterSheetDraft | undefined)?.preview
    if (!sheet || !isValidHeaderRow(sheet.headerRow))
      issues.push(
        `${ROLE_LABELS[role]}: choose a valid worksheet and header row.`,
      )
    if (
      sheet &&
      'preview' in sheet &&
      (!preview || (sheet as MasterSheetDraft).error)
    )
      issues.push(`${ROLE_LABELS[role]}: read the selected sheet preview.`)
    const available = REFERENCE_FIELDS[role].map((f) => f.id)
    for (const field of requiredReferenceFields(role, ref))
      if (!ref.columns[field])
        issues.push(`${ROLE_LABELS[role]}: map ${field}.`)
    for (const [field, column] of Object.entries(ref.columns)) {
      if (
        !available.includes(field as ReferenceField) ||
        (column && preview && !preview.headers.includes(column))
      )
        issues.push(
          `${ROLE_LABELS[role]}: column for ${field} no longer exists.`,
        )
    }
    if (!ref.relationships.length)
      issues.push(`${ROLE_LABELS[role]}: add a relationship.`)
    if (
      (role === 'fxDaily' || role === 'fxMonthEnd') &&
      ref.relationships.filter((relationship) => relationship.source === 'POS')
        .length > 1
    )
      issues.push(
        `${ROLE_LABELS[role]}: configure one POS relationship for each conversion basis.`,
      )
    for (const rel of ref.relationships) {
      if (!rel.id || ids.has(rel.id))
        issues.push('Relationship IDs must be unique.')
      ids.add(rel.id)
      if (!['POS', 'WEB', 'GL', 'Flash'].includes(rel.source))
        issues.push('Choose a source table.')
      if (
        !Object.hasOwn(PURPOSE_LABELS, rel.purpose) ||
        !['error', 'keep'].includes(rel.unmatched)
      )
        issues.push('Choose a lookup purpose and unmatched policy.')
      if (
        !rel.keys.length ||
        new Set(rel.keys.map((k) => k.referenceField)).size !== rel.keys.length
      )
        issues.push(`${ROLE_LABELS[role]}: choose distinct join keys.`)
      for (const key of rel.keys) {
        if (
          !['text', 'date', 'period'].includes(key.type) ||
          !available.includes(key.referenceField)
        )
          issues.push('Choose valid reference keys and key types.')
        const sourceFields = [
          ...(MAPPING_FIELDS[rel.source] ?? []).map((f) => f.id),
          'recognition_period',
        ]
        if (!sourceFields.includes(key.sourceField))
          issues.push(
            `${rel.source}: source field ${key.sourceField} is unavailable.`,
          )
      }
      if (!rel.outputs.length)
        issues.push(`${ROLE_LABELS[role]}: choose at least one returned field.`)
      if (
        rel.purpose === 'store-map' &&
        (role !== 'store' ||
          rel.source === 'Flash' ||
          !rel.outputs.includes('finance_store_code'))
      )
        issues.push(
          'Store mapping must return Finance store code for POS, WEB, or GL.',
        )
      if (rel.purpose.startsWith('calendar-') && role !== 'calendar')
        issues.push('Calendar purpose requires Calendar role.')
      if (
        rel.purpose === 'calendar-date' &&
        (!rel.outputs.includes('date') ||
          !rel.dateTarget ||
          !['date', 'posting_date', 'delivery_date', 'return_date'].includes(
            rel.dateTarget,
          ) ||
          !(MAPPING_FIELDS[rel.source] ?? []).some(
            (f) => f.id === rel.dateTarget,
          ))
      )
        issues.push(
          'Date resolution requires a valid source date target and Date output.',
        )
      if (
        rel.purpose === 'calendar-posting' &&
        (rel.source !== 'POS' || !rel.outputs.includes('posting_date'))
      )
        issues.push('Calendar posting requires POS and Posting date output.')
      if (role === 'fxDaily' || role === 'fxMonthEnd') {
        const temporal = role === 'fxDaily' ? 'date' : 'period'
        if (
          !rel.keys.some(
            (k) =>
              k.referenceField === temporal &&
              k.type === (temporal === 'date' ? 'date' : 'period'),
          ) ||
          !rel.keys.some(
            (k) => k.referenceField === 'currency' && k.type === 'text',
          )
        )
          issues.push(
            `${ROLE_LABELS[role]} requires ${temporal} AND currency keys.`,
          )
      }
      if (rel.purpose !== 'enrich' && rel.purpose !== 'validate') {
        const target = `${rel.source}:${rel.purpose === 'store-map' ? 'store_key' : rel.purpose === 'calendar-posting' ? 'posting_date' : rel.dateTarget}`
        if (destinations.has(target))
          issues.push(`Multiple relationships write ${target}.`)
        destinations.add(target)
      }
      if (files && drafts) {
        const sourceFiles = files.filter((f) => f.source === rel.source)
        if (!sourceFiles.length)
          issues.push(`${rel.source}: no source files selected.`)
        for (const file of sourceFiles)
          for (const key of rel.keys) {
            const columns = drafts[file.id]?.columns
            const field =
              key.sourceField === 'recognition_period'
                ? rel.source === 'WEB'
                  ? 'delivery_date'
                  : rel.source === 'POS' && columns?.posting_date
                    ? 'posting_date'
                    : 'date'
                : key.sourceField
            if (!columns?.[field])
              issues.push(
                `${file.file.name}: map source field ${field} for this relationship.`,
              )
          }
      }
    }
  }
  if (!enabled)
    issues.push(
      'Configure at least one reference role, or remove the workbook to continue without Master / Dim.',
    )
  return [...new Set(issues)]
}
export function masterReady(
  config: MasterDraft | undefined,
  validation: MasterValidation | undefined,
): boolean {
  return (
    !!config &&
    masterConfigurationIssues(config).length === 0 &&
    !!validation?.passed &&
    validation.scope === 'full' &&
    validation.errors.length === 0 &&
    validation.joins.every(
      (j) => j.errors.length === 0 && j.rowsBefore === j.rowsAfter,
    ) &&
    REFERENCE_ROLES.every(
      (role) =>
        config.roles[role].usage !== 'enabled' ||
        config.roles[role].relationships.every((rel) =>
          validation.joins.some(
            (j) =>
              j.role === role &&
              j.relationshipId === rel.id &&
              j.source === rel.source,
          ),
        ),
    )
  )
}
