---
title: Introduction
description: What live-artifact is, what it isn't, and where it fits in your chat UI.
---

`live-artifact` is a tiny toolkit for rendering LLM-generated React apps live inside a chat UI. You bring the LLM and the chat; `live-artifact` brings the virtual filesystem ([ZenFS](https://github.com/zen-fs/core)) and the preview ([Sandpack](https://sandpack.codesandbox.io/)).

## What it gives you

- **`ArtifactStore`** — a virtual, per-app filesystem with a subscribe API.
- **`useAppFiles(store, appId)`** — React hook that returns the app's files as a `FilesMap` and updates live.
- **`<LiveApp files />`** — Sandpack-backed preview. Auto-declares npm dependencies from imports, fetches peer deps from the registry, and waits for them before mounting so the first bundle is correct.
- **`artifactToolSpecs` + `DEFAULT_ARTIFACT_SYSTEM`** — JSON-schema tool specs (`start_new_app`, `list_files`, `read_file`, `write_file`) and a ready-to-use system prompt.

## What it isn't

- No LLM client. No provider adapters. No agent loop.
- It plugs into the tool-call dispatcher of your existing chat UI.

## Why pluggable?

Your chat UI already owns:

- The LLM client (Anthropic, OpenAI, Gemini, local model, your gateway).
- Streaming, retries, token accounting, auth.
- The tool-call dispatcher.

`live-artifact` doesn't fight that. It hands you a store to dispatch tool calls into and a component to render the result.
