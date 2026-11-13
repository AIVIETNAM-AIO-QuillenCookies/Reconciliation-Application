import { LocalizedNote } from '@/components/LocalizedError'
import { vi } from '@/lib/i18n'
import { Info } from 'lucide-react'

/** Display the assumptions returned by this exact engine run, not generic sample data. */
export function CompatibilityNotice({
  warnings,
  preview = false,
}: {
  warnings: readonly string[]
  preview?: boolean
}) {
  if (!warnings.length) return null
  return (
    <aside
      role="status"
      className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-950"
    >
      <div className="flex items-start gap-2">
        <Info className="mt-1 size-4 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-semibold">
            {preview
              ? vi('Temporary data preview · validation bypassed')
              : vi('Source mapping notes')}
          </p>
          <p>
            {preview ? (
              <>
                {' ' +
                  vi(
                    'Strict row checks are disabled. Missing or messy values use temporary defaults, including dates and amounts. These calculations are provisional: amounts assume USD, round to cents, and use positive magnitudes for sales; no exchange-rate conversion is performed.',
                  ) +
                  ' '}
              </>
            ) : (
              <>
                {' ' +
                  vi(
                    'Accounting checks are enabled. The engine used the field mappings and documented optional-field rules below. Review these mappings against your export schema.',
                  ) +
                  ' '}
              </>
            )}
          </p>
        </div>
      </div>
      <details className="mt-2 pl-6">
        <summary className="cursor-pointer font-medium">
          {preview
            ? vi('View temporary rules and column assumptions')
            : vi('View source mappings')}
        </summary>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          {warnings.map((warning, index) => (
            <li key={index} className="break-words">
              <LocalizedNote message={warning} />
            </li>
          ))}
        </ul>
      </details>
    </aside>
  )
}
