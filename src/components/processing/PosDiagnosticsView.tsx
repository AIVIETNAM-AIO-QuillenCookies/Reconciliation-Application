import type { PosDiagnostics } from '@/lib/pos-diagnostics'
import { posBranchLabel } from '@/lib/processing-workspace'

/** Diagnostic counts come from full SQL relations; samples remain bounded. */
export function PosDiagnosticsView({
  diagnostics,
}: {
  diagnostics: PosDiagnostics
}) {
  return (
    <section
      className="mt-4 space-y-4 rounded-xl border bg-white p-4"
      aria-label="Chẩn đoán dữ liệu POS"
      data-pos-diagnostics={diagnostics.runId}
    >
      <div>
        <h3 className="text-sm font-semibold">Chẩn đoán dữ liệu POS</h3>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Phiên {diagnostics.runId} · Bước{' '}
          {diagnostics.stage === 'staging' ? 'Staging' : 'USD'} · Counts trên
          toàn bộ dữ liệu của phiên; bản ghi bên dưới chỉ là mẫu.
        </p>
      </div>
      <dl className="progress-metrics">
        <div>
          <dt>Dòng lỗi duy nhất</dt>
          <dd>{diagnostics.uniqueInvalidRows.toLocaleString('vi-VN')}</dd>
        </div>
        <div>
          <dt>Nhóm khóa lỗi</dt>
          <dd>{diagnostics.invalidKeyGroups.toLocaleString('vi-VN')}</dd>
        </div>
        <div>
          <dt>Net nguyên tệ hợp lệ nhưng USD null</dt>
          <dd>
            {diagnostics.stage === 'staging'
              ? 'Chưa quy đổi USD'
              : diagnostics.validLocalMissingUsdRows.toLocaleString('vi-VN')}
          </dd>
        </div>
        <div>
          <dt>Nhóm xuất lặp khác nội dung</dt>
          <dd>{diagnostics.duplicateConflictGroups.toLocaleString('vi-VN')}</dd>
        </div>
      </dl>
      {diagnostics.duplicateGroups && (
        <dl className="progress-metrics">
          <div>
            <dt>Nhóm khóa có xuất lặp</dt>
            <dd>
              {diagnostics.duplicateGroups.keyGroups.toLocaleString('vi-VN')}
            </dd>
          </div>
          <div>
            <dt>Tất cả dòng trong nhóm xuất lặp</dt>
            <dd>
              {diagnostics.duplicateGroups.rowsInGroups.toLocaleString('vi-VN')}
            </dd>
          </div>
          <div>
            <dt>Bản xuất thực sự bị loại</dt>
            <dd>
              {diagnostics.duplicateGroups.discardedRows.toLocaleString(
                'vi-VN',
              )}
            </dd>
          </div>
        </dl>
      )}
      <p className="text-xs leading-5 text-muted-foreground">
        Một dòng có thể vi phạm nhiều điều kiện. Không cộng counts từng nguyên
        nhân để tính số dòng lỗi duy nhất. Nhóm khóa lỗi được đếm riêng.
      </p>
      {Object.keys(diagnostics.branchCounts).length > 0 && (
        <details open>
          <summary className="cursor-pointer text-xs font-semibold">
            Số dòng thực tế từng nhánh
          </summary>
          <dl className="progress-metrics mt-2">
            {Object.entries(diagnostics.branchCounts).map(([id, count]) => (
              <div key={id}>
                <dt>{posBranchLabel(id)}</dt>
                <dd>{count.toLocaleString('vi-VN')}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
      {!Object.hasOwn(diagnostics.branchCounts, 'fact_POS_final') && (
        <p className="text-xs leading-5 text-warning">
          Fact chưa được tạo: cần vượt qua kiểm tra đầu ra USD và grain trước
          khi công bố doanh thu.
        </p>
      )}
      {Object.keys(diagnostics.currencyCounts).length > 0 && (
        <div>
          <h4 className="text-xs font-semibold">Dòng lỗi theo currency</h4>
          <dl className="progress-metrics mt-2">
            {Object.entries(diagnostics.currencyCounts).map(
              ([currency, count]) => (
                <div key={currency}>
                  <dt>{currency || '(trống)'}</dt>
                  <dd>{count.toLocaleString('vi-VN')}</dd>
                </div>
              ),
            )}
          </dl>
        </div>
      )}
      <div className="space-y-2">
        {diagnostics.reasons.map((reason) => (
          <details key={reason.code} className="rounded-lg border p-3">
            <summary className="cursor-pointer text-xs font-medium">
              {reason.label} · {reason.rowCount.toLocaleString('vi-VN')} dòng
              {reason.keyGroupCount > 0 &&
                ` · ${reason.keyGroupCount.toLocaleString('vi-VN')} nhóm khóa`}
            </summary>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Mã nguyên nhân: <code>{reason.code}</code>. Đang hiển thị{' '}
              {reason.samples.length} bản ghi mẫu.
            </p>
            {reason.samples.map((sample, index) => {
              const fields = [
                ...new Set([
                  ...Object.keys(sample.raw),
                  ...Object.keys(sample.normalized),
                ]),
              ]
              return (
                <article
                  key={index}
                  className="mt-3 rounded-lg bg-muted/40 p-2"
                >
                  <p className="text-[11px] font-medium">
                    {sample.sourceFile} · Bản ghi nguồn {sample.sourceRecord}
                    {sample.sourceRow == null
                      ? ' · Dòng vật lý chưa có'
                      : ` · Dòng nguồn ${sample.sourceRow}`}
                  </p>
                  <div className="mt-2 max-h-64 overflow-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead>
                        <tr>
                          <th className="p-1">Trường</th>
                          <th className="p-1">Giá trị gốc</th>
                          <th className="p-1">Sau chuẩn hóa</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fields.map((field) => (
                          <tr key={field}>
                            <th className="p-1 font-medium">{field}</th>
                            <td
                              className="break-all p-1 whitespace-pre-wrap"
                              data-technical="true"
                            >
                              {Object.hasOwn(sample.raw, field)
                                ? (sample.raw[field] ?? 'NULL')
                                : '—'}
                            </td>
                            <td
                              className="break-all p-1 whitespace-pre-wrap"
                              data-technical="true"
                            >
                              {Object.hasOwn(sample.normalized, field)
                                ? (sample.normalized[field] ?? 'NULL')
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>
              )
            })}
          </details>
        ))}
      </div>
    </section>
  )
}
