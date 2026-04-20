---
title: Dependency helpers
description: Low-level utilities for custom preview layers.
---

Exposed for advanced cases where you want to build your own preview layer instead of using `<LiveApp>`.

## `extractDependencies(files)`

Reads a `FilesMap` and returns `{ [pkg]: "latest" }` for direct imports. Prefers `/package.json` when it's present and has a `dependencies` field.

```ts
import { extractDependencies } from "live-artifact";

const deps = extractDependencies({
  "/App.tsx": `import { useState } from "react";\nimport clsx from "clsx";`,
});
// → { clsx: "latest" }    (react is filtered as a builtin)
```

## `fetchPeerDependencies(pkg)`

Returns `peerDependencies` keys from the npm registry for `pkg`, with react builtins filtered out. Network call; cache it if you call it in a hot loop.

```ts
import { fetchPeerDependencies } from "live-artifact";

const peers = await fetchPeerDependencies("recharts");
// → ["prop-types"]   (react/react-dom filtered out)
```
