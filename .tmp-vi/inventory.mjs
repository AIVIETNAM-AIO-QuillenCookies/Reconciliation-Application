import fs from 'node:fs'
import { parseSync } from 'rolldown/utils'
const files = fs
  .readdirSync('src', { recursive: true })
  .filter((f) => f.endsWith('.tsx'))
  .map((f) => 'src/' + f.replaceAll('\\', '/'))
const texts = new Map(
  JSON.parse(fs.readFileSync('.tmp-vi/ui-inventory.json', 'utf8')).map((e) => [
    e.text,
    e,
  ]),
)
const add = (text, file, kind) => {
  const key = text.replace(/\s+/g, ' ').trim()
  if (!/[A-Za-z]/.test(key)) return
  if (!texts.has(key)) texts.set(key, { text: key, files: [], kinds: [] })
  const entry = texts.get(key)
  if (!entry.files.includes(file)) entry.files.push(file)
  if (!entry.kinds.includes(kind)) entry.kinds.push(kind)
}
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8'),
    source = parseSync(file, content).program
  const visit = (n, p) => {
    if (!n || typeof n !== 'object') return
    if (n.type === 'JSXText') add(n.value, file, 'jsx')
    if (n.type === 'Literal' && typeof n.value === 'string') {
      let skip = false
      if (
        [
          'ImportDeclaration',
          'ExportNamedDeclaration',
          'ExportAllDeclaration',
          'TSLiteralType',
        ].includes(p?.type)
      )
        skip = true
      if (
        p?.type === 'JSXAttribute' &&
        ![
          'aria-label',
          'aria-description',
          'title',
          'placeholder',
          'alt',
          'label',
          'description',
          'eyebrow',
        ].includes(p.name.name)
      )
        skip = true
      if (
        p?.type === 'Property' &&
        [
          'className',
          'color',
          'style',
          'variant',
          'id',
          'source',
          'key',
          'dataKey',
          'kind',
          'type',
          'value',
          'direction',
          'side',
          'align',
        ].includes(p.key.name ?? p.key.value)
      )
        skip = true
      if (
        ['BinaryExpression', 'SwitchCase', 'MemberExpression'].includes(p?.type)
      )
        skip = true
      if (
        n.value.includes('@/') ||
        n.value.includes('../') ||
        n.value.includes('var(--') ||
        /\b(bg-|text-|rounded-|size-|focus:|data-\[|items-center|justify-)/.test(
          n.value,
        ) ||
        (!n.value.includes(' ') && n.value.toLowerCase() === n.value)
      )
        skip = true
      if (!skip) add(n.value, file, 'literal')
    }
    if (n.type === 'TemplateLiteral') {
      const text = n.quasis
        .map(
          (q, i) => q.value.cooked + (i < n.expressions.length ? `{${i}}` : ''),
        )
        .join('')
      if (
        /[A-Za-z]+[ :]/.test(text) &&
        !text.includes('mw-') &&
        !text.includes('size-')
      )
        add(text, file, 'template')
    }
    for (const [k, v] of Object.entries(n))
      if (k !== 'parent' && k !== 'loc' && k !== 'range') {
        if (Array.isArray(v)) v.forEach((c) => visit(c, n))
        else if (v && typeof v === 'object') visit(v, n)
      }
  }
  visit(source)
}
fs.writeFileSync(
  '.tmp-vi/ui-inventory.json',
  JSON.stringify([...texts.values()], null, 2),
)
console.log(texts.size)
