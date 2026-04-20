---
title: Quickstart
description: Wire live-artifact into a chat UI in under five minutes.
---

This walkthrough wires `live-artifact` into your existing chat UI. The LLM client and message loop stay yours — `live-artifact` just gives you a store to dispatch tool calls into and a `<LiveApp>` component to render the result.

## 1. Create a store

```ts
import { createArtifactStore } from "live-artifact";

export const store = createArtifactStore();
```

## 2. Render the preview

```tsx
import { LiveApp, useAppFiles } from "live-artifact/react";
import { store } from "./store";

export function ChatMessage({ appId }: { appId: string | null }) {
  const files = useAppFiles(store, appId);
  return Object.keys(files).length > 0 ? <LiveApp files={files} /> : null;
}
```

`useAppFiles` subscribes to the store and re-renders as files change.

## 3. Dispatch tool calls

```ts
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

## 4. Hand the LLM its tools

```ts
import { artifactToolSpecs, DEFAULT_ARTIFACT_SYSTEM } from "live-artifact";

const response = await yourLLMClient.messages.create({
  system: DEFAULT_ARTIFACT_SYSTEM,
  tools: artifactToolSpecs,
  // ...
});
```

Map `artifactToolSpecs` into whatever shape your provider expects (Anthropic, OpenAI function calls, Gemini tool use). The tool *names and input schemas* are what the dispatcher in step 3 keys off.

## Try the example

A runnable chat UI wired to the Anthropic SDK lives at [`examples/anthropic-chat/`](https://github.com/msyavuz/live-artifact/tree/main/examples/anthropic-chat). It demonstrates the full tool-dispatch + `useAppFiles` + `<LiveApp>` flow end-to-end, including the "only the latest message renders the preview" pattern. There's an "Inject demo" button so you can verify rendering without an API key.
