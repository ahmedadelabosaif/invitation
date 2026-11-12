# Project instructions for the invitation app

## Project shape

This repository is a static invitation site for GitHub Pages. It uses plain HTML, CSS, and vanilla JavaScript; there is no build step, framework, or package manager setup.

Key files:
- `admin.js` — admin/editor flow, token handling, publish-to-GitHub logic, media uploads, and event editing
- `guest.js` — public guest page rendering, themed invitation layout, countdown, music controls, and sanitization
- `layout-config.js` — shared section-order and typography allowlists used by both admin and guest pages
- `admin.html` / `index.html` — page structure and UI wiring
- `invitations.json` — persisted invitation data and featured event selection
- `backgrounds/` — preset background assets for invitation themes
- `tests/*.test.js` — Node-based regression tests for both the admin editor and guest page

## Coding expectations

- Keep changes small, surgical, and compatible with the existing browser-only architecture.
- Do not introduce frameworks, bundlers, TypeScript, or package dependencies unless the task explicitly requires them.
- Preserve the current static deployment model for GitHub Pages and relative asset paths.
- Prefer existing patterns over adding new abstractions. Reuse helper functions, naming, and DOM conventions already used in `admin.js` and `guest.js`.
- When changing invitation fields or behavior, keep the data model consistent across `invitations.json`, `admin.js`, `guest.js`, and the relevant tests.

## Data and safety rules

- Treat `invitations.json` as the source of invitation state. Keep `featured`, `events`, `eventType`, `env`, `etiquette`, `background*`, `music*`, `layout`, and `layoutStyles` fields aligned with both rendering flows.
- Preserve safe URL validation and sanitization logic. Reject unsafe protocols such as `javascript:` and only allow secure or http(s) URLs for embedded media and location links.
- Keep rich text formatting consistent with the existing allowlist: bold, italic, underline, and the `gold|rose|emerald` accent tags.
- Escape user-provided HTML before injecting into the DOM; do not add arbitrary innerHTML usage for untrusted content.
- Never commit secrets or real publish tokens. Token usage in this app is intentionally browser-local only.

## Testing and verification

- Add or update tests in `tests/admin.test.js` or `tests/guest.test.js` whenever you change admin or guest behavior.
- Validate with the smallest relevant Node test run, for example:
  - `node --test tests/admin.test.js`
  - `node --test tests/guest.test.js`
  - `node --test tests/*.test.js`
- Keep tests realistic: they simulate the browser DOM in Node via `vm`, so behavior should be asserted through the same public DOM and event flow used by the app.

## Documentation and review

- Update `README.md` when the project’s user-facing behavior, publish workflow, or invitation capabilities change.
- Prefer clear, project-specific instructions over generic advice. Focus on the invitation builder, guest-page behavior, and browser-based GitHub Pages publishing flow.
