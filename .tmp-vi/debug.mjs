import fs from 'node:fs'
import { parseSync } from 'rolldown/utils'
const a = parseSync(
  'a.tsx',
  fs.readFileSync('src/pages/Dashboard.tsx', 'utf8'),
).program
function walk(n, parents = []) {
  if (!n || typeof n !== 'object') return
  if (
    n.type === 'Literal' &&
    ['GL Finance', 'Results ready', 'Reporting controls'].includes(n.value)
  )
    console.log(
      n,
      parents.map((p) => p.type + ' ' + (p.name?.name ?? p.key?.name ?? '')),
    )
  for (const [k, v] of Object.entries(n))
    if (!['parent', 'loc'].includes(k)) {
      if (Array.isArray(v)) v.forEach((c) => walk(c, [n, ...parents]))
      else if (v && typeof v === 'object') walk(v, [n, ...parents])
    }
}
walk(a)
