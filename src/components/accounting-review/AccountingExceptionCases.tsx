import { Link } from 'react-router-dom'
import { ArrowRight, ClipboardCheck } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import {
  classificationLabels,
  money,
  reviewStatusLabels,
} from './review-format'

export function AccountingExceptionCases() {
  const { reviewCases, glReview } = useAppStore()
  if (!reviewCases.length) return null
  const open = reviewCases.filter(
    (item) => item.status !== 'confirmed' || item.stale,
  )
  return (
    <section
      className="accounting-exception-cases"
      aria-label="Ngoại lệ kế toán dùng chung"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2>
          <ClipboardCheck className="mr-2 inline size-4 text-primary" />
          {reviewCases.length} hồ sơ rà soát · {open.length} hồ sơ còn mở
        </h2>
        <Link
          className="text-xs font-medium"
          to="/accounting-review?from=exceptions"
        >
          Mở hàng chờ <ArrowRight className="inline size-3" />
        </Link>
      </div>
      <details className="mt-2 text-xs leading-5 text-muted-foreground">
        <summary className="cursor-pointer">
          Phạm vi hồ sơ & cách đọc số tiền
        </summary>
        <p className="mt-1">
          Dùng chung dữ liệu với Rà soát kế toán. Một hồ sơ có thể liên quan
          nhiều bút toán. Các kiểm soát chứng từ không lọc theo ngưỡng tiền; giá
          trị hồ sơ không cộng thêm vào tổng rủi ro đối soát.
        </p>
      </details>
      <div className="case-list">
        {reviewCases.map((item) => {
          const related =
            glReview?.records.filter((r) => item.recordIds.includes(r.id)) || []
          const periods = [
            ...new Set(related.map((r) => r.period).filter(Boolean)),
          ]
          const complete =
            related.length === item.recordIds.length &&
            related.every((r) => r.revenueCents !== null)
          return (
            <Link
              className="case-link"
              key={item.id}
              to={`/accounting-review?case=${encodeURIComponent(item.id)}&from=exceptions`}
            >
              <span>
                <strong>{classificationLabels[item.classification]}</strong>
                <p
                  className="case-identifiers mt-1"
                  title={related.map((r) => r.journalId).join(', ')}
                >
                  {item.recordIds
                    .map(
                      (id) =>
                        glReview?.records.find((r) => r.id === id)?.journalId ||
                        id,
                    )
                    .join(', ')}
                </p>
                <span className="case-meta">
                  <span>Kỳ: {periods.join(', ') || 'Chưa rõ'}</span>
                  <span className="financial-value">
                    Doanh thu:{' '}
                    {complete
                      ? money(
                          related.reduce(
                            (sum, r) => sum + (r.revenueCents || 0),
                            0,
                          ),
                        )
                      : 'Nguồn cần kiểm tra'}
                  </span>
                  <span>Phụ trách: {item.owner || 'Chưa giao'}</span>
                  {item.dueDate && <span>Hạn: {item.dueDate}</span>}
                </span>
                <p className="case-step">
                  Bước tiếp: {item.nextStep || 'Bổ sung căn cứ và quyết định'}
                </p>
              </span>
              <span className={`accounting-pill is-${item.status}`}>
                {item.stale
                  ? 'Nguồn thay đổi · cần rà soát'
                  : reviewStatusLabels[item.status]}
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
