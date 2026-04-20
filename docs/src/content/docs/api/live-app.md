---
title: <LiveApp />
description: Sandpack preview with automatic dependency resolution.
---

Sandpack wrapper that auto-declares npm dependencies from imports, fetches peer deps from the npm registry, and waits for them before mounting so the first bundle is correct.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `files` | `FilesMap` | required | Files to mount in the Sandpack provider. |
| `template` | `SandpackPredefinedTemplate` | `"react-ts"` | Sandpack template. |
| `theme` | `SandpackThemeProp` | `"dark"` | Sandpack theme. |
| `height` | `number \| string` | `480` | Numbers are treated as pixels; strings pass through (`"100%"`, `"50vh"`). |
| `className` | `string` | — | Applied to the outer wrapper div. |
| `style` | `CSSProperties` | — | Applied to the outer wrapper div. |
| `providerProps` | `Partial<SandpackProviderProps>` | — | Forwarded to `SandpackProvider` (e.g. `options`). |
| `previewProps` | `Partial<SandpackPreviewProps>` | — | Forwarded to `SandpackPreview` (e.g. `showRefreshButton`). |
| `customSetup` | `SandpackProviderProps["customSetup"]` | — | Caller-provided deps take priority over auto-resolved ones. |

## Dependency resolution

`<LiveApp>` scans imports in the files map and builds a Sandpack dep list. For each new package it hits `https://registry.npmjs.org/<pkg>/latest` to find peer dependencies (cached per session), then waits to mount `SandpackProvider` until the full tree is known.

You see a brief `Resolving dependencies…` state on the first novel package; after that, hits are instant.

If the files map includes `/package.json` with a `dependencies` field, that wins over import-scanning, and `/package.json` is stripped from what's passed to Sandpack so the template's React stays intact.

## Hiding the CodeSandbox button

Done by default via `showOpenInCodeSandbox: false`.
