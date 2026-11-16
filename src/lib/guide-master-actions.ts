import type { AppStore } from './store.ts'
import type { MasterConfiguration, ReferenceRole } from './master-data.ts'
import {
  clickGuideTarget,
  openGuideTarget,
  waitForGuide,
  guideTarget,
} from './guide-dom.ts'

/** Exercise the real Master form. Only the preset's relationship definition is applied atomically. */
export async function demonstrateGuideMaster(
  role: ReferenceRole,
  preset: MasterConfiguration,
  actions: Pick<AppStore['actions'], 'setMasterReference'>,
  signal: AbortSignal,
) {
  const reference = preset.roles[role]
  async function choose(target: string, value: string) {
    await openGuideTarget(target, signal)
    await clickGuideTarget(`${target}-option-${value}`, signal)
  }
  await clickGuideTarget(`master-role-${role}`, signal)
  await clickGuideTarget('master-tab-mapping', signal)
  await choose(`master-usage-${role}`, reference.usage)
  await choose(`master-sheet-${role}`, reference.sheetName)
  for (const [field, column] of Object.entries(reference.columns)) {
    if (column) await choose(`master-column-${role}-${field}`, column)
  }
  signal.throwIfAborted()
  actions.setMasterReference(preset.fileId, role, reference)
  await clickGuideTarget('master-tab-relationships', signal)
  for (const relationship of reference.relationships) {
    const target = `master-relation-${relationship.id}`
    await waitForGuide(() => !!guideTarget(target), signal)
    await choose(`${target}-source`, relationship.source)
    for (const [index, key] of relationship.keys.entries()) {
      await choose(`${target}-source-key-${index}`, key.sourceField)
      await choose(`${target}-reference-key-${index}`, key.referenceField)
      await choose(`${target}-key-type-${index}`, key.type)
    }
    await choose(`${target}-purpose`, relationship.purpose)
    await choose(`${target}-unmatched`, relationship.unmatched)
  }
}
