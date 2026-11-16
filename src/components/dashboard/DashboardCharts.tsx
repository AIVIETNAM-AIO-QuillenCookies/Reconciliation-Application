import { useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type BarShapeProps,
} from 'recharts'
import type { DashboardModel } from '@/lib/dashboard-model'
import { compact, money, percent, shortMonth } from '@/lib/dashboard-format'
import { useDashboardWidgetExpanded } from './DashboardWidgets'

const grid = (
  <CartesianGrid vertical={false} stroke="#e8eef0" strokeDasharray="3 4" />
)
const axis = {
  axisLine: false,
  tickLine: false,
  tick: { fontSize: 11, fill: '#647780' },
}
const chartAxis = (expanded: boolean) => ({
  ...axis,
  tick: { ...axis.tick, fontSize: expanded ? 13 : 11 },
})
const tooltipStyle = {
  maxWidth: 'min(360px, 85vw)',
  whiteSpace: 'normal' as const,
  zIndex: 5,
}

export function RevenueTrend({
  model,
  onMonth,
}: {
  model: DashboardModel
  onMonth: (month: string) => void
}) {
  const expanded = useDashboardWidgetExpanded()
  return (
    <>
      <div
        className="dash-chart"
        aria-label="Sales Flash và GL theo tháng, USD"
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart
            data={model.monthly}
            margin={{ top: 12, right: 16, bottom: 0, left: 0 }}
            accessibilityLayer
            onClick={(s) => {
              const month = s?.activeLabel
              if (month) onMonth(String(month))
            }}
          >
            {grid}
            <XAxis
              dataKey="month"
              tickFormatter={shortMonth}
              {...chartAxis(expanded)}
            />
            <YAxis
              {...chartAxis(expanded)}
              width={expanded ? 85 : 65}
              tickFormatter={compact}
            />
            <Tooltip
              allowEscapeViewBox={{ x: false, y: false }}
              wrapperStyle={tooltipStyle}
              contentStyle={{
                fontSize: expanded ? 13 : 12,
                overflowWrap: 'anywhere',
                borderRadius: 8,
              }}
              labelFormatter={(v) => `Tháng ${v} · USD`}
              formatter={(v, name) => [`${money(Number(v))} USD`, name]}
            />
            <Line
              dataKey="flashUSD"
              name="Sales Flash"
              stroke="#08958e"
              strokeWidth={2.5}
              dot={{ r: 3 }}
              activeDot={{ r: 6 }}
              connectNulls={false}
              isAnimationActive={false}
            />
            <Line
              dataKey="glUSD"
              name="GL"
              stroke="#879eae"
              strokeWidth={2.5}
              dot={{ r: 3 }}
              activeDot={{ r: 6 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {expanded && (
        <div className="dash-legend" aria-label="Chú giải doanh thu">
          <span>
            <i />
            Sales Flash
          </span>
          <span>
            <i className="is-gl" />
            GL
          </span>
        </div>
      )}
      <MonthPicker
        months={model.selectedMonths}
        label="Xem chi tiết tháng doanh thu"
        onMonth={onMonth}
      />
    </>
  )
}

function MonthPicker({
  months,
  label,
  onMonth,
}: {
  months: string[]
  label: string
  onMonth: (month: string) => void
}) {
  return (
    <label className="dash-chart-detail-select">
      Xem tháng
      <select
        aria-label={label}
        value=""
        onChange={(event) => {
          if (event.target.value) onMonth(event.target.value)
        }}
      >
        <option value="">Chọn tháng…</option>
        {months.map((month) => (
          <option key={month}>{month}</option>
        ))}
      </select>
    </label>
  )
}

export function VarianceChart({
  model,
  onMonth,
  residual = false,
}: {
  model: DashboardModel
  onMonth: (month: string) => void
  residual?: boolean
}) {
  const expanded = useDashboardWidgetExpanded()
  const rows = residual
    ? model.monthly
        .filter((m) => m.unexplainedUSD != null)
        .toSorted(
          (a, b) =>
            Math.abs(b.unexplainedUSD ?? 0) - Math.abs(a.unexplainedUSD ?? 0),
        )
        .slice(0, 5)
    : model.monthly
  return (
    <>
      <div className="dash-chart">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart
            data={rows}
            accessibilityLayer
            margin={{ top: 10, right: 10, bottom: 0, left: 0 }}
            onClick={(s) => {
              if (s?.activeLabel) onMonth(String(s.activeLabel))
            }}
          >
            {grid}
            <XAxis
              dataKey="month"
              tickFormatter={shortMonth}
              {...chartAxis(expanded)}
            />
            <YAxis
              {...chartAxis(expanded)}
              width={expanded ? 85 : 60}
              tickFormatter={(v) =>
                residual ? compact(Number(v)) : `${Number(v * 100).toFixed(0)}%`
              }
            />
            <ReferenceLine y={0} stroke="#b2c0c8" />
            <Tooltip
              allowEscapeViewBox={{ x: false, y: false }}
              wrapperStyle={tooltipStyle}
              contentStyle={{
                fontSize: expanded ? 13 : 12,
                overflowWrap: 'anywhere',
                borderRadius: 8,
              }}
              labelFormatter={(v) => `Tháng ${v}`}
              formatter={(v) => [
                residual ? `${money(Number(v))} USD` : percent(Number(v)),
                residual ? 'Chưa giải thích' : 'Δ / Sales Flash',
              ]}
            />
            <Bar
              dataKey={residual ? 'unexplainedUSD' : 'deltaRatio'}
              name={residual ? 'Chưa giải thích' : 'Tỷ lệ chênh lệch'}
              fill={residual ? '#c6594e' : '#d28c46'}
              radius={[3, 3, 0, 0]}
              maxBarSize={30}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <MonthPicker
        months={rows.map((row) => row.month)}
        label={
          residual
            ? 'Xem chi tiết tháng còn chênh lệch'
            : 'Xem chi tiết tháng tỷ lệ chênh lệch'
        }
        onMonth={onMonth}
      />
    </>
  )
}

type BridgeRow = DashboardModel['bridge'][number]
function WaterfallTick({
  x = 0,
  y = 0,
  payload,
}: {
  x?: number
  y?: number
  payload?: { value: string }
}) {
  const words = String(payload?.value ?? '').split(/\s+/)
  const lines: string[] = []
  for (const word of words) {
    const previous = lines.at(-1)
    if (previous && previous.length + word.length < 16)
      lines[lines.length - 1] = `${previous} ${word}`
    else lines.push(word)
  }
  return (
    <text x={x} y={y + 10} textAnchor="middle" fill="#647780" fontSize={12}>
      {lines.map((line, index) => (
        <tspan key={index} x={x} dy={index ? 15 : 0}>
          {line}
        </tspan>
      ))}
    </text>
  )
}
function VerticalWaterfallTick({
  x = 0,
  y = 0,
  payload,
}: {
  x?: number
  y?: number
  payload?: { value: string }
}) {
  const lines: string[] = []
  for (const word of String(payload?.value ?? '').split(/\s+/)) {
    const previous = lines.at(-1)
    if (previous && previous.length + word.length < 23)
      lines[lines.length - 1] = `${previous} ${word}`
    else lines.push(word)
  }
  return (
    <text
      x={x - 7}
      y={y - (lines.length - 1) * 7 + 4}
      textAnchor="end"
      fill="#647780"
      fontSize={12}
    >
      {lines.map((line, index) => (
        <tspan key={index} x={x - 7} dy={index ? 14 : 0}>
          {line}
        </tspan>
      ))}
    </text>
  )
}
const signedCompact = new Intl.NumberFormat('vi-VN', {
  notation: 'compact',
  maximumFractionDigits: 2,
  signDisplay: 'exceptZero',
})
const totalCompact = new Intl.NumberFormat('vi-VN', {
  notation: 'compact',
  maximumFractionDigits: 2,
})
/** Compact step value: signed for adjustments, plain for the Flash/GL totals. */
const bridgeValueLabel = (row: BridgeRow) =>
  (row.kind === 'adjustment' ? signedCompact : totalCompact).format(
    Object.is(row.amountUSD, -0) ? 0 : row.amountUSD,
  )

export function DashboardWaterfall({
  rows,
  onSelect,
}: {
  rows: BridgeRow[]
  onSelect: (row: BridgeRow) => void
}) {
  const expanded = useDashboardWidgetExpanded()
  const [chartWidth, setChartWidth] = useState(0)
  const vertical = expanded && chartWidth > 0 && chartWidth < 760
  const data = rows.map((row) => ({
    ...row,
    shortLabel:
      row.kind === 'sales'
        ? 'Flash'
        : row.kind === 'finance'
          ? 'GL'
          : row.label,
    range: [
      Math.min(row.startUSD, row.endUSD),
      Math.max(row.startUSD, row.endUSD),
    ],
  }))
  return (
    <>
      <div
        className="dash-chart dash-waterfall"
        style={
          vertical
            ? {
                height: rows.length * 54 + 65,
                minHeight: rows.length * 54 + 65,
                flex: '0 0 auto',
              }
            : undefined
        }
      >
        <div className="dash-waterfall-canvas" style={{ height: '100%' }}>
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            onResize={(width) => setChartWidth(width)}
          >
            <BarChart
              data={data}
              layout={vertical ? 'vertical' : 'horizontal'}
              accessibilityLayer
              margin={{
                top: 18,
                right: vertical ? 64 : 10,
                bottom: 0,
                left: 0,
              }}
            >
              {grid}
              {vertical ? (
                <XAxis
                  type="number"
                  {...chartAxis(true)}
                  tickFormatter={compact}
                />
              ) : (
                <XAxis
                  dataKey="shortLabel"
                  {...chartAxis(expanded)}
                  interval={expanded ? 0 : 'preserveStartEnd'}
                  minTickGap={12}
                  tickFormatter={(value) =>
                    expanded || value.length <= 13
                      ? value
                      : `${value.slice(0, 11)}…`
                  }
                  tick={expanded ? <WaterfallTick /> : chartAxis(false).tick}
                  height={expanded ? 112 : 35}
                />
              )}
              {vertical ? (
                <YAxis
                  type="category"
                  dataKey="shortLabel"
                  width={155}
                  interval={0}
                  tick={<VerticalWaterfallTick />}
                  axisLine={false}
                  tickLine={false}
                />
              ) : (
                <YAxis
                  {...chartAxis(expanded)}
                  width={expanded ? 85 : 65}
                  tickFormatter={compact}
                />
              )}
              {vertical ? (
                <ReferenceLine x={0} stroke="#bdc9cf" />
              ) : (
                <ReferenceLine y={0} stroke="#bdc9cf" />
              )}
              <Tooltip
                allowEscapeViewBox={{ x: false, y: false }}
                wrapperStyle={tooltipStyle}
                cursor={{ fill: '#eef5f5' }}
                content={({ active, payload }) => {
                  const row = payload?.[0]?.payload as BridgeRow | undefined
                  return active && row ? (
                    <div className="dash-tooltip">
                      <strong>{row.label}</strong>
                      <p>{money(row.amountUSD)} USD</p>
                      <p>Lũy kế: {money(row.endUSD)} USD</p>
                      <small>Flash + điều chỉnh + chưa giải thích = GL</small>
                    </div>
                  ) : null
                }}
              />
              <Bar
                dataKey="range"
                isAnimationActive={false}
                shape={(props: BarShapeProps) => {
                  const row = props.payload as BridgeRow
                  const fill =
                    row.kind !== 'adjustment'
                      ? '#174657'
                      : row.category === 'error' ||
                          row.category === 'unexplained'
                        ? '#c45c51'
                        : row.category === 'rounding'
                          ? '#91a1ae'
                          : '#d89a55'
                  // Totals and increases are labelled at their high end,
                  // reductions at their low end, so labels never sit on a bar.
                  const left = vertical
                    ? Math.min(props.x, props.x + props.width)
                    : props.x
                  const top = vertical
                    ? props.y
                    : Math.min(props.y, props.y + props.height)
                  const length = Math.max(
                    2,
                    Math.abs(vertical ? props.width : props.height),
                  )
                  const thickness = Math.abs(
                    vertical ? props.height : props.width,
                  )
                  const centre = (vertical ? top : left) + thickness / 2
                  const fontSize = expanded ? 12 : 10
                  const rising = row.kind !== 'adjustment' || row.amountUSD >= 0
                  const label: {
                    x: number
                    y: number
                    anchor: 'start' | 'middle' | 'end'
                  } = vertical
                    ? rising
                      ? {
                          x: left + length + 5,
                          y: centre + fontSize / 3,
                          anchor: 'start',
                        }
                      : { x: left - 5, y: centre + fontSize / 3, anchor: 'end' }
                    : rising
                      ? { x: centre, y: top - 5, anchor: 'middle' }
                      : {
                          x: centre,
                          y: top + length + fontSize + 2,
                          anchor: 'middle',
                        }
                  return (
                    <g
                      role="button"
                      tabIndex={0}
                      aria-label={`${row.label}: ${money(row.amountUSD)} USD; xem chi tiết`}
                      onClick={() => onSelect(row)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onSelect(row)
                        }
                      }}
                      className="dash-svg-button"
                    >
                      <title>{`${row.label}: ${money(row.amountUSD)} USD; lũy kế ${money(row.endUSD)} USD`}</title>
                      <rect
                        x={vertical ? left - 4 : left}
                        y={vertical ? top : top - 4}
                        width={vertical ? Math.max(10, length + 8) : thickness}
                        height={vertical ? thickness : Math.max(10, length + 8)}
                        fill="transparent"
                      />
                      <rect
                        x={left}
                        y={top}
                        width={vertical ? length : thickness}
                        height={vertical ? thickness : length}
                        rx={3}
                        fill={fill}
                      />
                      {thickness >= (vertical ? 12 : 34) && (
                        <text
                          x={label.x}
                          y={label.y}
                          textAnchor={label.anchor}
                          fontSize={fontSize}
                          fontWeight={row.kind === 'adjustment' ? 500 : 650}
                          fill={
                            row.kind === 'adjustment' ? '#4c626e' : '#24404d'
                          }
                          pointerEvents="none"
                        >
                          {bridgeValueLabel(row)}
                        </text>
                      )}
                    </g>
                  )
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <label className="dash-chart-detail-select">
        Khoản mục
        <select
          value=""
          aria-label="Xem chi tiết khoản mục cầu nối"
          onChange={(event) => {
            const row = rows.find((item) => item.id === event.target.value)
            if (row) onSelect(row)
          }}
        >
          <option value="">Xem khoản mục…</option>
          {rows.map((row) => (
            <option key={row.id} value={row.id}>
              {row.label} · {money(row.amountUSD)} USD
            </option>
          ))}
        </select>
      </label>
      <div className="dash-waterfall-legend">
        <span>
          <i style={{ background: '#174657' }} />
          Flash / GL
        </span>
        <span>
          <i style={{ background: '#d89a55' }} />
          Quy tắc ghi nhận
        </span>
        <span>
          <i style={{ background: '#c45c51' }} />
          Lỗi / chưa giải thích
        </span>
        <span>
          <i style={{ background: '#91a1ae' }} />
          Làm tròn
        </span>
      </div>
    </>
  )
}

export function ImpactRanking({
  rows,
  onSelect,
  selectedMonths,
}: {
  rows: BridgeRow[]
  onSelect: (row: BridgeRow) => void
  selectedMonths: string[]
}) {
  const adjustments = rows.filter((r) => r.kind === 'adjustment')
  const denominator = adjustments.reduce(
    (sum, r) =>
      sum +
      selectedMonths.reduce(
        (s, month) => s + Math.abs(r.monthly[month] ?? 0),
        0,
      ),
    0,
  )
  const data = adjustments
    .map((r) => ({
      row: r,
      magnitude: selectedMonths.reduce(
        (s, month) => s + Math.abs(r.monthly[month] ?? 0),
        0,
      ),
    }))
    .sort((a, b) => b.magnitude - a.magnitude)
  const max = Math.max(1, ...data.map((r) => r.magnitude))
  return (
    <div
      className="dash-ranking"
      role="list"
      aria-label="Xếp hạng độ lớn ảnh hưởng"
    >
      <p>
        Σ |ảnh hưởng tháng trong kỳ chọn| · USD. Tỷ trọng trên tổng độ lớn các
        điều chỉnh; loại dòng tổng và kiểm tra.
      </p>
      {data.map(({ row, magnitude }) => (
        <button
          key={row.id}
          role="listitem"
          onClick={() => onSelect(row)}
          title={`${row.label}: ${money(row.amountUSD)} USD có dấu; độ lớn ${money(magnitude)} USD; ${percent(denominator ? magnitude / denominator : null)}`}
        >
          <span>{row.label}</span>
          <div>
            <i style={{ width: `${(magnitude / max) * 100}%` }} />
          </div>
          <strong>{money(magnitude)}</strong>
          <small>{percent(denominator ? magnitude / denominator : null)}</small>
        </button>
      ))}
    </div>
  )
}
