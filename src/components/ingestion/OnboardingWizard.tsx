import { LocalizedError } from '@/components/LocalizedError'
import { displayOnboardingSteps as ONBOARDING_STEPS } from '@/lib/localized-model'
import { vi, vt } from '@/lib/i18n'
import { useEffect, useRef, useState, type DragEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  FileSpreadsheet,
  FolderOpen,
  Info,
  Play,
  AlertCircle,
  Trash2,
  UploadCloud,
} from 'lucide-react'
import {
  DataMappingView,
  PreviewError,
  PreviewLoading,
} from '@/components/ingestion/DataMappingView'
import { SourceIcon } from '@/components/SourceIcon'
import { HeaderRowSelector } from '@/components/ingestion/HeaderRowSelector'
import { HeaderRowError } from '@/lib/header-row'
import { MasterDataConfigurator } from './MasterDataConfigurator'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useDuckDB } from '@/hooks/useDuckDB'
import { canCompleteOnboarding, onboardingStepReady } from '@/lib/onboarding'
import { readMappingPreviews } from '@/lib/read-mapping-preview'
import { useAppStore } from '@/lib/store'
import {
  fileKey,
  formatFileSize,
  MAX_BATCH_BYTES,
  MAX_FILES,
  validateFile,
  type QueuedFile,
  type Source,
} from '@/lib/uploads'
import { cn } from '@/lib/utils'
import { sourceStatus } from '@/lib/source-status'
import '@/ingestion-wizard.css'

/** One app-level instance keeps draft imports available from any entry point. */
export function OnboardingWizard() {
  const navigate = useNavigate()
  const engine = useDuckDB()
  const {
    onboardingOpen: open,
    onboardingStep: step,
    files,
    mappingDrafts,
    closeOnboarding,
    openSourceOnboarding,
    completeOnboarding,
    setFiles,
    setFilePreview,
    setPreviewError,
    resetFilePreview,
    setColumnMapping,
    setGLAmountBasis,
    setHeaderRow,
    masterFocusRequest,
    processingPanelOpen,
  } = useAppStore()
  const [selectedFiles, setSelectedFiles] = useState<
    Partial<Record<Source, string>>
  >({})
  const [previewAttempt, setPreviewAttempt] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [masterBusy, setMasterBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const dragDepth = useRef(0)
  const finishLock = useRef(false)
  const current = ONBOARDING_STEPS[step]
  const source = current.source
  const sourceFiles = files.filter((file) => file.source === source)
  const file =
    sourceFiles.find((entry) => entry.id === selectedFiles[source]) ??
    sourceFiles[0]
  const draft = file ? mappingDrafts[file.id] : undefined
  const final = step === ONBOARDING_STEPS.length - 1
  const ready = onboardingStepReady(source, files, mappingDrafts)
  const canFinish = canCompleteOnboarding(files, mappingDrafts)
  const unassigned = files.filter((entry) => !entry.source)

  useEffect(() => {
    if (!open) return
    setError(null)
    setDragging(false)
    dragDepth.current = 0
    finishLock.current = false
  }, [open, step])

  // Only a new source/file context resets the workspace. Preview, mapping and
  // header edits keep their scroll position and mounted controls.
  useEffect(() => {
    if (!open) return
    bodyRef.current?.scrollTo({ top: 0 })
    headingRef.current?.focus({ preventScroll: true })
  }, [open, source, file?.id])

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    void (async () => {
      for (const entry of files) {
        if (
          entry.source !== source ||
          mappingDrafts[entry.id]?.preview ||
          mappingDrafts[entry.id]?.error
        )
          continue
        try {
          const previews = await readMappingPreviews(
            entry.file,
            controller.signal,
            source === 'Dim' ? 'dim' : 'first',
            entry.headerRow ?? 1,
          )
          if (!controller.signal.aborted)
            setFilePreview(
              entry.id,
              entry.file,
              source,
              previews[0],
              source === 'Dim' ? previews : undefined,
            )
        } catch (issue) {
          if (controller.signal.aborted) return
          setPreviewError(
            entry.id,
            entry.file,
            source,
            issue instanceof Error ? issue.message : String(issue),
            issue instanceof HeaderRowError ? 'header-row' : 'file',
            entry.headerRow ?? 1,
          )
        }
      }
    })()
    return () => controller.abort()
    // A draft is captured when this source starts reading. Mapping edits must not
    // cancel another pending file; changing source, files, or modal state does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, source, files, previewAttempt, setFilePreview, setPreviewError])

  function upload(incoming: File[]) {
    setError(null)
    if (incoming.length !== 1) {
      setError(vi('Choose one CSV or XLSX file for this source.'))
      return
    }
    const incomingFile = incoming[0]
    if (
      source === 'Dim' &&
      !incomingFile.name.toLowerCase().endsWith('.xlsx')
    ) {
      setError(
        vi('Choose one XLSX Master workbook containing your reference sheets.'),
      )
      return
    }
    const issue = validateFile(incomingFile)
    if (issue) {
      setError(issue)
      return
    }
    const remaining = files.filter((entry) => entry.id !== file?.id)
    if (
      remaining.some((entry) => fileKey(entry.file) === fileKey(incomingFile))
    ) {
      setError(
        vi('This file is already selected. Choose the export for this source.'),
      )
      return
    }
    if (remaining.length >= MAX_FILES) {
      setError(vt`Select up to ${MAX_FILES} files per batch.`)
      return
    }
    if (
      remaining.reduce(
        (sum, entry) => sum + entry.file.size,
        incomingFile.size,
      ) > MAX_BATCH_BYTES
    ) {
      setError(vi('This batch exceeds 200 MiB. Use smaller exports.'))
      return
    }
    const next: QueuedFile = {
      id: crypto.randomUUID(),
      file: incomingFile,
      source,
    }
    setSelectedFiles((previous) => ({ ...previous, [source]: next.id }))
    setFiles([...remaining, next])
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    dragDepth.current = 0
    setDragging(false)
    upload(Array.from(event.dataTransfer.files))
  }

  function retryPreview() {
    if (!file) return
    resetFilePreview(file.id)
    setPreviewAttempt((attempt) => attempt + 1)
  }

  function next() {
    if (!ready) return
    if (!final) {
      openSourceOnboarding(ONBOARDING_STEPS[step + 1].source)
      return
    }
    if (!canFinish || finishLock.current) return
    finishLock.current = true
    try {
      completeOnboarding()
      navigate('/')
    } catch (issue) {
      finishLock.current = false
      setError(
        issue instanceof Error
          ? issue.message
          : vi(
              'Unable to start reconciliation. Check your files and try again.',
            ),
      )
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) closeOnboarding()
      }}
    >
      <DialogContent
        className="import-wizard"
        onOpenAutoFocus={(event) => {
          returnFocusRef.current =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null
          event.preventDefault()
          headingRef.current?.focus()
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          if (processingPanelOpen) return
          if (returnFocusRef.current?.isConnected)
            returnFocusRef.current.focus()
          else document.getElementById('main-content')?.focus()
        }}
      >
        <header className="import-wizard-header border-b">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
              <UploadCloud className="size-[18px]" aria-hidden="true" />
            </span>
            <div className="min-w-0 pr-4">
              <DialogTitle className="text-lg">
                {' ' + vi('Import & map your data') + ' '}
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs">
                {' ' +
                  vi(
                    'Four required sources. One optional reference workbook.',
                  ) +
                  ' '}
              </DialogDescription>
            </div>
          </div>
        </header>
        <div className="import-wizard-body">
          <nav
            aria-label={vi('Source navigation')}
            className="wizard-source-navigation bg-muted/60"
          >
            <p className="mb-3 hidden px-2 text-xs font-medium text-muted-foreground md:block">
              {' ' + vi('Import sources') + ' '}
            </p>
            <ol aria-label={vi('Import steps')} className="wizard-source-list">
              {ONBOARDING_STEPS.map((item, index) => {
                const info = sourceStatus(
                  item.source,
                  files,
                  mappingDrafts,
                  item.source === source,
                )
                const complete = info.state === 'ready'
                const issue = info.state === 'error' || info.state === 'mapping'
                return (
                  <li key={item.source}>
                    <button
                      type="button"
                      onClick={() => openSourceOnboarding(item.source)}
                      aria-current={index === step ? 'step' : undefined}
                      aria-label={vt`Step ${index + 1}: ${item.label}${complete ? vi(', complete') : ''}`}
                      className={cn(
                        'wizard-source-link rounded-lg transition-colors duration-150',
                        index === step
                          ? 'bg-accent text-accent-foreground ring-1 ring-primary/15'
                          : 'text-muted-foreground hover:bg-white',
                      )}
                    >
                      <span
                        className={cn(
                          'flex size-7 shrink-0 items-center justify-center rounded-lg border text-[12px] font-semibold',
                          index === step
                            ? 'border-primary bg-primary text-white'
                            : complete
                              ? 'border-primary/20 bg-accent text-primary'
                              : issue
                                ? 'border-warning/25 bg-warning-subtle text-warning'
                                : 'bg-white',
                        )}
                      >
                        {complete ? (
                          <Check className="size-3.5" aria-hidden="true" />
                        ) : issue ? (
                          <AlertCircle
                            className="size-3.5"
                            aria-hidden="true"
                          />
                        ) : (
                          index + 1
                        )}
                      </span>
                      <span className="wizard-source-label min-w-0 text-xs font-medium leading-4">
                        {item.label}
                        <span className="mt-0.5 hidden text-[12px] font-normal text-muted-foreground md:block">
                          {info.state === 'empty'
                            ? item.source === 'Dim'
                              ? vi('Optional')
                              : vi('Required')
                            : vi(info.label)}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
            <p className="wizard-source-note mt-4 hidden border-t px-2 pt-3 text-xs leading-5 text-muted-foreground md:block">
              {vi('Files stay in this tab.')}
            </p>
          </nav>
          <div ref={bodyRef} className="wizard-content-body">
            <div key={source} className="wizard-step-content">
              <div className="wizard-step-heading">
                <SourceIcon
                  source={source}
                  className="mt-1 size-10 [&_svg]:size-5"
                />
                <div className="wizard-step-copy">
                  <div className="mb-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>
                      {vi('Step') + ' '}
                      {step + 1}
                      {' ' + vi('of 5')}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={
                        source === 'Dim'
                          ? 'text-muted-foreground'
                          : 'text-primary'
                      }
                    >
                      {source === 'Dim'
                        ? vi('Optional')
                        : vi('Required source')}
                    </span>
                  </div>
                  <h2
                    ref={headingRef}
                    tabIndex={-1}
                    className="text-base font-semibold tracking-tight outline-none sm:text-lg"
                  >
                    {file
                      ? source === 'Dim'
                        ? vi('Configure your reference data')
                        : vt`Map your ${current.label} columns`
                      : vt`Upload ${current.name}`}
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {file && source !== 'Dim'
                      ? vi(
                          'Confirm the suggestions below, then inspect the first three rows.',
                        )
                      : current.description}
                  </p>
                </div>
              </div>
              <div className="wizard-step-workspace">
                {error && (
                  <div
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs leading-relaxed text-destructive"
                  >
                    <LocalizedError message={error} />
                  </div>
                )}
                {unassigned.length > 0 && (
                  <div
                    role="alert"
                    className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-warning"
                  >
                    <p className="mb-2">
                      {' ' +
                        vi(
                          'Remove these unassigned files, then upload them at the appropriate step.',
                        ) +
                        ' '}
                    </p>
                    {unassigned.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="min-w-0 truncate">
                          {entry.file.name}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-[11px]"
                          onClick={() =>
                            setFiles((previous) =>
                              previous.filter((item) => item.id !== entry.id),
                            )
                          }
                        >
                          {' ' + vi('Remove') + ' '}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <input
                  ref={inputRef}
                  type="file"
                  accept={source === 'Dim' ? '.xlsx' : '.csv,.xlsx'}
                  className="sr-only"
                  tabIndex={-1}
                  aria-label={vt`Choose ${current.name} file`}
                  onChange={(event) => {
                    upload(Array.from(event.target.files ?? []))
                    event.target.value = ''
                  }}
                />
                {!file ? (
                  <>
                    <div
                      onDragEnter={(event) => {
                        event.preventDefault()
                        dragDepth.current++
                        setDragging(true)
                      }}
                      onDragOver={(event) => {
                        event.preventDefault()
                        event.dataTransfer.dropEffect = 'copy'
                      }}
                      onDragLeave={(event) => {
                        event.preventDefault()
                        dragDepth.current--
                        if (dragDepth.current <= 0) {
                          dragDepth.current = 0
                          setDragging(false)
                        }
                      }}
                      onDrop={drop}
                      className={cn(
                        'wizard-dropzone flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-5 py-5 text-center transition-colors duration-150',
                        dragging
                          ? 'border-primary bg-accent'
                          : 'border-border bg-muted/50',
                      )}
                    >
                      <span className="mb-3 flex size-10 items-center justify-center rounded-xl border bg-white text-primary shadow-sm">
                        <UploadCloud className="size-6" aria-hidden="true" />
                      </span>
                      <p className="text-sm font-medium">
                        {dragging
                          ? vt`Drop your ${current.label} file here`
                          : vt`Drag & drop your ${current.label} file`}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {' ' + vi('CSV or Excel workbook · Up to 50 MB') + ' '}
                      </p>
                      <Button
                        className="mt-3 h-9 text-xs"
                        onClick={() => inputRef.current?.click()}
                      >
                        <FolderOpen className="size-3.5" aria-hidden="true" />
                        {' ' + vi('Browse files') + ' '}
                      </Button>
                      <p className="mt-3 text-[11px] text-muted-foreground">
                        {' ' +
                          vi(
                            '20 files / 200 MiB per batch ? Processed locally',
                          ) +
                          ' '}
                      </p>
                    </div>
                    {source === 'Dim' && (
                      <p className="flex items-start gap-2 rounded-lg bg-muted p-3 text-[12px] leading-relaxed text-muted-foreground">
                        <Info
                          className="mt-0.5 size-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        {' ' +
                          vi(
                            'Master data is optional. You can finish without it. Add a workbook when your exports use store aliases or calendar keys that need lookup tables.',
                          ) +
                          ' '}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <div className="wizard-file-summary flex flex-wrap items-center gap-3 rounded-lg border bg-muted/70 p-3">
                      <FileSpreadsheet
                        className="size-5 shrink-0 text-primary"
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className="truncate text-xs font-medium"
                          title={file.file.name}
                        >
                          {file.file.name}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {formatFileSize(file.file.size)}
                          {draft?.preview
                            ? source === 'Dim' && draft.master
                              ? vt` · ${Object.keys(draft.master.sheets).length} worksheets · One combined Master workbook`
                              : ` · ${draft.preview.headers.length} columns${draft.preview.sheetName ? ` · ${draft.preview.sheetName}` : ''}`
                            : draft?.error
                              ? vi('· Adjust file settings below')
                              : vi('· Reading file…')}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px]"
                        onClick={() => inputRef.current?.click()}
                      >
                        {' ' + vi('Replace file') + ' '}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={vt`Remove ${file.file.name}`}
                        className="size-7 text-muted-foreground hover:text-red-600"
                        onClick={() => {
                          setFiles((previous) =>
                            previous.filter((entry) => entry.id !== file.id),
                          )
                          setError(null)
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                    {sourceFiles.length > 1 && (
                      <Select
                        value={file.id}
                        onValueChange={(fileId) =>
                          setSelectedFiles((previous) => ({
                            ...previous,
                            [source]: fileId,
                          }))
                        }
                      >
                        <SelectTrigger
                          aria-label={vt`${source} file to map`}
                          className="text-xs"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {sourceFiles.map((entry) => (
                            <SelectItem
                              key={entry.id}
                              value={entry.id}
                              className="text-xs"
                            >
                              {entry.file.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {draft?.errorKind === 'header-row' && (
                      <PreviewError
                        error={draft.error!}
                        onRetry={retryPreview}
                        kind="header-row"
                      />
                    )}
                    {/* Sibling panels need distinct identities as warnings appear and disappear. */}
                    {source !== 'Dim' && (
                      <HeaderRowSelector
                        key={`header-row:${file.id}`}
                        value={file.headerRow ?? 1}
                        onChange={(row) => setHeaderRow(file.id, row)}
                      />
                    )}
                    {draft?.errorKind === 'header-row' ? null : source ===
                      'Dim' ? (
                      draft?.error ? (
                        <PreviewError
                          error={draft.error}
                          onRetry={retryPreview}
                        />
                      ) : !draft?.preview ? (
                        <PreviewLoading />
                      ) : (
                        <MasterDataConfigurator
                          key={`dimensions:${file.id}:${masterFocusRequest?.serial ?? 0}`}
                          file={file}
                          onBusy={setMasterBusy}
                        />
                      )
                    ) : (
                      <DataMappingView
                        key={`mapping:${file.id}`}
                        file={file}
                        draft={draft}
                        onMappingChange={(columns) =>
                          setColumnMapping(file.id, columns)
                        }
                        onRetryPreview={retryPreview}
                        onGLAmountBasisChange={(basis) =>
                          setGLAmountBasis(file.id, basis)
                        }
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        <footer className="import-wizard-footer border-t bg-white">
          <div
            className="wizard-footer-status text-muted-foreground"
            role="status"
            tabIndex={0}
          >
            <span className="mt-0.5 shrink-0">
              {ready ? (
                <CheckCircle2
                  className="size-3 text-primary"
                  aria-hidden="true"
                />
              ) : (
                <Info className="size-3" aria-hidden="true" />
              )}
            </span>
            <span id="onboarding-step-status">
              {final
                ? !canFinish
                  ? vi(
                      'Complete required sources, configure enabled reference roles, and check all mappings & joins.',
                    )
                  : engine.status === 'error'
                    ? vi(
                        'The local engine is unavailable. Retry it before completing your import.',
                      )
                    : vi(
                        'Your sources are ready. The dashboard will show reconciliation progress.',
                      )
                : !file
                  ? vi('Upload this source to continue.')
                  : draft?.error
                    ? draft.errorKind === 'header-row'
                      ? vi(
                          'Adjust Header Row Number to find your column names.',
                        )
                      : vi('Resolve the file preview error to continue.')
                    : !draft?.preview
                      ? vi('Reading your file…')
                      : ready
                        ? vi('All required fields for this source are mapped.')
                        : vi(
                            'Map every required field in every file for this source to continue.',
                          )}
            </span>
            {final && engine.status === 'error' && (
              <Button
                variant="link"
                size="xs"
                className="h-auto p-0 text-[11px]"
                onClick={engine.retry}
              >
                {' ' + vi('Retry engine') + ' '}
              </Button>
            )}
          </div>
          <div className="wizard-footer-actions">
            <Button
              variant="outline"
              className="wizard-footer-back h-9 text-xs"
              onClick={() =>
                step === 0
                  ? closeOnboarding()
                  : openSourceOnboarding(ONBOARDING_STEPS[step - 1].source)
              }
            >
              {step > 0 && (
                <ArrowLeft className="size-3.5" aria-hidden="true" />
              )}
              {step === 0 ? vi('Cancel') : vi('Back')}
            </Button>
            <div className="wizard-footer-secondary">
              {final && file && (
                <Button
                  type="submit"
                  form="master-configuration-form"
                  variant="outline"
                  className="h-9 text-xs"
                  disabled={
                    masterBusy || !draft?.master || engine.status !== 'ready'
                  }
                >
                  {masterBusy
                    ? vi('Checking all data…')
                    : vi('Check mappings & joins')}
                </Button>
              )}
              {final && file && (
                <Button
                  variant="ghost"
                  className="h-9 text-xs"
                  onClick={() =>
                    setFiles((previous) =>
                      previous.filter((entry) => entry.source !== 'Dim'),
                    )
                  }
                >
                  {' ' + vi('Continue without Master / Dim') + ' '}
                </Button>
              )}
            </div>
            <Button
              className="wizard-footer-next h-9 gap-2 text-xs"
              disabled={
                final
                  ? !canFinish || masterBusy || engine.status === 'error'
                  : !ready
              }
              aria-describedby="onboarding-step-status"
              onClick={next}
            >
              {final ? <Play className="size-3.5" aria-hidden="true" /> : null}
              {final ? vi('Run reconciliation') : vi('Next Step')}
              {!final && <ArrowRight className="size-3.5" aria-hidden="true" />}
            </Button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  )
}
