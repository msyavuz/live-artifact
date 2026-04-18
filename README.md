# live-artifact

A tiny toolkit for rendering LLM-generated React apps live inside a chat UI. You bring the LLM and the chat; `live-artifact` brings the virtual filesystem (ZenFS) and the preview (Sandpack).

> Status: 0.1.x alpha. API may change.

## What it is

- `ArtifactStore` — virtual, per-app filesystem with a subscribe API.
- `useAppFiles(store, appId)` — React hook, returns the app's files as a `FilesMap` and updates live.
- `<LiveApp files />` — Sandpack-backed preview component.
- `artifactToolSpecs` + `DEFAULT_ARTIFACT_SYSTEM` — optional JSON-schema tool specs and system prompt you can feed into whatever LLM you use.

## What it isn't

- No LLM client. No provider adapters. No agent loop. Wire it into the tool-call dispatcher of your existing chat UI.

## Install

```bash
npm install live-artifact @codesandbox/sandpack-react @zenfs/core react react-dom
```

## Quickstart

```tsx
import { useState } from "react";
import {
  createArtifactStore,
  artifactToolSpecs,
  DEFAULT_ARTIFACT_SYSTEM,
} from "live-artifact";
import { LiveApp, useAppFiles } from "live-artifact/react";

const store = createArtifactStore();

export function ChatMessage({ appId }: { appId: string | null }) {
  const files = useAppFiles(store, appId);
  return Object.keys(files).length > 0 ? <LiveApp files={files} /> : null;
}

// Inside your own LLM loop:
async function dispatchToolCall(name: string, input: any, currentAppId: string | null) {
  if (name === "start_new_app") {
    const id = store.createApp();
    return { appId: id, result: `Started ${id}` };
  }
  if (name === "write_file") {
    if (!currentAppId) return { result: "No active app", isError: true };
    await store.writeFile(currentAppId, input.path, input.content);
    return { result: `Wrote ${input.path}` };
  }
}
```

Feed `artifactToolSpecs` to your LLM (it contains `start_new_app` and `write_file`) and use `DEFAULT_ARTIFACT_SYSTEM` as the system prompt, or roll your own.

## API

### `createArtifactStore(opts?)`

```ts
createArtifactStore({
  backend?: "zenfs" | "memory",
  zenfs?: ZenFSConfig,
  idPrefix?: string,
}): ArtifactStore
```

- `backend: "zenfs"` (default) — filesystem powered by [@zenfs/core](https://github.com/zen-fs/core). Defaults to the in-memory `InMemory` backend; override with `zenfs` to plug in any ZenFS backend (IndexedDB, OPFS, OverlayFS, etc.). See [Backends](#backends).
- `backend: "memory"` — plain `Map<string, string>`. Good for tests. Ignores `zenfs`.

Returns:

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

### `useAppFiles(store, appId)`

React hook. Subscribes to the store and returns a `FilesMap` (`Record<string, string>`) keyed by `/`-prefixed paths. Updates as files are written.

### `<LiveApp files />`

Sandpack wrapper. Props:

- `files: FilesMap` (required)
- `template?: SandpackTemplate` (default `"react-ts"`)
- `theme?: SandpackTheme` (default `"dark"`)
- `height?: number` (default `360`)
- `options?: SandpackOptions`

### `artifactToolSpecs`

Array of JSON-schema tool specs (`name`, `description`, `inputSchema`). Provider-agnostic; map the shape into your SDK of choice.

### `DEFAULT_ARTIFACT_SYSTEM`

A ready-to-use system prompt that instructs the model to use the two tools and target Sandpack's `react-ts` template layout. Override freely.

## Backends

The default `"zenfs"` backend uses ZenFS's `InMemory`, so files vanish on reload. Any ZenFS backend works — install the relevant companion package and pass the same mount config you'd hand to ZenFS's `configure()`.

### Persist across reloads with IndexedDB

```bash
npm install @zenfs/dom
```

```ts
import { createArtifactStore } from "live-artifact";
import { IndexedDB } from "@zenfs/dom";

const store = createArtifactStore({
  backend: "zenfs",
  zenfs: { mounts: { "/": IndexedDB } },
});

await store.ready;
```

### Mount multiple paths / other backends

Anything ZenFS supports works the same way:

```ts
import { OverlayFS, InMemory } from "@zenfs/core";
import { WebAccess } from "@zenfs/dom";

const store = createArtifactStore({
  backend: "zenfs",
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

### In-process, no ZenFS

Use `backend: "memory"` for unit tests or environments where you don't want to pull ZenFS in.

```ts
const store = createArtifactStore({ backend: "memory" });
```

## Why pluggable?

Your chat UI already owns:

- The LLM client (Anthropic, OpenAI, Gemini, local model, your gateway).
- Streaming, retries, token accounting, auth.
- The tool-call dispatcher.

`live-artifact` doesn't fight that. It hands you a store to dispatch `write_file` into and a component to render the result.

## Security

Generated code runs inside Sandpack's iframe. Treat it as untrusted. If the artifact needs API access, inject per-user secrets at view time (see the [agor project's `agor.config.js` pattern](https://github.com/preset-io/agor)) rather than letting the LLM see raw credentials.

If you're calling an LLM API directly from the browser, do not ship real production keys — proxy through your backend.

## License

MIT © Mehmet Salih Yavuz
