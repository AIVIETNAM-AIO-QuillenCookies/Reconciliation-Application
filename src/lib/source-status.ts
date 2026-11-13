import { mappingIssues, type MappingDrafts } from './data-mapping.ts'
import { onboardingStepReady } from './onboarding.ts'
import type { QueuedFile, Source } from './uploads.ts'
import { masterReady } from './master-data.ts'

/** Preview readiness is distinct from accounting validation after a run. */
export function sourceStatus(
  source: Source,
  files: readonly QueuedFile[],
  drafts: MappingDrafts,
  previewActive = false,
) {
  const selected = files.filter((file) => file.source === source)
  const readyCount = selected.filter((file) =>
    source === 'Dim'
      ? masterReady(drafts[file.id]?.master, drafts[file.id]?.masterValidation)
      : mappingIssues(source, drafts[file.id]).length === 0,
  ).length
  const state = !selected.length
    ? 'empty'
    : selected.some((file) => drafts[file.id]?.error)
      ? 'error'
      : selected.some((file) => !drafts[file.id]?.preview)
        ? 'reading'
        : onboardingStepReady(source, files, drafts)
          ? 'ready'
          : 'mapping'
  const label = {
    empty: 'Not added',
    error: 'Needs attention',
    reading: previewActive ? 'Reading preview' : 'Preview pending',
    ready: source === 'Dim' ? 'Validated' : 'Mapping ready',
    mapping: 'Needs mapping',
  }[state]
  return { state, label, files: selected, readyCount }
}
