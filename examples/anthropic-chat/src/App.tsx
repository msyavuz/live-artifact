import { useEffect, useMemo, useRef, useState } from "react";
import Anthropic from "@anthropic-ai/sdk";
import {
  artifactToolSpecs,
  createArtifactStore,
  DEFAULT_ARTIFACT_SYSTEM,
  type ArtifactStore,
} from "live-artifact";
import { LiveApp, useAppFiles } from "live-artifact/react";
import "./App.css";

const MODEL = "claude-opus-4-7";

type ToolEvent = { name: string; summary: string; isError?: boolean };

type UiMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  appId?: string;
  tools?: ToolEvent[];
  error?: string;
};

export default function App() {
  const [apiKey, setApiKey] = useState<string>(
    () => localStorage.getItem("anthropic_key") ?? "",
  );
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [currentAppId, setCurrentAppId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  const store = useMemo(() => createArtifactStore(), []);

  useEffect(() => {
    store.ready.then(() => setReady(true));
  }, [store]);

  const scrollerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const atBottom = () =>
      el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    let stickToBottom = true;
    const onScroll = () => {
      stickToBottom = atBottom();
    };
    el.addEventListener("scroll", onScroll);
    const pin = () => {
      if (stickToBottom) el.scrollTo({ top: el.scrollHeight });
    };
    const observer = new ResizeObserver(pin);
    observer.observe(el);
    for (const child of Array.from(el.children)) observer.observe(child);
    const mutation = new MutationObserver(() => {
      for (const child of Array.from(el.children)) observer.observe(child);
      pin();
    });
    mutation.observe(el, { childList: true, subtree: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      observer.disconnect();
      mutation.disconnect();
    };
  }, []);

  async function send() {
    const text = input.trim();
    if (!text || !apiKey || busy) return;
    setInput("");
    setBusy(true);

    const userMsg: UiMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text,
    };
    const assistantId = crypto.randomUUID();
    const assistantMsg: UiMessage = {
      id: assistantId,
      role: "assistant",
      text: "",
    };
    const prior = messages;
    setMessages([...prior, userMsg, assistantMsg]);

    try {
      const appId = await runTurn({
        apiKey,
        prior,
        userText: text,
        currentAppId,
        store,
        onText: (delta) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, text: m.text + delta } : m,
            ),
          );
        },
        onToolEvent: (event) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, tools: [...(m.tools ?? []), event] }
                : m,
            ),
          );
        },
        onStartApp: (id) => {
          setCurrentAppId(id);
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, appId: id } : m)),
          );
        },
        onAttachApp: (id) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId && !m.appId ? { ...m, appId: id } : m,
            ),
          );
        },
      });
      if (appId) setCurrentAppId(appId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, error: message } : m,
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  function saveKey(k: string) {
    setApiKey(k);
    localStorage.setItem("anthropic_key", k);
  }

  async function injectDemo() {
    const id = store.createApp();
    await Promise.all([
      store.writeFile(
        id,
        "App.tsx",
        `import { useState } from "react";
import "./styles.css";

export default function App() {
  const [count, setCount] = useState(0);
  return (
    <div className="card">
      <h1>Demo counter</h1>
      <button onClick={() => setCount((c) => c + 1)}>Count: {count}</button>
    </div>
  );
}
`,
      ),
      store.writeFile(
        id,
        "index.tsx",
        `import { createRoot } from "react-dom/client";
import App from "./App";

createRoot(document.getElementById("root")!).render(<App />);
`,
      ),
      store.writeFile(
        id,
        "styles.css",
        `body { font-family: system-ui, sans-serif; margin: 0; }
.card { padding: 24px; max-width: 360px; margin: 40px auto; border: 1px solid #ddd; border-radius: 12px; background: #fafafa; }
.card button { padding: 8px 14px; border-radius: 8px; border: 0; background: #2563eb; color: white; cursor: pointer; }
`,
      ),
    ]);
    setCurrentAppId(id);
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "user",
        text: "[demo] counter",
      },
      {
        id: crypto.randomUUID(),
        role: "assistant",
        text: "Here's a demo app.",
        appId: id,
        tools: [
          { name: "start_new_app", summary: `start_new_app → ${id}` },
          { name: "write_file", summary: "write_file App.tsx" },
          { name: "write_file", summary: "write_file index.tsx" },
          { name: "write_file", summary: "write_file styles.css" },
        ],
      },
    ]);
  }

  return (
    <div className="shell">
      <header>
        <h1>live-artifact · anthropic-chat</h1>
        <button type="button" className="demobtn" onClick={injectDemo}>
          Inject demo
        </button>
        <input
          className="keyinput"
          type="password"
          placeholder="sk-ant-..."
          value={apiKey}
          onChange={(e) => saveKey(e.target.value)}
        />
      </header>

      <div className="chat" ref={scrollerRef}>
        {!ready && <div className="status">Booting filesystem...</div>}
        {messages.length === 0 && ready && (
          <div className="status">
            Ask for an app. Example: "Build a todo list" or "Show a chart of
            fake sales data".
          </div>
        )}
        {messages.map((m) => (
          <MessageRow key={m.id} message={m} store={store} />
        ))}
      </div>

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <textarea
          placeholder={
            apiKey ? "Describe an app..." : "Add your Anthropic API key first"
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          disabled={busy || !apiKey}
          rows={2}
        />
        <button type="submit" disabled={busy || !apiKey || !input.trim()}>
          {busy ? "Building..." : "Send"}
        </button>
      </form>
    </div>
  );
}

function MessageRow({
  message,
  store,
}: {
  message: UiMessage;
  store: ArtifactStore;
}) {
  const files = useAppFiles(store, message.appId ?? null);
  const hasFiles = Object.keys(files).length > 0;
  return (
    <div className={`msg ${message.role}`}>
      <div className="role">{message.role}</div>
      {message.text && <div className="text">{message.text}</div>}
      {message.tools && message.tools.length > 0 && (
        <ul className="tools">
          {message.tools.map((t, i) => (
            <li key={i} className={t.isError ? "tool err" : "tool"}>
              {t.summary}
            </li>
          ))}
        </ul>
      )}
      {message.error && <div className="err">Error: {message.error}</div>}
      {hasFiles && (
        <div className="preview">
          <LiveApp files={files} />
        </div>
      )}
    </div>
  );
}

async function runTurn(args: {
  apiKey: string;
  prior: UiMessage[];
  userText: string;
  currentAppId: string | null;
  store: ArtifactStore;
  onText: (delta: string) => void;
  onToolEvent: (event: ToolEvent) => void;
  onStartApp: (id: string) => void;
  onAttachApp: (id: string) => void;
}): Promise<string | null> {
  const client = new Anthropic({
    apiKey: args.apiKey,
    dangerouslyAllowBrowser: true,
  });

  const apiMessages: Anthropic.MessageParam[] = args.prior
    .filter((m) => m.text.trim().length > 0)
    .map((m) => ({ role: m.role, content: m.text }));
  apiMessages.push({ role: "user", content: args.userText });

  const apiTools: Anthropic.Tool[] = artifactToolSpecs.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema,
  }));

  let activeAppId = args.currentAppId;

  for (let step = 0; step < 8; step++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: DEFAULT_ARTIFACT_SYSTEM,
      tools: apiTools,
      messages: apiMessages,
    });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type === "text") {
        args.onText(block.text);
        continue;
      }
      if (block.type !== "tool_use") continue;

      const input = (block.input ?? {}) as Record<string, unknown>;
      let resultContent = "";
      let isError: boolean | undefined;

      if (block.name === "start_new_app") {
        activeAppId = args.store.createApp();
        args.onStartApp(activeAppId);
        resultContent = `Started app ${activeAppId}`;
      } else if (block.name === "write_file") {
        if (!activeAppId) {
          resultContent = "No active app. Call start_new_app first.";
          isError = true;
        } else {
          const path = String(input.path ?? "");
          const content = String(input.content ?? "");
          if (!path) {
            resultContent = "Missing path";
            isError = true;
          } else {
            await args.store.writeFile(activeAppId, path, content);
            args.onAttachApp(activeAppId);
            resultContent = `Wrote ${path} (${content.length} bytes)`;
          }
        }
      } else {
        resultContent = `Unknown tool: ${block.name}`;
        isError = true;
      }

      args.onToolEvent({
        name: block.name,
        summary: summarizeTool(block.name, input, resultContent),
        isError,
      });
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: resultContent,
        is_error: isError,
      });
    }

    apiMessages.push({ role: "assistant", content: response.content });
    if (response.stop_reason !== "tool_use") break;
    if (toolResults.length === 0) break;
    apiMessages.push({ role: "user", content: toolResults });
  }

  return activeAppId;
}

function summarizeTool(
  name: string,
  input: Record<string, unknown>,
  result: string,
): string {
  if (name === "write_file") return `write_file ${input.path ?? "?"}`;
  if (name === "start_new_app") return `start_new_app → ${result}`;
  return name;
}
