---
title: useAppFiles
description: React hook that returns the live FilesMap for an app id.
---

```ts
useAppFiles(store: ArtifactStore, appId: string | null): FilesMap
```

Subscribes to the store and returns a `FilesMap` (`Record<string, string>`) keyed by `/`-prefixed paths. Updates as files are written. Pass `null` to disable (useful when no app is active yet).

## Example

```tsx
import { LiveApp, useAppFiles } from "live-artifact/react";

function Message({ appId }: { appId: string | null }) {
  const files = useAppFiles(store, appId);
  if (!Object.keys(files).length) return null;
  return <LiveApp files={files} />;
}
```

## Tips

- In chat UIs with multiple messages, pass `null` for all messages except the latest one — see the [example app](https://github.com/msyavuz/live-artifact/tree/main/examples/anthropic-chat) for the pattern.
- The returned map is a fresh object on every change, so reference equality works as a dependency.
