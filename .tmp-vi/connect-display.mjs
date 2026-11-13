import fs from 'node:fs'
import { parseSync } from 'rolldown/utils'
function move(file, module, names) {
  let source = fs.readFileSync(file, 'utf8')
  const decl = parseSync(file, source).program.body.find(
    (n) => n.type === 'ImportDeclaration' && n.source.value === module,
  )
  if (!decl) throw Error(file + ' ' + module)
  const removed = decl.specifiers.filter((s) =>
    Object.hasOwn(names, s.imported?.name),
  )
  if (!removed.length) return
  const remaining = decl.specifiers
    .filter((s) => !removed.includes(s))
    .map(
      (s) =>
        (s.importKind === 'type' ? 'type ' : '') +
        s.imported.name +
        (s.local.name !== s.imported.name ? ' as ' + s.local.name : ''),
    )
  const replacement = remaining.length
    ? `import { ${remaining.join(', ')} } from '${module}'`
    : ''
  const added = `import { ${removed.map((s) => names[s.imported.name] + ' as ' + s.local.name).join(', ')} } from '@/lib/localized-model'\n`
  source =
    added + source.slice(0, decl.start) + replacement + source.slice(decl.end)
  fs.writeFileSync(file, source)
}
for (const file of [
  'src/pages/Dashboard.tsx',
  'src/pages/DataIngestion.tsx',
  'src/components/ingestion/OnboardingWizard.tsx',
])
  move(file, '@/lib/onboarding', { ONBOARDING_STEPS: 'displayOnboardingSteps' })
for (const file of [
  'src/components/ingestion/DataMappingView.tsx',
  'src/components/ingestion/MasterDataConfigurator.tsx',
])
  move(file, '@/lib/data-mapping', { MAPPING_FIELDS: 'displayMappingFields' })
for (const file of [
  'src/components/ingestion/MasterDataConfigurator.tsx',
  'src/components/methodology/ReferenceSummary.tsx',
])
  move(file, '@/lib/master-data', {
    REFERENCE_FIELDS: 'displayReferenceFields',
    ROLE_LABELS: 'displayRoleLabels',
    PURPOSE_LABELS: 'displayPurposeLabels',
  })
move(
  'src/components/methodology/SelectionInspector.tsx',
  '@/lib/model-workspace',
  {
    nodeById: 'displayNodeById',
    edgeById: 'displayEdgeById',
    ruleById: 'displayRuleById',
  },
)
move('src/components/methodology/SelectionInspector.tsx', '@/lib/methodology', {
  methodologyRules: 'displayRules',
})
