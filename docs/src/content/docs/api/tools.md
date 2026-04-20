---
title: Tool specs & system prompt
description: Provider-agnostic tool specs and the default system prompt.
---

## `artifactToolSpecs`

Array of provider-agnostic tool specs:

| name | purpose |
|---|---|
| `start_new_app` | Create a new virtual FS root. Call only for brand-new apps. |
| `list_files` | List files in the current app (used before modifying). |
| `read_file` | Read a file's current contents (used before rewriting). |
| `write_file` | Overwrite a file with full new contents. |

Each spec has `name`, `description`, `inputSchema`. Map the shape into your SDK of choice (Anthropic, OpenAI function calls, Gemini tool use, etc.).

```ts
import { artifactToolSpecs } from "live-artifact";

// Anthropic SDK
const tools = artifactToolSpecs.map((t) => ({
  name: t.name,
  description: t.description,
  input_schema: t.inputSchema,
}));
```

## `DEFAULT_ARTIFACT_SYSTEM`

A system prompt that explains the tools, the viewport (~480px tall, ~600–800px wide), responsive-layout expectations (`ResponsiveContainer` for recharts, percentage widths, no hardcoded px), and — importantly — how to distinguish a "new app" request from a "modify the existing app" request so the LLM doesn't call `start_new_app` every turn.

Override freely:

```ts
import { DEFAULT_ARTIFACT_SYSTEM } from "live-artifact";

const system = `${DEFAULT_ARTIFACT_SYSTEM}\n\nExtra rules for my app:\n- ...`;
```
