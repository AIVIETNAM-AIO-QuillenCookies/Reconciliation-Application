export const money = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value)
    ? '—'
    : new Intl.NumberFormat('vi-VN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Object.is(value, -0) ? 0 : value)
export const percent = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value)
    ? 'Không xác định'
    : `${new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value * 100)}%`
export const shortMonth = (month: string) => `T${Number(month.slice(5, 7))}`
