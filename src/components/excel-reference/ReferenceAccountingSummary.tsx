import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CheckCheck,
  ClipboardCheck,
  FileSearch,
  FileSpreadsheet,
  ListFilter,
  TriangleAlert,
} from 'lucide-react'
import { InformationNote } from '@/components/PageInformation'
import {
  selectExcelReference,
  type ReferenceSourceRow,
} from '@/lib/excel-reference'
import { money, NO_DATA, statusTone } from './reference-format'
import {
  ReferenceHeading,
  ReferencePeriodControl,
  ReferenceStat,
  SourceTable,
  type ReferenceViewProps,
} from './ReferencePrimitives'

export function ReferenceAccountingSummary(props: ReferenceViewProps) {
  const { workbook, period } = props
  const selected = selectExcelReference(workbook, period)
  const needsEvidence = selected.exceptions.filter((row) =>
    /chứng từ|evidence/i.test(row.status),
  )
  const priority = selected.exceptions.filter((row) =>
    /chứng từ|evidence|chưa giải thích/i.test(`${row.status} ${row.category}`),
  )
  const manuals = workbook.dashboard?.manuals.filter((row) =>
    selected.months.includes(row.period),
  )
  const manualRows: ReferenceSourceRow[] = (manuals ?? []).map((row) => ({
    sourceRow: row.sourceRow,
    values: {
      'Mã bút toán': row.journalId,
      'Ngày ghi sổ': row.postingDate,
      Kênh: row.channel,
      'Doanh thu (USD)': row.revenueUSD,
      'Diễn giải': row.description,
      'Tham chiếu': row.sourceRef,
      Source_Sheet: row.sourceSheet,
    },
  }))
  const matches = Math.abs(selected.bridgeResidualUSD) <= workbook.toleranceUSD
  return (
    <div className="excel-reference-view viewport-workspace reference-accounting">
      <ReferenceHeading
        title="Rà soát kế toán"
        description="Theo dõi bút toán tay, khoản chưa giải thích và chứng từ cần bổ sung."
        eyebrow="KHÔNG GIAN KẾ TOÁN"
        icon={<ClipboardCheck size={23} />}
        showBadge={false}
      />
      <ReferencePeriodControl {...props} />
      <section
        className="reference-stat-grid"
        aria-label="Tóm tắt rà soát kế toán"
      >
        <ReferenceStat
          label="Chưa giải thích trong kỳ"
          value={money(selected.available ? selected.unexplainedUSD : null)}
          hint="Khoản chưa giải thích theo cầu nối"
          icon={<TriangleAlert size={18} />}
          tone="red"
        />
        <ReferenceStat
          label="Ngoại lệ trong kỳ"
          value={selected.exceptions.length}
          hint={`${workbook.exceptions.length} ngoại lệ trong toàn bộ workbook`}
          icon={<ListFilter size={18} />}
          tone="slate"
        />
        <ReferenceStat
          label="Bút toán tay"
          value={manuals ? manuals.length : '—'}
          hint="Journal MANUAL trong GL chuẩn hóa"
          icon={<ClipboardCheck size={18} />}
        />
        <ReferenceStat
          label="Chênh lệch số học cầu nối"
          value={money(selected.available ? selected.bridgeResidualUSD : null)}
          hint={`Ngưỡng ${money(workbook.toleranceUSD)} · ${matches ? 'Khớp số học' : 'Cần kiểm tra'}`}
          icon={<CheckCheck size={18} />}
          tone={matches ? 'forest' : 'amber'}
        />
      </section>
      <InformationNote title="Hồ sơ và quyết định kế toán">
        Hồ sơ, ghi chú, bằng chứng và quyết định thủ công của luồng Raw vẫn được
        giữ nguyên. Tắt xem thử để tiếp tục rà soát các hồ sơ thực tế.
      </InformationNote>
      <div className="reference-review-layout">
        <section
          className="excel-reference-panel reference-review-main"
          aria-label="Bút toán tay tham chiếu Excel"
        >
          <div className="excel-reference-panel-heading">
            <div>
              <h2>Bút toán tay và tham chiếu</h2>
              <InformationNote title="Bút toán tay và chứng từ">
                Số tiền theo dấu doanh thu · Mã tham chiếu chưa xác nhận đủ
                chứng từ.
              </InformationNote>
            </div>
            <span className="reference-table-count">
              {manuals ? `${manuals.length} bút toán` : 'Chưa có bảng GL'}
            </span>
          </div>
          {manuals ? (
            <SourceTable
              key={`manuals-${period.start}-${period.end}`}
              sheet="manuals"
              label="Danh sách bút toán tay trong workbook"
              columns={[
                'Mã bút toán',
                'Ngày ghi sổ',
                'Kênh',
                'Doanh thu (USD)',
                'Diễn giải',
                'Tham chiếu',
              ]}
              rows={manualRows}
            />
          ) : (
            <div className="reference-empty-card">
              <FileSpreadsheet size={28} aria-hidden="true" />
              <strong>Workbook này chưa có bảng bút toán tay</strong>
              <p>
                {NO_DATA} Có thể xem các giao dịch và dòng nguồn trong bảng
                Chi_tiet.
              </p>
              <Link
                to="/processing?sheet=Chi_tiet"
                className="excel-reference-row-button"
              >
                Xem Chi_tiet <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </section>
        <aside
          className="excel-reference-panel reference-review-aside"
          aria-label="Ngoại lệ cần xem xét"
        >
          <div className="excel-reference-panel-heading">
            <div>
              <h2>Chưa giải thích & chứng từ</h2>
              <InformationNote title="Ngoại lệ cần chứng từ">
                {needsEvidence.length} ngoại lệ có trạng thái cần chứng từ
              </InformationNote>
            </div>
            <FileSearch size={20} aria-hidden="true" />
          </div>
          <div className="reference-case-list">
            {priority.map((row) => (
              <Link
                className="reference-case-card"
                key={row.id}
                to={`/exceptions?id=${encodeURIComponent(row.id)}`}
              >
                <div>
                  <span className="reference-record-id">{row.id}</span>
                  <strong>{money(row.impactUSD)}</strong>
                </div>
                <p>{row.description}</p>
                <span
                  className={`excel-reference-status reference-status-${statusTone(row.status)}`}
                >
                  {row.status}
                </span>
                <div className="reference-case-meta">
                  {row.owner} · {row.periodLabel}
                </div>
              </Link>
            ))}
            {!priority.length && (
              <div className="reference-empty-card">
                <CheckCheck size={26} aria-hidden="true" />
                <p>
                  Không có ngoại lệ mang trạng thái cần chứng từ hoặc chưa giải
                  thích trong kỳ đã chọn.
                </p>
              </div>
            )}
          </div>
          <InformationNote title="Số học và bằng chứng kế toán">
            Cầu nối khớp về số học không có nghĩa đã đủ bằng chứng kế toán. Các
            ngoại lệ cần chứng từ vẫn giữ nguyên trạng thái Excel.
          </InformationNote>
          <div className="excel-reference-footer">
            <Link
              className="inline-flex items-center gap-1 text-primary underline underline-offset-2"
              to="/exceptions"
            >
              Xem ngoại lệ tham chiếu <ArrowRight size={13} />
            </Link>
          </div>
        </aside>
      </div>
      <InformationNote title="Bổ sung bằng chứng và quyết định">
        {workbook.dashboard
          ? 'Để bổ sung bằng chứng và ghi nhận quyết định rà soát, quay lại luồng Raw.'
          : `Chi tiết hồ sơ và quyết định GL thực tế: ${NO_DATA}`}
      </InformationNote>
    </div>
  )
}
