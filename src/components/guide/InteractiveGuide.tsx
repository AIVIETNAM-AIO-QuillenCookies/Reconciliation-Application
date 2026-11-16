import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BookOpen, ArrowLeft, AlertCircle } from 'lucide-react'
import { AppStoreContext, useAppStore } from '@/lib/store'
import { useDuckDB } from '@/hooks/useDuckDB'
import { Button } from '@/components/ui/button'
// Explicit stylesheet import at the position of the former welcome dialog
// keeps the production CSS order unchanged (ARCHITECTURE.md §4).
import '@/interactive-guide.css'
import { GuideOverlay } from './GuideOverlay'
import { GuideSummary } from './GuideSummary'
import { useGuideWorkspace } from './GuideWorkspace'
import { GUIDE_CHAPTERS, GUIDE_STEPS } from '@/lib/interactive-guide'
import { clickGuideTarget, guideTarget, waitForGuide } from '@/lib/guide-dom'
import {
  GUIDE_COLUMNS,
  GUIDE_SOURCE_SHEETS,
  loadGuideSample,
  prepareGuideGL,
  type GuideSample,
} from '@/lib/guide-sample'
import type { FactSource } from '@/lib/uploads'
import type { ReferenceRole } from '@/lib/master-data'
import { claimIntroAutoOpen } from '@/lib/product-intro'
import { GuideEvidenceContent } from './GuideEvidenceContent'
import { useProductIntro } from '@/components/intro/intro-context'

const GUIDE_REFERENCE_OPTIONS = { expectedExceptionCount: 7 }
interface GuideContextValue {
  open: () => void
  sample: GuideSample | null
  stepId: string
  viewed: Set<string>
  acknowledge: (id: string) => void
  audit: { at: string; step: string; actor: string; result: string }[]
}
export const InteractiveGuideContext = createContext<GuideContextValue | null>(
  null,
)
export function InteractiveGuideProvider({
  children,
}: {
  children: ReactNode
}) {
  const workspace = useGuideWorkspace()
  const rawStore = useContext(AppStoreContext)!
  const engine = useDuckDB()
  const navigate = useNavigate()
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate
  const intro = useProductIntro()
  const [index, setIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [verified, setVerified] = useState(false)
  const [completed, setCompleted] = useState<Set<string>>(new Set())
  const [viewed, setViewed] = useState<Set<string>>(new Set())
  const [sample, setSample] = useState<GuideSample | null>(null)
  const [summary, setSummary] = useState(false)
  const [rawLimit, setRawLimit] = useState<string | null>(null)
  const sampleRef = useRef(sample)
  sampleRef.current = sample
  const activeController = useRef<AbortController | null>(null)
  const preparedStep = useRef<string | null>(null)
  const completedRef = useRef(completed)
  completedRef.current = completed
  const viewedRef = useRef(viewed)
  viewedRef.current = viewed
  const audit = useRef<
    { at: string; step: string; actor: string; result: string }[]
  >([])
  const step = GUIDE_STEPS[index]
  const session = workspace.session
  // Each page load opens the product introduction once, on whichever screen the
  // page opens; navigating or ending a practice session does not reopen it.
  useEffect(() => {
    if (intro && !session && claimIntroAutoOpen()) intro.open()
  }, [session, intro])
  function acknowledge(id: string) {
    setViewed((old) => new Set([...old, id]))
  }
  function record(id: string, result: string) {
    audit.current.push({
      at: new Date().toISOString(),
      step: id,
      actor: 'guide:guided',
      result,
    })
  }
  function reviewCase() {
    const state = rawStore.getState()
    const record = state.glReview?.records.find(
      (row) => row.journalId === 'JE20250904892',
    )
    return state.reviewCases.find(
      (item) => record && item.recordIds.includes(record.id),
    )
  }
  function verify(id: string): boolean {
    const state = rawStore.getState()
    const bundle = sampleRef.current
    if (id === 'overview')
      return state.onboardingOpen || completedRef.current.has(id)
    if (id === 'load')
      return (
        !!bundle &&
        state.files.length === 5 &&
        state.files.every((file) => file.sample)
      )
    if (id.startsWith('map-')) {
      const source = id.slice(4) as FactSource
      const file = state.files.find((file) => file.source === source)
      const draft = file && state.mappingDrafts[file.id]
      return (
        !!file &&
        file.sheetName === GUIDE_SOURCE_SHEETS[source] &&
        !!draft &&
        Object.entries(GUIDE_COLUMNS[source]).every(
          ([field, column]) =>
            draft.columns[field as keyof typeof draft.columns] === column,
        ) &&
        (source !== 'POS' || !draft.columns.net_amount)
      )
    }
    if (id.startsWith('master-')) {
      const role = id.slice(7) as ReferenceRole
      const config = state.mappingDrafts['guide-dim']?.master?.roles[role]
      return (
        !!bundle &&
        JSON.stringify(config) === JSON.stringify(bundle.preset.roles[role])
      )
    }
    if (id === 'validate')
      return state.mappingDrafts['guide-dim']?.masterValidation?.passed === true
    if (id === 'raw-run') return !!rawLimit && state.status === 'error'
    if (id === 'excel-opt-in')
      return (
        state.excelReference.status === 'ready' && state.excelReference.enabled
      )
    if (id.startsWith('table-'))
      return (
        viewedRef.current.has(id) &&
        guideTarget('guide-evidence')?.dataset.evidenceReady === 'true'
      )
    if (id === 'exceptions')
      return (
        viewedRef.current.has(id) && !!guideTarget('guide-source-exceptions')
      )
    if (id === 'late')
      return (
        viewedRef.current.has(id) &&
        guideTarget('guide-late-cells')?.dataset.cellCount === '2'
      )
    if (id === 'manual')
      return (
        (guideTarget('accounting-journal-type') as HTMLSelectElement | null)
          ?.value === 'MANUAL' &&
        guideTarget('accounting-workspace')?.dataset.manualCount === '15'
      )
    if (['shipping', 'transfer', 'adjustment'].includes(id))
      return (
        guideTarget('accounting-selected-journal')?.dataset.journalId ===
        {
          shipping: 'JE20250100572',
          transfer: 'JE20250603115',
          adjustment: 'JE20250904892',
        }[id]
      )
    if (id === 'notes')
      return (
        !!reviewCase()?.notes.trim() && reviewCase()?.evidenceReviewed === false
      )
    if (id === 'evidence')
      return (
        !!reviewCase()?.history.some(
          (event) => event.action === 'evidence_requested',
        ) && reviewCase()?.evidenceReviewed === false
      )
    if (id.startsWith('dash-')) {
      const tab = id.slice(5)
      const target = guideTarget('dashboard')
      const from =
        tab === 'overview' || tab === 'bridge' ? '2025-12' : '2025-01'
      return (
        target?.dataset.dashboardTab === tab &&
        target.dataset.dashboardFrom === from &&
        target.dataset.dashboardTo === '2025-12' &&
        target.dataset.dashboardReady === 'true' &&
        (tab !== 'bridge' || !!guideTarget('dashboard-inspector'))
      )
    }
    if (id === 'expand') return !!guideTarget('dashboard-expanded')
    if (id === 'close-expand')
      return (
        completedRef.current.has('expand') && !guideTarget('dashboard-expanded')
      )
    return false
  }
  async function load(signal: AbortSignal) {
    if (sampleRef.current) return
    const bundle = await loadGuideSample(signal)
    signal.throwIfAborted()
    rawStore.actions.setFiles(bundle.files)
    for (const file of bundle.files) {
      const previews = bundle.previews[file.id]
      rawStore.actions.setFilePreview(
        file.id,
        file.file,
        file.source as FactSource | 'Dim',
        previews[0],
        file.source === 'Dim' ? previews : undefined,
      )
    }
    sampleRef.current = bundle
    setSample(bundle)
    record(
      'load',
      `${bundle.file.name}: ${bundle.evidence.posRows} POS, ${bundle.evidence.webRows} WEB, ${bundle.evidence.glRows} GL`,
    )
  }
  async function prepare(id: string, signal: AbortSignal) {
    const current = GUIDE_STEPS.find((item) => item.id === id)!
    if (id !== 'overview') rawStore.actions.closeProcessingPanel()
    if (
      !id.startsWith('map-') &&
      !id.startsWith('master-') &&
      id !== 'validate' &&
      id !== 'load'
    )
      rawStore.actions.closeOnboarding()
    // Accounting uses the independently normalized GL snapshot even while
    // dashboard output is explicitly Excel. Restore the chosen source afterward.
    if (
      [
        'manual',
        'shipping',
        'transfer',
        'adjustment',
        'notes',
        'evidence',
      ].includes(id)
    ) {
      rawStore.actions.disableExcelReference()
      if (
        !rawStore.getState().glReview &&
        sampleRef.current &&
        engine.status === 'ready'
      ) {
        rawStore.actions.setReviewSnapshot(
          await prepareGuideGL(engine.database, sampleRef.current, signal),
        )
      }
    }
    if (id.startsWith('dash-') && !rawStore.getState().excelReference.enabled) {
      const reference = referenceFile.current
      if (!reference)
        throw new Error(
          'Chưa chọn chế độ Excel tham chiếu. Quay lại bước chọn nguồn.',
        )
      await rawStore.actions.loadExcelReference(
        reference,
        GUIDE_REFERENCE_OPTIONS,
      )
      rawStore.actions.closeExcelReference()
    }
    if (id === 'dash-overview') navigateRef.current('/')
    else if (!id.startsWith('dash-') && !id.endsWith('expand'))
      navigateRef.current(current.screen)
    if (id.startsWith('dash-') || id === 'expand') {
      guideTarget('dashboard-inspector')
        ?.querySelector<HTMLElement>('[data-slot="sheet-close"]')
        ?.click()
    }
    if (id.startsWith('map-'))
      rawStore.actions.openSourceOnboarding(id.slice(4) as FactSource)
    if (id.startsWith('master-') || id === 'validate') {
      rawStore.actions.openSourceOnboarding('Dim')
      if (id.startsWith('master-')) {
        await waitForGuide(
          () => !!guideTarget(`master-role-${id.slice(7)}`),
          signal,
        )
        await clickGuideTarget(`master-role-${id.slice(7)}`, signal)
      }
    }
    if (id === 'notes' || id === 'evidence') {
      const state = rawStore.getState()
      const row = state.glReview?.records.find(
        (item) => item.journalId === 'JE20250904892',
      )
      if (!row) throw new Error('Snapshot GL thiếu JE20250904892.')
      navigateRef.current(
        `/accounting-review?record=${encodeURIComponent(row.id)}`,
      )
      await clickGuideTarget('accounting-inspector-tab-evidence', signal)
    }
  }
  const referenceFile = useRef<File | null>(null)
  /**
   * Actions behind the guide's own buttons (load sample, apply a Master/Dim
   * preset, run Raw, opt in to the Excel reference). Every other step is done
   * by the user on the real screen; the guide only verifies the result.
   */
  async function perform(id: string, signal: AbortSignal) {
    if (verify(id) && !id.startsWith('master-')) return
    if (id === 'load') await load(signal)
    else if (id.startsWith('master-')) {
      const role = id.slice(7) as ReferenceRole
      rawStore.actions.setMasterReference(
        'guide-dim',
        role,
        sampleRef.current!.preset.roles[role],
      )
    } else if (id === 'raw-run') {
      if (rawStore.getState().status !== 'error') {
        const status = rawStore.getState().status
        if (status !== 'running' && status !== 'registering')
          rawStore.actions.completeOnboarding()
        await rawStore.whenSettled()
        signal.throwIfAborted()
      }
      const state = rawStore.getState()
      if (state.status !== 'error')
        throw new Error(
          'Luồng Raw chưa trả về giới hạn dự kiến. Kiểm tra cấu hình và kết quả trước khi tiếp tục.',
        )
      const diagnosis = state.error ?? 'Luồng Raw đang bị chặn.'
      setRawLimit(diagnosis)
      record(id, diagnosis)
    } else if (id === 'excel-opt-in') {
      // The Excel reference is only enabled by this deliberate user action.
      if (!referenceFile.current) {
        const { createGuideReferenceFile } =
          await import('@/lib/guide-reference')
        referenceFile.current = createGuideReferenceFile(
          sampleRef.current!.workbook,
        )
      }
      await rawStore.actions.loadExcelReference(
        referenceFile.current,
        GUIDE_REFERENCE_OPTIONS,
      )
      signal.throwIfAborted()
      if (rawStore.getState().excelReference.status !== 'ready')
        throw new Error(
          rawStore.getState().excelReference.error ??
            'Không đọc được Excel tham chiếu.',
        )
      rawStore.actions.closeExcelReference()
      rawStore.actions.closeProcessingPanel()
    }
  }
  function next() {
    if (!verify(step.id)) {
      setError(`Chưa hoàn tất: ${step.instruction}`)
      return
    }
    setCompleted((old) => new Set([...old, step.id]))
    record(step.id, step.result)
    if (index === GUIDE_STEPS.length - 1) {
      rawStore.actions.closeOnboarding()
      rawStore.actions.closeProcessingPanel()
      setSummary(true)
    } else setIndex((old) => old + 1)
  }
  const verifyRef = useRef(verify)
  verifyRef.current = verify
  useEffect(() => () => activeController.current?.abort(), [])
  useEffect(() => {
    if (!session || summary) return
    // Each step opens its screen once per attempt. The user then acts on the
    // real form; state/DOM changes are observed by the effect below.
    const preparationKey = `${session.id}:${step.id}:${attempt}`
    if (preparedStep.current === preparationKey) {
      setBusy(false)
      setVerified(verifyRef.current(step.id))
      return
    }
    const controller = new AbortController()
    activeController.current = controller
    document
      .querySelector('[data-guide-current-target]')
      ?.removeAttribute('data-guide-current-target')
    setBusy(true)
    setVerified(false)
    setError(null)
    void (async () => {
      await prepare(step.id, controller.signal)
      controller.signal.throwIfAborted()
      preparedStep.current = preparationKey
      setVerified(verifyRef.current(step.id))
    })()
      .catch((issue) => {
        if (!controller.signal.aborted) {
          setError(issue instanceof Error ? issue.message : String(issue))
          record(step.id, String(issue))
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false)
      })
    return () => controller.abort()
    // Step preparation happens once per step/attempt; state/DOM changes are observed below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, index, attempt, summary])
  useEffect(() => {
    if (!session || summary) return
    const check = () => {
      setVerified(verifyRef.current(step.id))
    }
    const observer = new MutationObserver(check)
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
    })
    const unsubscribe = rawStore.subscribe(check)
    check()
    return () => {
      observer.disconnect()
      unsubscribe()
    }
  }, [session, step.id, rawStore, viewed, rawLimit, summary])
  async function userAction() {
    const controller = new AbortController()
    activeController.current?.abort()
    activeController.current = controller
    setBusy(true)
    setError(null)
    try {
      await perform(step.id, controller.signal)
      controller.signal.throwIfAborted()
      setVerified(verify(step.id))
    } catch (issue) {
      if (!controller.signal.aborted)
        setError(issue instanceof Error ? issue.message : String(issue))
    } finally {
      if (!controller.signal.aborted) setBusy(false)
    }
  }
  const specialAction =
    step.id === 'load' ||
    step.id.startsWith('master-') ||
    step.id === 'raw-run' ||
    step.id === 'excel-opt-in'
  const actionLabel =
    step.id === 'load'
      ? 'Nạp workbook mẫu'
      : step.id.startsWith('master-')
        ? 'Áp dụng preset Nexa Home cho vai trò này'
        : step.id === 'excel-opt-in'
          ? 'Chuyển sang tham chiếu Excel'
          : 'Chạy xử lý Raw thực tế'
  return (
    <InteractiveGuideContext.Provider
      value={{
        open: () => intro?.open(),
        sample,
        stepId: session ? step.id : '',
        viewed,
        acknowledge,
        audit: audit.current,
      }}
    >
      {children}
      {session && !summary && (
        <GuideOverlay
          step={step}
          index={index}
          total={GUIDE_STEPS.length}
          busy={busy}
          verified={verified}
          error={error}
          completed={completed.size}
          onPrevious={() => {
            activeController.current?.abort()
            setIndex((old) => Math.max(0, old - 1))
          }}
          onNext={next}
          onRetry={() => setAttempt((old) => old + 1)}
          onConfigure={() => {
            rawStore.actions.closeProcessingPanel()
            rawStore.actions.openOnboarding()
            navigate('/ingestion')
          }}
          onRestart={workspace.start}
          onExit={workspace.exit}
          action={
            <>
              {specialAction && (
                <Button
                  data-tour={step.id === 'load' ? 'guide-load' : 'guide-action'}
                  size="sm"
                  disabled={busy || verified}
                  onClick={() => void userAction()}
                >
                  {actionLabel}
                </Button>
              )}
              {step.id === 'raw-run' && rawLimit && (
                <p role="status" className="text-xs">
                  Giới hạn Raw: {rawLimit}
                </p>
              )}
              {step.id === 'excel-opt-in' && (
                <p className="text-xs">
                  {rawLimit} Tiếp tục bằng đầu ra Excel tính sẵn; lựa chọn này
                  cần bạn bấm xác nhận.
                </p>
              )}
              {step.id.startsWith('table-') || step.id === 'exceptions' ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  data-tour="guide-acknowledge"
                  onClick={() => acknowledge(step.id)}
                >
                  Tôi đã xem bảng và phạm vi nguồn
                </Button>
              ) : null}
            </>
          }
        />
      )}
      <GuideSummary
        open={summary}
        steps={GUIDE_CHAPTERS.map((title, chapter) => ({
          title,
          status:
            chapter === 4
              ? 'limited'
              : GUIDE_STEPS.filter((s) => s.chapter === chapter + 1).every(
                    (s) => completed.has(s.id),
                  )
                ? 'completed'
                : 'pending',
        }))}
        exceptions={sample?.sourceExceptions}
        onRestart={workspace.start}
        onExit={workspace.exit}
      />
      {session && (
        <output
          className="sr-only"
          data-tour="guide-audit"
          data-step-id={step.id}
        >
          {JSON.stringify(audit.current)}
        </output>
      )}
    </InteractiveGuideContext.Provider>
  )
}

export function GuideLauncher() {
  const context = useContext(InteractiveGuideContext)
  return (
    <Button
      variant="outline"
      size="sm"
      data-tour="guide-launcher"
      onClick={() => context?.open()}
    >
      <BookOpen className="size-3.5" />
      <span>Hướng dẫn sử dụng</span>
    </Button>
  )
}
export function GuideSessionBanner() {
  const { session, exit } = useGuideWorkspace()
  const guide = useContext(InteractiveGuideContext)
  const app = useAppStore()
  if (!session) return null
  return (
    <div className="guide-session-banner" data-tour="guide-session-banner">
      <div>
        <strong>Đang thực hành với dữ liệu mẫu Nexa Home</strong>
        <p>
          {app.excelReference.enabled
            ? 'Nguồn dashboard: Excel tham chiếu · đầu ra tính sẵn'
            : 'Cấu hình và rà soát nguồn Raw · phiên mẫu riêng'}
        </p>
        {guide && (
          <details className="mt-2">
            <summary>
              Nhật ký thao tác hướng dẫn · {guide.audit.length} sự kiện
            </summary>
            <ol className="max-h-40 overflow-auto">
              {guide.audit.map((event, index) => (
                <li key={index}>
                  {event.at.slice(11, 19)} · {event.actor} · {event.step} ·{' '}
                  {event.result}
                </li>
              ))}
            </ol>
          </details>
        )}
      </div>
      <Button variant="outline" size="sm" onClick={exit}>
        <ArrowLeft size={14} />
        Quay về không gian ban đầu
      </Button>
    </div>
  )
}
export function GuideWorkspaceContent() {
  const context = useContext(InteractiveGuideContext)
  const { session } = useGuideWorkspace()
  const { pathname } = useLocation()
  if (
    !session ||
    !context?.sample ||
    !['/processing', '/exceptions'].includes(pathname)
  )
    return null
  return (
    <>
      <div className="notice mb-3 text-xs">
        <AlertCircle size={16} />
        <span>
          Các bảng dưới đây đọc kết quả workbook để đối chiếu. Tiến trình Raw
          thực tế và chẩn đoán vẫn được giữ riêng.
        </span>
      </div>
      <GuideEvidenceContent
        sample={context.sample}
        stepId={context.stepId}
        acknowledge={context.acknowledge}
      />
    </>
  )
}
