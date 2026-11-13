import fs from 'node:fs'
const inventory = JSON.parse(
  fs.readFileSync('.tmp-vi/ui-inventory.json', 'utf8'),
)
const values = JSON.parse(fs.readFileSync('.tmp-vi/ui-vi.json', 'utf8'))
const catalog = Object.fromEntries(
  Object.entries(values).map(([id, text]) => [
    inventory[Number(id)].text,
    text,
  ]),
)
fs.mkdirSync('src/lib/locale', { recursive: true })
fs.writeFileSync(
  'src/lib/locale/vi.ts',
  `/** Vietnamese presentation copy. Keys are source phrases, never processing identifiers. */\nexport const VI: Record<string, string> = ${JSON.stringify(catalog, null, 2)}\n`,
)
if (fs.existsSync('.tmp-vi/meta-vi.json')) {
  const keys = JSON.parse(
      fs.readFileSync('.tmp-vi/meta-inventory.json', 'utf8'),
    ),
    translations = JSON.parse(fs.readFileSync('.tmp-vi/meta-vi.json', 'utf8'))
  const metadata = Object.fromEntries(
    Object.entries(translations).map(([id, text]) => [keys[Number(id)], text]),
  )
  fs.writeFileSync(
    'src/lib/locale/metadata-vi.ts',
    `/** Localized descriptions; processing metadata and expressions remain unchanged. */\nexport const METADATA_VI: Record<string,string> = ${JSON.stringify(metadata, null, 2)}\n`,
  )
}
console.log(Object.keys(catalog).length)
