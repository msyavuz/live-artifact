import {
  act,
  cleanup,
  render,
  renderHook,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@codesandbox/sandpack-react", () => ({
  SandpackProvider: ({
    children,
    ...rest
  }: {
    children?: React.ReactNode;
    [k: string]: unknown;
  }) => (
    <div data-testid="provider" data-props={JSON.stringify(rest)}>
      {children}
    </div>
  ),
  SandpackLayout: ({
    children,
    ...rest
  }: {
    children?: React.ReactNode;
    [k: string]: unknown;
  }) => (
    <div data-testid="layout" data-props={JSON.stringify(rest)}>
      {children}
    </div>
  ),
  SandpackPreview: (props: Record<string, unknown>) => (
    <div data-testid="preview" data-props={JSON.stringify(props)} />
  ),
}));

import { createArtifactStore } from "../store";
import {
  __resetPeerDependencyCache,
  extractDependencies,
  fetchPeerDependencies,
  LiveApp,
  useAppFiles,
} from "./index";

function mockFetchJson(body: unknown, ok = true): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    ok,
    json: async () => body,
  });
}

beforeEach(() => {
  __resetPeerDependencyCache();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("useAppFiles", () => {
  it("returns an empty map when appId is null", () => {
    const store = createArtifactStore();
    const { result } = renderHook(() => useAppFiles(store, null));
    expect(result.current).toEqual({});
  });

  it("hydrates from existing files for the given appId", async () => {
    const store = createArtifactStore();
    const id = store.createApp();
    await store.writeFile(id, "App.tsx", "hello");

    const { result } = renderHook(() => useAppFiles(store, id));

    await waitFor(() => {
      expect(result.current).toEqual({ "/App.tsx": "hello" });
    });
  });

  it("updates live as files are written", async () => {
    const store = createArtifactStore();
    const id = store.createApp();

    const { result } = renderHook(() => useAppFiles(store, id));
    await waitFor(() => expect(result.current).toEqual({}));

    await act(async () => {
      await store.writeFile(id, "App.tsx", "one");
    });

    expect(result.current).toEqual({ "/App.tsx": "one" });

    await act(async () => {
      await store.writeFile(id, "App.tsx", "two");
      await store.writeFile(id, "styles.css", "body{}");
    });

    expect(result.current).toEqual({
      "/App.tsx": "two",
      "/styles.css": "body{}",
    });
  });

  it("ignores events for other appIds", async () => {
    const store = createArtifactStore();
    const a = store.createApp();
    const b = store.createApp();

    const { result } = renderHook(() => useAppFiles(store, a));
    await waitFor(() => expect(result.current).toEqual({}));

    await act(async () => {
      await store.writeFile(b, "App.tsx", "other");
    });

    expect(result.current).toEqual({});
  });

  it("resets when the appId prop changes", async () => {
    const store = createArtifactStore();
    const a = store.createApp();
    const b = store.createApp();
    await store.writeFile(a, "A.tsx", "a");
    await store.writeFile(b, "B.tsx", "b");

    const { result, rerender } = renderHook(
      ({ id }: { id: string | null }) => useAppFiles(store, id),
      { initialProps: { id: a as string | null } },
    );
    await waitFor(() => expect(result.current).toEqual({ "/A.tsx": "a" }));

    rerender({ id: b });
    await waitFor(() => expect(result.current).toEqual({ "/B.tsx": "b" }));

    rerender({ id: null });
    await waitFor(() => expect(result.current).toEqual({}));
  });

  it("unsubscribes on unmount", async () => {
    const store = createArtifactStore();
    const id = store.createApp();

    const { result, unmount } = renderHook(() => useAppFiles(store, id));
    await waitFor(() => expect(result.current).toEqual({}));
    unmount();

    await store.writeFile(id, "App.tsx", "later");
    expect(result.current).toEqual({});
  });

  it("handles getFiles resolving after unmount without error", async () => {
    const store = createArtifactStore();
    const id = store.createApp();
    let resolve!: (v: Record<string, string>) => void;
    const pending = new Promise<Record<string, string>>((r) => {
      resolve = r;
    });
    store.getFiles = vi.fn(() => pending) as typeof store.getFiles;

    const { unmount } = renderHook(() => useAppFiles(store, id));
    unmount();
    resolve({ "/App.tsx": "late" });
    await pending;
    expect(store.getFiles).toHaveBeenCalled();
  });
});

function providerProps(container: HTMLElement): Record<string, unknown> {
  const el = container.querySelector('[data-testid="provider"]');
  return JSON.parse(el?.getAttribute("data-props") ?? "{}");
}

function previewProps(container: HTMLElement): Record<string, unknown> {
  const el = container.querySelector('[data-testid="preview"]');
  return JSON.parse(el?.getAttribute("data-props") ?? "{}");
}

describe("LiveApp", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetchJson({}));
  });

  it("forwards files and defaults to SandpackProvider/Preview", () => {
    const files = {
      "/App.tsx": "export default () => null;",
      "/index.tsx": "render();",
    };
    const { container } = render(<LiveApp files={files} />);
    const p = providerProps(container);
    expect(p.files).toEqual(files);
    expect(p.template).toBe("react-ts");
    expect(p.theme).toBe("dark");
  });

  it("hides the 'Open in CodeSandbox' button by default", () => {
    const { container } = render(<LiveApp files={{}} />);
    expect(previewProps(container).showOpenInCodeSandbox).toBe(false);
  });

  it("accepts numeric and string heights and applies them to the preview", () => {
    const { container, rerender } = render(<LiveApp files={{}} height={360} />);
    expect((previewProps(container).style as { height?: string })?.height).toBe(
      "360px",
    );

    rerender(<LiveApp files={{}} height="100%" />);
    expect((previewProps(container).style as { height?: string })?.height).toBe(
      "100%",
    );
  });

  it("passes className and style to the wrapping div", () => {
    const { container } = render(
      <LiveApp files={{}} className="my-class" style={{ borderRadius: 12 }} />,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toBe("my-class");
    expect(wrapper.style.borderRadius).toBe("12px");
    expect(wrapper.style.width).toBe("100%");
  });

  it("allows overriding template and theme", () => {
    const { container } = render(
      <LiveApp files={{}} template="vanilla" theme="light" />,
    );
    const p = providerProps(container);
    expect(p.template).toBe("vanilla");
    expect(p.theme).toBe("light");
  });

  it("merges providerProps onto the SandpackProvider", () => {
    const { container } = render(
      <LiveApp
        files={{}}
        providerProps={{ options: { recompileMode: "delayed" } }}
      />,
    );
    const p = providerProps(container) as {
      options?: { recompileMode?: string };
    };
    expect(p.options?.recompileMode).toBe("delayed");
  });

  it("merges previewProps onto the SandpackPreview", () => {
    const { container } = render(
      <LiveApp files={{}} previewProps={{ showRefreshButton: false }} />,
    );
    expect(previewProps(container).showRefreshButton).toBe(false);
  });

  it("auto-declares npm dependencies based on imports in files", async () => {
    const files = {
      "/App.tsx": `import React from "react";
import { z } from "zod";
import "./styles.css";
export default () => null;`,
      "/styles.css": "body {}",
    };
    const { container } = render(<LiveApp files={files} />);
    await waitFor(() => {
      const p = providerProps(container) as {
        customSetup?: { dependencies?: Record<string, string> };
      };
      expect(p.customSetup?.dependencies).toEqual({ zod: "latest" });
    });
  });

  it("enriches deps with peers fetched from the npm registry", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("recharts")) {
          return {
            ok: true,
            json: async () => ({
              peerDependencies: { "react-is": "^18", react: "^18" },
            }),
          };
        }
        return { ok: true, json: async () => ({}) };
      }),
    );

    const files = { "/App.tsx": `import { LineChart } from "recharts";` };
    const { container } = render(<LiveApp files={files} />);

    await waitFor(() => {
      const p = providerProps(container) as {
        customSetup?: { dependencies?: Record<string, string> };
      };
      expect(p.customSetup?.dependencies).toEqual({
        recharts: "latest",
        "react-is": "latest",
      });
    });
  });

  it("falls back silently when the registry is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const files = { "/App.tsx": `import { foo } from "mystery-pkg";` };
    const { container } = render(<LiveApp files={files} />);

    await waitFor(() => {
      const p = providerProps(container) as {
        customSetup?: { dependencies?: Record<string, string> };
      };
      expect(p.customSetup?.dependencies).toEqual({
        "mystery-pkg": "latest",
      });
    });
  });

  it("respects user-supplied dependency overrides", async () => {
    const files = { "/App.tsx": `import { LineChart } from "recharts";` };
    const { container } = render(
      <LiveApp
        files={files}
        customSetup={{ dependencies: { recharts: "2.13.0" } }}
      />,
    );
    await waitFor(() => {
      const p = providerProps(container) as {
        customSetup?: { dependencies?: Record<string, string> };
      };
      expect(p.customSetup?.dependencies?.recharts).toBe("2.13.0");
    });
  });

  it("skips dep fetching when there are no imports", () => {
    const fetchFn = vi.fn();
    vi.stubGlobal("fetch", fetchFn);
    render(<LiveApp files={{ "/App.tsx": "export default () => null;" }} />);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("shows a loading state while peers are being resolved, then mounts Sandpack", async () => {
    let resolveFetch!: (v: {
      ok: boolean;
      json: () => Promise<unknown>;
    }) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<{ ok: boolean; json: () => Promise<unknown> }>((r) => {
            resolveFetch = r;
          }),
      ),
    );

    const files = { "/App.tsx": `import { z } from "zod";` };
    const { container } = render(<LiveApp files={files} />);

    // Initial render: peers not yet resolved, preview is loading.
    expect(
      container.querySelector('[data-testid="live-artifact-loading"]'),
    ).toBeTruthy();
    expect(container.querySelector('[data-testid="provider"]')).toBeNull();

    resolveFetch({ ok: true, json: async () => ({}) });

    await waitFor(() => {
      expect(container.querySelector('[data-testid="provider"]')).toBeTruthy();
    });
  });

  it("mounts Sandpack immediately when there are no imports (no peers to wait for)", () => {
    const { container } = render(
      <LiveApp files={{ "/App.tsx": "export default () => null;" }} />,
    );
    expect(container.querySelector('[data-testid="provider"]')).toBeTruthy();
    expect(
      container.querySelector('[data-testid="live-artifact-loading"]'),
    ).toBeNull();
  });

  it("does not overwrite a direct dep when it also appears as a peer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ peerDependencies: { "react-is": "^18" } }),
      })),
    );
    const files = {
      "/App.tsx": `import { LineChart } from "recharts";`,
      "/package.json": JSON.stringify({
        dependencies: { recharts: "latest", "react-is": "18.2.0" },
      }),
    };
    const { container } = render(<LiveApp files={files} />);

    await waitFor(() => {
      const p = providerProps(container) as {
        customSetup?: { dependencies?: Record<string, string> };
      };
      expect(p.customSetup?.dependencies?.["react-is"]).toBe("18.2.0");
    });
  });

  it("strips /package.json from the files handed to Sandpack", async () => {
    const files = {
      "/App.tsx": `import { z } from "zod";`,
      "/package.json": JSON.stringify({ dependencies: { zod: "latest" } }),
    };
    const { container } = render(<LiveApp files={files} />);
    await waitFor(() => {
      const p = providerProps(container) as {
        files?: Record<string, unknown>;
        customSetup?: { dependencies?: Record<string, string> };
      };
      expect(p.files).toEqual({ "/App.tsx": files["/App.tsx"] });
      expect(p.customSetup?.dependencies).toEqual({ zod: "latest" });
    });
  });

  it("does not update state if the component unmounts before peers resolve", async () => {
    let resolveFetch!: (v: {
      ok: boolean;
      json: () => Promise<unknown>;
    }) => void;
    const pending = new Promise<{ ok: boolean; json: () => Promise<unknown> }>(
      (r) => {
        resolveFetch = r;
      },
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(() => pending),
    );

    const files = { "/App.tsx": `import { z } from "zod";` };
    const { unmount } = render(<LiveApp files={files} />);
    unmount();

    resolveFetch({
      ok: true,
      json: async () => ({ peerDependencies: { "some-peer": "*" } }),
    });
    await pending;
  });
});

describe("extractDependencies", () => {
  it("returns an empty map for no imports", () => {
    expect(extractDependencies({})).toEqual({});
    expect(extractDependencies({ "/App.tsx": "const x = 1;" })).toEqual({});
  });

  it("ignores relative imports and react builtins", () => {
    const files = {
      "/App.tsx": `import "./styles.css";
import React from "react";
import { createRoot } from "react-dom/client";
import { jsx } from "react/jsx-runtime";`,
    };
    expect(extractDependencies(files)).toEqual({});
  });

  it("collapses scoped packages and subpaths to top-level package names", () => {
    const files = {
      "/App.tsx": `import thing from "@tanstack/react-table";
import { parse } from "date-fns/parse";
import deep from "@tanstack/react-query/build/modern/index";`,
    };
    expect(extractDependencies(files)).toEqual({
      "@tanstack/react-table": "latest",
      "date-fns": "latest",
      "@tanstack/react-query": "latest",
    });
  });

  it("handles a scoped specifier without a slash", () => {
    const files = { "/App.tsx": `import x from "@weird";` };
    expect(extractDependencies(files)).toEqual({ "@weird": "latest" });
  });

  it("rejects react subpaths that resolve back to the react builtin", () => {
    const files = { "/App.tsx": `import x from "react/experimental";` };
    expect(extractDependencies(files)).toEqual({});
  });

  it("handles both ES import and CommonJS require syntax", () => {
    const files = {
      "/App.tsx": `const x = require("lodash");
import { foo } from "mitt";`,
    };
    expect(extractDependencies(files)).toEqual({
      lodash: "latest",
      mitt: "latest",
    });
  });

  it("uses /package.json dependencies when present", () => {
    const files = {
      "/App.tsx": `import "ignored-by-scan";`,
      "/package.json": JSON.stringify({
        dependencies: { recharts: "^2.0.0", "react-is": "^18" },
      }),
    };
    expect(extractDependencies(files)).toEqual({
      recharts: "^2.0.0",
      "react-is": "^18",
    });
  });

  it("falls through to import scanning when /package.json is malformed", () => {
    const files = {
      "/App.tsx": `import { z } from "zod";`,
      "/package.json": "{not valid json",
    };
    expect(extractDependencies(files)).toEqual({ zod: "latest" });
  });

  it("falls through when /package.json has no dependencies field", () => {
    const files = {
      "/App.tsx": `import { z } from "zod";`,
      "/package.json": JSON.stringify({ name: "foo", version: "0.0.1" }),
    };
    expect(extractDependencies(files)).toEqual({ zod: "latest" });
  });

  it("falls through when /package.json dependencies field is not an object", () => {
    const files = {
      "/App.tsx": `import { z } from "zod";`,
      "/package.json": JSON.stringify({ dependencies: null }),
    };
    expect(extractDependencies(files)).toEqual({ zod: "latest" });
  });
});

describe("fetchPeerDependencies", () => {
  it("returns the peer dep names for a package", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchJson({
        peerDependencies: { "react-is": "^18", "date-fns": "^3" },
      }),
    );
    await expect(fetchPeerDependencies("recharts")).resolves.toEqual([
      "react-is",
      "date-fns",
    ]);
  });

  it("strips react builtins from peer list", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchJson({
        peerDependencies: { react: "^18", "react-dom": "^18", foo: "*" },
      }),
    );
    await expect(fetchPeerDependencies("some-pkg")).resolves.toEqual(["foo"]);
  });

  it("returns [] when the registry returns no peer deps", async () => {
    vi.stubGlobal("fetch", mockFetchJson({}));
    await expect(fetchPeerDependencies("mystery-pkg")).resolves.toEqual([]);
  });

  it("returns [] when the registry returns non-ok", async () => {
    vi.stubGlobal("fetch", mockFetchJson({}, false));
    await expect(fetchPeerDependencies("nonexistent")).resolves.toEqual([]);
  });

  it("returns [] when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(fetchPeerDependencies("any-pkg")).resolves.toEqual([]);
  });

  it("caches results across calls", async () => {
    const fetchFn = mockFetchJson({ peerDependencies: { foo: "*" } });
    vi.stubGlobal("fetch", fetchFn);
    await fetchPeerDependencies("same-pkg");
    await fetchPeerDependencies("same-pkg");
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
