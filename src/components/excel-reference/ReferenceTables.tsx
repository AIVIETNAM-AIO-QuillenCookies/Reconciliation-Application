import { useMemo, useState } from 'react'
import { Table2 } from 'lucide-react'
import { InformationNote } from '@/components/PageInformation'
import { selectExcelReference } from '@/lib/excel-reference'
import { NO_DATA } from './reference-format'
import {
  ReferenceHeading,
  ReferencePeriodControl,
  SourceTable,
  type ReferenceSheetName,
  type ReferenceViewProps,
} from './ReferencePrimitives'

const sheetLabels: Record<ReferenceSheetName, string> = {
  Cau_noi: 'Cầu nối doanh thu',
  Nhat_ky_ngoai_le: 'Nhật ký ngoại lệ',
  Chi_tiet: 'Chi tiết giao dịch',
}

export function ReferenceTables({
  sheet = 'Cau_noi',
  ...props
}: ReferenceViewProps & { sheet?: ReferenceSheetName }) {
  const { workbook, period } = props
  const [activeSheet, setActiveSheet] = useState<ReferenceSheetName>(sheet)
  const selected = useMemo(
    () => selectExcelReference(workbook, period),
    [workbook, period],
  )
  const data = workbook.sheets[activeSheet]
  const rows =
    activeSheet === 'Cau_noi'
      ? selected.bridgeRows
      : activeSheet === 'Nhat_ky_ngoai_le'
        ? selected.exceptions
        : selected.details
  const columns =
    activeSheet === 'Cau_noi'
      ? data.columns.filter(
          (column) =>
            !/^\d{4}-\d{2}$/.test(column) || selected.months.includes(column),
        )
      : data.columns
  return (
    <div className="excel-reference-view viewport-workspace reference-processing">
      <ReferenceHeading
        title="Xử lý dữ liệu & xem bảng"
        description="Dùng kết quả Excel; ba bảng tham chiếu được đọc trực tiếp từ workbook."
        eyebrow="KHÔNG GIAN DỮ LIỆU"
        icon={<Table2 size={23} />}
        showBadge={false}
      />
      <ReferencePeriodControl {...props} />
      <section className="excel-reference-panel">
        <div className="excel-reference-panel-heading">
          <div>
            <h2>{sheetLabels[activeSheet]}</h2>
            <InformationNote title="Nguồn bảng đang xem">
              {workbook.fileName} · {activeSheet} ·{' '}
              {rows.length.toLocaleString('vi-VN')} bản ghi trong kỳ
            </InformationNote>
          </div>
          <div
            className="excel-reference-tabs reference-sheet-tabs"
            aria-label="Sheet tham chiếu"
          >
            {(['Cau_noi', 'Nhat_ky_ngoai_le', 'Chi_tiet'] as const).map(
              (name) => (
                <button
                  type="button"
                  key={name}
                  aria-label={name}
                  title={name}
                  aria-pressed={activeSheet === name}
                  onClick={() => setActiveSheet(name)}
                >
                  <span className="reference-sheet-label">
                    {sheetLabels[name]}
                  </span>
                </button>
              ),
            )}
          </div>
        </div>
        <SourceTable
          key={`${activeSheet}-${period.start}-${period.end}`}
          columns={columns}
          rows={rows}
          label={`Bảng ${activeSheet} từ ${workbook.fileName}`}
          sheet={activeSheet}
        />
      </section>
      <InformationNote title="Cách đọc dữ liệu nguồn">
        <p>
          Chi_tiet giữ từng cột USD, USD_bao_cao, USD_chinh_xac và các cột tỷ
          giá để truy vết. Các cột này thể hiện các cách tính khác nhau và không
          được cộng lẫn. Dòng Excel là vị trí thực tế trong sheet. Cả năm là số
          đối chiếu của workbook.
        </p>
      </InformationNote>
      {!workbook.dashboard && (
        <InformationNote title="Phạm vi giao dịch và đối soát">
          <strong>Giao dịch Raw / đối soát cửa hàng–ngày:</strong> {NO_DATA}
        </InformationNote>
      )}
    </div>
  )
}
