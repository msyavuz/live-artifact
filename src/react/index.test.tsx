import {
  act,
  cleanup,
  render,
  renderHook,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@codesandbox/sandpack-react", () => ({
  Sandpack: (props: Record<string, unknown>) => (
    <div data-testid="sandpack" data-props={JSON.stringify(props)} />
  ),
}));

import { createArtifactStore } from "../store";
import { LiveApp, useAppFiles } from "./index";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("useAppFiles", () => {
  it("returns an empty map when appId is null", () => {
    const store = createArtifactStore({ backend: "memory" });
    const { result } = renderHook(() => useAppFiles(store, null));
    expect(result.current).toEqual({});
  });

  it("hydrates from existing files for the given appId", async () => {
    const store = createArtifactStore({ backend: "memory" });
    const id = store.createApp();
    await store.writeFile(id, "App.tsx", "hello");

    const { result } = renderHook(() => useAppFiles(store, id));

    await waitFor(() => {
      expect(result.current).toEqual({ "/App.tsx": "hello" });
    });
  });

  it("updates live as files are written", async () => {
    const store = createArtifactStore({ backend: "memory" });
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
    const store = createArtifactStore({ backend: "memory" });
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
    const store = createArtifactStore({ backend: "memory" });
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
    const store = createArtifactStore({ backend: "memory" });
    const id = store.createApp();

    const { result, unmount } = renderHook(() => useAppFiles(store, id));
    await waitFor(() => expect(result.current).toEqual({}));
    unmount();

    await store.writeFile(id, "App.tsx", "later");
    expect(result.current).toEqual({});
  });

  it("handles getFiles resolving after unmount without error", async () => {
    const store = createArtifactStore({ backend: "memory" });
    const id = store.createApp();
    const original = store.getFiles.bind(store);
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

    store.getFiles = original;
  });
});

describe("LiveApp", () => {
  it("forwards files and default options to Sandpack", () => {
    const files = {
      "/App.tsx": "export default () => null;",
      "/index.tsx": "render();",
    };
    const { getByTestId } = render(<LiveApp files={files} />);
    const props = JSON.parse(
      getByTestId("sandpack").getAttribute("data-props") ?? "{}",
    );
    expect(props.files).toEqual(files);
    expect(props.template).toBe("react-ts");
    expect(props.theme).toBe("dark");
    expect(props.options.editorHeight).toBe(360);
    expect(props.options.showTabs).toBe(false);
  });

  it("allows overriding template, theme, height, and options", () => {
    const { getByTestId } = render(
      <LiveApp
        files={{}}
        template="vanilla"
        theme="light"
        height={500}
        options={{ showTabs: true }}
      />,
    );
    const props = JSON.parse(
      getByTestId("sandpack").getAttribute("data-props") ?? "{}",
    );
    expect(props.template).toBe("vanilla");
    expect(props.theme).toBe("light");
    expect(props.options.editorHeight).toBe(500);
    expect(props.options.showTabs).toBe(true);
  });
});
