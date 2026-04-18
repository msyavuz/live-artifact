# anthropic-chat example

A minimal Vite + React chat UI that uses [live-artifact](../..) to render the apps Claude builds via tool calls, live in the chat.

## Run it

```bash
cd examples/anthropic-chat
npm install
npm run dev
```

Open the URL Vite prints, paste an Anthropic API key in the header, then ask Claude to build an app ("a todo list", "a chart of fake sales data", etc.). The generated React app appears inline, powered by Sandpack.

The "Inject demo" button drops in a hard-coded counter app so you can verify the rendering pipeline without spending any tokens.

## What this example demonstrates

- `createArtifactStore()` as the shared virtual filesystem
- `useAppFiles(store, appId)` returning a reactive files map per message
- `<LiveApp files={...} />` rendering each app inline
- A hand-rolled LLM loop (Anthropic SDK direct) dispatching `start_new_app` and `write_file` tool calls to the store
- No agent abstraction, no provider plumbing — all owned by the host app

## Key wiring

```tsx
import {
  artifactToolSpecs,
  createArtifactStore,
  DEFAULT_ARTIFACT_SYSTEM,
} from "live-artifact";
import { LiveApp, useAppFiles } from "live-artifact/react";
```

Tool dispatch (simplified):

```ts
if (block.name === "start_new_app") {
  const id = store.createApp();
  // attach id to assistant message state
}
if (block.name === "write_file") {
  await store.writeFile(currentAppId, block.input.path, block.input.content);
}
```

## Security note

This example uses `dangerouslyAllowBrowser: true` on the Anthropic client so the API key sits in the user's browser. That's fine for a PoC. For production, proxy LLM calls through a server you control.
