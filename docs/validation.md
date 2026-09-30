# Validation record

Date: **2026-09-30**. Plugin version: **0.3.0**. Host integration was checked against **DSH 0.2.0-rc.2 Web**, running in an isolated `DSH_HOME`. No changes were made to the user's normal DSH profile. No model credentials were required for the plugin checks.

## Automated checks

- TypeScript strict type checking and all four builds: host, DSH client, Vite plugin, and inspector.
- Eight unit tests cover local-origin validation, snapshot/path bounds, JSX instrumentation, development-only configuration, prompt content, backup round trips, invalid records, PNG header bounds, and combined feedback without images or URL query strings.
- Eleven Chromium scenarios cover the existing selection → source → composer → comparison → confirmation workflow; session separation; invalid capture targets; private content and forged-window rejection; theme inheritance; a 340px sidebar; comparison controls; search, filtering and deletion; cross-tab edits; continuous picking and combined insertion; backup restoration and failure handling; selected revision conflicts; and atomic storage operations.
- Backup checks use actual exported files containing before/after images, exercise cancellation and duplicate handling, restore into another session, reject invalid image data, and deliberately abort a write transaction to verify that the error appears in the modal without partial writes.
- Storage checks verify that one stale record prevents the entire queued-status update, and that exceeding the session limit leaves the existing notes intact.
- The browser workflow decodes a captured PNG to verify that the element's original background color is retained.
- A production demo build is checked for absence of the inspector protocol and source attributes.
- The 0.3.0 client bundle is **86,293 bytes**, below DSH's 262,144-byte limit.

The browser scenarios use a clearly labeled test adapter for the host composer. They do not replace the native DSH check below. GitHub Actions runs the reproducible checks on Windows and Ubuntu; its run status is the source of truth for each commit.

## Native DSH check

The package was installed with `dsh plugin --profile web add <local-tarball>` into an isolated profile, then booted through the actual DSH CLI on a separate port. A real Chromium page loaded the actual DSH application.

The following were exercised with the 0.3.0 package:

1. Updated package installation and native sidebar loading.
2. Continuous selection of a button and a heading, each with its own request and snapshot.
3. Batch insertion into the **native DSH composer**, preserving its existing draft and using one shared prompt header.
4. Restoration of an actual 0.2 export containing a confirmed note and both of its snapshots.
5. Exporting the two new notes, deleting only those generated test records, and restoring them through the dialog.
6. Queued notes restored as drafts; confirmed notes and snapshots preserved.
7. Repeated import reporting duplicate IDs and disabling restoration when there are no new notes.
8. Chinese and English controls, compact batch actions, and native DSH light/dark themes.
9. The demo's selected yearly billing state retained across selection, review, backup dialogs, and appearance changes.

The native run reported **zero page errors**. [Chinese batch sidebar](images/batch-zh.png), [English batch sidebar](images/batch.png), [full DSH screenshot](images/native-batch.png), [restore preview](images/restore-zh.png). Screenshots were taken in the real DSH application, not the integration fixture.

### Earlier native baseline

The 0.2.0 native check on the same host version also exercised a real source-file change to the demo button's text, width, radius and color; React Fast Refresh retaining yearly billing; result capture and confirmation; enlarged overlay comparison with Escape dismissal; and explicit host themes against the opposite operating-system preference. Those source edits were made by the test driver. This baseline was not rerun as a live source-edit scenario for 0.3; the automated browser suite continues to exercise result capture using a controlled DOM change. [Comparison screenshot](images/comparison.png), [baseline sidebar](images/workflow.png).

Model submission, model quality, Electron's desktop shell, other frameworks, and other DSH versions were not part of this validation.

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

For native verification, start a separate DSH 0.2.0-rc.2 Web profile with `DSH_HOME` pointing at a disposable directory. Install the tarball there, run the demo, and follow the README's continuous-picking, batch-insertion and backup-restoration instructions. Use DSH port `3086` for the bundled demo's allowlist. Keep an existing composer draft to check insertion, and import the same backup twice to check duplicates. The isolated native test profile and authentication token are intentionally excluded from the repository.

## Interpretation

Snapshots are DOM renders, not pixel-perfect screenshots. File/line information identifies JSX, not the original stylesheet rule. A successful capture is evidence that an element was recorded; only a user can decide whether the requested change is satisfactory. Stable IDs are needed for reliable identity across reordered lists.
