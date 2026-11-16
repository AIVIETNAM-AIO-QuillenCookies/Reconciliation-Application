import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  CalendarDays,
  FileSearch,
  ListFilter,
  Search,
  TriangleAlert,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InformationNote } from '@/components/PageInformation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { selectExcelReference } from '@/lib/excel-reference'
import { cell, money, monthEnd, statusTone } from './reference-format'
import {
  ReferenceHeading,
  ReferencePeriodControl,
  ReferenceStat,
  type ReferenceViewProps,
} from './ReferencePrimitives'

export function ReferenceExceptions(props: ReferenceViewProps) {
  const { workbook, period: sharedPeriod } = props
  const [params, setParams] = useSearchParams()
  const requestedReturn = params.get('returnTo')
  const dashboardReturn =
    requestedReturn === '/' || requestedReturn?.startsWith('/?')
      ? requestedReturn
      : null
  const localScope = !!dashboardReturn || params.has('from') || params.has('to')
  const startMonth = params.get('from') ?? sharedPeriod.start.slice(0, 7)
  const endMonth = params.get('to') ?? sharedPeriod.end.slice(0, 7)
  const validScope =
    workbook.months.includes(startMonth) &&
    workbook.months.includes(endMonth) &&
    startMonth <= endMonth
  const period = useMemo(
    () =>
      localScope && validScope
        ? { start: `${startMonth}-01`, end: monthEnd(endMonth) }
        : sharedPeriod,
    [localScope, validScope, startMonth, endMonth, sharedPeriod],
  )
  const viewProps: ReferenceViewProps = {
    ...props,
    period,
    setPeriod: localScope
      ? (next) =>
          setParams(
            (previous) => {
              previous.set('from', next.start.slice(0, 7))
              previous.set('to', next.end.slice(0, 7))
              return previous
            },
            { replace: true },
          )
      : props.setPeriod,
  }
  const selected = useMemo(
    () => selectExcelReference(workbook, period),
    [workbook, period],
  )
  const [query, setQuery] = useState('')
  const selectedId = params.get('id')
  const setSelectedId = (id: string | null) =>
    setParams(
      (previous) => {
        if (id) previous.set('id', id)
        else previous.delete('id')
        return previous
      },
      { replace: true },
    )
  const rows = selected.exceptions.filter((row) =>
    [
      row.id,
      row.description,
      row.owner,
      row.category,
      row.status,
      row.periodLabel,
    ]
      .join(' ')
      .toLocaleLowerCase('vi-VN')
      .includes(query.toLocaleLowerCase('vi-VN')),
  )
  const detail = selected.exceptions.find((row) => row.id === selectedId)
  const countCategory = (pattern: RegExp) =>
    selected.exceptions.filter((row) => pattern.test(row.category)).length
  const evidenceCount = selected.exceptions.filter((row) =>
    /chứng từ|evidence/i.test(row.status),
  ).length
  return (
    <div className="excel-reference-view viewport-workspace reference-exceptions">
      <ReferenceHeading
        title="Nhật ký ngoại lệ"
        description="Ngoại lệ tham chiếu từ Excel; trạng thái giữ nguyên theo workbook."
        eyebrow="THEO DÕI ĐỐI SOÁT"
        icon={<ListFilter size={23} />}
        showBadge={false}
      />
      {dashboardReturn && (
        <Button asChild variant="outline" size="sm" className="w-fit">
          <Link to={dashboardReturn}>Quay lại dashboard</Link>
        </Button>
      )}
      <ReferencePeriodControl {...viewProps} />
      <section
        className="reference-stat-grid"
        aria-label="Tóm tắt ngoại lệ trong kỳ"
      >
        <ReferenceStat
          label="Ngoại lệ trong kỳ"
          value={selected.exceptions.length}
          hint={`${workbook.exceptions.length} ngoại lệ trong toàn bộ workbook`}
          icon={<ListFilter size={18} />}
        />
        <ReferenceStat
          label="Lỗi dữ liệu"
          value={countCategory(/lỗi dữ liệu/i)}
          hint="Theo phân loại trong Excel"
          icon={<TriangleAlert size={18} />}
          tone="red"
        />
        <ReferenceStat
          label="Quy tắc ghi nhận"
          value={countCategory(/quy tắc/i)}
          hint="Các khác biệt về cơ sở ghi nhận"
          icon={<CalendarDays size={18} />}
          tone="slate"
        />
        <ReferenceStat
          label="Cần chứng từ"
          value={evidenceCount}
          hint="Theo trạng thái của ngoại lệ"
          icon={<FileSearch size={18} />}
          tone="amber"
        />
      </section>
      {localScope && validScope && (
        <InformationNote title="Phạm vi truy vết">
          Kỳ truy vết được lọc riêng trong nhật ký này; kỳ xem thử Excel và dữ
          liệu Raw được giữ nguyên.
        </InformationNote>
      )}
      {localScope && !validScope && (
        <p className="excel-reference-notice" role="status">
          Kỳ trong liên kết không hợp lệ; đang hiển thị kỳ xem thử Excel hiện
          tại. Chọn lại kỳ truy vết tại đây.
        </p>
      )}
      {selectedId && !detail && (
        <p className="excel-reference-notice" role="status">
          {workbook.exceptions.some((row) => row.id === selectedId)
            ? `Ngoại lệ ${selectedId} nằm ngoài kỳ đang chọn. Hãy mở rộng kỳ truy vết để xem đúng bản ghi.`
            : `Không tìm thấy ngoại lệ ${selectedId} trong workbook đang chọn.`}
        </p>
      )}
      <InformationNote title="Ngoại lệ Excel và hồ sơ Raw">
        Hồ sơ rà soát Raw, ghi chú, bằng chứng và quyết định thủ công được giữ
        nguyên. Nhật ký tham chiếu không xác nhận hoặc đóng các hồ sơ đó.
      </InformationNote>
      <section className="excel-reference-panel">
        <div className="excel-reference-panel-heading">
          <div>
            <h2>{rows.length} ngoại lệ trong kỳ</h2>
            <InformationNote title="Nguồn nhật ký ngoại lệ">
              {workbook.fileName} · Nhat_ky_ngoai_le
            </InformationNote>
          </div>
          <Link
            className="text-xs text-primary underline underline-offset-2"
            to="/processing?sheet=Nhat_ky_ngoai_le"
          >
            Xem bảng nguồn
          </Link>
        </div>
        <div className="excel-reference-toolbar">
          <label className="reference-search-field">
            <Search size={16} aria-hidden="true" />
            <span className="sr-only">Tìm ngoại lệ</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Mã, mô tả, người phụ trách…"
            />
          </label>
          <span className="reference-table-count">
            {rows.length} / {selected.exceptions.length} ngoại lệ · Chỉ xem
          </span>
        </div>
        <div
          className="excel-reference-scroll"
          role="region"
          aria-label="Ngoại lệ tham chiếu Excel"
          tabIndex={0}
        >
          {rows.length ? (
            <table className="excel-reference-table reference-table-exceptions">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Mô tả</th>
                  <th className="numeric">Ảnh hưởng · USD</th>
                  <th>Kỳ trong Excel</th>
                  <th>Phân loại</th>
                  <th>Hướng xử lý</th>
                  <th>Người phụ trách</th>
                  <th>Trạng thái Excel</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <button
                        type="button"
                        className="excel-reference-row-button reference-record-id"
                        data-tour={`reference-exception-open-${row.id}`}
                        onClick={() => setSelectedId(row.id)}
                      >
                        {row.id}
                      </button>
                    </td>
                    <td className="min-w-64">{row.description}</td>
                    <td
                      className={`numeric ${row.impactUSD < 0 ? 'reference-amount-negative' : row.impactUSD > 0 ? 'reference-amount-positive' : ''}`}
                      title={String(row.impactUSD)}
                    >
                      {money(row.impactUSD)}
                    </td>
                    <td className="whitespace-nowrap">{row.periodLabel}</td>
                    <td>{row.category}</td>
                    <td className="min-w-56">{row.resolution}</td>
                    <td>{row.owner}</td>
                    <td>
                      <span
                        className={`excel-reference-status reference-status-${statusTone(row.status)}`}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="excel-reference-empty">
              Không có ngoại lệ phù hợp trong kỳ đã chọn.
            </p>
          )}
        </div>
        <InformationNote title="Ngoại lệ nhiều tháng">
          Ngoại lệ nhiều tháng giữ nguyên phạm vi kỳ Excel; ảnh hưởng được giữ
          nguyên, không phân bổ giả định theo tháng.
        </InformationNote>
      </section>
      <Dialog
        open={!!detail}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null)
        }}
      >
        <DialogContent
          closeLabel="Đóng ngoại lệ tham chiếu"
          data-tour="reference-exception-detail"
          data-exception-id={detail?.id}
        >
          <div className="p-5 pr-14">
            <DialogTitle>{detail?.id} · Ngoại lệ tham chiếu</DialogTitle>
            <DialogDescription className="mt-1">
              {workbook.fileName} · Nhat_ky_ngoai_le · Dòng {detail?.sourceRow}
            </DialogDescription>
          </div>
          <div className="excel-reference-scroll">
            <dl className="excel-reference-definitions">
              {detail &&
                workbook.sheets.Nhat_ky_ngoai_le.columns.map((column) => (
                  <div key={column}>
                    <dt>{column}</dt>
                    <dd>{cell(detail.values[column])}</dd>
                  </div>
                ))}
            </dl>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
