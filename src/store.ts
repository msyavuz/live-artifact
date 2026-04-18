import { configure, fs, InMemory } from "@zenfs/core";

export type FilesMap = Record<string, string>;

export type ArtifactEvent =
  | { type: "app_created"; appId: string }
  | { type: "file_written"; appId: string; path: string; content: string };

export interface ArtifactStore {
  createApp(): string;
  hasApp(appId: string): boolean;
  writeFile(appId: string, path: string, content: string): Promise<void>;
  readFile(appId: string, path: string): Promise<string>;
  getFiles(appId: string): Promise<FilesMap>;
  subscribe(listener: (event: ArtifactEvent) => void): () => void;
  ready: Promise<void>;
}

export type ZenFSConfig = Parameters<typeof configure>[0];

export interface CreateStoreOptions {
  /**
   * ZenFS mount configuration, forwarded directly to ZenFS's `configure()`.
   * Plug in IndexedDB, OPFS, OverlayFS, or any other ZenFS backend here.
   *
   * Defaults to `{ mounts: { "/": InMemory } }`.
   */
  zenfs?: ZenFSConfig;
  /** Prefix for generated app ids. Defaults to "app". */
  idPrefix?: string;
}

// ZenFS mounts are a global singleton: calling configure() twice on the same
// mount point throws "already in use". Cache the first configure promise so
// StrictMode remounts, HMR, and multiple stores in one page all share it.
let zenfsReady: Promise<void> | null = null;

export function createArtifactStore(
  opts: CreateStoreOptions = {},
): ArtifactStore {
  const idPrefix = opts.idPrefix ?? "app";
  const listeners = new Set<(e: ArtifactEvent) => void>();
  const known = new Set<string>();

  zenfsReady ??= configure(opts.zenfs ?? { mounts: { "/": InMemory } });
  const ready = zenfsReady;

  const emit = (e: ArtifactEvent) => {
    for (const l of listeners) l(e);
  };

  const appRoot = (id: string) => `/apps/${id}`;
  const filePath = (id: string, rel: string) =>
    `${appRoot(id)}/${normalize(rel)}`;

  return {
    ready,
    createApp() {
      const id = newId(idPrefix);
      known.add(id);
      ready.then(() => {
        fs.mkdirSync(appRoot(id), { recursive: true });
      });
      emit({ type: "app_created", appId: id });
      return id;
    },
    hasApp(appId) {
      return known.has(appId);
    },
    async writeFile(appId, path, content) {
      await ready;
      const rel = normalize(path);
      const full = filePath(appId, rel);
      const dir = full.substring(0, full.lastIndexOf("/"));
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(full, content);
      known.add(appId);
      emit({ type: "file_written", appId, path: rel, content });
    },
    async readFile(appId, path) {
      await ready;
      return fs.readFileSync(filePath(appId, path), "utf8") as string;
    },
    async getFiles(appId) {
      await ready;
      const root = appRoot(appId);
      const out: FilesMap = {};
      const walk = (dir: string) => {
        if (!fs.existsSync(dir)) return;
        for (const entry of fs.readdirSync(dir) as string[]) {
          const full = `${dir}/${entry}`;
          if (fs.statSync(full).isDirectory()) walk(full);
          else {
            const rel = full.slice(root.length);
            out[rel] = fs.readFileSync(full, "utf8") as string;
          }
        }
      };
      walk(root);
      return out;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function normalize(rel: string): string {
  return rel.replace(/^\/+/, "");
}
