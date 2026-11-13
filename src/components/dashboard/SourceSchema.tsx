import { vi } from '@/lib/i18n'
import { ACCOUNTING_SOURCE_FIELDS as SCHEMA } from '@/lib/reconciliation-schema'
import { REQUIRED_SOURCES } from '@/lib/uploads'

export function SourceSchema() {
  return (
    <details className="mt-5 rounded-xl border bg-transparent px-5 py-4 text-xs">
      <summary className="cursor-pointer font-medium text-foreground">
        {' ' + vi('Source schema & accounting rules') + ' '}
      </summary>
      <div className="mt-4 space-y-4 leading-relaxed text-muted-foreground">
        <p>
          {' ' +
            vi(
              'Accounting mode is enabled. USD values, transaction keys, dates, and statuses are validated. Known field aliases and Dim store/calendar mappings are supported. Missing financial values are never replaced with fabricated amounts, dates, or transaction IDs.',
            ) +
            ' '}
        </p>
        {REQUIRED_SOURCES.map((source) => (
          <div key={source}>
            <p className="mb-1 font-semibold text-foreground">{source}</p>
            <code className="break-words text-[12px]">
              {vi(SCHEMA[source])}
            </code>
          </div>
        ))}
        <p>
          <span className="font-semibold text-foreground">
            {vi('Dim (optional):')}
          </span>{' '}
          {' ' +
            vi(
              'Assign reference roles, choose worksheets, map columns and configure join keys. Only confirmed roles and worksheets are loaded, with a header row per sheet. Full mappings & joins validation is required before confirmation.',
            ) +
            ' '}
        </p>
        <p>
          {' ' +
            vi(
              'Flash accepts revenue_usd or gross_usd and filters month_end_date. POS uses the earliest exported_at for each receipt_no + line_no; supplied export_seq breaks ties and provides fallback ordering when timestamps are absent. POS and WEB Net Amount are optional: use the mapped net value as supplied, or calculate gross USD minus USD discount when net is unmapped, without deducting a discount twice. The confirmed POS export uses line_amount for gross and net_usd_month_end for accounting. POS posting_date is optional; if absent, an explicit Dim calendar posting mapping is tried before business_date. Export CSV or an XLSX whose first worksheet contains the export data. Use the Header Row selector to skip metadata; select Row 5 for a Flash export with four metadata rows. Master worksheets use their individually selected headers.',
            ) +
            ' '}
        </p>
        <p>
          {' ' +
            vi(
              'Flash is monthly gross at daily FX; GL is net revenue at month-end FX. Select complete calendar months and include adjacent-month transactions and postings for accurate timing. Returned WEB orders reverse their full net_usd_month_end on return_date. GL inputs must contain revenue journals only.',
            ) +
            ' '}
        </p>
        <p>
          {' ' +
            vi(
              'The initial reporting period is FY2025: January 1 through December 31, 2025. Dim working_day is a calendar flag; the supplied posting_date mapping determines recognition dates without an inferred day offset.',
            ) +
            ' '}
        </p>
        <p>
          {' ' +
            vi(
              'WEB store codes use explicitly configured Store Master relationships; files without a store column use online store 999999. Unknown stores are not assigned to NX001. ISO dates are preferred; slash dates use MM/DD/YYYY first, then DD/MM/YYYY. Supply precomputed USD amounts for local-currency sales. FX references validate or return attributes without conversion. Existing month-end USD values are preserved.',
            ) +
            ' '}
        </p>
        <p>
          {' ' +
            vi(
              'Discounts include raw POS exports and WEB orders. Data errors remove duplicate POS net revenue and expected store/date totals with no GL journal. Other daily amount mismatches, manual journals, and FX effects remain explicit in Unexplained Difference. GL is compared only after store/date aggregation.',
            ) +
            ' '}
        </p>
      </div>
    </details>
  )
}
