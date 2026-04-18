import { afterEach, describe, expect, it, vi } from "vitest";
import { type ArtifactEvent, createArtifactStore } from "./store";
import { artifactToolSpecs, DEFAULT_ARTIFACT_SYSTEM } from "./tools";

describe.each([
  ["memory" as const, "memory"],
  ["zenfs" as const, "zenfs (default)"],
  [undefined, "zenfs (implicit default)"],
])("ArtifactStore — %s backend", (backend, _label) => {
  function makeStore(opts: Parameters<typeof createArtifactStore>[0] = {}) {
    return createArtifactStore({ ...opts, backend });
  }

  it("creates apps with unique ids and tracks them via hasApp", async () => {
    const store = makeStore();
    await store.ready;
    const a = store.createApp();
    const b = store.createApp();
    expect(a).not.toBe(b);
    expect(store.hasApp(a)).toBe(true);
    expect(store.hasApp(b)).toBe(true);
    expect(store.hasApp("bogus")).toBe(false);
  });

  it("round-trips writeFile / readFile / getFiles", async () => {
    const store = makeStore();
    await store.ready;
    const id = store.createApp();

    await store.writeFile(id, "App.tsx", "export default () => null;");
    await store.writeFile(id, "/styles.css", "body { margin: 0; }");

    expect(await store.readFile(id, "App.tsx")).toBe(
      "export default () => null;",
    );
    expect(await store.readFile(id, "styles.css")).toBe("body { margin: 0; }");

    expect(await store.getFiles(id)).toEqual({
      "/App.tsx": "export default () => null;",
      "/styles.css": "body { margin: 0; }",
    });
  });

  it("writeFile creates nested directories", async () => {
    const store = makeStore();
    await store.ready;
    const id = store.createApp();

    await store.writeFile(
      id,
      "src/components/Foo.tsx",
      "export const Foo = () => null;",
    );
    await store.writeFile(
      id,
      "src/components/Bar.tsx",
      "export const Bar = () => null;",
    );

    expect(await store.getFiles(id)).toEqual({
      "/src/components/Foo.tsx": "export const Foo = () => null;",
      "/src/components/Bar.tsx": "export const Bar = () => null;",
    });
  });

  it("writeFile auto-tracks apps even without an explicit createApp call", async () => {
    const store = makeStore();
    await store.ready;

    await store.writeFile("adhoc-id", "App.tsx", "x");

    expect(store.hasApp("adhoc-id")).toBe(true);
    expect(await store.readFile("adhoc-id", "App.tsx")).toBe("x");
  });

  it("getFiles on an unknown app returns an empty map", async () => {
    const store = makeStore();
    await store.ready;
    expect(await store.getFiles("never-existed")).toEqual({});
  });

  it("read of missing file rejects", async () => {
    const store = makeStore();
    await store.ready;
    const id = store.createApp();
    await expect(store.readFile(id, "missing.ts")).rejects.toThrow();
  });

  it("subscribe receives app_created and file_written events", async () => {
    const store = makeStore();
    await store.ready;
    const listener = vi.fn<(e: ArtifactEvent) => void>();
    const unsubscribe = store.subscribe(listener);

    const id = store.createApp();
    await store.writeFile(id, "App.tsx", "x");

    expect(listener).toHaveBeenCalledWith({ type: "app_created", appId: id });
    expect(listener).toHaveBeenCalledWith({
      type: "file_written",
      appId: id,
      path: "App.tsx",
      content: "x",
    });

    unsubscribe();
    await store.writeFile(id, "App.tsx", "y");
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("custom idPrefix is applied", async () => {
    const store = makeStore({ idPrefix: "art" });
    await store.ready;
    const id = store.createApp();
    expect(id.startsWith("art-")).toBe(true);
  });
});

describe("ZenFS backend — custom config", () => {
  afterEach(async () => {
    // Reset the singleton ZenFS mount for subsequent tests.
    const { configure, InMemory } = await import("@zenfs/core");
    await configure({ mounts: { "/": InMemory } });
  });

  it("forwards the zenfs option to configure()", async () => {
    const { InMemory } = await import("@zenfs/core");
    const store = createArtifactStore({
      backend: "zenfs",
      zenfs: { mounts: { "/": InMemory } },
    });
    await store.ready;
    const id = store.createApp();
    await store.writeFile(id, "App.tsx", "ok");
    expect(await store.readFile(id, "App.tsx")).toBe("ok");
  });

  it("is idempotent when configure() is called twice on the same mount", async () => {
    const { InMemory } = await import("@zenfs/core");
    const first = createArtifactStore({
      backend: "zenfs",
      zenfs: { mounts: { "/": InMemory } },
    });
    await first.ready;
    const second = createArtifactStore({
      backend: "zenfs",
      zenfs: { mounts: { "/": InMemory } },
    });
    await expect(second.ready).resolves.toBeUndefined();
  });
});

describe("exported tool specs", () => {
  it("exports the two expected tools with JSON-schema input schemas", () => {
    const names = artifactToolSpecs.map((t) => t.name);
    expect(names).toEqual(["start_new_app", "write_file"]);

    for (const tool of artifactToolSpecs) {
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.inputSchema).toHaveProperty("properties");
    }

    const writeFile = artifactToolSpecs.find((t) => t.name === "write_file");
    expect(writeFile?.inputSchema.required).toContain("path");
    expect(writeFile?.inputSchema.required).toContain("content");
  });

  it("ships a non-empty default system prompt", () => {
    expect(typeof DEFAULT_ARTIFACT_SYSTEM).toBe("string");
    expect(DEFAULT_ARTIFACT_SYSTEM).toMatch(/start_new_app/);
    expect(DEFAULT_ARTIFACT_SYSTEM).toMatch(/write_file/);
  });
});
