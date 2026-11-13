import {
  createExcelReferenceController,
  emptyExcelReference,
  selectActiveResult,
  type ExcelReferenceState,
} from './excel-reference-session.ts'
import {
  createProgressFlow,
  patchProgressStep,
  reduceProgress,
  failProgress,
  finishConfiguration,
  finishPipeline,
  type ProcessingFlow,
  type EngineProgressEvent,
} from './processing-progress.ts'
import { createContext, useContext, useMemo, useSyncExternalStore } from 'react'
import {
  REQUIRED_SOURCES,
  SOURCES,
  type QueuedFile,
  type Source,
} from './uploads.ts'
import type {
  ReconciliationPeriod,
  ReconciliationResult,
  DimTableInfo,
} from './reconciliation-types.ts'
import type { ReconciliationException } from './exceptions.ts'
import type { ProcessingPhase } from './reconciliation-evidence.ts'
import type { UploadProcessingOptions } from './ReconciliationEngine.ts'
import { captureRunFailure, type RunFailure } from './run-failure.ts'
import type { GLCorrection, GLReviewSnapshot } from './gl-review.ts'
import {
  synchronizeReviewCases,
  editReviewCase,
  previewCorrection,
  completeCorrectionPreview,
  linkReviewExceptions,
  type GLReviewCase,
  type GLCasePatch,
  type GLCorrectionPatch,
} from './accounting-review.ts'
import {
  validateHeaderRow,
  type HeaderRowUpdate,
  type PreviewErrorKind,
} from './header-row.ts'
import {
  autoMapColumns,
  confirmedMappingSnapshot,
  canConfirmMappings,
  isFactSource,
  type ColumnMapping,
  type ConfirmedFileMapping,
  type FilePreview,
  type MappingDrafts,
} from './data-mapping.ts'
import {
  canCompleteOnboarding,
  firstIncompleteStep,
  ONBOARDING_STEPS,
} from './onboarding.ts'
import {
  createMasterDraft,
  masterSnapshot,
  masterFingerprint,
  masterReady,
  type MasterConfiguration,
  type MasterValidation,
  type ReferenceRole,
  type ReferenceConfig,
} from './master-data.ts'

export type ProcessingStatus =
  'idle' | 'waiting' | 'registering' | 'running' | 'ready' | 'error'
export interface AppState {
  excelReference: ExcelReferenceState
  files: QueuedFile[]
  mappingDrafts: MappingDrafts
  confirmedMappings: ConfirmedFileMapping[] | null
  confirmedMaster: MasterConfiguration | null
  onboardingOpen: boolean
  onboardingStep: number
  /** True only after all currently selected files for this source were registered successfully. */
  filesUploaded: Record<Source, boolean>
  registeredFileIds: string[]
  dimTables: DimTableInfo[]
  canViewReconciliation: boolean
  reconciliationData: ReconciliationResult | null
  exceptionsData: ReconciliationException[]
  glReview: GLReviewSnapshot | null
  reviewCases: GLReviewCase[]
  glCorrections: GLCorrection[]
  period: ReconciliationPeriod
  status: ProcessingStatus
  processingPhase: ProcessingPhase | null
  pipelineProgress: ProcessingFlow | null
  configurationProgress: ProcessingFlow | null
  processingPanelOpen: boolean
  masterFocusRequest: {
    fileId: string
    role?: ReferenceRole
    relationshipId?: string
    serial: number
  } | null
  engineStatus: 'loading' | 'ready' | 'error'
  error: string | null
  runFailure: RunFailure | null
  missingSources: string[]
}
export type UploadProcessor = (
  files: QueuedFile[],
  period: ReconciliationPeriod,
  options: UploadProcessingOptions,
) => Promise<ReconciliationResult | null>
type FilesUpdate = QueuedFile[] | ((files: QueuedFile[]) => QueuedFile[])
const emptyUploaded = (): Record<Source, boolean> => ({
  POS: false,
  WEB: false,
  GL: false,
  Flash: false,
  Dim: false,
})

function hasPendingEvidenceRequest(reviewCase: GLReviewCase): boolean {
  if (reviewCase.status !== 'in_progress' || reviewCase.evidenceReviewed)
    return false
  const requested = reviewCase.history.findLastIndex(
    (event) => event.action === 'evidence_requested',
  )
  if (requested < 0) return false
  return !reviewCase.history.slice(requested + 1).some((event) => {
    if (event.action !== 'updated') return true
    try {
      const after: Partial<GLCasePatch> = JSON.parse(event.detail).after ?? {}
      return (
        after.status === 'reviewed' ||
        after.status === 'confirmed' ||
        after.evidenceReviewed === true
      )
    } catch {
      return true
    }
  })
}

/** The supplied Nexa Home exports cover FY2025; users can edit both dates. */
export const DEFAULT_REPORTING_PERIOD: Readonly<ReconciliationPeriod> =
  Object.freeze({
    start: '2025-01-01',
    end: '2025-12-31',
  })

/** A Context-owned, observable store. No files or financial results are persisted to disk. */
export function createAppStore(
  initialPeriod: ReconciliationPeriod = DEFAULT_REPORTING_PERIOD,
  {
    ingestionMode = 'automatic',
  }: { ingestionMode?: 'automatic' | 'mapping-preview' | 'wizard' } = {},
) {
  let state: AppState = {
    excelReference: emptyExcelReference(),
    files: [],
    mappingDrafts: {},
    confirmedMappings: null,
    confirmedMaster: null,
    onboardingOpen: false,
    onboardingStep: 0,
    filesUploaded: emptyUploaded(),
    registeredFileIds: [],
    dimTables: [],
    canViewReconciliation: false,
    reconciliationData: null,
    exceptionsData: [],
    glReview: null,
    reviewCases: [],
    glCorrections: [],
    period: { ...initialPeriod },
    status: 'idle',
    processingPhase: null,
    pipelineProgress: null,
    configurationProgress: null,
    processingPanelOpen: false,
    masterFocusRequest: null,
    engineStatus: 'loading',
    error: null,
    runFailure: null,
    missingSources: [...REQUIRED_SOURCES],
  }
  const listeners = new Set<() => void>()
  let processor: UploadProcessor | null = null
  let controller: AbortController | null = null
  let generation = 0
  // A cleared/removed Dim still needs a serialized engine pass to release its tables.
  let dimMayExist = false
  let pending: Promise<void> = Promise.resolve()
  let lastReviewFiles: QueuedFile[] = []
  let lastReviewConfiguration = ''
  const publish = (patch: Partial<AppState>) => {
    state = { ...state, ...patch }
    listeners.forEach((listener) => listener())
  }

  function restart() {
    controller?.abort()
    const reviewFiles = state.files.filter(
      (file) => file.source === 'GL' || file.source === 'Dim',
    )
    const reviewConfiguration = JSON.stringify({
      mappings: state.confirmedMappings,
      master: state.confirmedMaster,
      drafts: Object.fromEntries(
        Object.entries(state.mappingDrafts).map(([id, draft]) => [
          id,
          {
            columns: draft.columns,
            glAmountBasis: draft.glAmountBasis,
            master: draft.master,
          },
        ]),
      ),
    })
    const sourceChanged =
      reviewFiles.length !== lastReviewFiles.length ||
      reviewFiles.some((file, index) => {
        const old = lastReviewFiles[index]
        return (
          !old ||
          old.id !== file.id ||
          old.file !== file.file ||
          old.headerRow !== file.headerRow
        )
      }) ||
      reviewConfiguration !== lastReviewConfiguration
    if (sourceChanged && state.reviewCases.length) {
      state = {
        ...state,
        reviewCases: state.reviewCases.map((reviewCase) =>
          reviewCase.stale
            ? reviewCase
            : {
                ...reviewCase,
                stale: true,
                status: 'open',
                evidenceReviewed: false,
                nextStep:
                  'Nguồn hoặc cấu hình đã thay đổi; cần rà soát lại trong snapshot mới.',
                history: [
                  ...reviewCase.history,
                  {
                    at: new Date().toISOString(),
                    action: 'configuration_invalidated',
                    detail:
                      'Giữ lịch sử quyết định; chờ xác minh nguồn và cấu hình hiện tại.',
                  },
                ],
              },
        ),
      }
    }
    lastReviewFiles = reviewFiles
    lastReviewConfiguration = reviewConfiguration
    // Every edit advances the draft, even when the user restores the same values.
    // A response from an older validation request cannot confirm a newer draft.
    if (!state.confirmedMappings)
      state = {
        ...state,
        confirmedMaster: null,
        mappingDrafts: Object.fromEntries(
          Object.entries(state.mappingDrafts).map(([id, draft]) => [
            id,
            draft.master
              ? {
                  ...draft,
                  masterValidation: undefined,
                  master: {
                    ...draft.master,
                    revision: draft.master.revision + 1,
                  },
                }
              : draft,
          ]),
        ),
      }
    const version = ++generation
    const snapshot = state.files
    const period = { ...state.period }
    const assigned = snapshot.filter((entry) => entry.source !== '')
    const missingSources: string[] = REQUIRED_SOURCES.filter(
      (source) => !snapshot.some((entry) => entry.source === source),
    )
    if (assigned.length !== snapshot.length)
      missingSources.push('source assignments')
    const columnMappings = state.confirmedMappings
    const masterConfiguration = state.confirmedMaster
    const awaitingReview =
      ingestionMode === 'mapping-preview' ||
      (ingestionMode === 'wizard' && !columnMappings)
    if (awaitingReview && snapshot.length) {
      missingSources.push(
        state.confirmedMappings
          ? 'unified-table processing'
          : 'column mapping review',
      )
    }
    const pipelineProgress =
      missingSources.length === 0 && !awaitingReview
        ? createProgressFlow('pipeline')
        : null
    publish({
      pipelineProgress,
      configurationProgress: state.confirmedMappings
        ? state.configurationProgress
        : null,
      reconciliationData: null,
      glReview: null,
      processingPhase: null,
      exceptionsData: [],
      error: null,
      runFailure: null,
      filesUploaded: emptyUploaded(),
      registeredFileIds: [],
      dimTables: [],
      canViewReconciliation: missingSources.length === 0,
      missingSources,
      status: !snapshot.length
        ? 'idle'
        : processor && assigned.length && !awaitingReview
          ? 'registering'
          : 'waiting',
    })
    if (
      !processor ||
      (awaitingReview && !dimMayExist) ||
      (!assigned.length && !dimMayExist)
    ) {
      pending = Promise.resolve()
      return
    }

    const run = processor
    // An edit pauses fact processing, but still releases dimensions from a prior run.
    const processingFiles = awaitingReview ? [] : assigned
    const includesDim = processingFiles.some((entry) => entry.source === 'Dim')
    if (includesDim) dimMayExist = true
    const active = new AbortController()
    controller = active
    const registered = new Set<string>()
    const isCurrent = () => generation === version && !active.signal.aborted
    // A microtask coalesces rapid selection/source changes and StrictMode effect replay.
    pending = Promise.resolve()
      .then(async () => {
        if (!isCurrent()) return
        const result = await run(processingFiles, period, {
          signal: active.signal,
          canReconcile: missingSources.length === 0,
          columnMappings:
            ingestionMode === 'wizard'
              ? (columnMappings ?? undefined)
              : undefined,
          masterConfiguration:
            ingestionMode === 'wizard' ? masterConfiguration : undefined,
          glCorrections: state.glCorrections,
          onFailure(failure) {
            if (isCurrent())
              publish({
                runFailure: {
                  ...failure,
                  configurationId: `configuration-${version}`,
                  period,
                },
              })
          },
          onGLSnapshot(snapshot) {
            if (!isCurrent()) return
            publish({
              glReview: snapshot,
              reviewCases: synchronizeReviewCases(
                snapshot,
                state.reviewCases,
                state.glCorrections
                  .filter((c) => c.active)
                  .map((c) => c.recordId),
              ),
            })
          },
          onFileRegistered(id) {
            if (!isCurrent()) return
            registered.add(id)
            const flags = emptyUploaded()
            for (const source of SOURCES) {
              const sourceFiles = snapshot.filter(
                (entry) => entry.source === source,
              )
              flags[source] =
                sourceFiles.length > 0 &&
                sourceFiles.every((entry) => registered.has(entry.id))
            }
            publish({
              filesUploaded: flags,
              registeredFileIds: [...registered],
            })
          },
          onQueryStart() {
            if (isCurrent()) publish({ status: 'running' })
          },
          onPhaseChange(phase) {
            if (isCurrent()) publish({ processingPhase: phase })
          },
          onProgress(event) {
            if (isCurrent() && state.pipelineProgress)
              publish({
                pipelineProgress: reduceProgress(state.pipelineProgress, event),
              })
          },
          onDimTablesReady(tables) {
            if (isCurrent()) publish({ dimTables: tables })
          },
        })
        if (!isCurrent()) return
        if (!includesDim) dimMayExist = false
        if (result?.glReview) {
          const cases = synchronizeReviewCases(
            result.glReview,
            state.reviewCases,
          )
          result.exceptions = linkReviewExceptions(
            result.exceptions,
            result.glReview,
            cases,
          )
        }
        // Publish the bridge and exception rows together, from the same snapshot and period.
        publish(
          result && !missingSources.length
            ? {
                pipelineProgress: state.pipelineProgress
                  ? finishPipeline(state.pipelineProgress, result.evidence)
                  : null,
                reconciliationData: result,
                exceptionsData: result.exceptions,
                ...(result.glReview
                  ? {
                      glReview: result.glReview,
                      reviewCases: synchronizeReviewCases(
                        result.glReview,
                        state.reviewCases,
                      ),
                    }
                  : {}),
                status: 'ready',
                processingPhase: null,
              }
            : {
                pipelineProgress: state.pipelineProgress
                  ? { ...state.pipelineProgress, status: 'waiting' }
                  : null,
                status: snapshot.length ? 'waiting' : 'idle',
                processingPhase: null,
              },
        )
      })
      .catch((error: unknown) => {
        if (isCurrent())
          publish({
            runFailure:
              state.runFailure ??
              captureRunFailure(error, {
                runId: state.pipelineProgress?.engineRunId ?? null,
                configurationId: `configuration-${version}`,
                period,
                stage: state.processingPhase,
                source:
                  state.pipelineProgress?.steps.find(
                    (step) => step.id === state.pipelineProgress?.currentStepId,
                  )?.source ?? null,
              }),
            pipelineProgress: state.pipelineProgress
              ? failProgress(
                  state.pipelineProgress,
                  error instanceof Error ? error.message : String(error),
                )
              : null,
            status: 'error',
            processingPhase: null,
            error: error instanceof Error ? error.message : String(error),
            reconciliationData: null,
            exceptionsData: [],
          })
      })
  }

  const actions = {
    ...createExcelReferenceController(
      () => state.excelReference,
      (excelReference) => publish({ excelReference }),
    ),
    updateReviewCase(id: string, patch: GLCasePatch) {
      const current = state.reviewCases.find((c) => c.id === id)
      if (!current) throw new Error('Không tìm thấy yêu cầu rà soát.')
      if (state.status === 'running' || state.status === 'registering')
        throw new Error(
          'Chờ phiên xử lý hoàn tất trước khi cập nhật quyết định.',
        )
      if (
        patch.status === 'confirmed' &&
        state.glReview?.diagnostics.some(
          (issue) =>
            issue.blocking && current.recordIds.includes(issue.recordId),
        )
      )
        throw new Error(
          'Case còn lỗi dữ liệu chặn tính toán. Sửa lỗi trước khi xác nhận nghiệp vụ.',
        )
      const next = editReviewCase(current, patch, state.glReview?.records ?? [])
      publish({
        reviewCases: state.reviewCases.map((c) => (c.id === id ? next : c)),
      })
    },
    requestReviewEvidence(ids: string[]) {
      const selected = new Set(ids)
      if (!selected.size) throw new Error('Chọn yêu cầu cần bổ sung chứng từ.')
      if (state.status === 'running' || state.status === 'registering')
        throw new Error('Chờ phiên xử lý hoàn tất trước khi tạo công việc.')
      let created = 0
      const reviewCases = state.reviewCases.map((c): GLReviewCase => {
        // Repeated clicks and retries reuse the pending work, including after
        // unrelated notes or owner edits. A completed review can be reopened.
        if (!selected.has(c.id) || hasPendingEvidenceRequest(c)) return c
        created++
        return {
          ...c,
          status: 'in_progress',
          evidenceReviewed: false,
          nextStep: 'Yêu cầu bổ sung chứng từ gốc trong phiên đối soát.',
          history: [
            ...c.history,
            {
              at: new Date().toISOString(),
              action: 'evidence_requested',
              detail:
                'Tạo công việc bổ sung chứng từ trong tab này; chưa gửi tin nhắn hoặc email.',
            },
          ],
        }
      })
      if (created) publish({ reviewCases })
      return created
    },
    previewGLCorrection(
      recordId: string,
      patch: GLCorrectionPatch,
      reason: string,
    ) {
      if (state.status === 'running' || state.status === 'registering')
        throw new Error('Chờ kết quả phiên hiện tại trước khi xem ảnh hưởng.')
      const record = state.glReview?.records.find((r) => r.id === recordId)
      if (!record) throw new Error('Bản ghi không còn trong snapshot hiện tại.')
      const preview = previewCorrection(record, patch, reason, state.period)
      return state.reconciliationData && state.glReview
        ? completeCorrectionPreview(preview, state.glReview, state.period)
        : preview
    },
    previewGLUndo(recordId: string, reason: string) {
      if (!reason.trim())
        throw new Error('Nhập lý do hoàn tác để xem trước ảnh hưởng.')
      if (state.status === 'running' || state.status === 'registering')
        throw new Error('Chờ phiên xử lý hoàn tất trước khi xem hoàn tác.')
      const record = state.glReview?.records.find((r) => r.id === recordId)
      if (
        !record ||
        !state.glCorrections.some((c) => c.recordId === recordId && c.active)
      )
        throw new Error(
          'Không có chỉnh sửa để hoàn tác trong snapshot hiện tại.',
        )
      const original = record.original
      if (
        original.amountCents !== null &&
        original.postingDate &&
        original.period === original.postingDate.slice(0, 7) &&
        (original.storeKey === '-1') === (original.channel === 'UNALLOCATED')
      ) {
        return actions.previewGLCorrection(
          recordId,
          {
            amountCents: original.amountCents,
            postingDate: original.postingDate,
            period: original.period,
            storeKey: original.storeKey,
            channel: original.channel,
          },
          reason,
        )
      }
      const after = { ...record, ...original }
      return {
        complete: false,
        recordId,
        before: record,
        after,
        totalGLDeltaCents: 0,
        unexplainedDeltaCents: 0,
        impacts: [
          {
            period: record.period ?? '',
            channel: record.channel,
            beforeCents: record.revenueCents ?? 0,
            afterCents: original.revenueCents ?? 0,
          },
        ],
        reason: reason.trim(),
        patch: {},
      }
    },
    applyGLCorrection(
      recordId: string,
      patch: GLCorrectionPatch,
      reason: string,
    ) {
      const preview = actions.previewGLCorrection(recordId, patch, reason)
      const record = preview.before
      if (
        Object.entries(preview.patch).every(
          ([key, value]) => record[key as keyof typeof record] === value,
        )
      )
        throw new Error('Không có thay đổi so với dữ liệu hiệu lực hiện tại.')
      const prior = state.glCorrections.findLast(
        (c) =>
          c.recordId === recordId &&
          c.active &&
          c.sourceFingerprint === record.sourceFingerprint &&
          c.configurationVersion === record.configurationVersion,
      )
      const correction: GLCorrection = {
        id: crypto.randomUUID(),
        recordId,
        sourceFingerprint: record.sourceFingerprint,
        configurationVersion: record.configurationVersion,
        patch: { ...prior?.patch, ...preview.patch },
        reason: reason.trim(),
        appliedAt: new Date().toISOString(),
        active: true,
      }
      const reviewCases = synchronizeReviewCases(
        state.glReview!,
        state.reviewCases,
        [recordId],
      )
      state = {
        ...state,
        glCorrections: [
          ...state.glCorrections.map((c) =>
            c.recordId === recordId && c.active ? { ...c, active: false } : c,
          ),
          correction,
        ],
        reviewCases: reviewCases.map((c) =>
          c.recordIds.includes(recordId)
            ? {
                ...c,
                status: 'in_progress',
                evidenceReviewed: false,
                nextStep:
                  'Kiểm tra lại số liệu và xác nhận sau chỉnh sửa dữ liệu hiệu lực của phiên.',
                history: [
                  ...c.history,
                  {
                    at: correction.appliedAt,
                    action: 'correction_applied',
                    detail: JSON.stringify({
                      reason: correction.reason,
                      before: record,
                      patch: preview.patch,
                      totalGLDeltaCents: preview.totalGLDeltaCents,
                      impacts: preview.impacts,
                    }),
                  },
                ],
              }
            : c,
        ),
      }
      restart()
      return preview
    },
    undoGLCorrection(recordId: string, reason: string) {
      if (!reason.trim()) throw new Error('Nhập lý do hoàn tác để lưu lịch sử.')
      if (state.status === 'running' || state.status === 'registering')
        throw new Error('Chờ phiên xử lý hoàn tất trước khi hoàn tác.')
      if (!state.glCorrections.some((c) => c.recordId === recordId && c.active))
        throw new Error('Bản ghi không có chỉnh sửa đang áp dụng.')
      const at = new Date().toISOString()
      state = {
        ...state,
        glCorrections: state.glCorrections.map((c) =>
          c.recordId === recordId && c.active ? { ...c, active: false } : c,
        ),
        reviewCases: state.reviewCases.map((c) =>
          c.recordIds.includes(recordId)
            ? {
                ...c,
                status: 'in_progress',
                evidenceReviewed: false,
                history: [
                  ...c.history,
                  {
                    at,
                    action: 'correction_reverted',
                    detail: `Khôi phục dữ liệu gốc của phiên: ${reason.trim()}`,
                  },
                ],
              }
            : c,
        ),
      }
      restart()
    },
    setGLAmountBasis(id: string, basis: 'ledger' | 'revenue') {
      if (!['ledger', 'revenue'].includes(basis))
        throw new Error('Cơ sở số tiền GL không hợp lệ.')
      const draft = state.mappingDrafts[id]
      if (!draft || state.files.find((f) => f.id === id)?.source !== 'GL')
        return
      state = {
        ...state,
        confirmedMappings: null,
        mappingDrafts: {
          ...state.mappingDrafts,
          [id]: { ...draft, glAmountBasis: basis },
        },
      }
      restart()
    },
    openProcessingPanel() {
      publish({ processingPanelOpen: true })
    },
    closeProcessingPanel() {
      publish({ processingPanelOpen: false })
    },
    beginConfigurationCheck(fileId: string, fingerprint: string) {
      const flow = createProgressFlow('configuration', { fileId, fingerprint })
      publish({
        configurationProgress: patchProgressStep(flow, 'selection', {
          status: 'running',
        }),
        mappingDrafts: {
          ...state.mappingDrafts,
          [fileId]: {
            ...state.mappingDrafts[fileId],
            masterValidation: undefined,
          },
        },
      })
      return flow.id
    },
    configurationSelectionReady(id: string) {
      const flow = state.configurationProgress
      if (flow?.id === id)
        publish({
          configurationProgress: {
            ...patchProgressStep(flow, 'selection', { status: 'completed' }),
            status: 'waiting',
          },
        })
    },
    updateConfigurationProgress(id: string, event: EngineProgressEvent) {
      const flow = state.configurationProgress
      if (flow?.id === id)
        publish({ configurationProgress: reduceProgress(flow, event) })
    },
    finishConfigurationCheck(id: string, validation: MasterValidation) {
      const flow = state.configurationProgress
      if (flow?.id === id && flow.fingerprint === validation.fingerprint)
        publish({
          configurationProgress: finishConfiguration(flow, validation),
        })
    },
    failConfigurationCheck(
      id: string,
      error: string,
      status: 'error' | 'needs-configuration' | 'cancelled' = 'error',
    ) {
      const flow = state.configurationProgress
      if (
        status === 'cancelled' &&
        flow?.status !== 'running' &&
        flow?.status !== 'waiting'
      )
        return
      if (flow?.id === id)
        publish({
          configurationProgress: failProgress(flow, error, status),
          ...(flow.fileId && state.mappingDrafts[flow.fileId]
            ? {
                mappingDrafts: {
                  ...state.mappingDrafts,
                  [flow.fileId]: {
                    ...state.mappingDrafts[flow.fileId],
                    masterValidation: undefined,
                  },
                },
              }
            : {}),
        })
    },
    focusMasterConfiguration(
      fileId: string,
      role?: ReferenceRole,
      relationshipId?: string,
    ) {
      publish({
        onboardingOpen: true,
        onboardingStep: 4,
        processingPanelOpen: false,
        masterFocusRequest: {
          fileId,
          role,
          relationshipId,
          serial: (state.masterFocusRequest?.serial ?? 0) + 1,
        },
      })
    },
    openOnboarding() {
      publish({
        onboardingOpen: true,
        onboardingStep: firstIncompleteStep(state.files, state.mappingDrafts),
      })
    },
    closeOnboarding() {
      publish({ onboardingOpen: false })
    },
    openSourceOnboarding(source: Source) {
      const step = ONBOARDING_STEPS.findIndex((item) => item.source === source)
      if (step >= 0) publish({ onboardingOpen: true, onboardingStep: step })
    },
    setOnboardingStep(step: number) {
      if (
        !Number.isInteger(step) ||
        step < 0 ||
        step >= ONBOARDING_STEPS.length ||
        step > firstIncompleteStep(state.files, state.mappingDrafts)
      )
        return
      publish({ onboardingStep: step })
    },
    completeOnboarding() {
      if (!canCompleteOnboarding(state.files, state.mappingDrafts))
        throw new Error(
          'Upload and map all four required sources before running reconciliation. Check master data if a workbook is selected.',
        )
      const confirmedMappings = confirmedMappingSnapshot(
        state.files,
        state.mappingDrafts,
      )
      const dim = state.files.find((file) => file.source === 'Dim')
      const confirmedMaster = dim
        ? masterSnapshot(state.mappingDrafts[dim.id].master!)
        : null
      state = {
        ...state,
        confirmedMappings,
        confirmedMaster,
        onboardingOpen: false,
        processingPanelOpen: true,
      }
      restart()
    },
    setFiles(update: FilesUpdate) {
      const next = typeof update === 'function' ? update(state.files) : update
      const mappingDrafts: MappingDrafts = {}
      for (const entry of next) {
        const previous = state.files.find((file) => file.id === entry.id)
        if (
          entry.source !== '' &&
          previous?.file === entry.file &&
          previous.source === entry.source &&
          (previous.headerRow ?? 1) === (entry.headerRow ?? 1) &&
          state.mappingDrafts[entry.id]
        ) {
          mappingDrafts[entry.id] = state.mappingDrafts[entry.id]
        }
      }
      for (const id of Object.keys(mappingDrafts))
        if (mappingDrafts[id].masterValidation)
          mappingDrafts[id] = {
            ...mappingDrafts[id],
            masterValidation: undefined,
          }
      state = {
        ...state,
        files: [...next],
        mappingDrafts,
        confirmedMappings: null,
        confirmedMaster: null,
      }
      restart()
    },
    setHeaderRow(id: string, update: HeaderRowUpdate) {
      const entry = state.files.find((file) => file.id === id)
      if (!entry) return
      // Resolve each click against the latest scalar, including batched UI events.
      const headerRow =
        typeof update === 'function' ? update(entry.headerRow ?? 1) : update
      validateHeaderRow(headerRow)
      if ((entry.headerRow ?? 1) === headerRow) return
      actions.setFiles((previous) =>
        previous.map((file) =>
          file.id === id ? { ...file, headerRow } : file,
        ),
      )
    },
    setFilePreview(
      id: string,
      file: File,
      source: Source,
      preview: FilePreview,
      dimensionSheets?: FilePreview[],
    ) {
      const entry = state.files.find((entry) => entry.id === id)
      if (
        !entry ||
        entry.file !== file ||
        entry.source !== source ||
        (entry.headerRow ?? 1) !== (preview.headerRow ?? 1)
      )
        return
      state = {
        ...state,
        confirmedMappings: null,
        mappingDrafts: {
          ...state.mappingDrafts,
          [id]: {
            preview,
            error: null,
            columns: isFactSource(source)
              ? autoMapColumns(preview.headers, source)
              : {},
            dimensionSheets,
            ...(source === 'Dim'
              ? { master: createMasterDraft(id, dimensionSheets ?? [preview]) }
              : {}),
          },
        },
      }
      restart()
    },
    setPreviewError(
      id: string,
      file: File,
      source: Source,
      error: string,
      errorKind: PreviewErrorKind = 'file',
      headerRow = 1,
    ) {
      const entry = state.files.find((entry) => entry.id === id)
      if (
        !entry ||
        entry.file !== file ||
        entry.source !== source ||
        (entry.headerRow ?? 1) !== headerRow
      )
        return
      state = {
        ...state,
        confirmedMappings: null,
        mappingDrafts: {
          ...state.mappingDrafts,
          [id]: { preview: null, error, errorKind, columns: {} },
        },
      }
      restart()
    },
    resetFilePreview(id: string) {
      const mappingDrafts = { ...state.mappingDrafts }
      delete mappingDrafts[id]
      state = { ...state, mappingDrafts, confirmedMappings: null }
      restart()
    },
    setColumnMapping(id: string, columns: ColumnMapping) {
      const draft = state.mappingDrafts[id]
      if (!draft?.preview) return
      state = {
        ...state,
        confirmedMappings: null,
        mappingDrafts: {
          ...state.mappingDrafts,
          [id]: { ...draft, columns: { ...columns } },
        },
      }
      for (const [key, item] of Object.entries(state.mappingDrafts))
        if (item.masterValidation)
          state.mappingDrafts[key] = { ...item, masterValidation: undefined }
      restart()
    },
    setMasterReference(
      id: string,
      role: ReferenceRole,
      config: ReferenceConfig,
    ) {
      const draft = state.mappingDrafts[id]
      if (!draft?.master) return
      state = {
        ...state,
        confirmedMappings: null,
        confirmedMaster: null,
        mappingDrafts: {
          ...state.mappingDrafts,
          [id]: {
            ...draft,
            masterValidation: undefined,
            master: {
              ...draft.master,
              roles: { ...draft.master.roles, [role]: config },
            },
          },
        },
      }
      restart()
    },
    setMasterSheetHeader(id: string, name: string, update: HeaderRowUpdate) {
      const draft = state.mappingDrafts[id]
      const sheet = draft?.master?.sheets[name]
      if (!draft?.master || !sheet) return
      const headerRow =
        typeof update === 'function' ? update(sheet.headerRow) : update
      validateHeaderRow(headerRow)
      if (sheet.headerRow === headerRow) return
      const roles = { ...draft.master.roles }
      for (const role of Object.keys(roles) as ReferenceRole[])
        if (roles[role].sheetName === name)
          roles[role] = { ...roles[role], columns: {} }
      state = {
        ...state,
        confirmedMappings: null,
        confirmedMaster: null,
        mappingDrafts: {
          ...state.mappingDrafts,
          [id]: {
            ...draft,
            masterValidation: undefined,
            master: {
              ...draft.master,
              roles,
              sheets: {
                ...draft.master.sheets,
                [name]: { headerRow, preview: null, error: null },
              },
            },
          },
        },
      }
      restart()
    },
    setMasterSheetPreview(
      id: string,
      file: File,
      name: string,
      headerRow: number,
      preview: FilePreview | null,
      error: string | null = null,
    ) {
      const entry = state.files.find((f) => f.id === id)
      const draft = state.mappingDrafts[id]
      const sheet = draft?.master?.sheets[name]
      if (
        entry?.file !== file ||
        !draft?.master ||
        !sheet ||
        sheet.headerRow !== headerRow
      )
        return
      publish({
        mappingDrafts: {
          ...state.mappingDrafts,
          [id]: {
            ...draft,
            master: {
              ...draft.master,
              sheets: {
                ...draft.master.sheets,
                [name]: { headerRow, preview, error },
              },
            },
          },
        },
      })
    },
    setMasterValidation(id: string, validation: MasterValidation) {
      const draft = state.mappingDrafts[id]
      if (
        !draft?.master ||
        !canConfirmMappings(state.files, state.mappingDrafts)
      )
        return
      const mappings = confirmedMappingSnapshot(
        state.files,
        state.mappingDrafts,
      )
      if (
        validation.fingerprint !==
        masterFingerprint(draft.master, state.files, mappings)
      )
        return
      publish({
        mappingDrafts: {
          ...state.mappingDrafts,
          [id]: { ...draft, masterValidation: validation },
        },
      })
    },
    confirmMappings() {
      const dim = state.files.find((f) => f.source === 'Dim')
      if (
        dim &&
        !masterReady(
          state.mappingDrafts[dim.id]?.master,
          state.mappingDrafts[dim.id]?.masterValidation,
        )
      )
        throw new Error(
          'Validate Master / Dim mappings and joins before confirming.',
        )
      const confirmedMappings = confirmedMappingSnapshot(
        state.files,
        state.mappingDrafts,
      )
      state = {
        ...state,
        confirmedMappings,
        processingPanelOpen: true,
        confirmedMaster: dim
          ? masterSnapshot(state.mappingDrafts[dim.id].master!)
          : null,
      }
      restart()
    },
    setPeriod(period: ReconciliationPeriod) {
      if (
        period.start === state.period.start &&
        period.end === state.period.end
      )
        return
      state = { ...state, period: { ...period } }
      restart()
    },
    retry() {
      publish({ processingPanelOpen: true })
      restart()
    },
  }
  return {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    actions,
    /** The engine provider owns DuckDB. The store owns coordination and stale-result guards. */
    attachProcessor(next: UploadProcessor) {
      processor = next
      state = { ...state, engineStatus: 'ready' }
      restart()
      return () => {
        if (processor !== next) return
        processor = null
        controller?.abort()
        generation++
        publish({
          engineStatus: 'loading',
          pipelineProgress: null,
          error: null,
          runFailure: null,
          status: state.files.length ? 'waiting' : 'idle',
          reconciliationData: null,
          exceptionsData: [],
          filesUploaded: emptyUploaded(),
          registeredFileIds: [],
          dimTables: [],
        })
      }
    },
    setEngineUnavailable(
      status: 'loading' | 'error',
      error: string | null = null,
    ) {
      processor = null
      controller?.abort()
      generation++
      publish({
        engineStatus: status,
        pipelineProgress: null,
        processingPhase: null,
        status:
          status === 'error'
            ? 'error'
            : state.files.length
              ? 'waiting'
              : 'idle',
        error,
        runFailure: error
          ? captureRunFailure(error, { stage: 'engine' })
          : null,
        reconciliationData: null,
        exceptionsData: [],
        filesUploaded: emptyUploaded(),
        registeredFileIds: [],
        dimTables: [],
      })
    },
    /** Useful for integration tests and consumers coordinating an import. */
    whenSettled: () => pending,
    dispose() {
      actions.disableExcelReference()
      controller?.abort()
      generation++
      processor = null
      listeners.clear()
    },
  }
}

export type AppStore = ReturnType<typeof createAppStore>
export const AppStoreContext = createContext<AppStore | null>(null)
export function useAppStore() {
  const store = useContext(AppStoreContext)
  if (!store) throw new Error('useAppStore requires AppStoreProvider.')
  const state = useSyncExternalStore(
    store.subscribe,
    store.getState,
    store.getState,
  )
  return useMemo(
    () => ({
      ...state,
      ...store.actions,
      activeResult: selectActiveResult(state),
      isProcessing:
        state.status === 'registering' || state.status === 'running',
    }),
    [state, store.actions],
  )
}
