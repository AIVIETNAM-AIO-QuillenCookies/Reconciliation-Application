import type { RunEvidence } from './reconciliation-evidence.ts'

const posBranchLabels: Record<string, string> = {
  raw_pos: 'POS nguồn đã ánh xạ',
  pos_staging: 'Staging',
  pos_ranked: 'Phân loại bản xuất',
  q_POS_First_Export: 'Keeper đầu tiên',
  q_POS_Cleaning: 'Cleaning',
  q_POS_Mapped: 'Đã ánh xạ tham chiếu',
  q_POS_USD: 'USD',
  fact_POS_final: 'Fact',
  q_POS_Dup_Keys: 'Nhóm khóa xuất lặp',
  q_POS_Dup_Rows: 'Dòng xuất lặp bị loại',
  q_POS_Dup_Impact: 'Duplicate Impact',
}
export function posBranchLabel(id: string) {
  return posBranchLabels[id] ?? id
}

export function processingTableUrl(runId: string, tableId: string) {
  return `/processing?${new URLSearchParams({ run: runId, table: tableId })}`
}
/** A deep link must never silently resolve against a different processing run. */
export function resolveProcessingTable(
  evidence: RunEvidence | undefined,
  runId: string | null,
  tableId: string | null,
) {
  if (!evidence)
    return {
      error:
        'Chưa có snapshot xử lý thành công. Bảng tạm của phiên thất bại không có checkpoint để mở lại.',
    }
  if (runId && runId !== evidence.runId)
    return {
      error:
        'Liên kết thuộc phiên cũ. Cấu hình hoặc dữ liệu đã thay đổi; snapshot đó không còn trong tab này.',
    }
  const table = evidence.tables.find(
    (item) => item.id === (tableId ?? 'expected_events'),
  )
  if (!table)
    return {
      error:
        'Bảng này không có preview được lưu trong snapshot hiện tại. Không có checkpoint để mở lại.',
    }
  return { table }
}
