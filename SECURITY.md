# Security

## Reporting a vulnerability

Please do not open a public issue for a suspected security vulnerability. Contact the repository owner privately through the contact information on the GitHub profile.

## Action permissions

TabbyGuard is designed to work with the minimum practical workflow permissions:

```yaml
permissions:
  contents: read
  pull-requests: write
```

`pull-requests: write` is needed only when `post-comment: true`. Fork pull requests commonly receive a read-only token; TabbyGuard treats comment failure as non-fatal and still writes the workflow summary.

## AI mode

AI is optional. Deterministic mode does not send pull-request context to a model provider. In assisted mode, TabbyGuard sends bounded changed-file metadata and patch context to the configured OpenAI model. Browser evidence remains authoritative; the model cannot create or change the severity of findings.
