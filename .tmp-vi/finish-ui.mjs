import fs from 'node:fs'
function edit(file, pairs, imports = '') {
  const path = 'src/' + file
  let text = fs.readFileSync(path, 'utf8')
  for (const [from, to] of pairs) {
    if (!text.includes(from)) {
      if (!text.includes(to)) console.log(`${file}: skipped ${from}`)
      continue
    }
    text = text.replaceAll(from, to)
  }
  fs.writeFileSync(path, text.startsWith(imports) ? text : imports + text)
}
edit('components/methodology/PipelineCanvas.tsx', [
  ['{s.label}', '{vi(s.label)}'],
  ['${stage.label}', '${vi(stage.label)}'],
  ['{stage.label}', '{vi(stage.label)}'],
  [
    '<option key={s}>{s}</option>',
    "<option key={s} value={s}>{s === 'Flash' ? 'Sales Flash' : s}</option>",
  ],
])
edit(
  'components/methodology/RuleBrowser.tsx',
  [
    [
      'const rules = filterRules(filters)',
      'const rules = filterRules(filters).map(rule => displayRuleById.get(rule.id) ?? rule)',
    ],
    [
      '<option key={s}>{s}</option>',
      "<option key={s} value={s}>{s === 'Flash' ? 'Sales Flash' : s}</option>",
    ],
    [
      '<option key={g}>{g}</option>',
      '<option key={g} value={g}>{vi(g)}</option>',
    ],
    ['{status.label}', '{vi(status.label)}'],
    ['{s}\n', "{s === 'Flash' ? 'Sales Flash' : s}\n"],
  ],
  "import { displayRuleById } from '@/lib/localized-model'\n",
)
edit('components/methodology/EvidenceTable.tsx', [
  ['import { vi, vt }', 'import { vi, vt, viMessage, displayValue }'],
  ['{t.label}', '{viMessage(t.label)}'],
  [': table.kind}', ': vi(table.kind)}'],
  [': s}', ": s === 'Flash' ? 'Sales Flash' : s}"],
  [
    '<option key={t}>{t}</option>',
    "<option key={t} value={t}>{displayValue('event_type', t)}</option>",
  ],
  ['${table.label}', '${viMessage(table.label)}'],
  ['{table.grain}', '{viMessage(table.grain)}'],
  [
    "title={row[n] ?? 'NULL'}",
    "title={row[n] == null ? 'NULL' : displayValue(n, row[n])}",
  ],
  ['{row[n]}</span>', '{displayValue(n, row[n])}</span>'],
  [
    '                                row[n]\n',
    '                                displayValue(n, row[n])\n',
  ],
])
edit(
  'components/methodology/SelectionInspector.tsx',
  [
    ['import { vi, vt }', 'import { vi, vt, viMessage, displayValue }'],
    ['{feedback || vi("Copy")}', '{vi(feedback) || vi("Copy")}'],
    ['{feedback}', '{vi(feedback)}'],
    ['<pre>', '<pre data-technical="true">'],
    [': table?.label)', ': table ? viMessage(table.label) : undefined)'],
    ['? nodeType(node)', '? nodeTypeLabel(nodeType(node))'],
    [
      '{ruleStatus(rule.id, evidence).label}',
      '{vi(ruleStatus(rule.id, evidence).label)}',
    ],
    [
      '<p>{ruleStatus(rule.id, evidence).detail}</p>',
      '<LocalizedNote message={ruleStatus(rule.id, evidence).detail} />',
    ],
    ['{table.grain}', '{viMessage(table.grain)}'],
    [
      '                                value\n',
      '                                displayValue(key, value)\n',
    ],
    ['{evidence?.scope}', '{evidence && viMessage(evidence.scope)}'],
    [
      '<p className="mw-muted">{evidence?.sourceRowNote}</p>',
      '<div className="mw-muted">{evidence && <LocalizedNote message={evidence.sourceRowNote} />}</div>',
    ],
    ['{rule.technicalSource}', '{viMessage(rule.technicalSource)}'],
    [
      '{node.source}',
      "{node.source === 'Flash' ? 'Sales Flash' : node.source}",
    ],
    ['{s}\n', "{s === 'Flash' ? 'Sales Flash' : s}\n"],
  ],
  "import { nodeTypeLabel } from '@/lib/localized-model'\nimport { LocalizedNote } from '@/components/LocalizedError'\n",
)
edit(
  'components/ingestion/MasterDataConfigurator.tsx',
  [
    [
      "roleState(role) === 'Needs attention'",
      "roleState(role) === vi('Needs attention')",
    ],
    [
      'label={`${ROLE_LABELS[active]} usage`}',
      'label={vt`${ROLE_LABELS[active]} usage`}',
    ],
    [
      'label={`${ROLE_LABELS[active]} worksheet`}',
      'label={vt`${ROLE_LABELS[active]} worksheet`}',
    ],
    [
      'label={`${ROLE_LABELS[active]} ${field.label} column`}',
      'label={vt`${ROLE_LABELS[active]} ${field.label} column`}',
    ],
    [
      '<p role="alert" className="text-destructive">\n                    {sheet.error}\n                  </p>',
      '<div role="alert" className="text-destructive"><LocalizedError message={sheet.error} /></div>',
    ],
    [
      '<p\n                  role="alert"\n                  className="whitespace-pre-line text-destructive"\n                >\n                  {error}\n                </p>',
      '<div role="alert" className="whitespace-pre-line text-destructive"><LocalizedError message={error} /></div>',
    ],
    [
      '<li key={issue}>{issue}</li>',
      '<li key={issue}><LocalizedError message={issue} /></li>',
    ],
    [
      '<p key={message} className="text-destructive">\n                      {message}\n                    </p>',
      '<div key={message} className="text-destructive"><LocalizedError message={message} /></div>',
    ],
    ['{h}\n', '{vi(h)}\n'],
  ],
  "import { LocalizedError } from '@/components/LocalizedError'\n",
)
edit(
  'components/ingestion/DataMappingView.tsx',
  [
    [
      '<p className="mt-1 break-words leading-relaxed">{error}</p>',
      '<div className="mt-1 break-words leading-relaxed"><LocalizedError message={error} /></div>',
    ],
  ],
  "import { LocalizedError } from '@/components/LocalizedError'\n",
)
edit(
  'components/ingestion/OnboardingWizard.tsx',
  [
    ['{info.label}', '{vi(info.label)}'],
    [': info.label}', ': vi(info.label)}'],
    ["${complete ? ', complete' : ''}", "${complete ? vi(', complete') : ''}"],
    [
      '                  {error}\n',
      '                  <LocalizedError message={error} />\n',
    ],
  ],
  "import { LocalizedError } from '@/components/LocalizedError'\n",
)
edit(
  'pages/Dashboard.tsx',
  [
    [
      '<p className="min-w-0 flex-1 break-words">{error}</p>',
      '<div className="min-w-0 flex-1 break-words"><LocalizedError message={error} /></div>',
    ],
    ['{step.label}', '{vi(step.label)}'],
    ['{info.label}', '{vi(info.label)}'],
    ['{row.type}', '{vi(row.type)}'],
    ['{label}\n', '{vi(label)}\n'],
  ],
  "import { LocalizedError } from '@/components/LocalizedError'\n",
)
edit(
  'pages/ExceptionLog.tsx',
  [['<p>{error}</p>', '<LocalizedError message={error} />']],
  "import { LocalizedError } from '@/components/LocalizedError'\n",
)
edit('pages/DataIngestion.tsx', [['{info.label}', '{vi(info.label)}']])
edit('components/dashboard/WaterfallChart.tsx', [
  [
    'const steps = buildWaterfall(result)',
    'const steps = buildWaterfall(result).map(step => ({ ...step, label: vi(step.label) }))',
  ],
])
edit(
  'components/layout/AppLayout.tsx',
  [
    ["?.label ?? 'Overview'", '?.label ?? vi("Overview")'],
    [
      '<p className="mt-1 break-all text-xs">{error.message}</p>',
      '<div className="mt-1 break-all text-xs"><LocalizedError message={error.message} /></div>',
    ],
    ['className="size-[18px]"', 'className="size-[18px] shrink-0"'],
    ['className="ml-auto size-4"', 'className="ml-auto size-4 shrink-0"'],
  ],
  "import { LocalizedError } from '@/components/LocalizedError'\n",
)
edit('components/SourceIcon.tsx', [
  ['import { vi }', 'import { vi, TERMS }'],
  ['    <span\n', '    <span title={TERMS[source]}\n'],
])
edit(
  'components/CompatibilityNotice.tsx',
  [['{warning}', '<LocalizedNote message={warning} />']],
  "import { LocalizedNote } from '@/components/LocalizedError'\n",
)
edit(
  'components/dashboard/exceptions/ExceptionBadge.tsx',
  [['{category}', '{vi(category)}']],
  "import { vi } from '@/lib/i18n'\n",
)
edit('components/dashboard/exceptions/ExceptionActions.tsx', [
  ['{exceptionActionLabel(row)}', '{vi(exceptionActionLabel(row))}'],
])
edit(
  'components/dashboard/ExceptionLog.tsx',
  [
    ['import { vi, vt }', 'import { vi, vt, viMessage }'],
    ["Intl.DateTimeFormat('en-US'", "Intl.DateTimeFormat('vi-VN'"],
    ["${rows.length === 1 ? 'case' : 'cases'}", "${vi('cases')}"],
    ['${category}', '${vi(category)}'],
    [': category}', ': vi(category)}'],
    [': value}', ': vi(value)}'],
    ['{row.type}', '{vi(row.type)}'],
    ['{label}\n', '{vi(label)}\n'],
    ['{row.description}', '<LocalizedNote message={row.description} />'],
    [
      '<p className="mt-4 max-w-3xl border-t pt-3 text-[13px] leading-6 text-muted-foreground">',
      '<div className="mt-4 max-w-3xl border-t pt-3 text-[13px] leading-6 text-muted-foreground">',
    ],
    [
      '<LocalizedNote message={row.description} />\n                          </p>',
      '<LocalizedNote message={row.description} />\n                          </div>',
    ],
    ['{announcement}', '{viMessage(announcement)}'],
    ["row.storeKey ?? 'Not specified'", 'row.storeKey ?? vi("Not specified")'],
  ],
  "import { LocalizedNote } from '@/components/LocalizedError'\n",
)
edit('pages/Settings.tsx', [
  ["{files.length === 1 ? 'file' : 'files'}", '{vi("files")}'],
])
