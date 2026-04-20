---
title: Install
description: Install live-artifact and its peer dependencies.
---

`live-artifact` ships ESM only and requires Node 22+.

```bash
npm install live-artifact @codesandbox/sandpack-react @zenfs/core react react-dom
```

## Peer dependencies

| Package | Why |
|---|---|
| `@codesandbox/sandpack-react` | Renders the live preview. Marked optional — skip it if you only want the store. |
| `@zenfs/core` | Virtual filesystem backing the store. |
| `react`, `react-dom` | Used by the React entry (`live-artifact/react`). |

## Optional ZenFS backends

For persistence across reloads, install a ZenFS companion:

```bash
npm install @zenfs/dom   # IndexedDB, OPFS, WebAccess
```

See the [Backends guide](../guides/backends/) for usage.
