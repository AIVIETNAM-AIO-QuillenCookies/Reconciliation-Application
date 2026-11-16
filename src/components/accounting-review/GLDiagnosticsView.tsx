import { Link } from 'react-router-dom'
import { FileSearch } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { GLReviewSnapshot } from '@/lib/gl-review'

// Styles: accounting-diagnostics/accounting-table rules are in src/accounting-review.css,
// loaded by src/pages/AccountingReview.tsx (kept there so bundle CSS order is unchanged).

export function GLDiagnosticsView({
  snapshot,
  expanded = false,
}: {
  snapshot: GLReviewSnapshot
  expanded?: boolean
}) {
  return (
    <details className="accounting-diagnostics" open={expanded || undefined}>
      <summary>
        Chẩn đoán GL · {snapshot.diagnostics.length} lỗi kiểm tra ·{' '}
        {snapshot.records.length.toLocaleString('vi-VN')} dòng nguồn
      </summary>
      <p className="mt-2 text-xs leading-6 text-muted-foreground">
        {snapshot.complete
          ? 'Các dòng GL có thể tính toán. Khoản chưa phân bổ được giữ trong tổng GL, với khóa kỹ thuật -1.'
          : 'Đang chặn kết quả GL, cầu nối và chênh lệch phụ thuộc. Sửa cấu hình nguồn hoặc đề xuất điều chỉnh có lý do rồi chạy lại.'}
      </p>
      {snapshot.diagnostics.length > 0 && (
        <div className="diagnostics-scroll">
          <table className="accounting-table">
            <thead>
              <tr>
                <th>Mã lỗi / Bút toán</th>
                <th>Trường / giá trị</th>
                <th>Dòng nguồn</th>
                <th>Nguyên nhân</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.diagnostics.map((item) => (
                <tr key={item.id}>
                  <td>
                    {item.code}
                    <small>{item.journalId || 'Thiếu ID'}</small>
                  </td>
                  <td>
                    {item.field}
                    <small>{item.value ?? '(trống)'}</small>
                  </td>
                  <td>
                    {item.fileName}
                    <small>
                      {item.sheetName} ·{' '}
                      {item.sourceRow === null
                        ? 'Chưa xác định dòng vật lý'
                        : `dòng ${item.sourceRow}`}
                    </small>
                  </td>
                  <td className="max-w-96 whitespace-normal">
                    {item.reason}
                    <small>
                      {item.blocking
                        ? 'Chặn đầu ra phụ thuộc'
                        : 'Cần rà soát nghiệp vụ'}
                    </small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Button asChild variant="outline" size="sm" className="mt-2">
        <Link to="/accounting-review">
          <FileSearch className="size-3.5" />
          Rà soát kế toán
        </Link>
      </Button>
    </details>
  )
}
