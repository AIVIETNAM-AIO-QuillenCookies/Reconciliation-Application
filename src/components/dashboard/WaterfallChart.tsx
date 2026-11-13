import { vi } from '@/lib/i18n'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type BarShapeProps,
  type TooltipContentProps,
} from 'recharts'
import {
  buildWaterfall,
  type ReconciliationResult,
  type WaterfallStep,
} from '@/lib/reconciliation-types'
import { formatUSD } from '@/lib/format-money'

const color = (step: WaterfallStep) =>
  step.total
    ? 'var(--forest)'
    : step.unexplained
      ? 'var(--warning)'
      : step.amount < 0
        ? 'var(--negative)'
        : 'var(--positive)'

function FloatingBar(props: BarShapeProps) {
  const step = props.payload as WaterfallStep
  const top = Math.min(props.y, props.y + props.height)
  const height = Math.abs(props.height)
  return (
    <g>
      {height > 0 ? (
        <rect
          x={props.x}
          y={top}
          width={props.width}
          height={height}
          rx={4}
          fill={color(step)}
        />
      ) : (
        <line
          x1={props.x}
          x2={props.x + props.width}
          y1={top}
          y2={top}
          stroke="var(--muted-foreground)"
          strokeWidth={2}
        />
      )}
      <text
        x={props.x + props.width / 2}
        y={top - 10}
        textAnchor="middle"
        fill={step.total ? 'var(--foreground)' : 'var(--muted-foreground)'}
        fontSize={11}
        fontWeight={step.total ? 650 : 500}
      >
        {step.amount > 0 && !step.total ? '+' : ''}
        {formatUSD(step.amountCents)}
      </text>
    </g>
  )
}

function BridgeTooltip({
  active,
  payload,
}: Pick<TooltipContentProps<number[], string>, 'active' | 'payload'>) {
  if (!active || !payload.length) return null
  const step = payload[0].payload as WaterfallStep
  return (
    <div className="min-w-52 rounded-xl border bg-white p-4 text-xs shadow-lg">
      <p className="font-semibold">{step.label}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {step.total
          ? vi('Revenue total')
          : step.unexplained
            ? vi('Unexplained residual')
            : step.amountCents < 0
              ? vi('Revenue reduction')
              : vi('Revenue increase')}
      </p>
      <p className="financial-value mt-2 text-lg">
        {!step.total && step.amountCents > 0 ? '+' : ''}
        {formatUSD(step.amountCents)}
      </p>
      {!step.total && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          {' ' + vi('Running revenue:') + ' '}
          {formatUSD(step.endCents)}
        </p>
      )}
    </div>
  )
}

/** Range bars handle positive, negative, and zero-crossing balances without stacked-base artifacts. */
export default function WaterfallChart({
  result,
}: {
  result: ReconciliationResult
}) {
  const steps = buildWaterfall(result).map((step) => ({
    ...step,
    label: vi(step.label),
  }))
  return (
    <figure
      aria-label={vi('Revenue reconciliation waterfall in US dollars')}
      className="waterfall-figure"
    >
      <div
        className="waterfall-scroll"
        tabIndex={0}
        role="region"
        aria-label={vi('Scrollable revenue waterfall')}
      >
        <div className="waterfall-canvas">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart
              data={steps}
              margin={{ top: 28, right: 16, left: 0, bottom: 8 }}
              barCategoryGap="30%"
              accessibilityLayer
            >
              <CartesianGrid
                vertical={false}
                stroke="var(--border)"
                strokeDasharray="3 4"
              />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                interval={0}
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                dy={8}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                width={65}
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                tickFormatter={(value: number) =>
                  new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    notation: 'compact',
                    maximumFractionDigits: 1,
                  }).format(value)
                }
                domain={[
                  (min: number) => Math.min(0, min),
                  (max: number) => Math.max(1, max * 1.12),
                ]}
              />
              <ReferenceLine y={0} stroke="var(--input)" />
              <Tooltip
                content={(props) => <BridgeTooltip {...props} />}
                cursor={{ fill: 'var(--muted)', fillOpacity: 0.5 }}
              />
              <Bar
                dataKey="range"
                name={vi('Revenue bridge')}
                shape={(props) => <FloatingBar {...props} />}
                isAnimationActive={false}
                maxBarSize={64}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <figcaption className="mt-2 flex shrink-0 flex-wrap justify-center gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
        {[
          ['bg-forest', 'Flash / GL totals'],
          ['bg-positive', 'Increase (+)'],
          ['bg-negative', 'Reduction (−)'],
          ['bg-warning', 'Unexplained residual'],
        ].map(([style, label]) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={`size-2 rounded-sm ${style}`} />
            {label}
          </span>
        ))}
      </figcaption>
    </figure>
  )
}
