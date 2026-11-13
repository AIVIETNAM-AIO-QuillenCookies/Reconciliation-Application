import { mappingIssues, type MappingDrafts } from './data-mapping.ts'
import { REQUIRED_SOURCES, type QueuedFile, type Source } from './uploads.ts'
import { masterReady } from './master-data.ts'

export const ONBOARDING_STEPS = [
  {
    source: 'POS',
    label: 'POS',
    name: 'POS sales data',
    description:
      'Start with your in-store sales. We’ll match the columns, then check a few rows.',
  },
  {
    source: 'WEB',
    label: 'WEB',
    name: 'web sales data',
    description:
      'Add online orders, including delivery, cancellation, and return details.',
  },
  {
    source: 'GL',
    label: 'Finance GL',
    name: 'finance GL data',
    description: 'Connect your signed ledger amounts and store references.',
  },
  {
    source: 'Flash',
    label: 'Sales Flash',
    name: 'sales flash data',
    description:
      'Add the monthly revenue summary used as the starting point for your bridge.',
  },
  {
    source: 'Dim',
    label: 'Master / Dim',
    name: 'master data',
    description: 'Optionally add your store, calendar, and FX lookup workbook.',
  },
] as const

export function onboardingStepReady(
  source: Source,
  files: readonly QueuedFile[],
  drafts: MappingDrafts,
): boolean {
  const selected = files.filter((file) => file.source === source)
  if (source === 'Dim')
    return (
      selected.length <= 1 &&
      selected.every((file) =>
        masterReady(drafts[file.id]?.master, drafts[file.id]?.masterValidation),
      )
    )
  return (
    selected.length > 0 &&
    selected.every(
      (file) => mappingIssues(source, drafts[file.id]).length === 0,
    )
  )
}

export function canCompleteOnboarding(
  files: readonly QueuedFile[],
  drafts: MappingDrafts,
): boolean {
  return (
    files.every((file) => file.source !== '') &&
    REQUIRED_SOURCES.every((source) =>
      onboardingStepReady(source, files, drafts),
    ) &&
    onboardingStepReady('Dim', files, drafts)
  )
}

export function firstIncompleteStep(
  files: readonly QueuedFile[],
  drafts: MappingDrafts,
): number {
  const index = ONBOARDING_STEPS.findIndex(
    (step) => !onboardingStepReady(step.source, files, drafts),
  )
  return index === -1 ? ONBOARDING_STEPS.length - 1 : index
}
