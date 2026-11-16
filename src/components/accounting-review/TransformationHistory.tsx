import type { GLReviewSnapshot } from '@/lib/gl-review'
import { money } from './review-format'

export function TransformationHistory({
  snapshot,
  selectedId,
}: {
  snapshot: GLReviewSnapshot
  selectedId?: string
}) {
  const grouped = new Map<
    string,
    { count: number; impact: number; fields: Set<string> }
  >()
  for (const item of snapshot.transformations) {
    const group = grouped.get(item.rule) || {
      count: 0,
      impact: 0,
      fields: new Set<string>(),
    }
    group.count++
    group.impact += item.impactCents
    group.fields.add(`${item.sourceField} → ${item.outputField}`)
    grouped.set(item.rule, group)
  }
  const details = snapshot.transformations.filter(
    (item) => item.recordId === selectedId,
  )
  return (
    <details className="accounting-diagnostics">
      <summary>Lịch sử tự chuẩn hóa · {grouped.size} quy tắc</summary>
      <p className="mt-2 text-xs leading-6 text-muted-foreground">
        Với đầu vào sổ cái: doanh thu = −số tiền GL gốc. Đầu vào doanh thu giữ
        dấu và lưu riêng số tiền GL gốc tương ứng. Đây là thay đổi cách biểu
        diễn, không phải sửa sổ cái. Tổng ảnh hưởng dưới đây là chênh lệch giữa
        giá trị nguồn và giá trị biểu diễn theo từng quy tắc.
      </p>
      <div className="diagnostics-scroll">
        <table className="accounting-table">
          <thead>
            <tr>
              <th>Quy tắc</th>
              <th>Số dòng</th>
              <th>Field nguồn → đầu ra</th>
              <th>Ảnh hưởng biểu diễn USD</th>
            </tr>
          </thead>
          <tbody>
            {[...grouped].map(([rule, group]) => (
              <tr key={rule}>
                <td>{rule}</td>
                <td>{group.count.toLocaleString('vi-VN')}</td>
                <td>{[...group.fields].join(', ')}</td>
                <td>{money(group.impact)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs font-medium">
        Chi tiết bút toán đang chọn · {details.length} thay đổi
      </p>
      <div className="diagnostics-scroll">
        <table className="accounting-table">
          <thead>
            <tr>
              <th>Quy tắc / field</th>
              <th>Trước</th>
              <th>Sau</th>
            </tr>
          </thead>
          <tbody>
            {details.map((item) => (
              <tr key={item.id}>
                <td>
                  {item.rule}
                  <small>
                    {item.sourceField} → {item.outputField}
                  </small>
                </td>
                <td>{item.before ?? '(trống)'}</td>
                <td>{item.after ?? '(trống)'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Chọn bút toán khác để xem dấu vết tương ứng. Những dòng cần kiểm tra nằm
        trong chẩn đoán GL và hàng chờ.
      </p>
    </details>
  )
}
