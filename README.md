# live-artifact

A tiny toolkit for rendering LLM-generated React apps live inside a chat UI. You bring the LLM and the chat; `live-artifact` brings the virtual filesystem (ZenFS) and the preview (Sandpack).

> Status: pre-1.0 alpha. API may change.

## What it is

- `ArtifactStore` — virtual, per-app filesystem with a subscribe API.
- `useAppFiles(store, appId)` — React hook, returns the app's files as a `FilesMap` and updates live.
- `<LiveApp files />` — Sandpack-backed preview. Auto-declares npm dependencies from imports, fetches peer deps from the registry, waits for them before mounting so the first bundle is correct.
- `artifactToolSpecs` + `DEFAULT_ARTIFACT_SYSTEM` — JSON-schema tool specs (`start_new_app`, `list_files`, `read_file`, `write_file`) and a ready-to-use system prompt.

## What it isn't

- No LLM client. No provider adapters. No agent loop. Wire it into the tool-call dispatcher of your existing chat UI.

## Install

```bash
npm install live-artifact @codesandbox/sandpack-react @zenfs/core react react-dom
```

## Quickstart

```tsx
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
async function dispatchToolCall(
  name: string,
  input: any,
  currentAppId: string | null,
) {
  if (name === "start_new_app") {
    const id = store.createApp();
    return { appId: id, result: `Started ${id}` };
  }
  if (name === "list_files") {
    if (!currentAppId) return { result: "No active app", isError: true };
    const files = await store.getFiles(currentAppId);
    return { result: Object.keys(files).join("\n") };
  }
  if (name === "read_file") {
    if (!currentAppId) return { result: "No active app", isError: true };
    return { result: await store.readFile(currentAppId, input.path) };
  }
  if (name === "write_file") {
    if (!currentAppId) return { result: "No active app", isError: true };
    await store.writeFile(currentAppId, input.path, input.content);
    return { result: `Wrote ${input.path}` };
  }
}
```

Feed `artifactToolSpecs` to your LLM and use `DEFAULT_ARTIFACT_SYSTEM` as the system prompt, or roll your own.

## API

### `createArtifactStore(opts?)`

```ts
createArtifactStore({
  zenfs?: ZenFSConfig,
  idPrefix?: string,
}): ArtifactStore
```

Filesystem is always powered by [@zenfs/core](https://github.com/zen-fs/core). Defaults to its in-memory mount; pass `zenfs` to plug any ZenFS backend (IndexedDB, OPFS, OverlayFS, etc.) — see [Backends](#backends). `idPrefix` customizes generated app ids (default `"app"`).

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

React hook. Subscribes to the store and returns a `FilesMap` (`Record<string, string>`) keyed by `/`-prefixed paths. Updates as files are written. Pass `null` to disable.

### `<LiveApp files />`

Sandpack wrapper with automatic dependency resolution. Props:

- `files: FilesMap` (required)
- `template?: SandpackPredefinedTemplate` — default `"react-ts"`
- `theme?: SandpackThemeProp` — default `"dark"`
- `height?: number | string` — default `480`. Numbers are treated as pixels; strings pass through (`"100%"`, `"50vh"`, etc.).
- `className?: string` — applied to the outer wrapper div
- `style?: CSSProperties` — applied to the outer wrapper div
- `providerProps?: Partial<SandpackProviderProps>` — forwarded to `SandpackProvider` (e.g. `options`)
- `previewProps?: Partial<SandpackPreviewProps>` — forwarded to `SandpackPreview` (e.g. `showRefreshButton`)
- `customSetup?: SandpackProviderProps["customSetup"]` — caller-provided deps take priority over auto-resolved ones

**Dependency resolution**: `<LiveApp>` scans imports in the files map and builds a Sandpack dep list. For each new package it hits `https://registry.npmjs.org/<pkg>/latest` to find peer dependencies (cached per session), then waits to mount `SandpackProvider` until the full tree is known. You see a brief `Resolving dependencies…` state on the first novel package; after that, hits are instant. If the files map includes `/package.json` with a `dependencies` field, that wins over import-scanning, and `/package.json` is stripped from what's passed to Sandpack so the template's React stays intact.

**Hiding the CodeSandbox button**: done by default via `showOpenInCodeSandbox: false`.

### `extractDependencies(files)` and `fetchPeerDependencies(pkg)`

Exposed for advanced cases (custom preview layers). `extractDependencies` reads a files map and returns `{ pkg: "latest" }` for direct imports, preferring `/package.json` when present. `fetchPeerDependencies` returns `peerDependencies` keys from the npm registry, with react builtins filtered out.

### `artifactToolSpecs`

Array of provider-agnostic tool specs:

| name | purpose |
|---|---|
| `start_new_app` | Create a new virtual FS root. Call only for brand-new apps. |
| `list_files` | List files in the current app (used before modifying). |
| `read_file` | Read a file's current contents (used before rewriting). |
| `write_file` | Overwrite a file with full new contents. |

Each has `name`, `description`, `inputSchema`. Map the shape into your SDK of choice (Anthropic, OpenAI function calls, Gemini tool use, etc.).

### `DEFAULT_ARTIFACT_SYSTEM`

System prompt that explains the tools, the viewport (~480px tall, ~600-800px wide), responsive layout requirements (ResponsiveContainer for recharts, percentage widths, no hardcoded px), and — importantly — how to tell apart a "new app" request from a "modify the existing app" request so the LLM doesn't call `start_new_app` every turn. Override freely.

## Backends

By default files live in ZenFS's `InMemory` mount and vanish on reload. Any ZenFS backend works — install the relevant companion package and pass the same mount config you'd hand to ZenFS's `configure()`.

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

## Why pluggable?

Your chat UI already owns:

- The LLM client (Anthropic, OpenAI, Gemini, local model, your gateway).
- Streaming, retries, token accounting, auth.
- The tool-call dispatcher.

`live-artifact` doesn't fight that. It hands you a store to dispatch tool calls into and a component to render the result.

## Security

Generated code runs inside Sandpack's iframe. Treat it as untrusted. If the artifact needs API access, inject per-user secrets at view time (see the [agor project's `agor.config.js` pattern](https://github.com/preset-io/agor)) rather than letting the LLM see raw credentials.

If you're calling an LLM API directly from the browser, do not ship real production keys — proxy through your backend.

## Example

A runnable chat UI wired to the Anthropic SDK lives at [`examples/anthropic-chat/`](./examples/anthropic-chat). It demonstrates the full tool-dispatch + `useAppFiles` + `<LiveApp>` flow end-to-end, including the "only the latest message renders the preview" pattern for chat UIs where artifacts evolve across turns. Includes an "Inject demo" button so you can verify rendering without an API key.

## License

MIT © Mehmet Salih Yavuz
