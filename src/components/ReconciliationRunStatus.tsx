import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, Workflow, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'
import { explainError } from '@/lib/i18n'
import { SOURCES } from '@/lib/uploads'
import { ExcelReferenceButton } from '@/components/excel-reference/ExcelReferenceControls'

const stages: Record<string, string> = {
  registering: 'Đọc tệp nguồn',
  dimensions: 'Nạp bảng tham chiếu',
  projecting: 'Ánh xạ trường và phép nối',
  normalizing: 'Chuẩn hóa dữ liệu',
  classifying: 'Phân loại',
  cleaning: 'Làm sạch',
  mapping: 'Ánh xạ cửa hàng',
  converting: 'Quy đổi tiền tệ',
  validating: 'Kiểm tra dữ liệu',
  recognition: 'Ghi nhận doanh thu',
  reconciling: 'Tính đối soát',
  evidence: 'Lưu bằng chứng tính toán',
  period: 'Kiểm tra kỳ báo cáo',
  engine: 'Khởi động bộ xử lý',
}

/** A GL review snapshot and a completed reconciliation are separate states. */
export function ReconciliationRunStatus() {
  const store = useAppStore()
  const [showSamples, setShowSamples] = useState(false)
  if (store.status !== 'error' || !store.error) return null
  const failure = store.runFailure
  const source = failure?.source
  const stage = failure?.stage
  const sourceType = SOURCES.find((value) => value === source)
  const glValid =
    store.glReview?.complete && store.glReview.runId === failure?.runId
  const specific =
    failure?.reasons.filter((reason) => reason.code !== 'PROCESSING_FAILURE') ??
    []
  const glDiagnostics =
    source === 'GL' && failure?.runId && store.glReview?.runId === failure.runId
  return (
    <section
      role="alert"
      className="accounting-notice is-error run-failure-notice"
    >
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-start gap-2 font-semibold">
            <AlertCircle
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            Đối soát đang bị chặn{source ? ` · Nguồn ${source}` : ''}
            {stage ? ` · ${stages[stage] ?? stage}` : ''}
          </p>
          <p className="mt-1 leading-5">
            {specific.length
              ? specific
                  .slice(0, 2)
                  .map(
                    (reason) =>
                      `${reason.code.startsWith('REPORTING_PERIOD_') ? explainError(reason.message) : reason.message}${reason.count === undefined ? '' : ` (${reason.count.toLocaleString('vi-VN')} dòng/nhóm)`}`,
                  )
                  .join(' ')
              : explainError(store.error)}
          </p>
          {glValid && source !== 'GL' && (
            <p className="mt-1 leading-5">
              GL đã hợp lệ trong phiên này. Kết quả đối soát toàn bộ và các
              chênh lệch phụ thuộc chưa có.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <ExcelReferenceButton />
          {glDiagnostics && (
            <Button asChild variant="outline" size="sm">
              <Link
                to={`/processing?run=${encodeURIComponent(failure.runId!)}&table=gl-diagnostics`}
              >
                Xem dòng lỗi GL
              </Link>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={store.openProcessingPanel}
            disabled={!store.pipelineProgress}
          >
            <Workflow className="size-3.5" /> Mở tiến trình
          </Button>
          {sourceType && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => store.openSourceOnboarding(sourceType)}
            >
              <Wrench className="size-3.5" /> Sửa cấu hình nguồn {sourceType}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={store.retry}>
            Chạy lại đối soát
          </Button>
        </div>
      </div>
      <details className="mt-2 text-xs" open={showSamples || undefined}>
        <summary className="cursor-pointer font-medium">
          Chẩn đoán kỹ thuật
          {failure?.samples.length
            ? ` · ${failure.samples.length} bản ghi mẫu`
            : ''}
        </summary>
        <dl className="mt-2 grid min-w-0 gap-1 leading-5 [overflow-wrap:anywhere]">
          <div>
            <dt className="inline font-semibold">Nguồn: </dt>
            <dd className="inline">
              {source ??
                (stage === 'period'
                  ? 'Cấu hình kỳ báo cáo'
                  : 'Chưa xác định; xem chẩn đoán gốc')}
            </dd>
          </div>
          <div>
            <dt className="inline font-semibold">Bước: </dt>
            <dd className="inline">{stage ?? 'Chưa có tín hiệu bước xử lý'}</dd>
          </div>
          <div>
            <dt className="inline font-semibold">Phiên dữ liệu: </dt>
            <dd className="inline">
              {failure?.runId ?? 'Chưa tạo phiên tính toán'}
            </dd>
          </div>
          <div>
            <dt className="inline font-semibold">Cấu hình: </dt>
            <dd className="inline">
              {failure?.configurationId ?? 'Khởi tạo engine'} ·{' '}
              {failure?.period?.start ?? store.period.start} →{' '}
              {failure?.period?.end ?? store.period.end}
            </dd>
          </div>
          {failure?.fileName && (
            <div>
              <dt className="inline font-semibold">Tệp: </dt>
              <dd className="inline">{failure.fileName}</dd>
            </div>
          )}
        </dl>
        {failure?.reasons.map((reason, index) => (
          <p
            key={`${reason.code}:${index}`}
            className="mt-1 [overflow-wrap:anywhere]"
          >
            <strong>{reason.code}</strong>
            {reason.fields.length
              ? ` · Trường: ${reason.fields.join(', ')}`
              : ''}{' '}
            · {reason.message}
          </p>
        ))}
        <pre
          data-technical="true"
          className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap break-words rounded-md border bg-white/70 p-2"
        >
          {store.error}
        </pre>
        {failure?.samples.length ? (
          <div className="mt-2 space-y-2">
            <p className="text-muted-foreground">
              Mẫu bản ghi từ chính phiên bị lỗi. Số thứ tự bản ghi không phải số
              dòng vật lý trong tệp.
            </p>
            {failure.samples.map((sample, index) => (
              <details
                key={`${sample.fileName}:${sample.sourceRecord}:${index}`}
                className="rounded-md border bg-white/60 p-2"
              >
                <summary className="cursor-pointer [overflow-wrap:anywhere]">
                  {sample.fileName} · Bản ghi {sample.sourceRecord}
                </summary>
                <pre
                  data-technical="true"
                  className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap break-words"
                >
                  {JSON.stringify(sample.values, null, 2)}
                </pre>
              </details>
            ))}
          </div>
        ) : null}
      </details>
      {!!failure?.samples.length && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-1"
          onClick={() => setShowSamples((value) => !value)}
        >
          {showSamples ? 'Thu gọn dòng lỗi' : 'Xem dòng lỗi'}
        </Button>
      )}
    </section>
  )
}
