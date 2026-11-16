/** Vietnamese labels and display formatting shared by the GL accounting review UI. */
import type { GLCaseStatus, GLClassification, GLRecord } from '@/lib/gl-review'
import { formatUSD } from '@/lib/format-money'

export const classificationLabels: Record<GLClassification, string> = {
  shipping: 'Phí vận chuyển',
  channel_transfer: 'Chuyển kênh',
  unexplained: 'Chưa giải thích',
  other: 'Nghiệp vụ khác',
}
export const reviewStatusLabels: Record<GLCaseStatus, string> = {
  open: 'Chờ xác minh',
  in_progress: 'Đang xử lý',
  reviewed: 'Đã xem · chưa giải quyết',
  confirmed: 'Đã xác nhận',
}
export const money = (cents: number | null | undefined) =>
  cents == null ? 'Không đọc được' : formatUSD(cents)
export const displayChannel = (record: GLRecord) =>
  record.channel === 'UNALLOCATED' || record.storeKey === '-1'
    ? 'Chưa phân bổ'
    : record.channel || 'Chưa rõ kênh'
