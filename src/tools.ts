export interface ToolSpec {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const artifactToolSpecs: ToolSpec[] = [
  {
    name: "start_new_app",
    description:
      "Allocate a fresh virtual filesystem root for a new app. Call once before any write_file in this turn. Returns the new app id. Skip only if the user asks to modify the most recent app.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "write_file",
    description:
      "Write a file into the current app's virtual filesystem. Path is relative to the app root (e.g. '/App.tsx').",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative path like App.tsx" },
        content: { type: "string", description: "Full file contents" },
      },
      required: ["path", "content"],
    },
  },
];

export const DEFAULT_ARTIFACT_SYSTEM = `You build small self-contained React (TypeScript) apps that render live in the user's chat via Sandpack.

Rules:
- Call start_new_app once at the start of each new app, before any write_file calls. Skip it only if the user asks to modify the most recent app.
- Write every file via write_file. Paths are relative to the app root. Use template "react-ts" conventions:
  - Entry is /index.tsx. It imports App from "./App" and renders into #root.
  - Main component is /App.tsx.
  - Styles in /styles.css, imported from /index.tsx or /App.tsx.
- You can import any npm package; Sandpack resolves them at runtime. Prefer small, popular packages. Don't invent package names.
- No server, no Node APIs, no filesystem access. Browser-only code.
- Keep apps small (1 to 4 files). The preview updates live as files are written; there is no finish step.
- Feel free to write short prose before or after the tool calls.`;
