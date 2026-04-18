import {
  SandpackLayout,
  type SandpackPredefinedTemplate,
  SandpackPreview,
  SandpackProvider,
  type SandpackProviderProps,
  type SandpackThemeProp,
} from "@codesandbox/sandpack-react";
import {
  type ComponentProps,
  type CSSProperties,
  useEffect,
  useMemo,
  useState,
} from "react";

type SandpackPreviewComponentProps = ComponentProps<typeof SandpackPreview>;

import type { ArtifactStore, FilesMap } from "../store";

export function useAppFiles(
  store: ArtifactStore,
  appId: string | null,
): FilesMap {
  const [files, setFiles] = useState<FilesMap>({});

  useEffect(() => {
    setFiles({});
    if (!appId) return;

    let cancelled = false;
    store.getFiles(appId).then((initial) => {
      if (!cancelled) setFiles(initial);
    });

    const unsubscribe = store.subscribe((event) => {
      if (event.type !== "file_written" || event.appId !== appId) return;
      setFiles((prev) => ({ ...prev, [`/${event.path}`]: event.content }));
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [store, appId]);

  return files;
}

const BUILTIN_SPECIFIERS = new Set([
  "react",
  "react-dom",
  "react-dom/client",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
]);

const IMPORT_REGEX =
  /\b(?:import|from)\s*['"]([^'"./][^'"]*)['"]|require\s*\(\s*['"]([^'"./][^'"]*)['"]\s*\)/g;

function topLevelPackage(specifier: string): string {
  if (specifier.startsWith("@")) {
    const parts = specifier.split("/");
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : specifier;
  }
  const slashIdx = specifier.indexOf("/");
  return slashIdx === -1 ? specifier : specifier.substring(0, slashIdx);
}

/**
 * Return the direct-import dependency map for a files snapshot. If the files
 * contain a `/package.json` with a `dependencies` object, that wins — the LLM
 * (or the caller) owns the dependency list. Otherwise we scan imports.
 */
export function extractDependencies(files: FilesMap): Record<string, string> {
  const pkgJson = files["/package.json"];
  if (pkgJson !== undefined) {
    const parsed = safeJsonParse(pkgJson);
    if (parsed && typeof parsed === "object" && "dependencies" in parsed) {
      const deps = (parsed as { dependencies?: unknown }).dependencies;
      if (deps && typeof deps === "object") {
        return { ...(deps as Record<string, string>) };
      }
    }
  }

  const deps: Record<string, string> = {};
  for (const [path, content] of Object.entries(files)) {
    if (path === "/package.json") continue;
    IMPORT_REGEX.lastIndex = 0;
    let match = IMPORT_REGEX.exec(content);
    while (match !== null) {
      const specifier = (match[1] ?? match[2]) as string;
      if (!BUILTIN_SPECIFIERS.has(specifier)) {
        const pkg = topLevelPackage(specifier);
        if (!BUILTIN_SPECIFIERS.has(pkg)) {
          deps[pkg] = "latest";
        }
      }
      match = IMPORT_REGEX.exec(content);
    }
  }
  return deps;
}

function safeJsonParse(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

const peerCache = new Map<string, Promise<string[]>>();
const resolvedPeers = new Map<string, string[]>();

/**
 * Fetch the `peerDependencies` of a package from the npm registry. Cached
 * per-package for the session. Returns [] on any error or missing field, so
 * callers don't need to branch on failure. Resolved results are also stored
 * in a synchronous cache so subsequent renders can include peers without
 * waiting on a microtask.
 */
export async function fetchPeerDependencies(pkg: string): Promise<string[]> {
  const cached = peerCache.get(pkg);
  if (cached) return cached;
  const promise = (async () => {
    try {
      const res = await fetch(
        `https://registry.npmjs.org/${encodeURIComponent(pkg)}/latest`,
      );
      if (!res.ok) return [];
      const data = (await res.json()) as {
        peerDependencies?: Record<string, string>;
      };
      return Object.keys(data.peerDependencies ?? {}).filter(
        (peer) => !BUILTIN_SPECIFIERS.has(peer),
      );
    } catch {
      return [];
    }
  })();
  peerCache.set(pkg, promise);
  promise.then((peers) => {
    resolvedPeers.set(pkg, peers);
  });
  return promise;
}

function mergeKnownPeers(deps: Record<string, string>): Record<string, string> {
  const merged = { ...deps };
  for (const pkg of Object.keys(deps)) {
    const peers = resolvedPeers.get(pkg);
    if (!peers) continue;
    for (const peer of peers) {
      if (!(peer in merged)) merged[peer] = "latest";
    }
  }
  return merged;
}

export function __resetPeerDependencyCache(): void {
  peerCache.clear();
  resolvedPeers.clear();
}

export interface LiveAppProps {
  files: FilesMap;
  template?: SandpackPredefinedTemplate;
  theme?: SandpackThemeProp;
  /** Preview height. Number (px) or CSS length string. Default 480. */
  height?: number | string;
  className?: string;
  style?: CSSProperties;
  /** Extra props forwarded to SandpackProvider (e.g. options). */
  providerProps?: Omit<
    SandpackProviderProps,
    "template" | "theme" | "files" | "customSetup"
  >;
  /** Extra props forwarded to SandpackPreview. */
  previewProps?: Omit<SandpackPreviewComponentProps, "showOpenInCodeSandbox">;
  customSetup?: SandpackProviderProps["customSetup"];
}

export function LiveApp({
  files,
  template = "react-ts",
  theme = "dark",
  height = 480,
  className,
  style,
  providerProps,
  previewProps,
  customSetup,
}: LiveAppProps) {
  const directDeps = useMemo(() => extractDependencies(files), [files]);
  const [peerBump, setPeerBump] = useState(0);
  // peerBump increments after async peer fetches populate the sync cache,
  // so subsequent renders include those peers.
  const enrichedDeps = useMemo(() => {
    void peerBump;
    return mergeKnownPeers(directDeps);
  }, [directDeps, peerBump]);

  useEffect(() => {
    let cancelled = false;
    const packages = Object.keys(directDeps);
    const missing = packages.filter((pkg) => !resolvedPeers.has(pkg));
    if (missing.length === 0) return;
    Promise.all(missing.map(fetchPeerDependencies)).then(() => {
      if (!cancelled) setPeerBump((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [directDeps]);

  const mergedSetup: SandpackProviderProps["customSetup"] = {
    ...customSetup,
    dependencies: {
      ...enrichedDeps,
      ...customSetup?.dependencies,
    },
  };

  const heightCss = typeof height === "number" ? `${height}px` : height;

  // Drop /package.json from the files handed to Sandpack: when present it
  // overrides the template's own package.json (including React itself),
  // breaking the preview. We already extracted its dependencies above into
  // customSetup, so Sandpack still sees everything it needs.
  const sandpackFiles = useMemo(() => {
    if (!("/package.json" in files)) return files;
    const { "/package.json": _ignored, ...rest } = files;
    return rest;
  }, [files]);

  return (
    <div className={className} style={{ width: "100%", ...style }}>
      <SandpackProvider
        template={template}
        theme={theme}
        files={sandpackFiles}
        customSetup={mergedSetup}
        {...providerProps}
      >
        <SandpackLayout style={{ height: heightCss, border: "none" }}>
          <SandpackPreview
            showOpenInCodeSandbox={false}
            showRefreshButton
            style={{ height: heightCss, flex: 1 }}
            {...previewProps}
          />
        </SandpackLayout>
      </SandpackProvider>
    </div>
  );
}
