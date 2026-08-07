---
name: email-draft
description: Write a Magic Cats newsletter issue and build it to a single HTML file the user pastes into their newsletter provider. Use when asked to write, edit, or preview a newsletter/email issue (e.g. "draft the launch email", "write issue 2", "update the newsletter copy").
---

# Newsletter issues

Compose here, build to one HTML file, hand it to the user to paste into their
provider. **Nothing in this repo sends email or talks to a provider API** — no
keys, no accounts. Don't add any.

```
email/
├── template.html   the branded shell — edit rarely
├── issues/         one file per issue: JSON metadata comment + HTML body
├── build.mjs       issue + template -> email/out/<slug>.html
└── out/            generated, gitignored
```

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

`subject`, `preheader` and `cta` are required; the build fails without them.

### Body rules — email is not the web

The body is injected into a table-based, inline-styled shell. Follow the same
constraints or it breaks in Outlook and Gmail:

- **Inline styles only.** No `<style>` blocks, no classes, no external CSS.
- **No flexbox or grid.** Use tables if you need columns.
- **Every `<p>` needs an explicit `margin`** — clients disagree on defaults.
- **No `text-shadow`, no gradients, no animation.** Gmail strips them, Outlook
  ignores them. The site's neon glow cannot be reproduced; use solid brand
  colours instead.
- **Custom fonts will not load.** `'Cinzel Decorative', Georgia, serif` is
  deliberate: whoever has the font gets it, everyone else gets Georgia. Never
  let the display fonts carry meaning.
- **Absolute URLs** for every link and image.
- Palette: `#08001a` void, `#120030` card, `#9b00ff` magic, `#ffd700` gold,
  `#00ffff` cyan, `#ff00ff` magenta, `#c0c0c0` body text.

### Merge tags belong to the provider

`greeting` and `unsubscribeUrl` pass through untouched so they can hold any
provider's syntax — `{{{triple}}}`, `{$dollar}`, `*|PIPE|*`. The build only
substitutes its own `{{UPPERCASE}}` placeholders.

Never "fix" a provider merge tag that looks unresolved in `email/out/` — it is
resolved at send time, not build time. `email/README.md` has a syntax table per
provider.

## Build and check

```bash
pnpm email:build <issue-slug>      # -> email/out/<issue-slug>.html
```

Open the file in a browser to check layout. Be honest with the user about what
that proves: Chrome is the most forgiving renderer there is, so a good preview
means "not obviously broken", not "correct in Outlook".

If the build warns that `unsubscribeUrl` is unset, tell the user — an EU-facing
list legally needs a working unsubscribe, from either their merge tag or their
provider's own appended footer.

## Handing it over

After a successful build, tell the user to:

1. Copy the contents of `email/out/<slug>.html`.
2. Create a campaign in their provider using its **custom HTML** option, paste.
3. Send a test to themselves and check it in **Gmail and Outlook** — that's where
   font fallbacks and the Outlook VML button diverge.
4. Verify the subject and preheader as they appear in the inbox list, then click
   the CTA and the unsubscribe link.
5. Send to the list.
