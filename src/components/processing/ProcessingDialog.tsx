import { Link } from 'react-router-dom'
import { ArrowRight, EyeOff, FileInput } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'
import { progressEvidence } from '@/lib/processing-progress'
import { processingTableUrl } from '@/lib/processing-workspace'
import { ONBOARDING_STEPS } from '@/lib/onboarding'
import { viMessage } from '@/lib/i18n'
import { ProgressView } from './ProgressView'
import { LocalizedError } from '@/components/LocalizedError'
import { useDuckDB } from '@/hooks/useDuckDB'

export function ProcessingDialog() {
  const store = useAppStore()
  const engine = useDuckDB()
  const flow = store.pipelineProgress
  const evidence = flow
    ? progressEvidence(flow, store.reconciliationData?.evidence)
    : undefined
  const hide = store.closeProcessingPanel
  const diagnostics = flow?.steps
    .map((step) => step.diagnostics)
    .filter((item) => item?.runId === flow.engineRunId)
    .at(-1)
  const fix = () => {
    hide()
    store.openOnboarding()
    const current = flow?.steps.find((step) => step.id === flow.currentStepId)
    const index = ONBOARDING_STEPS.findIndex(
      (step) => step.source === current?.source,
    )
    if (index >= 0) store.setOnboardingStep(index)
  }
  if (store.excelReference.enabled || store.excelReference.panelOpen)
    return null
  return (
    <Dialog
      open={store.processingPanelOpen}
      onOpenChange={(open) => {
        if (!open) hide()
      }}
    >
      <DialogContent
        className="processing-dialog h-[min(720px,calc(100dvh-32px))] max-w-[1080px] gap-0"
        closeLabel="Ẩn tiến trình"
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          if (typeof document === 'undefined') return
          if (store.onboardingOpen) return
          const target =
            document.querySelector<HTMLElement>('[data-progress-trigger]') ??
            document.getElementById('main-content')
          target?.focus()
        }}
      >
        <header className="shrink-0 border-b px-5 py-4 pr-16">
          <DialogTitle>Theo dõi xử lý</DialogTitle>
          <DialogDescription className="mt-1 text-xs">
            {store.period.start} → {store.period.end} · Dữ liệu chỉ tồn tại
            trong tab này.
          </DialogDescription>
        </header>
        {flow ? (
          <ProgressView
            key={flow.id}
            flow={flow}
            evidence={evidence}
            glReview={store.glReview}
            pendingGLCases={
              store.reviewCases.filter(
                (item) => item.status !== 'confirmed' || item.stale,
              ).length
            }
            onFix={fix}
            onRetry={store.retry}
            onFixJoin={(report) => {
              const dim = store.files.find((file) => file.source === 'Dim')
              if (dim)
                store.focusMasterConfiguration(
                  dim.id,
                  report.role,
                  report.relationshipId,
                )
            }}
            tableAction={(id, label) => (
              <Button asChild variant="outline" size="sm">
                <Link
                  to={processingTableUrl(evidence!.runId, id)}
                  onClick={hide}
                >
                  Xem bảng: {viMessage(label)}
                  <ArrowRight className="size-3" />
                </Link>
              </Button>
            )}
          />
        ) : (
          <div className="flex flex-1 flex-col items-start justify-center gap-3 p-7">
            <FileInput className="size-7 text-primary" />
            <h3 className="text-base font-semibold">
              {store.engineStatus === 'error'
                ? 'Bộ máy cục bộ chưa sẵn sàng'
                : 'Cấu hình đã thay đổi'}
            </h3>
            {store.engineStatus === 'error' && store.error ? (
              <LocalizedError message={store.error} />
            ) : (
              <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                Tiến trình và kết quả cũ đã được xóa. Kiểm tra cấu hình hiện tại
                rồi xác nhận để bắt đầu phiên mới.
              </p>
            )}
            {store.engineStatus === 'error' ? (
              <Button onClick={engine.retry}>Khởi động lại engine</Button>
            ) : (
              <Button onClick={fix}>Mở cấu hình nguồn</Button>
            )}
          </div>
        )}
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-5 py-3">
          <Button variant="ghost" size="sm" onClick={hide}>
            <EyeOff className="size-4" />
            Ẩn tiến trình
          </Button>
          <div className="flex flex-wrap gap-2">
            {(evidence || diagnostics || store.glReview) && (
              <Button asChild variant="outline" size="sm">
                <Link
                  to={
                    store.glReview &&
                    (store.glReview.diagnostics.length > 0 ||
                      store.reviewCases.some(
                        (item) => item.status !== 'confirmed' || item.stale,
                      ))
                      ? '/accounting-review'
                      : evidence
                        ? processingTableUrl(evidence.runId, 'expected_events')
                        : `/processing?${new URLSearchParams({ run: diagnostics!.runId })}`
                  }
                  onClick={hide}
                >
                  {store.glReview &&
                  (store.glReview.diagnostics.length > 0 ||
                    store.reviewCases.some(
                      (item) => item.status !== 'confirmed' || item.stale,
                    ))
                    ? 'Rà soát kế toán / Chẩn đoán GL'
                    : evidence
                      ? 'Xem dữ liệu sau xử lý'
                      : 'Xem chẩn đoán POS'}
                </Link>
              </Button>
            )}
            <Button asChild size="sm">
              <Link to="/" onClick={hide}>
                Đến trang Tổng quan
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  )
}
