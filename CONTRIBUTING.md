# Contributing

Start with a small reproduction and the versions of DSH, Vite, React, Node, and the browser. Keep the first release focused on source-linked visual feedback and explicit result review.

Run `npm ci`, `npm run build`, `npm run typecheck`, `npm test`, and `npm run test:browser` after installing Playwright's Chromium. Run `npm run demo:build` when changing the Vite integration. Commit the regenerated `lib/` files; they are the installable client and bridge, not temporary artifacts.

Changes to DSH registration or composer actions require a check in the actual supported DSH host. The test fixture cannot validate native slot contracts. Keep framework adapters development-only and include a production build check.

Preserve the following behavior:

- A plugin action never silently replaces the user's draft or submits a message.
- A result is not attached to a changed page/viewport or an invalid target.
- Private elements and snapshot bytes stay out of agent feedback.
- Every registered listener, timer, pending request, and DSH entry has a cleanup path.
- New support claims identify the versions actually exercised.

Please do not include credentials, private screenshots, browser profiles, or unrelated workspace data in an issue or pull request. Exported feedback includes images.

The project is MIT-licensed. Avoid adding code from projects with incompatible terms; record bundled dependency notices in `THIRD_PARTY_NOTICES.md`.
