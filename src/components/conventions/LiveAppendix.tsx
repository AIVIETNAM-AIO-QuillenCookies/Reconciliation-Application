import { useId, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, GitBranch, ListFilter } from 'lucide-react'
import { vi } from '@/lib/i18n'
import { money } from '@/lib/dashboard-format'
import {
  selectExcelReference,
  type ExcelReferenceWorkbook,
} from '@/lib/excel-reference'
import {
  buildWaterfall,
  type ReconciliationPeriod,
  type ReconciliationResult,
} from '@/lib/reconciliation-types'
import type { RunEvidence } from '@/lib/reconciliation-evidence'
import { methodologyRules } from '@/lib/methodology'
import { APP_CONVENTION_VALUES } from '@/lib/convention-document'

const NO_DATA = 'Chưa có dữ liệu tương ứng trong file tham chiếu.'

function centsText(cents: number | bigint) {
  const value = BigInt(cents)
  const absolute = value < 0n ? -value : value
  return `${value < 0n ? '−' : ''}${(absolute / 100n).toLocaleString('vi-VN')},${(absolute % 100n).toString().padStart(2, '0')}`
}

function LiveFigure({
  number,
  caption,
  children,
  source,
}: {
  number: number
  caption: string
  children: ReactNode
  source?: ReactNode
}) {
  const id = useId()
  return (
    <figure className="cd-figure" aria-labelledby={id}>
      <figcaption id={id} className="cd-figcaption">
        <span className="cd-caption-number">Bảng {number}.</span> {caption}
      </figcaption>
      <div className="cd-table-wrap">{children}</div>
      {source && <p className="cd-source">Nguồn: {source}</p>}
    </figure>
  )
}

export function ExcelAppendix({
  workbook,
  period,
  firstTable,
}: {
  workbook: ExcelReferenceWorkbook
  period: ReconciliationPeriod
  firstTable: number
}) {
  const selected = selectExcelReference(workbook, period)
  const passed = selected.checks.filter((check) => check.passed).length
  const failed = selected.checks.filter((check) => !check.passed)
  const tolerance = `${money(workbook.toleranceUSD)} USD`
  const range = selected.months.length
    ? `${selected.months[0]} → ${selected.months.at(-1)}`
    : 'không có tháng hợp lệ'
  const checkTable = (rows: typeof selected.checks) => (
    <table className="cd-table cd-compact">
      <colgroup>
        <col />
        <col style={{ width: '11%' }} />
        <col style={{ width: '17%' }} />
        <col style={{ width: '17%' }} />
        <col style={{ width: '13%' }} />
        <col style={{ width: '13%' }} />
      </colgroup>
      <thead>
        <tr>
          <th scope="col">Kiểm tra</th>
          <th scope="col">Kỳ</th>
          <th scope="col" className="num">
            Đọc / tính được
          </th>
          <th scope="col" className="num">
            Đối chiếu
          </th>
          <th scope="col" className="num">
            Chênh lệch
          </th>
          <th scope="col">Kết quả</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((check) => (
          <tr key={check.id}>
            <td>{check.label}</td>
            <td>{check.month ?? 'Cả năm'}</td>
            <td className="num">
              {check.unit === 'records'
                ? `${check.actualUSD} bản ghi`
                : money(check.actualUSD)}
            </td>
            <td className="num">
              {check.unit === 'records'
                ? `${check.expectedUSD} bản ghi`
                : money(check.expectedUSD)}
            </td>
            <td className="num">
              {check.unit === 'records'
                ? check.differenceUSD
                : money(check.differenceUSD)}
            </td>
            <td>
              <span
                className="cd-badge"
                data-status={check.passed ? 'match' : 'differs'}
              >
                {check.passed ? 'Khớp' : 'Cần kiểm tra'}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
  return (
    <div className="cd-live">
      <p className="cd-paragraph">
        Phần này đọc trực tiếp từ workbook{' '}
        <code className="cd-code">{workbook.fileName}</code> đang dùng và kỳ xem
        thử đã chọn; nội dung không chỉnh sửa trong tài liệu.
      </p>
      <LiveFigure
        number={firstTable}
        caption="Ba bảng của workbook tham chiếu"
        source={<code className="cd-code">{workbook.fileName}</code>}
      >
        <table className="cd-table">
          <colgroup>
            <col style={{ width: '22%' }} />
            <col style={{ width: '15%' }} />
            <col />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Sheet</th>
              <th scope="col" className="num">
                Quy mô
              </th>
              <th scope="col">Nội dung và cách đọc</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">
                <code className="cd-code">Cau_noi</code>
              </th>
              <td className="num">{workbook.bridgeRows.length} dòng</td>
              <td>
                12 tháng và Cả năm. Phân biệt tổng Sales, điều chỉnh, tổng cầu
                nối, Finance và kiểm tra. Giữ nguyên tên và dấu; chỉ cộng các
                tháng trong kỳ.
              </td>
            </tr>
            <tr>
              <th scope="row">
                <code className="cd-code">Nhat_ky_ngoai_le</code>
              </th>
              <td className="num">{workbook.exceptions.length} ngoại lệ</td>
              <td>
                Giữ nguyên mã, mô tả, ảnh hưởng USD, phạm vi kỳ, phân loại,
                hướng xử lý, người phụ trách và trạng thái. Ngoại lệ không tự
                trở thành hồ sơ đã giải quyết.
              </td>
            </tr>
            <tr>
              <th scope="row">
                <code className="cd-code">Chi_tiet</code>
              </th>
              <td className="num">
                {workbook.details.length.toLocaleString('vi-VN')} dòng
              </td>
              <td>
                Liên kết khoản mục qua <code className="cd-code">Ma_khoan</code>{' '}
                và tháng khi xác định được quan hệ. Giữ{' '}
                <code className="cd-code">Ma_giao_dich</code>,{' '}
                <code className="cd-code">Dong_nguon</code> và các cột tiền/tỷ
                giá riêng biệt.
              </td>
            </tr>
          </tbody>
        </table>
      </LiveFigure>
      <p className="cd-paragraph">
        Số liệu cầu nối đã là USD. Không quy đổi FX thêm; chỉ làm tròn theo tiền
        tệ khi hiển thị. Cột Cả năm chỉ dùng đối chiếu, không cộng vào 12 tháng.
        Bảng giao dịch Raw và đối soát đầy đủ theo cửa hàng/ngày: {NO_DATA}
      </p>
      <p className="cd-paragraph">
        Kiểm tra số học trong kỳ {range}:{' '}
        <strong>
          {passed}/{selected.checks.length} khớp
        </strong>{' '}
        với sai số {tolerance}. Sales Flash cộng các khoản điều chỉnh được so
        với Finance từng tháng và cả năm; chênh lệch thực tế được hiển thị,
        không tạo khoản cân bằng.
      </p>
      {failed.length > 0 && (
        <LiveFigure
          number={firstTable + 1}
          caption="Kiểm tra số học cần xem lại trong kỳ"
          source={<code className="cd-code">{workbook.fileName}</code>}
        >
          {checkTable(failed)}
        </LiveFigure>
      )}
      {selected.checks.length > 0 && (
        <details className="cd-details">
          <summary>Xem toàn bộ {selected.checks.length} kiểm tra</summary>
          <div className="cd-table-wrap">{checkTable(selected.checks)}</div>
        </details>
      )}
      <nav className="cd-live-links" aria-label="Xem dữ liệu workbook">
        <Link to="/processing?sheet=Cau_noi">
          Xem ba bảng nguồn <ArrowRight size={14} aria-hidden="true" />
        </Link>
        <Link to="/">
          Xem cầu nối <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </nav>
    </div>
  )
}

export function RawAppendix({
  period,
  evidence,
  result,
  statusText,
  firstTable,
  onOpenTab,
}: {
  period: ReconciliationPeriod
  evidence?: RunEvidence
  result: ReconciliationResult | null
  statusText: string
  firstTable: number
  onOpenTab: (tab: 'pipeline' | 'rules') => void
}) {
  const counts = {
    implemented: methodologyRules.filter(
      (rule) => rule.implementation === 'implemented',
    ).length,
    reference: methodologyRules.filter(
      (rule) => rule.implementation === 'reference',
    ).length,
    unsupported: methodologyRules.filter(
      (rule) => rule.implementation === 'unsupported',
    ).length,
  }
  const run = result?.cents && evidence ? buildWaterfall(result) : null
  return (
    <div className="cd-live">
      <p className="cd-paragraph">
        Phần này đọc trực tiếp từ phiên làm việc Raw hiện tại; nội dung không
        chỉnh sửa trong tài liệu. Kết quả tính toán dùng quy tắc đã triển khai
        trong chương trình, không đọc từ tài liệu này.
      </p>
      <LiveFigure number={firstTable} caption="Trạng thái áp dụng trong phiên">
        <table className="cd-table">
          <colgroup>
            <col style={{ width: '30%' }} />
            <col />
          </colgroup>
          <tbody>
            <tr>
              <th scope="row">Kỳ báo cáo</th>
              <td>
                {period.start} → {period.end}
              </td>
            </tr>
            <tr>
              <th scope="row">Lần chạy</th>
              <td>{statusText}</td>
            </tr>
            <tr>
              <th scope="row">Danh mục quy tắc</th>
              <td>
                {counts.implemented} đã triển khai · {counts.reference} chỉ tham
                chiếu · {counts.unsupported} chưa hỗ trợ
              </td>
            </tr>
            <tr>
              <th scope="row">Nhóm cầu nối Raw</th>
              <td>
                Chiết khấu, Đơn hủy, Lệch thời điểm, Hàng trả, Lỗi dữ liệu; phần
                còn lại là Chưa giải thích. Tỷ giá, phí vận chuyển, chuyển kênh
                và làm tròn chưa được tách riêng.
              </td>
            </tr>
            <tr>
              <th scope="row">Bộ lọc Nhật ký ngoại lệ</th>
              <td>
                |nguồn − GL| &gt;{' '}
                {APP_CONVENTION_VALUES.exceptionLogAmountUSD.toLocaleString(
                  'vi-VN',
                )}{' '}
                USD theo mặc định; không xét điều kiện phần trăm.
              </td>
            </tr>
          </tbody>
        </table>
      </LiveFigure>
      {run ? (
        <LiveFigure
          number={firstTable + 1}
          caption="Cầu nối của lần chạy hiện tại (USD)"
          source={`lần chạy ${evidence!.runId.slice(0, 8)}, số nguyên cent`}
        >
          <table className="cd-table cd-bridge">
            <colgroup>
              <col />
              <col style={{ width: '26%' }} />
              <col style={{ width: '26%' }} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">Khoản</th>
                <th scope="col" className="num">
                  Tác động / tổng
                </th>
                <th scope="col" className="num">
                  Lũy kế
                </th>
              </tr>
            </thead>
            <tbody>
              {run.map((step) => (
                <tr
                  key={step.key}
                  className={
                    step.key === 'Flash_Sales' || step.key === 'GL_Finance'
                      ? 'is-total'
                      : undefined
                  }
                >
                  <th scope="row">{vi(step.label)}</th>
                  <td className="num">{centsText(step.amountCents)}</td>
                  <td className="num">{centsText(step.endCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </LiveFigure>
      ) : (
        <p className="cd-paragraph cd-placeholder">
          Chưa có lần chạy thành công; tài liệu không suy ra số liệu cầu nối,
          trạng thái đạt/không đạt hay số dòng bị ảnh hưởng.
        </p>
      )}
      <div className="cd-live-links">
        <button type="button" onClick={() => onOpenTab('pipeline')}>
          <GitBranch size={14} aria-hidden="true" />
          Mở sơ đồ pipeline
        </button>
        <button type="button" onClick={() => onOpenTab('rules')}>
          <ListFilter size={14} aria-hidden="true" />
          Mở danh mục quy tắc
        </button>
      </div>
    </div>
  )
}
