import { describe, expect, it, vi } from "vitest";
import { createArtifactStore, type ArtifactEvent } from "./store";
import { artifactToolSpecs } from "./tools";

describe("memory-backed ArtifactStore", () => {
  it("creates apps with unique ids", () => {
    const store = createArtifactStore({ backend: "memory" });
    const a = store.createApp();
    const b = store.createApp();
    expect(a).not.toBe(b);
    expect(store.hasApp(a)).toBe(true);
    expect(store.hasApp(b)).toBe(true);
    expect(store.hasApp("bogus")).toBe(false);
  });

  it("round-trips writeFile / readFile / getFiles", async () => {
    const store = createArtifactStore({ backend: "memory" });
    const id = store.createApp();

    await store.writeFile(id, "App.tsx", "export default () => null;");
    await store.writeFile(id, "/styles.css", "body { margin: 0; }");

    expect(await store.readFile(id, "App.tsx")).toBe(
      "export default () => null;",
    );
    expect(await store.readFile(id, "styles.css")).toBe("body { margin: 0; }");

    const files = await store.getFiles(id);
    expect(files).toEqual({
      "/App.tsx": "export default () => null;",
      "/styles.css": "body { margin: 0; }",
    });
  });

  it("read of missing file throws ENOENT", async () => {
    const store = createArtifactStore({ backend: "memory" });
    const id = store.createApp();
    await expect(store.readFile(id, "missing.ts")).rejects.toThrow(/ENOENT/);
  });

  it("subscribe receives app_created and file_written events", async () => {
    const store = createArtifactStore({ backend: "memory" });
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

  it("custom idPrefix is applied", () => {
    const store = createArtifactStore({ backend: "memory", idPrefix: "art" });
    const id = store.createApp();
    expect(id.startsWith("art-")).toBe(true);
  });
});

describe("artifactToolSpecs", () => {
  it("exports the two expected tools with JSON-schema input schemas", () => {
    const names = artifactToolSpecs.map((t) => t.name);
    expect(names).toEqual(["start_new_app", "write_file"]);

    for (const tool of artifactToolSpecs) {
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.inputSchema).toHaveProperty("properties");
    }

    const writeFile = artifactToolSpecs.find((t) => t.name === "write_file")!;
    expect(writeFile.inputSchema.required).toContain("path");
    expect(writeFile.inputSchema.required).toContain("content");
  });
});
