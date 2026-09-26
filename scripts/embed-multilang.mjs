import { readFile, writeFile } from 'node:fs/promises'
import { minify } from 'terser'

const clientPath = new URL('../lib/client.js', import.meta.url)
const basePath = new URL('../build-src/client.js', import.meta.url)
const extensionPath = new URL('../lib/multi-lang-client.js', import.meta.url)
const domHelpersPath = new URL('../lib/dom-translation.js', import.meta.url)
const packagePath = new URL('../package.json', import.meta.url)
const { version: packageVersion } = JSON.parse(await readFile(packagePath, 'utf8'))
const source = (await readFile(basePath, 'utf8')).trim().replaceAll('__PKG_VERSION__', packageVersion)
const extension = (await readFile(extensionPath, 'utf8')).trim()
const domHelpers = (await readFile(domHelpersPath, 'utf8')).trim()
const applyPattern = /function apply\(ctx\)\s*\{/g

if (!applyPattern.test(source)) throw new Error('Could not find the base browser apply(ctx) entrypoint')
applyPattern.lastIndex = 0
const client = source.replace(applyPattern, () => `function apply(ctx){\n${domHelpers}\napplyMultiLang(ctx);\n${extension}\n`)
if (!client.includes('applyMultiLang(ctx)') || client.includes('DSH_MULTI_LANG_UI_EXTENSION_BEGIN')) {
  throw new Error('Community client integration markers are inconsistent')
}

const bundled = await minify(client, {
  compress: true,
  mangle: true,
  format: { comments: false },
})
if (!bundled.code) throw new Error('Terser did not produce the DSH client bundle')
const size = Buffer.byteLength(bundled.code)
const maximumBytes = 160 * 1024
if (size > maximumBytes) throw new Error(`DSH client bundle exceeds ${maximumBytes} bytes (${size})`)

await writeFile(clientPath, `${bundled.code}\n`)
console.log(`Built community locale client (${size} bytes)`)
