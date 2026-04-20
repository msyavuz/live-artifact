---
title: createArtifactStore
description: Factory that returns an ArtifactStore backed by ZenFS.
---

```ts
createArtifactStore({
  zenfs?: ZenFSConfig,
  idPrefix?: string,
}): ArtifactStore
```

Filesystem is always powered by [`@zenfs/core`](https://github.com/zen-fs/core). Defaults to its in-memory mount; pass `zenfs` to plug any ZenFS backend (IndexedDB, OPFS, OverlayFS, etc.) — see the [Backends guide](../../guides/backends/). `idPrefix` customizes generated app ids (default `"app"`).

## Returned shape

```ts
interface ArtifactStore {
  ready: Promise<void>;                              // resolves when backend is initialized
  createApp(): string;                               // returns a new app id
  hasApp(appId: string): boolean;
  writeFile(appId: string, path: string, content: string): Promise<void>;
  readFile(appId: string, path: string): Promise<string>;
  getFiles(appId: string): Promise<FilesMap>;        // { "/App.tsx": "...", ... }
  subscribe(listener: (e: ArtifactEvent) => void): () => void;
}
```

## Notes

- Files live under `/apps/<id>/` inside the ZenFS tree. Mount a persistent backend at `/` (or at `/apps`) to survive reloads.
- `subscribe` is what powers `useAppFiles` — call it yourself if you're integrating with a non-React view layer.
- `ready` is a promise; await it before issuing reads/writes when using an async backend like IndexedDB.
