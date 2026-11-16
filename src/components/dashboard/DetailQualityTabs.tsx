import { Link, useLocation } from 'react-router-dom'
import type { DashboardModel } from '@/lib/dashboard-model'
import { useAppStore } from '@/lib/store'
import { InformationNote } from '@/components/PageInformation'
import { DashboardWidget } from './DashboardWidgets'
import { DataTable, Metric, Missing, TrendChart } from './DetailPrimitives'
import { count, monthLabel, money, ratio } from './detail-format'

export interface DashboardInspection {
  title: string
  description: string
  rows: Record<string, unknown>[]
  links?: { label: string; to: string }[]
}
type TabProps = {
  model: DashboardModel
  onInspect: (selection: DashboardInspection) => void
}
const TEAL = '#148b82'
const SLATE = '#7f93a6'
const ORANGE = '#dd923b'

export function DetailTab({ model, onInspect }: TabProps) {
  const store = useAppStore()
  const location = useLocation()
  const detail = model.detail
  const stores = detail.stores.map((row) => ({ ...row, id: row.storeKey }))
  const exceptionLinks = (ids: string[]) =>
    ids.map((id) => ({
      label: `Mở ngoại lệ ${id}`,
      to: `/exceptions?${new URLSearchParams({ tab: 'differences', q: id, threshold: '0', record: id, from: 'dashboard', returnTo: `${location.pathname}${location.search}` })}`,
    }))
  const relatedRecords = (storeKey: string, date?: string) => {
    const active = store.activeResult
    if (active.source === 'excel' && active.workbook.dashboard) {
      const cells = active.workbook.dashboard.cells.filter(
        (row) =>
          row.storeKey === storeKey &&
          model.selectedMonths.includes(row.date.slice(0, 7)) &&
          (!date || row.date === date),
      )
      return {
        rows: cells.flatMap((row) =>
          row.sources.map((source) => ({
            'Cửa hàng': row.storeKey,
            Ngày: row.date,
            File: active.workbook.fileName,
            Sheet: source.sheetName,
            'Dòng nguồn': source.sourceRow,
            Trường: source.field,
            'POS chuẩn hóa USD (tổng ô)': row.expectedUSD,
            'GL USD (tổng ô)': row.glUSD,
          })),
        ),
        links: [],
        note: 'Truy vết các dòng chuẩn hóa trong workbook Excel; số tổng lấy từ toàn bộ dữ liệu trong phạm vi đã chọn.',
      }
    }
    const snapshot = store.reconciliationData?.glReview ?? store.glReview
    const records =
      model.source === 'raw'
        ? (snapshot?.records ?? []).filter(
            (record) =>
              record.storeKey === storeKey &&
              record.journalType?.startsWith('POS') &&
              !!record.period &&
              model.selectedMonths.includes(record.period) &&
              (!date || record.postingDate === date),
          )
        : []
    const source = store.reconciliationData?.evidence?.tables.find(
      (table) => table.id === 'fact_POS_final',
    )
    const posRows =
      model.source === 'raw'
        ? (source?.rows ?? []).filter(
            (record) =>
              record.store_key === storeKey &&
              !!record.posting_date &&
              model.selectedMonths.includes(record.posting_date.slice(0, 7)) &&
              (!date || record.posting_date === date),
          )
        : []
    return {
      rows: [
        ...records.map((record) => ({
          Loại: 'Bút toán GL POS',
          'Cửa hàng': record.storeKey,
          Ngày: record.postingDate,
          'Mã giao dịch / bút toán': record.journalId,
          'Doanh thu USD':
            record.revenueCents == null ? null : record.revenueCents / 100,
          File: record.fileName,
          Sheet: record.sheetName,
          'Dòng nguồn': record.sourceRow,
          'Tham chiếu': record.sourceRef,
          'Diễn giải': record.description,
        })),
        ...posRows.map((record) => ({
          Loại: 'Giao dịch POS · xem trước nguồn',
          'Cửa hàng': record.store_key,
          Ngày: record.posting_date,
          'Mã giao dịch / bút toán': `${record.receipt_no ?? ''}/${record.line_no ?? ''}`,
          'Doanh thu USD': record.net_usd_month_end,
          File: record.source_file,
          'Dòng nguồn': record.source_row,
          'Thứ tự bản ghi': record.source_record,
        })),
      ],
      links: records.slice(0, 20).map((record) => {
        const review = store.reviewCases.find((item) =>
          item.recordIds.includes(record.id),
        )
        const params = new URLSearchParams({
          record: record.id,
          from: 'dashboard',
          returnTo: `${location.pathname}${location.search}`,
        })
        if (review) params.set('case', review.id)
        return {
          label: `Mở bút toán ${record.journalId ?? record.id}`,
          to: `/accounting-review?${params}`,
        }
      }),
      note: `GL POS: ${records.length} bút toán trong phạm vi đang chọn; snapshot ${snapshot?.complete ? 'đầy đủ' : 'chưa đầy đủ'}. POS: ${posRows.length} dòng xem trước liên quan trên ${source?.rows.length ?? 0} dòng được lưu, ${source?.truncated ? `giới hạn ${source.rows.length}/${source.rowCount} dòng toàn bảng` : 'toàn bộ bảng xem trước đã lưu'}. Dữ liệu xem trước không dùng tính tổng. ${records.length > 20 ? 'Nút mở hồ sơ giới hạn 20 bút toán đầu; bảng giữ toàn bộ bút toán trong phạm vi.' : ''}`,
    }
  }
  return (
    <div
      className="dash-tab-body"
      data-tour="dashboard-detail"
      data-cell-count={detail.cellCount}
    >
      <div className="dash-kpis" data-tour="dashboard-detail-kpis">
        <Metric
          label="Ô cửa hàng × ngày"
          value={count(detail.cellCount)}
          description="Số ô đủ dữ liệu trong kỳ; mỗi ô chỉ đếm một lần."
        />
        <Metric
          label="Ô lệch theo dữ liệu thô"
          value={count(detail.rawCellCount)}
          description="Đếm ô có chênh lệch trước chuẩn hóa, không phải số cửa hàng."
        />
        <Metric
          label="Cửa hàng vượt ngưỡng · trước"
          value={count(detail.beforeThresholdStores)}
          description="Cửa hàng có ít nhất một tháng |Δ| > 200 USD và |Δ/GL| > 1%."
        />
        <Metric
          label="Cửa hàng vượt ngưỡng · sau"
          value={count(detail.afterThresholdStores)}
          description="Kiểm tra từng cửa hàng–tháng sau chuẩn hóa; không bù trừ các tháng."
        />
        <Metric
          label="Chênh lệch online chuẩn hóa"
          value={money(detail.onlineDeltaUSD)}
          unit="USD"
          description="GL − WEB theo ngày giao và ngày trả hàng."
        />
      </div>
      {detail.reason && (
        <InformationNote title="Cơ sở chuẩn hóa và ngưỡng kiểm tra">
          {detail.reason}
        </InformationNote>
      )}
      <div className="dash-grid dash-grid-two dash-detail-layout dash-detail-grid">
        <DashboardWidget
          id="detail-store-trend"
          title="Chênh lệch cửa hàng trước và sau chuẩn hóa"
          subtitle="USD · GL − POS · trong kỳ đang chọn"
        >
          {detail.trend.length ? (
            <TrendChart
              rows={detail.trend}
              series={[
                { key: 'rawDeltaUSD', label: 'Trước chuẩn hóa', color: SLATE },
                {
                  key: 'normalizedDeltaUSD',
                  label: 'Sau chuẩn hóa',
                  color: TEAL,
                },
              ]}
              onMonth={(month) =>
                onInspect({
                  title: `Đối soát cửa hàng · ${monthLabel(month)}`,
                  description:
                    'Tổng chênh lệch tháng = GL − POS. Ngưỡng được kiểm tra riêng tại từng cửa hàng–tháng.',
                  rows: detail.trend
                    .filter((row) => row.month === month)
                    .map((row) => ({
                      Tháng: month,
                      'Chênh lệch thô USD': row.rawDeltaUSD,
                      'Chênh lệch chuẩn hóa USD': row.normalizedDeltaUSD,
                    })),
                })
              }
            />
          ) : (
            <Missing>
              {detail.reason ||
                'Cần bảng POS, GL và dữ liệu chuẩn hóa tại cấp cửa hàng–tháng.'}
            </Missing>
          )}
        </DashboardWidget>
        <DashboardWidget
          id="detail-online-trend"
          title="Online theo cơ sở ngày đặt và ngày ghi nhận"
          subtitle="USD · ngày ghi nhận gồm ngày giao và giảm trừ ngày trả"
        >
          {detail.onlineTrend.length ? (
            <TrendChart
              rows={detail.onlineTrend}
              series={[
                { key: 'orderUSD', label: 'WEB ngày đặt', color: SLATE },
                {
                  key: 'recognizedUSD',
                  label: 'WEB đã chuẩn hóa',
                  color: TEAL,
                },
                { key: 'glUSD', label: 'GL online', color: ORANGE },
              ]}
              onMonth={(month) =>
                onInspect({
                  title: `Online · ${monthLabel(month)}`,
                  description:
                    'Các cơ sở ngày khác nhau được giữ riêng. Δ chuẩn hóa = GL − WEB ghi nhận.',
                  rows: detail.onlineTrend
                    .filter((row) => row.month === month)
                    .map((row) => ({
                      Tháng: row.month,
                      'WEB ngày đặt USD': row.orderUSD,
                      'WEB chuẩn hóa USD': row.recognizedUSD,
                      'GL USD': row.glUSD,
                      'Δ USD': row.deltaUSD,
                    })),
                })
              }
            />
          ) : (
            <Missing>
              Cần bảng WEB_Orders đầy đủ, sự kiện giao/trả và GL có phân bổ kênh
              WEB.
            </Missing>
          )}
        </DashboardWidget>

        <DashboardWidget
          id="detail-stores"
          title="Đối soát theo cửa hàng"
          subtitle="Tổng có dấu và tổng độ lớn giữ riêng · tỷ lệ dùng |GL|"
        >
          <DataTable
            label="bảng cửa hàng"
            rows={stores}
            columns={[
              { key: 'store', label: 'Cửa hàng', value: (row) => row.storeKey },
              {
                key: 'raw',
                label: 'Δ thô · USD',
                value: (row) => row.rawDeltaUSD,
                render: (row) => money(row.rawDeltaUSD),
                numeric: true,
              },
              {
                key: 'normalized',
                label: 'Δ chuẩn hóa · USD',
                value: (row) => row.normalizedDeltaUSD,
                render: (row) => money(row.normalizedDeltaUSD),
                numeric: true,
              },
              {
                key: 'ratio',
                label: 'Δ / |GL|',
                value: (row) => row.ratio,
                render: (row) => ratio(row.ratio),
                numeric: true,
              },
              {
                key: 'magnitude',
                label: 'Σ |Δ tháng| · USD',
                value: (row) => row.magnitudeUSD,
                render: (row) => money(row.magnitudeUSD),
                numeric: true,
              },
              {
                key: 'status',
                label: 'Trạng thái',
                value: (row) => row.status,
              },
            ]}
            onSelect={(row) => {
              const related = relatedRecords(row.storeKey)
              onInspect({
                title: `Cửa hàng ${row.storeKey}`,
                description: `Số tổng cửa hàng không thay thế kiểm tra ngưỡng từng tháng. Chi tiết ô chỉ bao gồm các ô còn lệch. ${related.note}`,
                rows: [
                  ...detail.cells
                    .filter((cell) => cell.storeKey === row.storeKey)
                    .map((cell) => ({
                      Loại: 'Ô đối soát',
                      Ngày: cell.date,
                      'Nguồn USD': cell.expectedUSD,
                      'GL USD': cell.glUSD,
                      'Δ USD': cell.deltaUSD,
                      'Trạng thái': cell.status,
                    })),
                  ...related.rows,
                ],
                links: [...exceptionLinks(row.exceptionIds), ...related.links],
              })
            }}
            empty={detail.reason || 'Không có cửa hàng trong phạm vi đã chọn.'}
          />
        </DashboardWidget>
        <DashboardWidget
          id="detail-cells"
          title="Các ô cửa hàng × ngày còn lệch"
          subtitle="Δ = GL − nguồn · thiếu một bên được biểu diễn riêng"
        >
          <DataTable
            label="ô cửa hàng ngày"
            rows={detail.cells}
            columns={[
              { key: 'store', label: 'Cửa hàng', value: (row) => row.storeKey },
              { key: 'date', label: 'Ngày', value: (row) => row.date },
              {
                key: 'source',
                label: 'Nguồn · USD',
                value: (row) => row.expectedUSD,
                render: (row) => money(row.expectedUSD),
                numeric: true,
              },
              {
                key: 'gl',
                label: 'GL · USD',
                value: (row) => row.glUSD,
                render: (row) => money(row.glUSD),
                numeric: true,
              },
              {
                key: 'delta',
                label: 'Δ · USD',
                value: (row) => row.deltaUSD,
                render: (row) => money(row.deltaUSD),
                numeric: true,
              },
              {
                key: 'status',
                label: 'Trạng thái',
                value: (row) => row.status,
              },
            ]}
            onSelect={(row) => {
              const related = relatedRecords(row.storeKey, row.date)
              onInspect({
                title: `${row.storeKey} · ${row.date}`,
                description: `Đối soát cùng cửa hàng và ngày ghi nhận; không khẳng định liên kết một giao dịch với một journal nếu nguồn không có khóa nối. ${related.note}`,
                rows: [
                  {
                    Loại: 'Ô đối soát',
                    'Cửa hàng': row.storeKey,
                    Ngày: row.date,
                    'Nguồn USD': row.expectedUSD,
                    'GL USD': row.glUSD,
                    'Δ USD': row.deltaUSD,
                    'Trạng thái': row.status,
                  },
                  ...related.rows,
                ],
                links: [...exceptionLinks(row.exceptionIds), ...related.links],
              })
            }}
            empty={
              detail.available
                ? 'Không có ô còn lệch trong kỳ đã chọn.'
                : detail.reason || 'Cần bảng đối soát cửa hàng–ngày đầy đủ.'
            }
          />
        </DashboardWidget>
      </div>
    </div>
  )
}

export function QualityTab({ model, onInspect }: TabProps) {
  const store = useAppStore()
  const location = useLocation()
  const quality = model.quality
  const returnTo = `${location.pathname}${location.search}`
  const raw = store.activeResult.source === 'raw'
  const excel =
    store.activeResult.source === 'excel'
      ? store.activeResult.workbook.dashboard
      : undefined
  const params = new URLSearchParams(location.search)
  const channel = params.get('channel') || 'ALL'
  const manualEntries = raw
    ? (store.glReview?.records || [])
        .filter(
          (row) =>
            row.journalType === 'MANUAL' &&
            !!row.period &&
            model.selectedMonths.includes(row.period) &&
            (channel === 'ALL' || channel === 'all' || row.channel === channel),
        )
        .map((row) => ({
          ...row,
          revenueUSD: row.revenueCents == null ? null : row.revenueCents / 100,
        }))
    : (excel?.manuals ?? []).filter(
        (row) =>
          model.selectedMonths.includes(row.period) &&
          (channel === 'ALL' || channel === 'all' || row.channel === channel),
      )
  const manuals: (typeof manualEntries)[number][] = manualEntries
  const completeManuals =
    model.available && (raw ? !!store.glReview?.complete : !!excel)
  const reviewFor = (id: string) =>
    store.reviewCases.find((item) => item.recordIds.includes(id))
  const journalLink = (id: string) => {
    const review = reviewFor(id)
    const query = new URLSearchParams({
      record: id,
      from: 'dashboard',
      returnTo,
    })
    if (review) query.set('case', review.id)
    return `/accounting-review?${query}`
  }
  const evidenceLabel = (id: string) => {
    if (!raw) return 'Chưa xác minh · tham chiếu Excel'
    const review = reviewFor(id)
    if (!review) return 'Chưa có hồ sơ rà soát'
    if (review.stale) return 'Cần xác minh lại'
    if (!review.evidenceReviewed)
      return review.evidence
        ? 'Đã bổ sung, chưa xác minh'
        : 'Chưa có bằng chứng'
    return review.status === 'confirmed'
      ? 'Đã xác minh và xác nhận'
      : 'Đã xác minh bằng chứng'
  }
  return (
    <div
      className="dash-tab-body"
      data-tour="dashboard-quality"
      data-cancelled-orders={quality.cancelledOrders}
      data-duplicate-exports={quality.removedDuplicateLines}
      data-manual-journals={completeManuals ? manuals.length : undefined}
    >
      <div className="dash-kpis" data-tour="dashboard-quality-kpis">
        <Metric
          label="Giá trị hàng trả"
          value={money(quality.returnsUSD)}
          unit="USD"
          description={
            excel
              ? 'Giá trị net_usd_daily theo ngày trả, theo quy tắc báo cáo.'
              : 'Tổng giá trị giảm trừ theo ngày trả; cơ sở FX theo nguồn đang chọn.'
          }
        />
        <Metric
          label="Tỷ lệ hàng trả"
          value={quality.returnRate == null ? '—' : ratio(quality.returnRate)}
          description="Tổng giá trị hàng trả / tổng doanh thu online đã giao; không lấy trung bình tỷ lệ tháng."
        />
        <Metric
          label="Đơn online bị hủy"
          value={count(quality.cancelledOrders)}
          description="Đếm mã đơn duy nhất theo ngày đặt trong kỳ đã chọn."
        />
        <Metric
          label="Dòng POS trùng bị loại"
          value={count(quality.removedDuplicateLines)}
          description="Chỉ đếm bản xuất bị loại, không đếm keeper còn giữ lại."
        />
        <Metric
          label="Bút toán tay"
          value={completeManuals ? count(manuals.length) : '—'}
          description="Số journal MANUAL trong GL; một hồ sơ có thể gồm nhiều journal."
        />
      </div>
      {quality.reason && (
        <InformationNote title="Cơ sở hoàn trả và chất lượng">
          {quality.reason}
        </InformationNote>
      )}
      <div className="dash-grid dash-grid-two dash-quality-layout dash-quality-grid">
        <DashboardWidget
          id="quality-return-rate"
          title="Tỷ lệ giá trị hàng trả theo tháng"
          subtitle="Hàng trả / doanh thu online đã giao · %"
        >
          {quality.monthly.some((row) => row.returnRate != null) ? (
            <TrendChart
              rows={quality.monthly}
              percent
              series={[
                { key: 'returnRate', label: 'Tỷ lệ hàng trả', color: TEAL },
              ]}
              onMonth={(month) =>
                onInspect({
                  title: `Hàng trả · ${monthLabel(month)}`,
                  description:
                    'Tỷ lệ tính từ tổng tử số chia tổng mẫu số trong cùng kỳ.',
                  rows: quality.monthly
                    .filter((row) => row.month === month)
                    .map((row) => ({
                      Tháng: row.month,
                      'Hàng trả USD': row.returnsUSD,
                      'Đã giao USD': row.deliveredUSD,
                      'Tỷ lệ': ratio(row.returnRate),
                    })),
                })
              }
            />
          ) : (
            <Missing>
              Cần doanh thu WEB đã giao theo tháng và sự kiện hàng trả. Giá trị
              hàng trả riêng không đủ làm mẫu số.
            </Missing>
          )}
        </DashboardWidget>
        <DashboardWidget
          id="quality-cancellations"
          title="Đơn hủy theo tháng đặt"
          subtitle="Mã đơn duy nhất · tổng biểu đồ cùng phạm vi với KPI"
        >
          {quality.monthly.some((row) => row.cancelledOrders != null) ? (
            <TrendChart
              rows={quality.monthly}
              bars
              series={[
                { key: 'cancelledOrders', label: 'Đơn bị hủy', color: ORANGE },
              ]}
              onMonth={(month) =>
                onInspect({
                  title: `Đơn hủy · ${monthLabel(month)}`,
                  description:
                    'Đếm mã đơn duy nhất theo ngày đặt; loại tháng ngoài bộ lọc.',
                  rows: quality.monthly
                    .filter((row) => row.month === month)
                    .map((row) => ({
                      Tháng: row.month,
                      'Số đơn hủy': row.cancelledOrders,
                    })),
                })
              }
            />
          ) : (
            <Missing>
              Cần WEB_Orders hoặc chi tiết CANCEL với mã đơn duy nhất và ngày
              đặt.
            </Missing>
          )}
        </DashboardWidget>

        <DashboardWidget
          id="quality-manuals"
          title="Bút toán tay và tình trạng bằng chứng"
          subtitle="Số tiền theo dấu doanh thu GL · mã tham chiếu chưa phải bằng chứng đã xác minh"
        >
          <InformationNote title="Bút toán tay · xem đầy đủ">
            Bản xem trước · phóng to để xem đủ kênh, diễn giải và mã tham chiếu.
          </InformationNote>
          <DataTable
            label="bút toán tay"
            rows={manuals}
            columns={[
              {
                key: 'journal',
                label: 'Mã bút toán',
                value: (row) => row.journalId,
                render: (row) =>
                  raw ? (
                    <Link className="dash-text-button" to={journalLink(row.id)}>
                      {row.journalId || 'Thiếu mã'}
                    </Link>
                  ) : (
                    <button
                      className="dash-text-button"
                      onClick={() =>
                        onInspect({
                          title: `Bút toán Excel · ${row.journalId}`,
                          description:
                            'Giá trị và mã tham chiếu từ GL chuẩn hóa trong workbook; chưa xác minh bằng chứng kế toán.',
                          rows: [{ ...row }],
                        })
                      }
                    >
                      {row.journalId || 'Thiếu mã'}
                    </button>
                  ),
              },
              {
                key: 'date',
                label: 'Ngày ghi sổ',
                value: (row) => row.postingDate,
              },
              {
                key: 'store',
                label: 'Cửa hàng',
                value: (row) => row.storeCode || row.storeKey,
              },
              { key: 'channel', label: 'Kênh', value: (row) => row.channel },
              {
                key: 'amount',
                label: 'Doanh thu · USD',
                value: (row) => row.revenueUSD,
                render: (row) => money(row.revenueUSD),
                numeric: true,
              },
              {
                key: 'description',
                label: 'Diễn giải',
                value: (row) => row.description,
                render: (row) => (
                  <span title={row.description || undefined}>
                    {row.description || 'Chưa có'}
                  </span>
                ),
              },
              {
                key: 'reference',
                label: 'Tham chiếu',
                value: (row) => row.sourceRef,
              },
              {
                key: 'evidence',
                label: 'Bằng chứng',
                value: (row) => evidenceLabel(row.id),
              },
            ]}
            empty={
              completeManuals
                ? 'Không có journal MANUAL trong phạm vi đã chọn.'
                : 'Cần dữ liệu GL_Manual_Entries và hồ sơ rà soát. Workbook cầu nối không cung cấp trạng thái bằng chứng.'
            }
          />
        </DashboardWidget>
        <DashboardWidget
          id="quality-checks"
          title="Kiểm tra chất lượng dữ liệu"
          subtitle={
            excel
              ? 'QC_Summary · toàn workbook · giữ nguyên kết quả đã ghi và ô chưa đánh giá'
              : 'Số trường hợp từ kiểm tra thực tế · không suy diễn lỗi từ khoản điều chỉnh'
          }
        >
          <DataTable
            label="kiểm tra chất lượng"
            rows={quality.validations}
            columns={[
              { key: 'label', label: 'Kiểm tra', value: (row) => row.label },
              {
                key: 'count',
                label: excel ? 'Số lỗi' : 'Số trường hợp',
                value: (row) => row.count,
                render: (row) => count(row.count),
                numeric: true,
              },
              { key: 'status', label: 'Kết quả', value: (row) => row.status },
              {
                key: 'action',
                label: 'Truy vết',
                value: () => '',
                render: (row) => (
                  <button
                    className="dash-text-button"
                    onClick={() =>
                      onInspect({
                        title: row.label,
                        description:
                          'Kết quả từ cùng nguồn và phiên xử lý. Bằng chứng xem trước có thể bị giới hạn; số tổng lấy từ kiểm tra đầy đủ.',
                        rows: [
                          {
                            'Kiểm tra': row.label,
                            'Số trường hợp': row.count,
                            'Kết quả': row.status,
                            'Bảng nguồn': row.tableId,
                            ...(excel
                              ? {
                                  'Giá trị thực tế': row.actual,
                                  'Mong đợi': row.expected,
                                  'Quy tắc': row.rule,
                                  'Ghi chú': row.note,
                                  Sheet: row.sourceSheet,
                                  'Dòng nguồn': row.sourceRow,
                                }
                              : {}),
                          },
                        ],
                      })
                    }
                  >
                    Xem chi tiết
                  </button>
                ),
              },
            ]}
            empty="Cần kết quả kiểm tra chất lượng từ pipeline Raw; dữ liệu Excel hiện tại không có bộ kiểm tra độc lập cho chỉ tiêu này."
          />
        </DashboardWidget>
      </div>
    </div>
  )
}
