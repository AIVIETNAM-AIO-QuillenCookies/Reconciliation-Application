import fs from 'node:fs'
import { parseSync } from 'rolldown/utils'
import {
  modelNodes,
  modelConnections,
  methodologyRules,
} from '../src/lib/methodology.ts'
import { MAPPING_FIELDS } from '../src/lib/data-mapping.ts'
import {
  REFERENCE_FIELDS,
  ROLE_LABELS,
  PURPOSE_LABELS,
} from '../src/lib/master-data.ts'
import { ONBOARDING_STEPS } from '../src/lib/onboarding.ts'
import { ACCOUNTING_SOURCE_FIELDS } from '../src/lib/reconciliation-schema.ts'
import { VI } from '../src/lib/locale/vi.ts'
const texts = new Set()
const add = (s) => {
  if (s && !VI[s.replace(/\s+/g, ' ').trim()]) texts.add(s)
}
for (const source of Object.values(MAPPING_FIELDS))
  for (const f of source) {
    add(f.label)
    add(f.description)
  }
for (const a of Object.values(REFERENCE_FIELDS))
  for (const f of a) {
    add(f.label)
    add(f.description)
  }
Object.values(ROLE_LABELS).forEach(add)
Object.values(PURPOSE_LABELS).forEach(add)
ONBOARDING_STEPS.forEach((s) => {
  add(s.label)
  add(s.name)
  add(s.description)
})
for (const n of modelNodes) {
  ;['title', 'role', 'grain', 'caution'].forEach((k) => add(n[k]))
  n.logic.forEach(add)
  n.fields.forEach((f) => add(f.description))
  n.keys.filter((s) => s.includes(' ')).forEach(add)
}
for (const e of modelConnections) {
  ;['label', 'operation', 'cardinality', 'condition', 'explanation'].forEach(
    (k) => add(e[k]),
  )
  e.keys.filter((s) => s.includes(' ')).forEach(add)
}
for (const r of methodologyRules) {
  ;[
    'title',
    'group',
    'purpose',
    'condition',
    'logic',
    'output',
    'nullError',
  ].forEach((k) => add(r[k]))
  r.inputFields.filter((s) => s.includes(' ')).forEach(add)
}
Object.values(ACCOUNTING_SOURCE_FIELDS).forEach(add)
for (const file of [
  'src/lib/reconciliation-evidence.ts',
  'src/lib/reconciliation-accounting.ts',
]) {
  const ast = parseSync(file, fs.readFileSync(file, 'utf8')).program
  function walk(n, p) {
    if (!n || typeof n !== 'object') return
    if (
      n.type === 'Literal' &&
      typeof n.value === 'string' &&
      p?.type === 'Property' &&
      ['label', 'grain', 'detail', 'scope', 'sourceRowNote'].includes(
        p.key.name,
      )
    )
      add(n.value)
    if (
      n.type === 'Literal' &&
      typeof n.value === 'string' &&
      p?.type === 'CallExpression' &&
      p.callee.property?.name === 'push' &&
      n.value.includes(' ')
    )
      add(n.value)
    for (const v of Object.values(n)) {
      if (Array.isArray(v)) v.forEach((c) => walk(c, n))
      else if (v && typeof v === 'object') walk(v, n)
    }
  }
  walk(ast)
}
fs.writeFileSync(
  '.tmp-vi/meta-inventory.json',
  JSON.stringify([...texts], null, 2),
)
console.log([...texts].map((s, i) => i + ' ' + s).join('\n'))
