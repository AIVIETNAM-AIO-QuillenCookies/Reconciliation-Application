import { LocalizedError } from '@/components/LocalizedError'
import {
  displayReferenceFields as REFERENCE_FIELDS,
  displayRoleLabels as ROLE_LABELS,
  displayPurposeLabels as PURPOSE_LABELS,
} from '@/lib/localized-model'
import { displayMappingFields as MAPPING_FIELDS } from '@/lib/localized-model'
import { vi, vt } from '@/lib/i18n'
import { useEffect, useRef, useState } from 'react'
import { Popover } from 'radix-ui'
import { ChevronDown, Plus, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { HeaderRowSelector } from './HeaderRowSelector'
import { SpreadsheetPreview, PreviewLoading } from './DataMappingView'
import { MasterFlowSummary } from './MasterFlowSummary'
import { ProgressView } from '@/components/processing/ProgressView'
import { useAppStore } from '@/lib/store'
import { useDuckDB } from '@/hooks/useDuckDB'
import { readMappingPreviews } from '@/lib/read-mapping-preview'
import { confirmedMappingSnapshot, mappingIssues } from '@/lib/data-mapping'
import {
  REFERENCE_ROLES,
  defaultRelationship,
  requiredReferenceFields,
  masterConfigurationIssues,
  masterSnapshot,
  masterFingerprint,
  type ReferenceRole,
  type ReferenceConfig,
  type MasterRelationship,
  type SourceField,
  type ReferenceField,
} from '@/lib/master-data'
import type { QueuedFile, FactSource } from '@/lib/uploads'
import { cn } from '@/lib/utils'

export function SearchSelect({
  label,
  value,
  options,
  onChange,
  placeholder = 'Chọn trang tính…',
  invalid = false,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  placeholder?: string
  invalid?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        setSearch('')
      }}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-invalid={invalid || undefined}
          className={cn(
            'flex min-h-9 w-full min-w-0 items-center justify-between gap-2 rounded-md border bg-white px-3 py-2 text-left text-xs',
            invalid && 'border-warning bg-amber-50/40',
          )}
        >
          <span className="truncate">
            {options.find((o) => o.value === value)?.label ?? placeholder}
          </span>
          <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={5}
          className="z-[80] w-[min(360px,85vw)] rounded-lg border bg-white p-2 shadow-xl"
        >
          <div className="mb-2 flex items-center gap-2 border-b px-2 pb-2">
            <Search className="size-3" />
            <input
              aria-label={vt`Search ${label}`}
              className="w-full text-xs outline-none"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={vi('Search…')}
            />
          </div>
          <div
            className="max-h-56 overflow-auto"
            role="listbox"
            aria-label={label}
            onKeyDown={(event) => {
              if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key))
                return
              event.preventDefault()
              const choices = Array.from(
                event.currentTarget.querySelectorAll<HTMLButtonElement>(
                  '[role="option"]',
                ),
              )
              const index = choices.indexOf(
                document.activeElement as HTMLButtonElement,
              )
              choices[
                event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? choices.length - 1
                    : event.key === 'ArrowDown'
                      ? (index + 1) % choices.length
                      : (index - 1 + choices.length) % choices.length
              ]?.focus()
            }}
          >
            {options
              .filter((o) =>
                o.label
                  .toLocaleLowerCase()
                  .includes(search.toLocaleLowerCase()),
              )
              .map((o) => (
                <button
                  type="button"
                  key={o.value}
                  role="option"
                  aria-selected={value === o.value}
                  className="block w-full rounded px-2 py-2 text-left text-xs hover:bg-accent focus:bg-accent"
                  onClick={() => {
                    onChange(o.value)
                    setOpen(false)
                  }}
                >
                  {o.label}
                </button>
              ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

export function MasterDataConfigurator({
  file,
  onBusy,
}: {
  file: QueuedFile
  onBusy: (busy: boolean) => void
}) {
  const store = useAppStore()
  const engine = useDuckDB()
  const draft = store.mappingDrafts[file.id]
  const master = draft?.master
  const focusRequest =
    store.masterFocusRequest?.fileId === file.id
      ? store.masterFocusRequest
      : null
  const [active, setActive] = useState<ReferenceRole>(
    focusRequest?.role ?? 'store',
  )
  const [browseSheet, setBrowseSheet] = useState('')
  const [tab, setTab] = useState<'mapping' | 'relationships' | 'validation'>(
    focusRequest?.relationshipId ? 'relationships' : 'mapping',
  )
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const validationController = useRef<AbortController | null>(null)
  const attempt = useRef<string | null>(null)
  const failConfigurationCheck = store.failConfigurationCheck
  const ref = master?.roles[active]
  const name =
    browseSheet || ref?.sheetName || Object.keys(master?.sheets ?? {})[0]
  const sheet = master?.sheets[name]
  const fingerprint = master
    ? masterFingerprint(
        master,
        store.files,
        store.files
          .filter((f) => f.source !== 'Dim')
          .map((f) => [f.id, store.mappingDrafts[f.id]?.columns]),
      )
    : ''
  useEffect(() => {
    validationController.current?.abort()
    return () => {
      validationController.current?.abort()
      if (attempt.current)
        failConfigurationCheck(
          attempt.current,
          'Đã dừng kiểm tra do đóng màn hình hoặc thay đổi cấu hình.',
          'cancelled',
        )
    }
  }, [fingerprint, failConfigurationCheck])
  useEffect(() => {
    if (tab !== 'relationships') return
    const target = focusRequest?.relationshipId
    if (target)
      document.getElementById(`master-relationship-${target}`)?.focus()
  }, [focusRequest?.serial, focusRequest?.relationshipId, tab])
  const setMasterSheetPreview = store.setMasterSheetPreview
  useEffect(() => {
    if (!sheet || sheet.preview || sheet.error) return
    const controller = new AbortController()
    void readMappingPreviews(
      file.file,
      controller.signal,
      'dim',
      sheet.headerRow,
      name === 'CSV' ? undefined : name,
    )
      .then((previews) => {
        if (!controller.signal.aborted) {
          const preview = previews[0]
          setMasterSheetPreview(
            file.id,
            file.file,
            name,
            sheet.headerRow,
            preview.error ? null : preview,
            preview.error ?? null,
          )
        }
      })
      .catch((issue) => {
        if (!controller.signal.aborted)
          setMasterSheetPreview(
            file.id,
            file.file,
            name,
            sheet.headerRow,
            null,
            issue instanceof Error ? issue.message : String(issue),
          )
      })
    return () => controller.abort()
  }, [file.id, file.file, name, sheet, setMasterSheetPreview])
  if (!master || !ref) return <PreviewLoading />
  const update = (patch: Partial<ReferenceConfig>) =>
    store.setMasterReference(file.id, active, { ...ref, ...patch })
  const issues = masterConfigurationIssues(
    master,
    store.mappingDrafts,
    store.files,
  )
  const required = requiredReferenceFields(active, ref)
  const validation = draft.masterValidation
  const check = async () => {
    setError(null)
    setTab('validation')
    const config = masterSnapshot(master)
    let mappings: ReturnType<typeof confirmedMappingSnapshot>
    try {
      mappings = confirmedMappingSnapshot(store.files, store.mappingDrafts)
    } catch (issue) {
      const id = store.beginConfigurationCheck(file.id, fingerprint)
      const message = issue instanceof Error ? issue.message : String(issue)
      setError(message)
      store.failConfigurationCheck(id, message, 'needs-configuration')
      return
    }
    const checkFingerprint = masterFingerprint(config, store.files, mappings)
    const id = store.beginConfigurationCheck(file.id, checkFingerprint)
    attempt.current = id
    if (issues.length) {
      setError(issues.join('\n'))
      store.failConfigurationCheck(id, issues.join('\n'), 'needs-configuration')
      return
    }
    if (engine.status !== 'ready') {
      setError(vi('Wait for the local engine to be ready.'))
      store.failConfigurationCheck(
        id,
        vi('Wait for the local engine to be ready.'),
        'needs-configuration',
      )
      return
    }
    store.configurationSelectionReady(id)
    const controller = new AbortController()
    validationController.current?.abort()
    validationController.current = controller
    setBusy(true)
    onBusy(true)
    try {
      const [
        { ReconciliationEngine },
        { decodeSpreadsheet, decodeDimSpreadsheet },
      ] = await Promise.all([
        import('@/lib/ReconciliationEngine'),
        import('@/lib/decode-spreadsheet'),
      ])
      controller.signal.throwIfAborted()
      await new ReconciliationEngine(
        engine.database,
        decodeSpreadsheet,
        decodeDimSpreadsheet,
        { onWarning() {} },
      ).processUploads(store.files, store.period, {
        signal: controller.signal,
        columnMappings: mappings,
        masterConfiguration: config,
        validationOnly: true,
        masterFingerprint: checkFingerprint,
        onProgress: (event) => {
          if (!controller.signal.aborted)
            store.updateConfigurationProgress(id, event)
        },
        onMasterValidation: (result) => {
          if (!controller.signal.aborted) {
            store.setMasterValidation(file.id, result)
            store.finishConfigurationCheck(id, result)
          }
        },
      })
    } catch (issue) {
      if (!controller.signal.aborted) {
        const message = issue instanceof Error ? issue.message : String(issue)
        setError(message)
        store.failConfigurationCheck(id, message)
      }
    } finally {
      if (validationController.current === controller) {
        setBusy(false)
        onBusy(false)
      }
    }
  }
  const roleState = (role: ReferenceRole) => {
    const item = master.roles[role]
    if (item.usage === 'not-used') return vi('Not used')
    if (item.usage === 'unconfigured') return vi('Not configured')
    if (validation?.passed) return vi('Validated')
    const single = {
      ...master,
      roles: Object.fromEntries(
        REFERENCE_ROLES.map((r) => [
          r,
          r === role ? item : { ...master.roles[r], usage: 'not-used' },
        ]),
      ),
    } as typeof master
    return masterConfigurationIssues(single, store.mappingDrafts, store.files)
      .length ||
      validation?.joins.some((j) => j.role === role && j.errors.length)
      ? vi('Needs attention')
      : vi('Configuration ready')
  }
  const changeRelationship = (
    index: number,
    patch: Partial<MasterRelationship>,
  ) =>
    update({
      relationships: ref.relationships.map((rel, i) =>
        i === index ? { ...rel, ...patch } : rel,
      ),
    })
  const editRole = (role: ReferenceRole, relationshipId?: string) => {
    setActive(role)
    setBrowseSheet('')
    setTab(relationshipId ? 'relationships' : 'mapping')
    if (relationshipId)
      store.focusMasterConfiguration(file.id, role, relationshipId)
  }
  const progress =
    store.configurationProgress?.fileId === file.id
      ? store.configurationProgress
      : null
  const fixConfiguration = () => {
    const fact = store.files.find(
      (entry) =>
        entry.source !== '' &&
        entry.source !== 'Dim' &&
        mappingIssues(entry.source, store.mappingDrafts[entry.id]).length > 0,
    )
    if (fact?.source) {
      store.openSourceOnboarding(fact.source)
      return
    }
    const report = validation?.joins.find((entry) => entry.errors.length)
    if (report) {
      editRole(report.role, report.relationshipId)
      return
    }
    const role =
      REFERENCE_ROLES.find(
        (role) =>
          roleState(role) === vi('Not configured') ||
          roleState(role) === vi('Needs attention'),
      ) ?? active
    editRole(role)
  }
  if (tab === 'validation' && progress)
    return (
      <form
        id="master-configuration-form"
        className="configuration-progress space-y-3"
        onSubmit={(event) => {
          event.preventDefault()
          if (!busy) void check()
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {file.file.name} · Bản nháp được giữ nguyên
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setTab('mapping')}
          >
            Quay lại cấu hình
          </Button>
        </div>
        <ProgressView
          key={progress.id}
          flow={progress}
          onRetry={() => void check()}
          onFix={fixConfiguration}
          onFixJoin={(report) => editRole(report.role, report.relationshipId)}
        />
        <details className="text-xs">
          <summary className="cursor-pointer font-medium text-primary">
            Xem sơ đồ cấu hình đang kiểm tra
          </summary>
          <div className="mt-3">
            <MasterFlowSummary
              master={master}
              validation={validation}
              files={store.files}
              drafts={store.mappingDrafts}
              onEdit={editRole}
            />
          </div>
        </details>
      </form>
    )
  return (
    <form
      id="master-configuration-form"
      onSubmit={(event) => {
        event.preventDefault()
        void check()
      }}
      className="space-y-4 text-xs"
    >
      <div className="rounded-xl border border-primary/20 bg-accent/50 p-3">
        <p className="font-medium text-primary">
          {' ' +
            vi(
              'Choose the reference sheets, map their columns, and confirm how they connect to your source data.',
            ) +
            ' '}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {' ' +
            vi(
              'Assign sheets → Map fields & joins → Validate → Confirm. Sheet names never assign roles automatically.',
            ) +
            ' '}
        </p>
      </div>
      <div className="grid min-w-0 gap-4 lg:grid-cols-[155px_minmax(0,1fr)]">
        <nav
          aria-label={vi('Reference roles')}
          className="flex gap-2 overflow-auto lg:flex-col"
        >
          {REFERENCE_ROLES.map((role) => (
            <button
              type="button"
              key={role}
              onClick={() => {
                setActive(role)
                setBrowseSheet('')
                setTab('mapping')
              }}
              aria-pressed={active === role}
              className={cn(
                'min-w-[130px] rounded-lg border p-3 text-left',
                active === role ? 'border-primary/40 bg-accent' : 'bg-white',
              )}
            >
              <strong className="block">{ROLE_LABELS[role]}</strong>
              <span
                className={cn(
                  'mt-1 block text-[10px]',
                  roleState(role) === vi('Needs attention')
                    ? 'text-warning'
                    : 'text-muted-foreground',
                )}
              >
                {roleState(role)}
              </span>
              <span className="mt-1 block truncate text-[10px]">
                {master.roles[role].sheetName || vi('Choose worksheet')}
              </span>
            </button>
          ))}
        </nav>
        <div className="min-w-0 space-y-4">
          <div className="grid gap-3 rounded-xl border bg-muted/40 p-3 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="font-medium">{ROLE_LABELS[active]}</span>
              <SearchSelect
                label={vt`${ROLE_LABELS[active]} usage`}
                value={ref.usage}
                options={[
                  {
                    value: 'unconfigured',
                    label: vi('Choose Use or Not used'),
                  },
                  { value: 'enabled', label: vi('Use this reference role') },
                  { value: 'not-used', label: vi('Not used') },
                ]}
                onChange={(usage) =>
                  update({ usage: usage as ReferenceConfig['usage'] })
                }
              />
            </label>
            <label className="space-y-1.5">
              <span>{vi('Reference worksheet')}</span>
              <SearchSelect
                label={vt`${ROLE_LABELS[active]} worksheet`}
                invalid={ref.usage === 'enabled' && !ref.sheetName}
                value={ref.sheetName}
                options={Object.keys(master.sheets).map((s) => ({
                  value: s,
                  label: s,
                }))}
                onChange={(sheetName) => {
                  setBrowseSheet('')
                  update({
                    usage: 'enabled',
                    sheetName,
                    columns: {},
                    relationships: [defaultRelationship(active)],
                  })
                }}
              />
            </label>
          </div>
          <div
            className="flex flex-wrap gap-1 border-b"
            role="tablist"
            aria-label={vi('Reference configuration')}
          >
            {(['mapping', 'relationships', 'validation'] as const).map((t) => (
              <button
                type="button"
                role="tab"
                aria-selected={tab === t}
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'border-b-2 px-3 py-2 capitalize',
                  tab === t
                    ? 'border-primary font-medium text-primary'
                    : 'border-transparent text-muted-foreground',
                )}
              >
                {t === 'mapping'
                  ? vi('Map fields & preview')
                  : t === 'relationships'
                    ? vi('Relationship builder')
                    : vi('Validation')}
              </button>
            ))}
          </div>
          {tab === 'mapping' && (
            <div className="space-y-4">
              {ref.usage !== 'enabled' ? (
                <p className="text-muted-foreground">
                  {' ' +
                    vi(
                      'Choose Use to configure this role, or leave it explicitly Not used. All worksheets remain available for preview.',
                    ) +
                    ' '}
                </p>
              ) : !ref.sheetName ? (
                <p>{vi('Choose the worksheet used by this reference role.')}</p>
              ) : (
                <div className="divide-y rounded-lg border">
                  {REFERENCE_FIELDS[active].map((field) => (
                    <div
                      key={field.id}
                      className="grid items-center gap-2 p-3 sm:grid-cols-2"
                    >
                      <div>
                        <strong className="font-medium">{field.label}</strong>
                        <span
                          className={cn(
                            'ml-2 text-[10px]',
                            required.has(field.id)
                              ? 'text-primary'
                              : 'text-muted-foreground',
                          )}
                        >
                          {required.has(field.id)
                            ? vi('Required')
                            : vi('Optional')}
                        </span>
                        <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                          {field.description}
                        </p>
                      </div>
                      <SearchSelect
                        label={vt`${ROLE_LABELS[active]} ${field.label} column`}
                        invalid={
                          required.has(field.id) && !ref.columns[field.id]
                        }
                        value={ref.columns[field.id] ?? ''}
                        options={[
                          { value: '', label: vi('Not mapped') },
                          ...(
                            master.sheets[ref.sheetName]?.preview?.headers ?? []
                          ).map((h) => ({ value: h, label: h })),
                        ]}
                        onChange={(column) =>
                          update({
                            columns: { ...ref.columns, [field.id]: column },
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-3 rounded-xl border p-3">
                <div className="flex items-center justify-between gap-2">
                  <strong className="font-medium">
                    {vi('Worksheet preview')}
                  </strong>
                  <span className="text-[10px] text-muted-foreground">
                    {' ' + vi('Sample only · up to 5 rows') + ' '}
                  </span>
                </div>
                <SearchSelect
                  label={vi('Master data worksheet to preview')}
                  value={name ?? ''}
                  options={Object.keys(master.sheets).map((s) => ({
                    value: s,
                    label: s,
                  }))}
                  onChange={setBrowseSheet}
                />
                {sheet && (
                  <HeaderRowSelector
                    key={`${file.id}:${name}`}
                    value={sheet.headerRow}
                    onChange={(row) =>
                      store.setMasterSheetHeader(file.id, name, row)
                    }
                    dimensions
                  />
                )}
                {sheet?.error ? (
                  <div role="alert" className="text-destructive">
                    <LocalizedError message={sheet.error} />
                  </div>
                ) : sheet?.preview ? (
                  <div className="max-h-56 overflow-auto">
                    <SpreadsheetPreview preview={sheet.preview} />
                  </div>
                ) : (
                  <PreviewLoading />
                )}
              </div>
            </div>
          )}
          {tab === 'relationships' && (
            <div className="space-y-3">
              {ref.usage !== 'enabled' ? (
                <p>
                  {' ' +
                    vi(
                      'Enable this role and choose its sheet to configure relationships.',
                    ) +
                    ' '}
                </p>
              ) : (
                <>
                  <p className="text-[11px] leading-5 text-muted-foreground">
                    {' ' +
                      vi(
                        'Each key pair is combined with AND. Source fields resolve through each file’s own mapping. All lookups preserve source rows with a left join; duplicate reference keys block processing.',
                      ) +
                      ' '}
                  </p>
                  {ref.relationships.map((rel, index) => (
                    <div
                      key={rel.id}
                      id={`master-relationship-${rel.id}`}
                      tabIndex={-1}
                      className={cn(
                        'space-y-3 rounded-xl border p-3 focus:outline-none focus:ring-2 focus:ring-primary',
                        validation?.joins.some(
                          (report) =>
                            report.relationshipId === rel.id &&
                            report.errors.length,
                        ) && 'border-destructive bg-red-50/30',
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <strong className="font-medium">
                          {' ' + vi('Relationship') + ' '}
                          {index + 1}
                        </strong>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={vt`Remove relationship ${index + 1}`}
                          onClick={() =>
                            update({
                              relationships: ref.relationships.filter(
                                (_, i) => i !== index,
                              ),
                            })
                          }
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="space-y-1">
                          <span>{vi('Source table')}</span>
                          <SearchSelect
                            label={vt`Relationship ${index + 1} source`}
                            value={rel.source}
                            options={(
                              ['POS', 'WEB', 'GL', 'Flash'] as const
                            ).map((s) => ({ value: s, label: s }))}
                            onChange={(source) =>
                              changeRelationship(index, {
                                source: source as FactSource,
                              })
                            }
                          />
                        </label>
                        <div>
                          <p className="mb-1">{vi('Reference')}</p>
                          <p className="rounded-md bg-accent px-3 py-2">
                            {ROLE_LABELS[active]} ·{' '}
                            {ref.sheetName || vi('Choose worksheet')}
                          </p>
                        </div>
                      </div>
                      {rel.keys.map((key, keyIndex) => (
                        <div key={keyIndex} className="space-y-1">
                          <p className="text-[10px] text-muted-foreground">
                            {keyIndex ? vi('AND') : vi('Join key')}
                          </p>
                          <div className="grid items-center gap-2 sm:grid-cols-[1fr_1fr_85px_28px]">
                            <SearchSelect
                              label={vt`Source key ${index + 1}.${keyIndex + 1}`}
                              value={key.sourceField}
                              options={[
                                ...MAPPING_FIELDS[rel.source].map((f) => ({
                                  value: f.id,
                                  label: f.label,
                                })),
                                {
                                  value: 'recognition_period',
                                  label: vi('Recognition period'),
                                },
                              ]}
                              onChange={(sourceField) =>
                                changeRelationship(index, {
                                  keys: rel.keys.map((k, i) =>
                                    i === keyIndex
                                      ? {
                                          ...k,
                                          sourceField:
                                            sourceField as SourceField,
                                        }
                                      : k,
                                  ),
                                })
                              }
                            />
                            <SearchSelect
                              label={vt`Reference key ${index + 1}.${keyIndex + 1}`}
                              value={key.referenceField}
                              options={REFERENCE_FIELDS[active].map((f) => ({
                                value: f.id,
                                label: f.label,
                              }))}
                              onChange={(referenceField) =>
                                changeRelationship(index, {
                                  keys: rel.keys.map((k, i) =>
                                    i === keyIndex
                                      ? {
                                          ...k,
                                          referenceField:
                                            referenceField as ReferenceField,
                                        }
                                      : k,
                                  ),
                                })
                              }
                            />
                            <SearchSelect
                              label={vt`Key type ${index + 1}.${keyIndex + 1}`}
                              value={key.type}
                              options={['text', 'date', 'period'].map((t) => ({
                                value: t,
                                label: t,
                              }))}
                              onChange={(type) =>
                                changeRelationship(index, {
                                  keys: rel.keys.map((k, i) =>
                                    i === keyIndex
                                      ? { ...k, type: type as typeof key.type }
                                      : k,
                                  ),
                                })
                              }
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={vt`Remove key ${keyIndex + 1}`}
                              onClick={() =>
                                changeRelationship(index, {
                                  keys: rel.keys.filter(
                                    (_, i) => i !== keyIndex,
                                  ),
                                })
                              }
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          changeRelationship(index, {
                            keys: [
                              ...rel.keys,
                              {
                                sourceField: 'store_key',
                                referenceField: REFERENCE_FIELDS[active][0].id,
                                type: 'text',
                              },
                            ],
                          })
                        }
                      >
                        <Plus className="size-3" />
                        {' ' + vi('Add key pair') + ' '}
                      </Button>
                      <fieldset>
                        <legend className="mb-2 font-medium">
                          {' ' + vi('Fields returned after lookup') + ' '}
                        </legend>
                        <div className="flex flex-wrap gap-3">
                          {REFERENCE_FIELDS[active].map((field) => (
                            <label
                              key={field.id}
                              className="flex items-center gap-1.5"
                            >
                              <input
                                type="checkbox"
                                checked={rel.outputs.includes(field.id)}
                                onChange={(e) =>
                                  changeRelationship(index, {
                                    outputs: e.target.checked
                                      ? [...rel.outputs, field.id]
                                      : rel.outputs.filter(
                                          (f) => f !== field.id,
                                        ),
                                  })
                                }
                              />
                              {field.label}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="space-y-1">
                          <span>{vi('Lookup purpose')}</span>
                          <SearchSelect
                            label={vt`Relationship ${index + 1} purpose`}
                            value={rel.purpose}
                            options={Object.entries(PURPOSE_LABELS)
                              .filter(
                                ([p]) =>
                                  p === 'enrich' ||
                                  p === 'validate' ||
                                  (active === 'store' && p === 'store-map') ||
                                  (active === 'calendar' &&
                                    p.startsWith('calendar-')),
                              )
                              .map(([value, label]) => ({ value, label }))}
                            onChange={(purpose) =>
                              changeRelationship(index, {
                                purpose:
                                  purpose as MasterRelationship['purpose'],
                              })
                            }
                          />
                        </label>
                        <label className="space-y-1">
                          <span>{vi('When no match is found')}</span>
                          <SearchSelect
                            label={vt`Relationship ${index + 1} unmatched policy`}
                            value={rel.unmatched}
                            options={[
                              {
                                value: 'error',
                                label: vi('Block and show unmatched keys'),
                              },
                              {
                                value: 'keep',
                                label: vi('Keep source row and report warning'),
                              },
                            ]}
                            onChange={(unmatched) =>
                              changeRelationship(index, {
                                unmatched:
                                  unmatched as MasterRelationship['unmatched'],
                              })
                            }
                          />
                        </label>
                      </div>
                      {rel.purpose === 'calendar-date' && (
                        <SearchSelect
                          label={vi('Date field to resolve')}
                          value={rel.dateTarget ?? 'date'}
                          options={MAPPING_FIELDS[rel.source]
                            .filter((f) =>
                              [
                                'date',
                                'posting_date',
                                'delivery_date',
                                'return_date',
                              ].includes(f.id),
                            )
                            .map((f) => ({ value: f.id, label: f.label }))}
                          onChange={(dateTarget) =>
                            changeRelationship(index, {
                              dateTarget:
                                dateTarget as MasterRelationship['dateTarget'],
                            })
                          }
                        />
                      )}
                      <div className="rounded-lg bg-accent/60 p-2 text-[11px] leading-5">
                        <p>
                          {rel.keys
                            .map(
                              (k) =>
                                `${rel.source}.${MAPPING_FIELDS[rel.source].find((f) => f.id === k.sourceField)?.label ?? vi('Recognition period')} → ${ref.sheetName || vi('Selected sheet')}.${REFERENCE_FIELDS[active].find((f) => f.id === k.referenceField)?.label}`,
                            )
                            .join(vi('AND'))}
                        </p>
                        <p>
                          {' ' + vi('Return:')}{' '}
                          {rel.outputs
                            .map((f) => ref.columns[f] || f)
                            .join(', ') || vi('Choose output fields')}{' '}
                          · {PURPOSE_LABELS[rel.purpose]}
                        </p>
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      update({
                        relationships: [
                          ...ref.relationships,
                          defaultRelationship(active),
                        ],
                      })
                    }
                  >
                    <Plus className="size-3" />
                    {' ' + vi('Add relationship') + ' '}
                  </Button>
                </>
              )}
            </div>
          )}
          {tab === 'validation' && (
            <div className="space-y-3" aria-live="polite">
              <p className="font-medium text-primary">
                {busy
                  ? vi('Checking all source and selected reference rows…')
                  : validation?.passed
                    ? vi('Full validation passed')
                    : validation
                      ? vi('Full validation needs attention')
                      : vi('Not validated')}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {' ' +
                  vi(
                    'Preview samples are not validation. Check mappings & joins scans the full uploaded data. FX relationships validate or return attributes; they do not convert money or change GL amount_usd.',
                  ) +
                  ' '}
              </p>
              {error && (
                <div
                  role="alert"
                  className="whitespace-pre-line text-destructive"
                >
                  <LocalizedError message={error} />
                </div>
              )}
              {!validation && issues.length > 0 && (
                <ul className="list-disc space-y-1 pl-4 text-warning">
                  {issues.map((issue) => (
                    <li key={issue}>
                      <LocalizedError message={issue} />
                    </li>
                  ))}
                </ul>
              )}
              {validation?.joins.map((result, i) => (
                <div key={i} className="space-y-1 rounded-lg border p-3">
                  <strong>
                    {ROLE_LABELS[result.role]} · {result.source} ·{' '}
                    {store.files.find((f) => f.id === result.fileId)?.file.name}
                  </strong>
                  <p>
                    {' ' + vi('Reference:') + ' '}
                    {result.referenceRows}
                    {' ' + vi('rows · Duplicate key groups:') + ' '}
                    {result.duplicateKeys}
                    {' ' + vi('· Blank keys:')} {result.blankReferenceKeys}
                  </p>
                  <p>
                    {' ' + vi('Source rows:') + ' '}
                    {result.rowsBefore}
                    {' ' + vi('before →') + ' '}
                    {result.rowsAfter} {' ' + vi('after · Unmatched:') + ' '}
                    {result.unmatchedRows}
                  </p>
                  {result.unmatchedSamples.length > 0 && (
                    <p className="break-all text-warning">
                      {' ' + vi('Sample unmatched keys:')}{' '}
                      {result.unmatchedSamples.join('; ')}
                    </p>
                  )}
                  {result.errors.map((message) => (
                    <div key={message} className="text-destructive">
                      <LocalizedError message={message} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <details className="rounded-xl border bg-white p-3">
        <summary className="cursor-pointer text-xs font-semibold text-primary">
          Sơ đồ cấu hình & phép nối
        </summary>
        <div className="mt-3">
          <MasterFlowSummary
            master={master}
            validation={validation}
            files={store.files}
            drafts={store.mappingDrafts}
            onEdit={editRole}
          />
        </div>
      </details>
    </form>
  )
}
