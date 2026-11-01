# Quiver

A private, keyboard-first library for the AI prompts that actually work. Each prompt is tagged with the model it was written for, found in a keystroke, and copied in one more.

**Open it:** <https://sangeethan-dev.github.io/quiver-app/> (Edge or Chrome on desktop)

## Privacy

Your prompts live in a folder on your PC, as plain Markdown files, and they never leave it.

- There is no account, no server, no analytics and no tracking.
- Quiver makes no network requests except loading its own files from the site it was opened from.
- The service worker that makes Quiver work offline stores only the app's own files, never your prompts.
- The browser only lets Quiver reach the one folder you choose, and it asks your permission first.

The one thing stored outside your folder is a convenience: values you last typed into a prompt's fill-in form are kept in your browser's local storage, so the form can prefill them next time.

## Using Quiver

### Choose a folder

Quiver needs a folder of its own, because it can read and write everything inside the one you pick. Create a new, empty folder such as `Documents\Quiver`. Don't choose Documents, Desktop or a whole drive.

If the browser asks for permission again on a later visit, click **Reconnect folder** and choose **Allow on every visit**.

### Install it (optional)

Click the **Install** icon at the right of the address bar. Quiver then opens in its own window and can be pinned to the taskbar. It has the same features either way.

After one visit, Quiver works without an internet connection, installed or not.

### Keyboard shortcuts

| Key | Action |
|---|---|
| Ctrl+K | Open the command palette |
| N | New prompt |
| / | Focus the search box |
| ↑ / ↓ or J / K | Move selection |
| Enter | Copy the selected prompt |
| F | Toggle favorite |
| E | Edit |
| Delete | Move to trash |
| ? | Show shortcuts |

Except for Ctrl+K, these don't fire while you're typing in a field.

In the command palette:

| Key | Action |
|---|---|
| ↑ / ↓ | Move through results |
| Enter | Copy, or open the fill-in form |
| Alt+1 to Alt+9 | Filter by model |
| Alt+F | Toggle favorite |
| Alt+E | Edit |
| Esc | Close |

In the search box, ↑ / ↓ move the selection, Enter copies, and Esc clears the search, then leaves the box.

In the fill-in form, Enter moves to the next field (and copies from the last one), Ctrl+Enter copies from anywhere, and Esc closes. In the editor, Ctrl+S or Ctrl+Enter saves.

### Variables

Put `{{name}}` in a prompt for anything you fill in each time. Prompts with variables open a short form before copying, with a live preview.

| You write | What it does |
|---|---|
| `{{audience}}` | A field called audience |
| `{{tone\|friendly}}` | A field prefilled with a default, friendly |
| `{{audience}}` used twice | One field, filled in once |
| `\{{name}}` | The literal text `{{name}}`, not a variable |

- Names can use letters, numbers, spaces, underscores and hyphens.
- A variable named `text`, `content`, `input`, `context` or `code`, or one with a multi-line default, gets a larger box.
- Braces that aren't a valid variable, such as JSON, are left exactly as written.
- A default ends at the first `}}`, and it keeps any spaces you put in it, so write `{{tone|friendly}}` rather than `{{tone | friendly}}`.

## File format

One Markdown file per prompt, readable and editable in Notepad.

```text
Quiver/
  _settings.json                       Your models
  rewrite-tone-and-register--k3f9a2.md A prompt
  _history/k3f9a2/v1.md                Earlier versions of a prompt
  _trash/old-prompt--x1y2z3.md         Deleted prompts
```

```markdown
---
id: k3f9a2
title: Rewrite · tone & register
model: claude
tags: [writing, email]
favorite: true
version: 3
created: 2026-11-01T08:30:00+05:30
updated: 2026-11-03T14:12:00+05:30
lastUsed: 2026-11-04T09:01:00+05:30
useCount: 12
---
Rewrite the text below in a {{tone|friendly}} tone for {{audience}}.
```

- Everything after the closing `---` is the prompt, kept exactly as written.
- The `id` (6 lowercase letters or numbers) identifies the prompt. The filename is only for your convenience, and it follows the title.
- A new version is saved to `_history` when the body changes. Other edits don't create one.
- Deleting moves a file to `_trash`. Only **Empty trash** in Settings removes anything for good, and it leaves `_history` in place.
- Files starting with `_` or `.` and anything that isn't `.md` are ignored. A file that can't be read is listed under "Couldn't read" and isn't changed.
- Edits made outside Quiver appear when you return to the window. If a file changed while you were editing it, Quiver asks which version to keep.

## Development

Requires Node 22.12 or later.

```bash
npm install
```

```bash
npm run dev
```

```bash
npm test
```

```bash
npm run lint
```

```bash
npm run build
```

`npm run build` writes a static site to `out/`, then `scripts/stamp-sw.mjs` adds the build's file list to the service worker. The service worker only registers in production builds.

Never keep prompts inside this project. The repository is public, and `Quiver/` and `vault/` folders are ignored in case one is created by mistake.

## Deployment

Every push to `main` deploys to GitHub Pages through `.github/workflows/deploy.yml`, which runs the tests first.

To set up a new copy, go to **Settings → Pages → Source** in the repository and choose **GitHub Actions**. The site's base path is taken from the repository name automatically.
