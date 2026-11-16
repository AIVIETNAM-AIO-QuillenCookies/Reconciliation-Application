/**
 * Overview summary of the revenue bridge: groups the classified adjustment rows
 * of an existing DashboardModel into rule, data-error, rounding and unexplained
 * steps between the Flash start and the Finance end. It only regroups model
 * rows (exact sums via sumReferenceUSD); it never recalculates accounting.
 */
import type { DashboardModel } from './dashboard-model.ts'
import { sumReferenceUSD } from './excel-reference.ts'

export function summaryBridge(
  rows: DashboardModel['bridge'],
): DashboardModel['bridge'] {
  const first = rows.find((row) => row.kind === 'sales')
  const last = rows.find((row) => row.kind === 'finance')
  if (!first || !last) return []
  let running = first.amountUSD
  const groups = (
    ['rule', 'error', 'rounding', 'unexplained'] as const
  ).flatMap((category) => {
    const children = rows.filter((row) => row.category === category)
    if (!children.length) return []
    const amountUSD = sumReferenceUSD(children.map((row) => row.amountUSD))
    const startUSD = running
    running = sumReferenceUSD([running, amountUSD])
    return [
      {
        id: `group-${category}`,
        label: {
          rule: 'Quy tắc ghi nhận',
          error: 'Lỗi dữ liệu',
          rounding: 'Làm tròn',
          unexplained: 'Chưa giải thích',
        }[category],
        kind: 'adjustment' as const,
        category,
        amountUSD,
        startUSD,
        endUSD: running,
        monthly: Object.fromEntries(
          Object.keys(first.monthly).map((month) => [
            month,
            sumReferenceUSD(children.map((row) => row.monthly[month] ?? 0)),
          ]),
        ),
        sourceRows: children.flatMap((row) => row.sourceRows),
        detailCodes: children.flatMap((row) => row.detailCodes),
        sourceRowsTruncated: children.some((row) => row.sourceRowsTruncated),
        detailCount: children.reduce(
          (sum, row) => sum + (row.detailCount ?? 0),
          0,
        ),
      },
    ]
  })
  return [first, ...groups, last]
}
