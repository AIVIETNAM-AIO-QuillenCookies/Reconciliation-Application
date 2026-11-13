import { useState, type ReactNode } from 'react'
import {
  AlertCircle,
  ArrowRight,
  Check,
  CircleMinus,
  Clock3,
  LoaderCircle,
  ShieldCheck,
  Table2,
  Wrench,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LocalizedError } from '@/components/LocalizedError'
import { displayRoleLabels } from '@/lib/localized-model'
import {
  progressEvidence,
  stepStatusLabels,
  type ProcessingFlow,
  type StepStatus,
} from '@/lib/processing-progress'
import type { RunEvidence } from '@/lib/reconciliation-evidence'
import type { JoinValidation } from '@/lib/master-data'
import { cn } from '@/lib/utils'
import '@/processing.css'
import { PosDiagnosticsView } from './PosDiagnosticsView'
import { GLDiagnosticsView } from '@/pages/AccountingReview'
import type { GLReviewSnapshot } from '@/lib/gl-review'

function StepIcon({ status, index }: { status: StepStatus; index: number }) {
  const Icon =
    status === 'completed'
      ? Check
      : status === 'running'
        ? LoaderCircle
        : status === 'error' || status === 'needs-configuration'
          ? AlertCircle
          : status === 'not-applicable'
            ? CircleMinus
            : status === 'waiting'
              ? Clock3
              : null
  return (
    <span className={cn('progress-step-icon', `is-${status}`)}>
      {Icon ? (
        <Icon
          className={cn(
            'size-4',
            status === 'running' && 'motion-safe:animate-spin',
          )}
          aria-hidden="true"
        />
      ) : (
        index + 1
      )}
    </span>
  )
}
export function JoinResult({
  report,
  onFix,
}: {
  report: JoinValidation
  onFix?: (report: JoinValidation) => void
}) {
  const problem = report.errors.length > 0
  return (
    <article
      className={cn('progress-join-result', problem && 'has-error')}
      data-relationship-result={report.relationshipId}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-[13px] font-semibold">
            {displayRoleLabels[report.role]} · {report.source}
          </h4>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {problem
              ? 'Cần sửa phép nối'
              : report.unmatchedRows
                ? 'Đã kiểm tra • Có cảnh báo'
                : 'Đã kiểm tra toàn bộ dữ liệu'}
          </p>
        </div>
        {onFix && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onFix(report)}
          >
            <Wrench className="size-3.5" />
            {problem ? 'Sửa cấu hình' : 'Xem phép nối'}
          </Button>
        )}
      </div>
      <dl className="progress-metrics">
        <div>
          <dt>Dòng tham chiếu</dt>
          <dd>{report.referenceRows}</dd>
        </div>
        <div>
          <dt>Trước → Sau phép nối</dt>
          <dd>
            {report.rowsBefore} <ArrowRight className="inline size-3" />{' '}
            {report.rowsAfter}
          </dd>
        </div>
        <div>
          <dt>Nhóm khóa trùng</dt>
          <dd className={report.duplicateKeys ? 'text-destructive' : ''}>
            {report.duplicateKeys}
          </dd>
        </div>
        <div>
          <dt>Không khớp</dt>
          <dd className={report.unmatchedRows ? 'text-warning' : ''}>
            {report.unmatchedRows}
          </dd>
        </div>
      </dl>
      {(report.blankReferenceKeys > 0 ||
        report.invalidReferenceKeys > 0 ||
        report.invalidSourceKeys > 0) && (
        <p className="text-xs leading-5 text-destructive">
          Khóa trống: {report.blankReferenceKeys} dòng tham chiếu. Khóa không
          hợp lệ: {report.invalidReferenceKeys} dòng tham chiếu,{' '}
          {report.invalidSourceKeys} dòng nguồn.
        </p>
      )}
      {report.duplicateKeys > 0 && (
        <p className="mt-2 text-xs text-destructive">
          Khóa tham chiếu bị trùng; phép nối có thể nhân doanh thu. Sửa khóa
          hoặc cấu hình trước khi xác nhận.
        </p>
      )}
      {report.unmatchedSamples.length > 0 && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer font-medium text-warning">
            Xem mẫu khóa không khớp ({report.unmatchedSamples.length})
          </summary>
          <p className="mt-2 text-muted-foreground">
            Đây là mẫu khóa, không phải toàn bộ dòng lỗi.
          </p>
          <pre className="mt-2 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-2 text-[11px]">
            {report.unmatchedSamples.join('\n')}
          </pre>
        </details>
      )}
      {report.errors.length > 0 && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer text-destructive">
            Nguyên nhân và chẩn đoán ({report.errors.length})
          </summary>
          <div className="mt-2 space-y-2">
            {report.errors.map((error) => (
              <LocalizedError key={error} message={error} />
            ))}
          </div>
        </details>
      )}
    </article>
  )
}
export function ProgressView({
  flow,
  evidence,
  onFix,
  onFixJoin,
  onRetry,
  tableAction,
  footer,
  glReview,
  pendingGLCases = 0,
}: {
  flow: ProcessingFlow
  evidence?: RunEvidence
  onFix?: () => void
  onFixJoin?: (report: JoinValidation) => void
  onRetry?: () => void
  tableAction?: (tableId: string, label: string) => ReactNode
  footer?: ReactNode
  glReview?: GLReviewSnapshot | null
  pendingGLCases?: number
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const defaultGLStep =
    flow.status === 'completed' &&
    glReview &&
    (pendingGLCases > 0 || glReview.diagnostics.length > 0)
      ? flow.steps.find((step) => step.id === 'validating')
      : undefined
  const selected =
    flow.steps.find((step) => step.id === selectedId) ??
    defaultGLStep ??
    flow.steps.find((step) => step.id === flow.currentStepId) ??
    flow.steps[0]
  const current = flow.steps.find((step) => step.id === flow.currentStepId)
  const finished = flow.steps.filter(
    (step) => step.status === 'completed' || step.status === 'not-applicable',
  ).length
  const captured = progressEvidence(flow, evidence)
  const title =
    flow.kind === 'configuration'
      ? 'Kiểm tra cấu hình'
      : 'Xử lý dữ liệu & đối soát'
  const resultTitle =
    flow.status === 'completed'
      ? flow.kind === 'configuration'
        ? 'Cấu hình hợp lệ'
        : pendingGLCases
          ? 'Hoàn tất xử lý, còn ngoại lệ chờ xác minh'
          : 'Đã hoàn tất xử lý'
      : flow.status === 'needs-configuration'
        ? 'Cần sửa cấu hình'
        : flow.status === 'error'
          ? 'Phiên xử lý chưa hoàn tất'
          : flow.status === 'cancelled'
            ? 'Đã dừng kiểm tra'
            : flow.status === 'waiting'
              ? 'Đang chờ engine bắt đầu phiên'
              : current?.title
  const index = flow.currentStepId
    ? flow.steps.findIndex((step) => step.id === flow.currentStepId) + 1
    : 0
  return (
    <section className="progress-view" aria-label={title}>
      <header className="progress-overview">
        <div className="flex items-center gap-2">
          <ShieldCheck
            className="size-4 shrink-0 text-primary"
            aria-hidden="true"
          />
          <h3>{title}</h3>
          <span className="progress-scope">
            {flow.kind === 'configuration'
              ? 'Phạm vi khi chạy: toàn bộ tệp'
              : 'Pipeline hiện có'}
          </span>
        </div>
        <p
          role="status"
          className={cn(
            'progress-current',
            flow.status === 'error' && 'text-destructive',
            flow.status === 'needs-configuration' && 'text-warning',
          )}
        >
          {(flow.status === 'running' || flow.status === 'waiting') && (
            <LoaderCircle
              className="size-4 motion-safe:animate-spin"
              aria-hidden="true"
            />
          )}
          {resultTitle}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span>
            {index
              ? `Bước ${index}/${flow.steps.length}`
              : `Chờ bắt đầu · ${flow.steps.length} bước`}{' '}
            · {finished} bước hoàn thành/không áp dụng
          </span>
          <span>
            Phiên {flow.engineRunId?.slice(0, 8) ?? flow.id.slice(0, 8)}
          </span>
        </div>
        <div className="progress-segments" aria-hidden="true">
          {flow.steps.map((step) => (
            <span key={step.id} className={`is-${step.status}`} />
          ))}
        </div>
      </header>
      <div className="progress-columns">
        <nav className="progress-step-list" aria-label="Các bước thực tế">
          <ol>
            {flow.steps.map((step, i) => (
              <li key={step.id}>
                <button
                  type="button"
                  className={cn(
                    'progress-step-button',
                    selected.id === step.id && 'is-selected',
                  )}
                  onClick={() => setSelectedId(step.id)}
                  aria-current={selected.id === step.id ? 'step' : undefined}
                >
                  <StepIcon status={step.status} index={i} />
                  <span>
                    <strong>{step.title}</strong>
                    <small>{stepStatusLabels[step.status]}</small>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <div
          className="progress-detail"
          tabIndex={0}
          role="region"
          aria-label="Kết quả bước đang chọn"
        >
          <span className={cn('progress-state', `is-${selected.status}`)}>
            {stepStatusLabels[selected.status]}
          </span>
          <h4 className="mt-2 text-base font-semibold">{selected.title}</h4>
          <p className="mt-2 text-[13px] leading-6 text-muted-foreground">
            {selected.description}
          </p>
          {(selected.detail || selected.fileName || selected.source) && (
            <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-xs leading-5">
              {selected.detail ??
                [selected.source, selected.fileName]
                  .filter(Boolean)
                  .join(' · ')}
            </p>
          )}
          <dl className="progress-io">
            <div>
              <dt>Đầu vào</dt>
              <dd>{selected.input}</dd>
            </div>
            <ArrowRight className="size-4 text-primary" aria-hidden="true" />
            <div>
              <dt>Đầu ra</dt>
              <dd>{selected.output}</dd>
            </div>
          </dl>
          {selected.metrics.length > 0 && (
            <dl className="progress-metrics">
              {selected.metrics.map((metric) => (
                <div key={metric.label}>
                  <dt>{metric.label}</dt>
                  <dd>
                    {typeof metric.value === 'number'
                      ? metric.value.toLocaleString('vi-VN')
                      : metric.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {selected.error && (
            <div
              role="alert"
              className={cn(
                'progress-error',
                selected.status === 'needs-configuration' &&
                  'needs-configuration',
              )}
            >
              <AlertCircle
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <div>
                <p className="mb-1 font-semibold">
                  {selected.source ? `${selected.source} · ` : ''}
                  {selected.title}
                </p>
                <LocalizedError message={selected.error} />
                {onFix && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={onFix}
                  >
                    Sửa cấu hình
                  </Button>
                )}
              </div>
            </div>
          )}
          {glReview &&
            (selected.source === 'GL' ||
              (selected.id === 'validating' &&
                (glReview.diagnostics.length > 0 || pendingGLCases > 0))) && (
              <GLDiagnosticsView
                snapshot={glReview}
                expanded={!glReview.complete}
              />
            )}
          {selected.diagnostics &&
            selected.source !== 'GL' &&
            selected.diagnostics.runId === flow.engineRunId && (
              <PosDiagnosticsView diagnostics={selected.diagnostics} />
            )}
          {selected.joins.map((report) => (
            <JoinResult
              key={`${report.relationshipId}:${report.fileId}`}
              report={report}
              onFix={onFixJoin}
            />
          ))}
          {selected.tableIds.length > 0 && (
            <div className="mt-4">
              <h5 className="mb-2 text-xs font-semibold">Bảng đầu ra</h5>
              <div className="flex flex-wrap gap-2">
                {selected.tableIds.map((id) => {
                  const table = captured?.tables.find(
                    (entry) => entry.id === id,
                  )
                  return table && tableAction ? (
                    <span key={id}>{tableAction(id, table.label)}</span>
                  ) : (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] text-muted-foreground"
                    >
                      <Table2 className="size-3.5" />
                      {id}
                    </span>
                  )
                })}
              </div>
              {!captured && (
                <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                  Chỉ mở được preview khi engine lưu snapshot thành công của
                  đúng phiên. Bảng tạm chưa có checkpoint xem lại sẽ không được
                  giả lập.
                </p>
              )}
            </div>
          )}
          {selected.status === 'waiting' && (
            <p className="mt-3 text-xs text-muted-foreground">
              Đang chờ bước trước hoặc cần xử lý vấn đề hiện tại rồi chạy lại.
            </p>
          )}
          {selected.status === 'not-applicable' && (
            <p className="mt-3 text-xs text-muted-foreground">
              {selected.detail ??
                'Bước này không được sử dụng trong cấu hình hiện tại.'}
            </p>
          )}
          {flow.kind === 'configuration' &&
            selected.id === 'summary' &&
            flow.status === 'completed' && (
              <p className="mt-3 rounded-lg bg-accent p-3 text-xs leading-6 text-primary">
                Ánh xạ và phép nối đã hợp lệ. Dữ liệu chưa được đánh dấu đã đối
                soát; dùng “Chạy đối soát” để khởi chạy giai đoạn tiếp theo.
              </p>
            )}
          {flow.kind === 'pipeline' && selected.id === 'projecting' && (
            <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
              Ánh xạ giữ riêng tiền nguyên tệ và USD được cung cấp. POS nguyên
              tệ được quy đổi ở bước “Quy đổi USD” bằng tỷ giá đã xác nhận; net
              USD được map không bị quy đổi hoặc trừ discount thêm lần nữa.
            </p>
          )}
        </div>
      </div>
      <footer className="progress-view-footer">
        <span>
          {flow.kind === 'configuration'
            ? 'Kiểm tra cấu hình khác với xử lý kế toán.'
            : 'Thay cấu hình sẽ xóa tiến trình và kết quả không còn hợp lệ.'}
        </span>
        <div>
          {onRetry &&
            (flow.status === 'error' ||
              flow.status === 'needs-configuration' ||
              flow.status === 'cancelled') && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRetry}
              >
                Thử lại
              </Button>
            )}
          {footer}
        </div>
      </footer>
    </section>
  )
}
