# Changelog

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
