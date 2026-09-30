# Validation record

Date: **2026-09-30**. Host integration was checked against **DSH 0.2.0-rc.2 Web**, running in an isolated `DSH_HOME`. No changes were made to the user's normal DSH profile. No model credentials were required for the plugin checks.

## Automated checks

- TypeScript strict type checking and all four builds: host, DSH client, Vite plugin, and inspector.
- Four unit tests: local-origin validation; snapshot/path bounds; JSX instrumentation and development-only configuration; agent-feedback content with PNG exclusion.
- Four Chromium scenarios: select → source → composer → before/after → confirm → reload/session separation; changed viewport and missing target; private input and forged-window rejection; stale revision conflict between tabs.
- The browser workflow decodes a captured PNG to verify that the element's original background color is retained.
- A production demo build is checked for absence of the inspector protocol and source attributes.

The browser scenarios use a clearly labeled test adapter for the host composer. They do not replace the native DSH check below. GitHub Actions runs the reproducible checks on Windows and Ubuntu; its run status is the source of truth for each commit.

## Native DSH check

The package was installed with `dsh plugin --profile web add <local-tarball>` into an isolated profile, then booted through the actual DSH CLI on a separate port. A real Chromium page loaded the actual DSH application.

The following were exercised:

1. Plugin package discovery and native sidebar guide entry.
2. Chinese and English locale integration.
3. Connection to the local Vite demo and JSX source coordinates.
4. Element selection and a persisted feedback record with a PNG.
5. Insertion through the **native DSH composer**, preserving its existing draft.
6. A real source-file edit changing the demo button's text, width, radius, and color.
7. React Fast Refresh retaining the selected yearly billing state during that edit.
8. Two recorded element images, measured differences, and explicit confirmation.

The native run reported **zero page errors**. [Sidebar screenshot](images/workflow.png), [full DSH screenshot](images/native-dsh.png).

The code edit in step 6 was made by the test driver. No claim is made that a live LLM performed it. Model submission, model quality, Electron's desktop shell, other frameworks, and other DSH versions were not part of this validation.

## Reproduce locally

```sh
npm ci
npm run build
npm run typecheck
npm test
npx playwright install chromium
npm run test:browser
npm run demo:build
```

For native verification, start a separate DSH 0.2.0-rc.2 Web profile with `DSH_HOME` pointing at a disposable directory. Install the tarball there, run the demo, and follow the README's five-step workflow. Use DSH port `3086` for the bundled demo's allowlist. The isolated native test profile and authentication token are intentionally excluded from the repository.

## Interpretation

Snapshots are DOM renders, not pixel-perfect screenshots. File/line information identifies JSX, not the original stylesheet rule. A successful capture is evidence that an element was recorded; only a user can decide whether the requested change is satisfactory. Stable IDs are needed for reliable identity across reordered lists.
