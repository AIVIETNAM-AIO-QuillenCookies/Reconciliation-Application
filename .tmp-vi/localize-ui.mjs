import fs from 'node:fs'
import { parseSync } from 'rolldown/utils'
import { VI as UI } from '../src/lib/locale/vi.ts'
import { COMMON_VI } from '../src/lib/locale/common-vi.ts'
import { METADATA_VI } from '../src/lib/locale/metadata-vi.ts'
const VI = { ...METADATA_VI, ...COMMON_VI, ...UI }
const files = fs
  .readdirSync('src', { recursive: true })
  .filter((f) => f.endsWith('.tsx') && !f.includes('LocalizedError'))
  .map((f) => 'src/' + f.replaceAll('\\', '/'))
const humanProps = new Set([
  'label',
  'name',
  'title',
  'description',
  'detail',
  'eyebrow',
  'placeholder',
  'aria-label',
  'aria-description',
  'alt',
])
const normalize = (s) => s.replace(/\s+/g, ' ').trim()
for (const file of files) {
  let source = fs.readFileSync(file, 'utf8')
  const ast = parseSync(file, source).program,
    replacements = []
  const eligible = (n, parents) => {
    if (
      parents.some(
        (p) =>
          (p.type === 'CallExpression' && p.callee?.name === 'vi') ||
          (p.type === 'TaggedTemplateExpression' && p.tag?.name === 'vt'),
      )
    )
      return false
    if (
      parents.some((p) =>
        ['ImportDeclaration', 'TSLiteralType', 'TSTypeAnnotation'].includes(
          p.type,
        ),
      )
    )
      return false
    const p = parents[0]
    if (p?.type === 'Property' && p.key === n) return false
    if (
      ['BinaryExpression', 'SwitchCase', 'MemberExpression'].includes(p?.type)
    )
      return false
    if (p?.type === 'Property' && humanProps.has(p.key.name ?? p.key.value))
      return true
    const attr = parents.find((p) => p.type === 'JSXAttribute')
    if (attr && !humanProps.has(attr.name.name)) return false
    if (parents.some((p) => p.type === 'ArrayExpression')) return false
    if (
      parents.some(
        (p) => p.type === 'JSXExpressionContainer' || p.type === 'JSXAttribute',
      )
    )
      return true
    if (
      parents.some(
        (p) =>
          p.type === 'ConditionalExpression' || p.type === 'ReturnStatement',
      )
    )
      return true
    if (
      p?.type === 'CallExpression' &&
      /^(setError|setAnnouncement|setFeedback)$/.test(p.callee.name ?? '')
    )
      return true
    if (
      p?.type === 'VariableDeclarator' &&
      /label|message|error|title/i.test(p.id.name ?? '')
    )
      return true
    return false
  }
  const walk = (n, parents = []) => {
    if (!n || typeof n !== 'object') return
    if (n.type === 'JSXText') {
      const text = normalize(n.value)
      if (VI[text]) {
        replacements.push([
          n.start,
          n.end,
          `{${/^\s/.test(n.value) ? JSON.stringify(' ') + ' + ' : ''}vi(${JSON.stringify(text)})${/\s$/.test(n.value) ? ' + ' + JSON.stringify(' ') : ''}}`,
        ])
        return
      }
    }
    if (
      n.type === 'Literal' &&
      typeof n.value === 'string' &&
      VI[normalize(n.value)] &&
      eligible(n, parents)
    ) {
      if (source.slice(n.start, n.end) !== n.raw)
        throw Error('Unexpected parser offset: ' + file)
      const jsx = parents[0]?.type === 'JSXAttribute'
      replacements.push([
        n.start,
        n.end,
        `${jsx ? '{' : ''}vi(${JSON.stringify(normalize(n.value))})${jsx ? '}' : ''}`,
      ])
      return
    }
    if (n.type === 'TemplateLiteral' && eligible(n, parents)) {
      const key = n.quasis
        .map(
          (q, i) => q.value.cooked + (i < n.expressions.length ? `{${i}}` : ''),
        )
        .join('')
      if (VI[normalize(key)]) {
        replacements.push([n.start, n.end, 'vt' + source.slice(n.start, n.end)])
        return
      }
    }
    for (const [key, value] of Object.entries(n))
      if (!['loc', 'range', 'parent'].includes(key)) {
        if (Array.isArray(value)) value.forEach((v) => walk(v, [n, ...parents]))
        else if (value && typeof value === 'object')
          walk(value, [n, ...parents])
      }
  }
  walk(ast)
  if (!replacements.length) continue
  for (const [start, end, text] of replacements.sort((a, b) => b[0] - a[0]))
    source = source.slice(0, start) + text + source.slice(end)
  const helpers = [
    replacements.some((r) => r[2].includes('vi(')) ? 'vi' : null,
    replacements.some((r) => r[2].startsWith('vt`')) ? 'vt' : null,
  ].filter(Boolean)
  const current = source.match(
    /import \{ ([\w, ]+) \} from ['"]@\/lib\/i18n['"]/,
  )
  if (current) {
    const names = [
      ...new Set([...current[1].split(',').map((s) => s.trim()), ...helpers]),
    ]
    source = source.replace(
      current[0],
      `import { ${names.join(', ')} } from '@/lib/i18n'`,
    )
  } else
    source = `import { ${helpers.join(', ')} } from '@/lib/i18n'\n` + source
  fs.writeFileSync(file, source)
  console.log(file, replacements.length)
}
