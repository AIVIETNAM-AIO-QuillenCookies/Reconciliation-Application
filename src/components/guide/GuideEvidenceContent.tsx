import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'
import {
  guideTableRows,
  type GuideSample,
  type GuideCell,
} from '@/lib/guide-sample'

const tableGroups: Record<string, string[]> = {
  raw: ['01a_Nguon_POS', '01b_Nguon_WEB', '01c_Nguon_GL', '01d_Nguon_Flash'],
  normalized: [
    '02a_POS_chuan_hoa',
    '02b_Web_chuan_hoa',
    '02c_GL_chuan_hoa',
    '02d_Flash_chuan_hoa',
  ],
  duplicates: ['03c_POS_Dong_trung'],
  joins: [
    '01e_Master_Cua_Hang',
    '01f_Master_Lich',
    '01g_Master_TyGia_Ngay',
    '01h_Master_TyGia_Thang',
  ],
  unified: ['02_Giao_Dich_Chung'],
  qc: [
    'QC_Summary',
    '03a_Doi_soat_Cua_hang',
    '03b_Doi_soat_Online',
    '04c_So_sanh_ty_gia',
  ],
}
const display = (value: GuideCell | undefined) =>
  value === null || value === undefined || value === ''
    ? '—'
    : typeof value === 'number'
      ? value.toLocaleString('vi-VN', { maximumFractionDigits: 8 })
      : String(value)

export function GuideEvidenceContent({
  sample,
  stepId,
  acknowledge,
}: {
  sample: GuideSample
  stepId: string
  acknowledge: (id: string) => void
}) {
  const store = useAppStore()
  const { pathname } = useLocation()
  const [selectedException, setSelectedException] = useState<string | null>(
    null,
  )
  const group = stepId.startsWith('table-')
    ? stepId.slice(6)
    : stepId === 'late'
      ? 'late'
      : 'raw'
  const sheets = tableGroups[group] ?? ['03a_Doi_soat_Cua_hang']
  const [choice, setChoice] = useState('')
  const sheet = sheets.includes(choice) ? choice : sheets[0]
  const [table, setTable] = useState<{
    sheet: string
    headers: string[]
    rows: GuideCell[][]
    total: number
  } | null>(null)
  const [tableError, setTableError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  useEffect(() => {
    setQuery('')
    setChoice('')
  }, [stepId])
  useEffect(() => {
    let cancelled = false
    setTableError(null)
    void guideTableRows(sample, sheet, Number.MAX_SAFE_INTEGER)
      .then((result) => {
        if (cancelled) return
        let rows = result.rows
        if (group === 'duplicates') {
          const index = result.headers.indexOf('store_id')
          rows = rows.filter((row) => String(row[index]) === '74')
        }
        if (group === 'late') {
          const storeIndex = result.headers.indexOf('Store_Key')
          const deltaIndex = result.headers.indexOf('Chenh_Lech_NoiTe')
          rows = rows.filter(
            (row) =>
              String(row[storeIndex]) === '570' &&
              Math.abs(Number(row[deltaIndex])) > 0.1,
          )
        }
        setTable({ sheet, ...result, rows })
      })
      .catch((issue) => {
        if (!cancelled) setTableError(String(issue))
      })
    return () => {
      cancelled = true
    }
  }, [sample, sheet, group])
  if (pathname === '/exceptions') {
    const selected = sample.sourceExceptions.find(
      (row) => row.id === selectedException,
    )
    const lateRecord = store.glReview?.records.find(
      (row) => row.journalId === 'JE20251206231',
    )
    const bridgeAddresses: Record<string, string> = {
      'EX-01': 'O10',
      'EX-02': 'E12',
      'EX-03': 'G13',
      'EX-04': 'J13',
      'EX-05': 'K19',
    }
    const address = selected && bridgeAddresses[selected.id]
    const bridgeValue = address
      ? sample.workbook.Sheets['04a_Cau_noi_Flash_GL'][address]?.v
      : undefined
    const linkedRef =
      selected?.id === 'EX-05'
        ? 'MJ-ADJ-2509'
        : selected?.id === 'EX-07'
          ? 'MJ-RCL-2506'
          : null
    const linkedCase = linkedRef
      ? store.reviewCases.find((item) =>
          item.recordIds.some((id) =>
            store.glReview?.records.some(
              (row) => row.id === id && row.sourceRef === linkedRef,
            ),
          ),
        )
      : undefined
    return (
      <section
        className="guide-evidence-panel mb-5"
        data-tour="guide-source-exceptions"
      >
        <header>
          <div>
            <p className="guide-eyebrow">
              05_Nhat_ky_ngoai_le · {sample.file.name}
            </p>
            <h2>7 ngoại lệ gốc của workbook</h2>
            <p>
              Nội dung và trạng thái nguồn được giữ nguyên. Nhật ký này liên kết
              đến hồ sơ hiện có, không tạo bản ghi ngoại lệ mới.
            </p>
          </div>
        </header>
        <div className="guide-evidence-scroll">
          <table>
            <thead>
              <tr>
                <th>Mã</th>
                <th>Mô tả</th>
                <th>Ảnh hưởng tham chiếu (USD)</th>
                <th>Kỳ</th>
                <th>Phụ trách</th>
                <th>Trạng thái Excel</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sample.sourceExceptions.map((row) => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>{row.description}</td>
                  <td>{display(row.impactUSD)}</td>
                  <td>{row.periodLabel}</td>
                  <td>{row.owner}</td>
                  <td>{row.status}</td>
                  <td>
                    <Button
                      size="sm"
                      variant="outline"
                      data-tour={`guide-exception-${row.id}`}
                      onClick={() => {
                        setSelectedException(row.id)
                        if (row.id === 'EX-06') acknowledge('late')
                      }}
                    >
                      Mở hồ sơ
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {selected && (
          <div
            className="guide-evidence-detail"
            data-tour="guide-exception-detail"
          >
            <h3>
              {selected.id} · {selected.status}
            </h3>
            <dl>
              {Object.entries(selected.values).map(([key, value]) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>{display(value)}</dd>
                </div>
              ))}
            </dl>
            {address && typeof bridgeValue === 'number' && (
              <p>
                Số nhật ký tham chiếu: {display(selected.impactUSD)} USD. Số đối
                chiếu từ kết quả công thức Excel 04a_Cau_noi_Flash_GL!{address}:{' '}
                {display(bridgeValue)} USD. Giữ nguyên sai khác do phạm vi hoặc
                làm tròn; đây chưa phải phép tính lại của Raw.
              </p>
            )}
            <p>
              Liên kết hiện có:{' '}
              {linkedCase ? (
                <Link
                  className="text-primary underline"
                  to={`/accounting-review?case=${encodeURIComponent(linkedCase.id)}`}
                >
                  Mở hồ sơ {linkedRef}
                </Link>
              ) : selected.id === 'EX-06' && lateRecord ? (
                <Link
                  className="text-primary underline"
                  to={`/accounting-review?record=${encodeURIComponent(lateRecord.id)}`}
                >
                  Mở {lateRecord.journalId} đã có trong GL
                </Link>
              ) : (
                'Đối chiếu bảng nguồn và ngoại lệ do pipeline phát hiện; không thêm dòng trùng.'
              )}
            </p>
            {selected.id === 'EX-06' && (
              <div
                data-tour="guide-late-cells"
                data-cell-count={
                  table?.sheet === '03a_Doi_soat_Cua_hang'
                    ? table.rows.length
                    : 0
                }
              >
                <h3>Hai ô cửa hàng–ngày vẫn lệch</h3>
                <p>
                  POS 21/11/2025 · 570/NX057 · 7.227,56 USD.{' '}
                  {lateRecord
                    ? `${lateRecord.journalId} · ngày ghi ${lateRecord.postingDate} · ${display((lateRecord.revenueCents ?? 0) / 100)} USD.`
                    : 'GL gốc đã có JE20251206231 ngày 02/12/2025.'}{' '}
                  Không thêm catch-up và không đổi ngày nguồn.
                </p>
                <p>
                  Các ô dưới đây từ 03a, đơn vị theo Tien_Te của từng dòng
                  (trường hợp này là USD). Tự bù trong năm, còn ảnh hưởng
                  tháng/ngày.
                </p>
                {table?.sheet === '03a_Doi_soat_Cua_hang' && (
                  <EvidenceTable headers={table.headers} rows={table.rows} />
                )}
              </div>
            )}
          </div>
        )}
      </section>
    )
  }
  const rows =
    table?.rows.filter(
      (row) =>
        !query ||
        row.some((value) =>
          String(value ?? '')
            .toLowerCase()
            .includes(query.toLowerCase()),
        ),
    ) ?? []
  return (
    <section
      className="guide-evidence-panel mb-5"
      data-tour="guide-evidence"
      data-evidence-sheet={table?.sheet}
      data-evidence-ready={table?.sheet === sheet}
    >
      <header>
        <div>
          <p className="guide-eyebrow">ĐỐI CHIẾU WORKBOOK · EXCEL THAM CHIẾU</p>
          <h2>{sheet}</h2>
          <p>
            {table?.total.toLocaleString('vi-VN')} dòng trong sheet · hiển thị
            tối đa 30 dòng mỗi lần tìm kiếm. Các con số đọc từ workbook, chưa
            phải kết quả Raw hoàn chỉnh.
          </p>
        </div>
        <label>
          Sheet bằng chứng
          <select
            data-tour="guide-evidence-sheet"
            value={sheet}
            onChange={(event) => setChoice(event.target.value)}
          >
            {sheets.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
      </header>
      <div className="guide-evidence-tools">
        <label>
          Tìm dòng nguồn
          <input
            data-tour="guide-evidence-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Mã giao dịch, ngày, cửa hàng…"
          />
        </label>
        <span>
          {rows.length.toLocaleString('vi-VN')} dòng trong phạm vi đang xem
        </span>
      </div>
      {group === 'raw' && (
        <p className="px-4 py-2 text-xs">
          POS {sample.evidence.posRows.toLocaleString('vi-VN')} dòng /{' '}
          {sample.evidence.uniquePOSKeys.toLocaleString('vi-VN')} khóa. WEB{' '}
          {sample.evidence.webRows.toLocaleString('vi-VN')} đơn;{' '}
          {sample.evidence.cancelledAll} Cancelled toàn file /{' '}
          {sample.evidence.cancelled2025} theo ngày đặt 2025.
        </p>
      )}
      {group === 'duplicates' && (
        <p className="px-4 py-2 text-xs">
          Đang xem 74/NX007 ngày 29/03. So sánh exported_at, first_export,
          flag_dup và export_seq: bản xuất sớm nhất giữ lại; bản xuất dư không
          cộng doanh thu. Tổng file: 12 nhóm / 24 dòng trong nhóm / 12 bản dư.
          02a vẫn giữ bản lặp để kiểm tra.
        </p>
      )}
      {group === 'qc' && (
        <p className="px-4 py-2 text-xs">
          Có {sample.evidence.qcUnassessed} chỉ tiêu chưa có trạng thái: chưa
          đánh giá. Sai số cầu nối Excel được giữ nguyên; workbook dùng ngưỡng
          0,10 USD, giao diện tham chiếu đang kiểm tra 0,01 USD.
        </p>
      )}
      {group === 'joins' && (
        <div className="px-4 py-2 text-xs">
          {store.mappingDrafts['guide-dim']?.masterValidation?.joins.map(
            (join) => (
              <p key={join.relationshipId}>
                {join.role}: {join.rowsBefore} → {join.rowsAfter} dòng; khóa
                trùng {join.duplicateKeys}; không khớp {join.unmatchedRows}.
              </p>
            ),
          )}
        </div>
      )}
      {tableError ? (
        <p role="alert">{tableError}</p>
      ) : table?.sheet === sheet ? (
        <EvidenceTable headers={table.headers} rows={rows.slice(0, 30)} />
      ) : (
        <p role="status" className="p-4">
          Đang đọc bảng bằng chứng…
        </p>
      )}
    </section>
  )
}
function EvidenceTable({
  headers,
  rows,
}: {
  headers: string[]
  rows: GuideCell[][]
}) {
  return (
    <div className="guide-evidence-scroll">
      <table>
        <thead>
          <tr>
            {headers.map((header, index) => (
              <th key={`${header}-${index}`}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {headers.map((_, column) => (
                <td key={column}>{display(row[column])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
