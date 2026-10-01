# DSH Visual Edit

**Select an element, draw an arrow, or frame an area in DSH's preview. Add feedback and compare the updated page automatically.**

[中文说明](README.zh-CN.md) · [Download v0.5.2](https://github.com/Han-1413141/dsh-visual-edit/releases/tag/v0.5.2) · [Report a problem](https://github.com/Han-1413141/dsh-visual-edit/issues)

[![CI](https://github.com/Han-1413141/dsh-visual-edit/actions/workflows/ci.yml/badge.svg)](https://github.com/Han-1413141/dsh-visual-edit/actions/workflows/ci.yml)

A visual feedback plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), integrated into its existing HTML preview and desktop Browser. It follows the host's typography, colors, radii, and light/dark preference. The entry lives in the preview toolbar; no conversation-header shortcut is added.

<img src="docs/images/native-modes.png" alt="Element, arrow, and rectangle tools in a real DSH HTML preview" width="1100" />

## Use it

1. Open an HTML file in the right sidebar, or load a website in the desktop **Browser**.
2. Click **Visual Edit** in the preview toolbar. Choose **Element**, **Arrow**, or **Rectangle**.
3. Describe the change and click **Add to chat & compare**. The request is inserted into the current composer, preserving its existing draft.
4. Send the draft in DSH. When the agent changes the page and the preview updates, before/after snapshots appear automatically.
5. Enlarge or overlay the snapshots, inspect measured changes, and **Confirm result** when satisfied.

| Mode | Gesture | Context |
|---|---|---|
| Element | Click an element | Locator, text, styles, available source location, and image |
| Arrow | Drag toward a target | Arrow, target element, and surrounding area |
| Rectangle | Drag any rectangular area | Area image, text, and document coordinates |

`Ctrl / ⌘ + Enter` activates the comment form's primary action; `Esc` cancels selection. **Save feedback** keeps a draft without adding it to chat. **Save & pick another** and batch selection let you collect several requests first.

Automatic comparison watches queued and unconfirmed review notes. HTML reloads and browser DOM updates are supported. Unrelated changes outside the selected element do not recapture it. Closing the feedback overlay keeps monitoring active; switching away from the preview pauses it until the tab becomes visible again. Confirming a result stops further automatic updates to that note.

“Added to composer” records insertion, not model completion. Page changes are evidence for your review, not proof that the request was implemented correctly.

<img src="docs/images/native-auto-compare.png" alt="Automatic comparison after editing a real file in DSH" width="1100" />

## Install

Targets DSH **0.2.0-rc.2**. The package includes its inspector and client dependencies. Native HTML and desktop Browser integration require no changes to the web project's configuration. The DSH plugin manager handles package dependencies during installation.

For the desktop app, fully exit through its application menu, then run the **bundled DSH CLI**:

```sh
dsh plugin --profile desktop add https://github.com/Han-1413141/dsh-visual-edit/releases/download/v0.5.2/dsh-visual-edit-0.5.2.tgz
```

Reopen DSH. On Windows, the bundled launcher is `resources/runtime/cli/bin/dsh.cmd` inside the application directory. DSH Web users substitute `--profile web`, restart the server, and refresh the client.

Distribution is through **GitHub Releases**, using the complete package URL. A bare `npm install dsh-visual-edit` is not the release installation path. No desktop application files are patched; removing the plugin restores the host's original preview registrations.

### Upgrade

Reinstall from the new URL and restart DSH. Existing IndexedDB notes, images, and older JSON backups remain compatible. Use the same client profile, DSH origin, and session to access existing records. Imported queued notes become drafts, since the destination composer may not contain their requests.

Version 0.5.2 fixes capture on pages containing HTML divider comments. Rectangle captures include complete intersecting content blocks, and saved targets follow layout changes and wrapping. Failed or old result images are refreshed once per preview load. If a historical before image is missing, choose **Restore from original HTML** below it and provide the actual earlier file (up to 2 MB). The isolated renderer disables page scripts and network access, checks the recorded text and target, preserves the original timestamp, and labels the recovered image. It never infers an earlier page from the current one.

### Optional Vite / React source locations

Native HTML records original file line/column locations. The desktop Browser can inspect loaded HTTP(S) pages directly. For JSX/TSX locations, install the development bridge in your web project:

```sh
npm install -D https://github.com/Han-1413141/dsh-visual-edit/releases/download/v0.5.2/dsh-visual-edit-0.5.2.tgz
```

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualEdit } from 'dsh-visual-edit/vite';

export default defineConfig({
  plugins: [visualEdit(), react()],
});
```

Restart Vite. Instrumentation is development-only and absent from production builds.

The standalone **Visual Edit** sidebar remains available for local Vite apps in DSH Web. That compatibility view retains element selection and manual comparison, requiring a separate page origin. Allowed DSH origins default to localhost port `3080`; customize other ports with `visualEdit({ allowedOrigins: ['http://127.0.0.1:3086'] })`. Use the native preview toolbar for the three annotation modes and automatic comparison.

## Review and storage

- The original baseline is retained; later page updates replace the after snapshot until confirmation.
- If an element is removed or its identity no longer matches, native comparison captures the original area and labels the fallback. Changed viewport dimensions are also labeled.
- **Capture result** remains available for immediate manual refresh.
- Search, status filters, batch insertion, JSON backup/restore, and revision conflict detection remain supported.
- IndexedDB holds up to 50 notes per session. Backups are limited to 70 MB; duplicate IDs are skipped after a restore preview.

Only the request and reference metadata reach the agent draft: source, selector, text, measured styles, and annotation coordinates. PNG images stay local. Normal submission uses the model configured in DSH.

Form controls, editable content, and `data-private` / `data-visual-edit-private` elements are excluded from captured text and imagery. URL query/hash values are omitted from feedback. Native HTML retains DSH file permissions and interactive-preview settings; static mode permits the bundled inspector while blocking the page's own scripts.

## Scope

| Area | Behavior |
|---|---|
| Native HTML | DSH 0.2.0-rc.2; real DSH Web verification includes selection, original HTML locations, file refresh, composer insertion, and automatic comparison |
| Desktop Browser | Electron webview injection into the current page; see [validation](docs/validation.md) for actual desktop verification scope |
| Images | DOM-rendered PNG, up to 1600 × 1600 and 650,000 data-URL characters |
| Regions | Document coordinates; arrows and rectangles retain the same region across comparison |
| Legacy Vite tab | Local Vite 6.4 / React; manual comparison requires the same address, viewport, and valid element identity |

Cross-origin child iframes, Shadow DOM, canvas/WebGL, and external fonts are outside reliable image reconstruction. Remote assets and CSP can prevent a PNG; available metadata remains with an explanation. These are review snapshots, not pixel-exact browser screenshots. Stable IDs or `data-testid` are recommended for reordered list items.

## Develop

```sh
npm ci
npm run build
npm run typecheck
npm test
npx playwright install chromium
npm run test:browser
npm run demo:build
```

`npm run demo` serves the included page at `http://127.0.0.1:5179`. On Linux, use `npx playwright install --with-deps chromium`.

[Validation](docs/validation.md) · [Architecture](docs/architecture.md) · [Troubleshooting](docs/troubleshooting.md) · [UI design](docs/ui-design.zh-CN.md) · [Research](docs/research.zh-CN.md)

MIT. Dependency licenses are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
