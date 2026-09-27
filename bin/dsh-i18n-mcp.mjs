#!/usr/bin/env node

import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createTranslationTools, getPackageVersion, makeMcpToolResult } from '../lib/mcp-tools.js'

const SERVER_NAME = 'dsh-i18n-mcp'

function printHelp() {
  process.stdout.write(`dsh-i18n-mcp — local community translation assistance over MCP stdio\n\nUsage:\n  dsh-i18n-mcp --repo <checkout-path>\n\nThe path must be a Git checkout of @tommilevs/dsh-multi-lang-ui.\nNo network listener or GitHub credentials are used.\n`)
}

function parseArguments(argv) {
  let repoPath
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--help' || argument === '-h') return { help: true }
    if (argument === '--repo') {
      if (repoPath !== undefined) throw new Error('Pass --repo only once')
      repoPath = argv[++index]
      if (!repoPath || repoPath.startsWith('--')) throw new Error('--repo requires a checkout path')
      continue
    }
    throw new Error(`Unknown argument: ${argument}`)
  }
  if (!repoPath) throw new Error('Pass an explicit --repo path to a Git checkout')
  return { repoPath }
}

function registerTool(server, name, description, inputSchema, handler) {
  server.registerTool(name, { description, inputSchema }, async (input) => {
    try {
      return makeMcpToolResult(await handler(input))
    } catch (error) {
      return makeMcpToolResult({ error: error.message }, { isError: true })
    }
  })
}

export function createTranslationMcpServer(repoPath) {
  const tools = createTranslationTools(repoPath)
  const server = new McpServer({ name: SERVER_NAME, version: getPackageVersion() })
  const pluginId = z.string().min(1).max(200)
  const locale = z.string().min(2).max(35)
  const pack = z.record(z.string(), z.unknown())

  registerTool(
    server,
    'list_translation_coverage',
    'List validated community translation packs with plugin metadata, locales, entry counts, and source-map availability.',
    {},
    () => tools.listTranslationCoverage()
  )
  registerTool(
    server,
    'get_translation_source',
    'Return the exact source namespace strings and scoped DOM source text available for one plugin.',
    { pluginId, sourceLocale: locale.optional() },
    (input) => tools.getTranslationSource(input)
  )
  registerTool(
    server,
    'scaffold_translation_pack',
    'Create an in-memory locale-pack draft whose translation targets carry explicit placeholders until translated.',
    { pluginId, locale, sourceLocale: locale.optional() },
    (input) => tools.scaffoldTranslationPack(input)
  )
  registerTool(
    server,
    'validate_translation_pack',
    'Validate pack fields, source-key parity, placeholders, scoped DOM selectors, and conflicts with the checkout catalog.',
    { pack },
    ({ pack: candidate }) => tools.validateTranslationPack(candidate)
  )
  registerTool(
    server,
    'stage_translation_pack',
    'Stage a valid JSON pack under the checkout contributions/ directory. Existing files require overwrite: true.',
    { pack, overwrite: z.boolean().optional() },
    (input) => tools.stageTranslationPack(input)
  )
  registerTool(
    server,
    'stage_source_catalog',
    'Create and stage a new plugin source-locale catalog from exact source strings. DOM targets are initialized to their source text; existing files require overwrite: true.',
    z.object({
      plugin: z.object({
        id: z.string().min(1).max(200),
        version: z.string().min(1).max(200),
        source: z.string().url().max(2048),
        license: z.string().min(1).max(200),
      }).strict(),
      sourceLocale: z.string().min(2).max(35),
      namespaces: z.record(z.string(), z.record(z.string(), z.string())),
      dom: z.array(z.object({
        selector: z.string().min(1).max(300),
        source: z.string().min(1).max(100000),
      }).strict()).max(10000).optional(),
      overwrite: z.boolean().optional(),
    }).strict(),
    (input) => tools.stageSourceCatalog(input)
  )
  return server
}

async function main() {
  const args = parseArguments(process.argv.slice(2))
  if (args.help) {
    printHelp()
    return
  }
  const server = createTranslationMcpServer(args.repoPath)
  await server.connect(new StdioServerTransport())
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  })
}
