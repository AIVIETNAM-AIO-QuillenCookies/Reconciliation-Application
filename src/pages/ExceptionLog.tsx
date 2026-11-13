import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, LoaderCircle } from 'lucide-react'
import { ExceptionLog as ExceptionTable } from '@/components/dashboard/ExceptionLog'
import { ReconciliationRunStatus } from '@/components/ReconciliationRunStatus'
import { CompatibilityNotice } from '@/components/CompatibilityNotice'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppStore } from '@/lib/store'
import { ReferenceExceptions } from '@/components/excel-reference/ReferenceViews'
import { AccountingExceptionCases } from '@/pages/AccountingReview'
import '@/exceptions.css'

export function ExceptionLog() {
  const store = useAppStore()
  const result = store.activeResult
  return result.source === 'excel' ? (
    <ReferenceExceptions
      workbook={result.workbook}
      period={result.period}
      setPeriod={store.setExcelReferencePeriod}
    />
  ) : (
    <RawExceptionLog />
  )
}

function RawExceptionLog() {
  const {
    exceptionsData,
    status,
    isProcessing,
    period,
    missingSources,
    reconciliationData,
    reviewCases,
    glReview,
  } = useAppStore()
  const [params, setParams] = useSearchParams()
  const tab =
    params.get('tab') || (reviewCases.length ? 'accounting' : 'differences')
  const openCount = reviewCases.filter(
    (item) => item.status !== 'confirmed' || item.stale,
  ).length
  return (
    <div className="exception-page">
      <header className="exception-page-heading">
        <div>
          <p>ĐỐI SOÁT</p>
          <h1>Nhật ký ngoại lệ</h1>
        </div>
        <div className="exception-heading-tools">
          <span>
            {period.start} → {period.end}
          </span>
          <details className="exception-guide">
            <summary>Cách đọc nhật ký</summary>
            <div>
              <p>
                Hồ sơ kế toán dùng chung dữ liệu, bằng chứng và quyết định với
                Rà soát kế toán. Một hồ sơ có thể liên quan nhiều bút toán.
              </p>
              <p>
                Chênh lệch đối soát được tạo từ POS chuẩn hóa và so sánh nguồn
                với GL theo cửa hàng/ngày. Chênh lệch = nguồn − GL. Các phần dư
                tỷ giá hoặc độ phủ theo tháng nằm trên Dashboard.
              </p>
              <p>
                Số tiền hồ sơ không được cộng thêm vào tổng rủi ro. Ngưỡng tiền
                chỉ áp dụng cho chênh lệch đối soát.
              </p>
            </div>
          </details>
        </div>
      </header>
      <ReconciliationRunStatus />
      <div className="exception-workspace">
        <div
          className="exception-workspace-tabs"
          role="tablist"
          aria-label="Phạm vi nhật ký ngoại lệ"
          onKeyDown={(event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key))
              return
            event.preventDefault()
            const next =
              event.key === 'Home'
                ? 'accounting'
                : event.key === 'End'
                  ? 'differences'
                  : tab === 'accounting'
                    ? 'differences'
                    : 'accounting'
            setParams((previous) => {
              previous.set('tab', next)
              return previous
            })
            event.currentTarget
              .querySelector<HTMLButtonElement>(`#exception-${next}-tab`)
              ?.focus()
          }}
        >
          <button
            role="tab"
            id="exception-accounting-tab"
            aria-controls="exception-accounting-panel"
            aria-selected={tab === 'accounting'}
            tabIndex={tab === 'accounting' ? 0 : -1}
            onClick={() =>
              setParams((previous) => {
                previous.set('tab', 'accounting')
                return previous
              })
            }
          >
            Hồ sơ kế toán <span>{reviewCases.length}</span>
            <small>{openCount} còn mở</small>
          </button>
          <button
            role="tab"
            id="exception-differences-tab"
            aria-controls="exception-differences-panel"
            aria-selected={tab !== 'accounting'}
            tabIndex={tab !== 'accounting' ? 0 : -1}
            onClick={() =>
              setParams((previous) => {
                previous.set('tab', 'differences')
                return previous
              })
            }
          >
            Chênh lệch đối soát{' '}
            <span>{status === 'ready' ? exceptionsData.length : '—'}</span>
          </button>
        </div>
        <section
          role="tabpanel"
          id="exception-accounting-panel"
          aria-labelledby="exception-accounting-tab"
          className="exception-tab-panel"
          hidden={tab !== 'accounting'}
        >
          {reviewCases.length ? (
            <AccountingExceptionCases />
          ) : (
            <div className="exception-empty-state">
              <h2>
                {glReview
                  ? 'Không có hồ sơ kế toán cần rà soát.'
                  : 'Chưa có phiên dữ liệu GL.'}
              </h2>
              <p>
                {glReview
                  ? 'Các hồ sơ kiểm soát chứng từ sẽ xuất hiện tại đây khi cần xác minh.'
                  : 'Nạp và cấu hình nguồn GL để tạo hồ sơ. Kết quả đối soát toàn bộ được theo dõi riêng.'}
              </p>
              <Button asChild variant="outline" size="sm">
                <Link to={glReview ? '/accounting-review' : '/ingestion'}>
                  {glReview ? 'Mở Rà soát kế toán' : 'Mở nguồn dữ liệu'}
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </div>
          )}
        </section>
        <section
          role="tabpanel"
          id="exception-differences-panel"
          aria-labelledby="exception-differences-tab"
          className="exception-tab-panel"
          hidden={tab === 'accounting'}
        >
          {isProcessing ? (
            <div className="exception-loading" aria-busy="true">
              <p role="status">
                <LoaderCircle className="size-4 motion-safe:animate-spin" />
                {status === 'registering'
                  ? 'Đang đăng ký tệp đã tải lên…'
                  : 'Đang tính ngoại lệ từ nguồn dữ liệu…'}
              </p>
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : status === 'ready' ? (
            <>
              {!!reconciliationData?.compatibilityWarnings?.length && (
                <details className="exception-mapping-notes">
                  <summary>
                    Ghi chú cấu hình nguồn ·{' '}
                    {reconciliationData.compatibilityWarnings.length}
                  </summary>
                  <CompatibilityNotice
                    warnings={reconciliationData.compatibilityWarnings}
                    preview={reconciliationData.schemaMode === 'compatible'}
                  />
                </details>
              )}
              <ExceptionTable
                key={`${period.start}:${period.end}`}
                data={exceptionsData}
                reviewCases={reviewCases}
                sample={false}
                emptyState={{
                  title: 'Không phát hiện ngoại lệ từ nguồn.',
                  description:
                    'Không có bản ghi POS trùng hoặc chênh lệch GL khác 0 theo cửa hàng/ngày trong kỳ này.',
                }}
              />
            </>
          ) : (
            <div className="exception-empty-state">
              <h2>
                {status === 'error'
                  ? 'Chưa có kết quả chênh lệch đối soát.'
                  : 'Chưa chạy đối soát toàn bộ.'}
              </h2>
              <p>
                {status === 'error'
                  ? 'Hoàn tất xử lý lỗi của lần chạy hiện tại để tạo danh sách chênh lệch. Các hồ sơ GL đã có vẫn xem được ở tab Hồ sơ kế toán.'
                  : missingSources.length
                    ? `Nguồn còn thiếu: ${missingSources.join(', ')}.`
                    : 'Hoàn tất cấu hình và chạy đối soát để xem kết quả.'}
              </p>
              <Button asChild variant="outline" size="sm">
                <Link to={status === 'error' ? '/processing' : '/ingestion'}>
                  {status === 'error' ? 'Mở tiến trình' : 'Mở nguồn dữ liệu'}
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
