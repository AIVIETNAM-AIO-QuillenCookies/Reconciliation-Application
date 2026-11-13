import fs from 'node:fs'
import { parseSync } from 'rolldown/utils'
const files = fs
  .readdirSync('src', { recursive: true })
  .filter((f) => f.endsWith('.tsx'))
  .map((f) => 'src/' + f.replaceAll('\\', '/'))
const texts = []
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8')
  function w(n, ps = []) {
    if (!n || typeof n !== 'object') return
    if (
      ps.some(
        (p) =>
          (p.type === 'CallExpression' &&
            ['vi', 'viMessage', 'vt'].includes(p.callee?.name)) ||
          (p.type === 'TaggedTemplateExpression' && p.tag.name === 'vt'),
      )
    )
      return
    if (
      ps.some((p) =>
        [
          'ImportDeclaration',
          'TSTypeAnnotation',
          'TSLiteralType',
          'TSTypeAliasDeclaration',
        ].includes(p.type),
      )
    )
      return
    const p = ps[0],
      attr = ps.find((p) => p.type === 'JSXAttribute'),
      key = ps.find((p) => p.type === 'Property')?.key
    const s =
      n.type === 'JSXText'
        ? n.value.trim()
        : n.type === 'Literal' && typeof n.value === 'string'
          ? n.value
          : n.type === 'TemplateLiteral'
            ? n.quasis
                .map(
                  (q, i) =>
                    q.value.cooked + (i < n.expressions.length ? `{${i}}` : ''),
                )
                .join('')
            : null
    if (
      s &&
      /[A-Za-z]/.test(s) &&
      !s.includes('@/') &&
      !/var\(--|\b(bg-|mw-|text-|rounded-|size-|items-|motion-safe|justify-|data-\[|border-|h-|w-|px-|mt-)/.test(
        s,
      ) &&
      (!attr ||
        [
          'aria-label',
          'title',
          'placeholder',
          'aria-description',
          'label',
          'description',
          'eyebrow',
        ].includes(attr.name.name)) &&
      (!key ||
        ![
          'id',
          'className',
          'color',
          'type',
          'style',
          'value',
          'source',
          'variant',
          'icon',
          'to',
          'kind',
          'side',
          'direction',
          'dataKey',
          'key',
          'align',
        ].includes(key.name)) &&
      !['MemberExpression', 'BinaryExpression'].includes(p?.type) &&
      !(p?.type === 'Property' && p.key === n)
    )
      if (n.type === 'JSXText' || s.includes(' ') || /^[A-Z][a-z]+/.test(s))
        texts.push({
          file,
          line: source.slice(0, n.start).split('\n').length,
          s: s.replace(/\s+/g, ' '),
          p: p?.type,
        })
    for (const [k, v] of Object.entries(n))
      if (!['parent', 'loc', 'range'].includes(k)) {
        if (Array.isArray(v)) v.forEach((c) => w(c, [n, ...ps]))
        else if (v && typeof v === 'object') w(v, [n, ...ps])
      }
  }
  w(parseSync(file, source).program)
}
fs.writeFileSync('.tmp-vi/remaining.json', JSON.stringify(texts, null, 2))
for (const t of texts) console.log(t.file + ':' + t.line + ' ' + t.s)
