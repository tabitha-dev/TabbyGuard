# Contributing

Thanks for improving TabbyGuard.

## Local setup

```bash
npm install
npm run check
npm test
npm run build
```

Before opening a pull request, run:

```bash
npm run verify
```

The bundled `dist/` directory is part of the published GitHub Action and must match the source for release commits.

## Design rule

A failed heuristic is not automatically a product defect. Findings must be backed by concrete browser evidence. When a safe target cannot be identified, prefer `skipped` or `inconclusive`.
