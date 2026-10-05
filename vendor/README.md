# Vendored runtime dependencies

`runtime-dependencies.js` is a generated CommonJS dependency runtime used only by `scripts/build.mjs` to produce the committed `dist/index.js` without compiling or installing dependencies during a consumer's workflow run.

It contains the reachable third-party modules for the pinned runtime dependencies used by TabbyGuard (GitHub Actions Toolkit, Playwright 1.52.x, Axe Playwright integration, and Zod). TabbyGuard source modules are injected separately at build time; the prior MergeGuard application entry and application modules are not part of this dependency runtime.

`licenses.txt` preserves the bundled third-party license notices.

When runtime dependency versions are intentionally upgraded, regenerate this runtime and `dist/`, then run the full CI/browser fixture suite before releasing.
