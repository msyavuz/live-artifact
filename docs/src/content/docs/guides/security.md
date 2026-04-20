---
title: Security
description: What to treat as untrusted and how to inject secrets safely.
---

Generated code runs inside Sandpack's iframe. **Treat it as untrusted.**

## Secrets

If the artifact needs API access, inject per-user secrets at view time rather than letting the LLM see raw credentials. See the [agor project's `agor.config.js` pattern](https://github.com/preset-io/agor) for one approach.

## Browser-side LLM calls

If you're calling an LLM API directly from the browser, **do not ship real production keys** — proxy through your backend. `live-artifact` has no opinion here; it only renders what the LLM writes to the store.

## Iframe sandboxing

Sandpack isolates previews in a sandboxed iframe. You still own the surrounding page, so:

- Don't `postMessage` secrets into the iframe.
- Don't render the preview on the same origin as anything that carries session cookies you care about.
