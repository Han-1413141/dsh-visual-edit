# Changelog

## 0.3.0 — 2026-09-30

- Save feedback and immediately pick the next element without losing live page state.
- Select multiple unconfirmed notes and insert or copy one combined prompt, retaining each source location and the existing composer draft.
- Preserve selected revisions across background updates and commit queued statuses together in one transaction.
- Preview and restore v1 JSON backups into the current session, including snapshots. Skip existing IDs and restore queued records as drafts.
- Validate backup records, file size, PNG headers and image dimensions before restoration; reject excessive note counts and roll back a failed import.
- Keep restore failures visible inside the dialog and focus the active batch action by hiding individual send/capture controls while selecting.
- Expand coverage to eight unit tests and eleven browser scenarios. Verify the new workflow in native DSH and add bilingual instructions and screenshots.

## 0.2.0 — 2026-09-30

- Follow DSH's actual light/dark setting, fonts, colors, border radii, and compact control sizes. Remove the separate branded header.
- Separate Preview and Feedback views while retaining the live page; add actual-size preview, search, status filters, and stable note ordering.
- Enlarge snapshots with side-by-side and overlay comparison, keyboard controls, and focus restoration.
- Add inline deletion confirmation, copyable source locations and setup commands, save shortcuts, and storage retry.
- Preserve unsaved edits and the original revision when another browser tab updates a note. Prevent repeated concurrent actions and distinguish successful composer insertion from a failed status save.
- Bring the preview into view during image capture to avoid hidden-frame rendering timeouts; return to the current review afterward.
- Keep the existing note storage and bridge protocol compatible with 0.1.0.
- Expand browser coverage to seven scenarios, including explicit DSH theme selection, narrow sidebars, comparison interactions, and live edit conflicts. Update bilingual instructions and real DSH screenshots.

## 0.1.0 — 2026-09-30

- Native DSH 0.2.0-rc.2 visual feedback sidebar and composer integration.
- Vite development bridge with React JSX/TSX source locations.
- Element selection, local DOM snapshots, feedback, result comparison, and explicit confirmation.
- Session storage with revision checks, local export, and desktop/mobile viewports.
- English and Chinese UI, documentation, demo, and reproducible browser checks.

Distribution: GitHub Release tarball. Verified host scope: DSH Web. Electron and live model execution are outside this release's validation.
