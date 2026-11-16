/**
 * Number/date formatting for the Detail and Quality dashboard tabs.
 * Note: this `money` intentionally keeps its original behaviour and differs
 * from `money` in @/lib/dashboard-format (no -0 or non-finite handling);
 * unifying them would change displayed text, so it is a reviewed follow-up.
 * Compact axis numbers (`compact`) are shared via @/lib/dashboard-format.
 */

export const money = (value: number | null | undefined) =>
  value == null
    ? '—'
    : new Intl.NumberFormat('vi-VN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value)
export const ratio = (value: number | null | undefined) =>
  value == null ? 'Không xác định' : `${money(value * 100)}%`
export const count = (value: number | null | undefined) =>
  value == null ? '—' : value.toLocaleString('vi-VN')
export const monthLabel = (value: string) =>
  value.length === 10
    ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`
    : `${value.slice(5, 7)}/${value.slice(0, 4)}`
