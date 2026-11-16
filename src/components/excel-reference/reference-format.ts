/** Shared constants and plain-text formatting for the Excel reference views. */

export const NO_DATA = 'Chưa có dữ liệu tương ứng trong file tham chiếu.'
export const money = (value: number | null | undefined) =>
  value === null || value === undefined
    ? '—'
    : new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Object.is(value, -0) ? 0 : value)
export const cell = (value: unknown) =>
  value === null || value === undefined || value === ''
    ? '—'
    : typeof value === 'number'
      ? new Intl.NumberFormat('vi-VN', {
          maximumFractionDigits: 12,
        }).format(value)
      : String(value)

export function columnKind(column: string) {
  if (/tỷ giá|ty_gia|fx_|rate/i.test(column)) return 'rate'
  if (/^\d{4}-\d{2}$/.test(column) || /USD|Cả năm|Ảnh hưởng/.test(column))
    return 'amount'
  if (/^Khoản mục$/.test(column)) return 'label'
  if (/mô tả|diễn giải|hướng xử lý/i.test(column)) return 'description'
  if (/nguồn|source|loai_bang/i.test(column)) return 'source'
  if (/^Mã|^Ma_|^Thang$|^Kỳ|^Ngày|^Kenh$|^Kênh$/.test(column)) return 'code'
  return 'text'
}

export function sourceCell(value: unknown, column: string) {
  if (typeof value !== 'number') return cell(value)
  const kind = columnKind(column)
  if (kind !== 'amount' && kind !== 'rate') return cell(value)
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: kind === 'amount' ? 2 : 0,
    maximumFractionDigits: kind === 'amount' ? 2 : 6,
  }).format(Object.is(value, -0) ? 0 : value)
}

export function statusTone(status: string) {
  if (/chưa giải thích|cần sửa nguồn/i.test(status)) return 'danger'
  if (/cần|chưa|đối chiếu/i.test(status)) return 'warning'
  if (/^đã (xác nhận|hoàn tất|đóng)$|^khớp$|^pass$/i.test(status))
    return 'success'
  return 'neutral'
}

export function monthEnd(month: string) {
  const [year, value] = month.split('-').map(Number)
  return `${month}-${String(new Date(Date.UTC(year, value, 0)).getUTCDate()).padStart(2, '0')}`
}
