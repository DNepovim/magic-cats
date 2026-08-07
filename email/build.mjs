#!/usr/bin/env node
/**
 * Renders an issue into a complete email by filling email/template.html.
 *
 * An issue is a single HTML file whose leading comment is a JSON block of
 * metadata; everything after it is the body. Output goes to email/out/.
 *
 * Usage: node email/build.mjs <issue-slug>
 */
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const ISSUES_DIR = join(here, 'issues')
const OUT_DIR = join(here, 'out')

export const listIssues = async () =>
  (await readdir(ISSUES_DIR)).filter((f) => f.endsWith('.html')).map((f) => f.replace(/\.html$/, ''))

const parseIssue = (raw, slug) => {
  const match = raw.match(/^\s*<!--([\s\S]*?)-->/)
  if (!match) throw new Error(`${slug}: missing leading <!-- { ... } --> metadata block`)

  let meta
  try {
    meta = JSON.parse(match[1])
  } catch (err) {
    throw new Error(`${slug}: metadata block is not valid JSON — ${err.message}`)
  }

  for (const key of ['subject', 'preheader', 'cta']) {
    if (!meta[key]) throw new Error(`${slug}: metadata is missing "${key}"`)
  }
  if (!meta.cta.url || !meta.cta.label) throw new Error(`${slug}: cta needs both "url" and "label"`)

  return { meta, body: raw.slice(match[0].length).trim() }
}

export const buildIssue = async (slug) => {
  const raw = await readFile(join(ISSUES_DIR, `${slug}.html`), 'utf8')
  const { meta, body } = parseIssue(raw, slug)
  const template = await readFile(join(here, 'template.html'), 'utf8')

  const replacements = {
    LANG: meta.lang ?? 'en',
    SUBJECT: meta.subject,
    PREHEADER: meta.preheader,
    KICKER: meta.kicker ?? '',
    BODY: body,
    CTA_URL: meta.cta.url,
    CTA_LABEL: meta.cta.label,
    FOOTER: meta.footer ?? '',
    // Personalisation and unsubscribe are provider-specific. Set these per issue
    // to whatever merge-tag syntax your provider uses; defaults are plain.
    GREETING: meta.greeting ?? 'Hi there,',
    UNSUBSCRIBE_URL: meta.unsubscribeUrl ?? '%%UNSUBSCRIBE_URL%%',
    UNSUBSCRIBE_LABEL: meta.unsubscribeLabel ?? 'Unsubscribe',
  }

  // Only our own {{TOKEN}} placeholders are substituted. Provider merge tags —
  // {{{triple}}}, {$dollar}, *|PIPE|* — must survive untouched.
  const html = Object.entries(replacements).reduce(
    (acc, [key, value]) => acc.replaceAll(`{{${key}}}`, value),
    template,
  )

  // Lookaround on both sides so a provider's {{{TRIPLE_BRACE}}} tag isn't
  // mistaken for one of ours left unreplaced.
  const leftover = html.match(/(?<!\{)\{\{(?!\{)[A-Z_]+\}\}(?!\})/g)
  if (leftover) throw new Error(`${slug}: unreplaced placeholders ${[...new Set(leftover)].join(', ')}`)

  const warnings = html.includes('%%UNSUBSCRIBE_URL%%')
    ? [
        'unsubscribeUrl not set — the footer link points at a placeholder.\n' +
          '  Set it to your provider\'s merge tag, or drop the link if the\n' +
          '  provider appends its own unsubscribe footer.',
      ]
    : []

  await mkdir(OUT_DIR, { recursive: true })
  const outPath = join(OUT_DIR, `${slug}.html`)
  await writeFile(outPath, html, 'utf8')

  return { meta, html, outPath, warnings }
}

const main = async () => {
  const slug = process.argv[2]
  if (!slug) {
    const issues = await listIssues()
    console.error('Usage: node email/build.mjs <issue-slug>\n\nAvailable issues:')
    for (const issue of issues) console.error(`  ${issue}`)
    process.exit(1)
  }

  const { meta, outPath, warnings } = await buildIssue(slug)
  console.log(`Subject: ${meta.subject}`)
  console.log(`Built:   ${outPath}`)

  for (const warning of warnings) console.warn(`\nWarning: ${warning}`)

  console.log('\nPaste the file contents into your provider as a custom-HTML')
  console.log('campaign, send yourself a test, then send to the list.')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.message)
    process.exit(1)
  })
}
