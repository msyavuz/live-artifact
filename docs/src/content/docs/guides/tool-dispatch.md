---
title: Tool dispatch
description: Wire artifactToolSpecs into your existing chat UI's tool-call loop.
---

`live-artifact` doesn't run your LLM. It hands your dispatcher four tools and expects it to call back into the store. Here's the contract.

## The four tools

| name | input | expected behavior |
|---|---|---|
| `start_new_app` | `{}` | `store.createApp()`, return the new `appId`. |
| `list_files` | `{}` | `store.getFiles(appId)`, return path names. |
| `read_file` | `{ path }` | `store.readFile(appId, path)`. |
| `write_file` | `{ path, content }` | `store.writeFile(appId, path, content)`. |

## Tracking the current app id

The LLM doesn't know which app it's operating on — your dispatcher does. Keep `currentAppId` in your message state and update it when `start_new_app` fires:

```ts
let currentAppId: string | null = null;

async function dispatchToolCall(name: string, input: any) {
  if (name === "start_new_app") {
    currentAppId = store.createApp();
    return { result: `Started ${currentAppId}` };
  }
  if (!currentAppId) return { result: "No active app", isError: true };

  if (name === "list_files") {
    const files = await store.getFiles(currentAppId);
    return { result: Object.keys(files).join("\n") };
  }
  if (name === "read_file") {
    return { result: await store.readFile(currentAppId, input.path) };
  }
  if (name === "write_file") {
    await store.writeFile(currentAppId, input.path, input.content);
    return { result: `Wrote ${input.path}` };
  }
}
```

## Telling "new app" from "modify"

The default system prompt (`DEFAULT_ARTIFACT_SYSTEM`) already teaches the model to reuse the existing app when the user is iterating. If you override the system prompt, keep that instruction — otherwise you'll get a fresh app id every turn.
