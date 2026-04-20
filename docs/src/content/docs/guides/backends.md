---
title: Backends
description: Persist artifacts across reloads or mount multiple filesystem backends.
---

By default, files live in ZenFS's `InMemory` mount and vanish on reload. Any ZenFS backend works — install the relevant companion package and pass the same mount config you'd hand to ZenFS's `configure()`.

## Persist with IndexedDB

```bash
npm install @zenfs/dom
```

```ts
import { createArtifactStore } from "live-artifact";
import { IndexedDB } from "@zenfs/dom";

const store = createArtifactStore({
  zenfs: { mounts: { "/": IndexedDB } },
});

await store.ready;
```

## Multiple mounts

Anything ZenFS supports works the same way:

```ts
import { OverlayFS, InMemory } from "@zenfs/core";
import { WebAccess } from "@zenfs/dom";

const store = createArtifactStore({
  zenfs: {
    mounts: {
      "/": InMemory,
      "/persist": WebAccess,
      "/scratch": OverlayFS,
    },
  },
});
```

The store always works under `/apps/<id>/`, so mount a persistent backend at `/` (or at `/apps`) if you want artifacts to survive reloads.

## Await `ready`

Async backends (IndexedDB, OPFS, WebAccess) need initialization. Always `await store.ready` before the first read/write when not using the default in-memory mount.
