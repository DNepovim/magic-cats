# Newsletter

Write an issue here, build it to a single HTML file, then paste that file into
whatever newsletter provider you use. Nothing in this directory talks to a
provider — no API keys, no accounts, no lock-in.

```
email/
├── template.html   the branded shell — edit rarely
├── issues/         one file per issue: JSON metadata comment + HTML body
├── build.mjs       issue + template -> email/out/<slug>.html
└── out/            generated, gitignored
```

## The loop

```bash
pnpm email:build 2026-08-17-launch
```

Then:

1. Open `email/out/<slug>.html` in a browser to check the layout.
2. Copy the file's contents.
3. In your provider, create a campaign using its **custom HTML** / "paste your
   own HTML" option, and paste.
4. Send yourself a test. Check it in **Gmail and Outlook** — those two are where
   the font fallbacks and the Outlook button diverge.
5. Send to the list.

Most providers offer a custom-HTML campaign type, but some gate it behind a paid
tier. Confirm yours does before writing a long issue.

## Writing an issue

Create `email/issues/<YYYY-MM-DD>-<slug>.html`. The leading HTML comment is a
JSON metadata block; everything after it is the body.

```html
<!--
{
  "subject": "The gates open today 🐾",
  "preheader": "Magic Cats is live. Come tame your first cat.",
  "lang": "en",
  "kicker": "N E W S L E T T E R  ·  I S S U E  0 1",
  "cta": { "label": "⚔️ Enter the Realm ⚔️", "url": "https://meow.magic-cats.fyi" },
  "footer": "You are getting this because you signed up at magic-cats.fyi.",
  "greeting": "Hi there,",
  "unsubscribeUrl": "%%UNSUBSCRIBE_URL%%",
  "unsubscribeLabel": "Unsubscribe"
}
-->

<h1 style="...">Heading</h1>
<p style="margin:0 0 16px 0;">Copy…</p>
```

`subject`, `preheader` and `cta` are required — the build fails without them.
Everything else has a default.

## Merge tags are provider-specific

`greeting` and `unsubscribeUrl` are passed through untouched, so set them to
your provider's syntax. Common ones:

| Provider | First name | Unsubscribe URL |
| --- | --- | --- |
| Resend | `{{{contact.first_name\|there}}}` | `{{{RESEND_UNSUBSCRIBE_URL}}}` |
| MailerLite | `{$name}` | `{$unsubscribe}` |
| Mailchimp | `*\|FNAME\|*` | `*\|UNSUB\|*` |
| Brevo | `{{ contact.FIRSTNAME }}` | `{{ unsubscribe }}` |

Verify against your provider's current docs — these change.

Example for Resend:

```json
"greeting": "Hi {{{contact.first_name|there}}},",
"unsubscribeUrl": "{{{RESEND_UNSUBSCRIBE_URL}}}"
```

The build only substitutes its own `{{UPPERCASE}}` placeholders and errors on any
it misses, so provider tags in any syntax survive intact.

If you leave `unsubscribeUrl` unset, the build warns and the footer link points
at `%%UNSUBSCRIBE_URL%%`. Some providers append their own unsubscribe footer
automatically — if yours does, delete the footer link from `template.html`
rather than shipping a dead one.

## Body rules — email is not the web

The body is injected into a table-based, inline-styled shell. Follow the same
constraints or it breaks in Outlook and Gmail:

- **Inline styles only.** No `<style>` blocks, no classes, no external CSS.
- **No flexbox or grid.** Use tables if you need columns.
- **Every `<p>` needs an explicit `margin`** — clients disagree on defaults.
- **No `text-shadow`, no gradients, no animation.** Gmail strips them, Outlook
  ignores them. The site's neon glow cannot be reproduced; use solid brand
  colours instead.
- **Custom fonts will not load.** `'Cinzel Decorative', Georgia, serif` is
  deliberate: recipients who happen to have the font get it, everyone else gets
  Georgia. Never rely on the display fonts carrying meaning.
- **Absolute URLs** for every link and image.
- Palette: `#08001a` void, `#120030` card, `#9b00ff` magic, `#ffd700` gold,
  `#00ffff` cyan, `#ff00ff` magenta, `#c0c0c0` body text.

A browser preview only proves "not obviously broken" — Chrome is the most
forgiving renderer there is. The test send is what tells you the truth.

## Before you send to real people

This list is EU-facing, so GDPR applies:

- Collect explicit consent — no pre-ticked boxes. Double opt-in is the safer
  pattern for a launch list.
- Every send needs a working unsubscribe link, whether from your merge tag or
  the provider's own footer.
- Identify yourself honestly in the footer: who is sending, and why the
  recipient is getting it.

## Still outstanding

The signup form at `magic-cats.fyi` posts to `action="#"`, so **no addresses are
being captured yet**. Wiring it up needs a serverless endpoint
(`apps/web/src/pages/api/subscribe.ts` with `export const prerender = false`),
because the site is statically prerendered and the CSP sets `form-action 'self'`.
