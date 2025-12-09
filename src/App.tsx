import { useState, useEffect, useCallback, useRef } from "react";
import Markdown from "react-markdown";
import { Switch } from "./components/ui/switch";

function usePersistedState<T>(key: string, defaultValue: T): [T, (value: T) => void] {
  const [state, setState] = useState<T>(() => {
    const stored = localStorage.getItem(key);
    return stored !== null ? JSON.parse(stored) : defaultValue;
  });

  const setPersistedState = useCallback((value: T) => {
    setState(value);
    localStorage.setItem(key, JSON.stringify(value));
  }, [key]);

  return [state, setPersistedState];
}

function CollapsibleContent({ content, markdown }: { content: string; markdown: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [isOverflow, setIsOverflow] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = contentRef.current;
    if (el) {
      setIsOverflow(el.scrollHeight > 40);
    }
  }, [content, markdown]);

  return (
    <div className="relative">
      <div
        ref={contentRef}
        className={`text-ink text-sm leading-relaxed ${
          !expanded && isOverflow ? "max-h-10 overflow-hidden" : ""
        }`}
      >
        {markdown ? (
          <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-pre:my-2 prose-ul:my-1 prose-ol:my-1">
            <Markdown>{content}</Markdown>
          </div>
        ) : (
          <p className="whitespace-pre-wrap break-words">{content}</p>
        )}
      </div>
      {isOverflow && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1 text-xs text-primary hover:text-primary/80"
        >
          {expanded ? "Collapse" : "Expand"}
        </button>
      )}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
  }, [text]);

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  return (
    <button
      onClick={handleCopy}
      className="absolute top-3 right-3 p-1.5 rounded-md bg-card-alt/80 hover:bg-card-alt text-muted hover:text-ink transition-opacity opacity-0 group-hover:opacity-100"
      title="Copy"
    >
      {copied ? (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  );
}
import { invoke } from "@tauri-apps/api/core";

interface Project {
  id: string;
  path: string;
  session_count: number;
  last_active: number;
}

interface Session {
  id: string;
  project_id: string;
  summary: string | null;
  message_count: number;
  last_modified: number;
}

interface Message {
  uuid: string;
  role: string;
  content: string;
  timestamp: string;
}

type View =
  | { type: "projects" }
  | { type: "sessions"; projectId: string; projectPath: string }
  | { type: "messages"; projectId: string; sessionId: string; summary: string | null };

function App() {
  const [view, setView] = useState<View>({ type: "projects" });

  return (
    <main className="min-h-screen bg-canvas">
      {view.type === "projects" && (
        <ProjectList onSelect={(p) => setView({
          type: "sessions",
          projectId: p.id,
          projectPath: p.path
        })} />
      )}
      {view.type === "sessions" && (
        <SessionList
          projectId={view.projectId}
          projectPath={view.projectPath}
          onBack={() => setView({ type: "projects" })}
          onSelect={(s) => setView({
            type: "messages",
            projectId: s.project_id,
            sessionId: s.id,
            summary: s.summary
          })}
        />
      )}
      {view.type === "messages" && (
        <MessageView
          projectId={view.projectId}
          sessionId={view.sessionId}
          summary={view.summary}
          onBack={() => setView({
            type: "sessions",
            projectId: view.projectId,
            projectPath: ""
          })}
        />
      )}
    </main>
  );
}

type SortKey = "recent" | "sessions" | "name";

function ProjectList({ onSelect }: { onSelect: (p: Project) => void }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortKey>("recent");

  useEffect(() => {
    invoke<Project[]>("list_projects")
      .then(setProjects)
      .finally(() => setLoading(false));
  }, []);

  const formatRelativeTime = (ts: number) => {
    const now = Date.now() / 1000;
    const diff = now - ts;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(ts * 1000).toLocaleDateString();
  };

  const sortedProjects = [...projects].sort((a, b) => {
    switch (sortBy) {
      case "recent": return b.last_active - a.last_active;
      case "sessions": return b.session_count - a.session_count;
      case "name": return a.path.localeCompare(b.path);
    }
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted">Loading projects...</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-8">
      <header className="mb-6">
        <h1 className="font-serif text-3xl font-semibold text-ink">Projects</h1>
        <p className="text-muted mt-1">{projects.length} Claude Code projects</p>
      </header>

      <div className="flex gap-2 mb-6">
        {([
          ["recent", "Recent"],
          ["sessions", "Sessions"],
          ["name", "Name"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSortBy(key)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              sortBy === key
                ? "bg-primary text-primary-foreground"
                : "bg-card-alt text-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {sortedProjects.map((project) => (
          <button
            key={project.id}
            onClick={() => onSelect(project)}
            className="w-full text-left bg-card rounded-xl p-4 border border-border hover:border-primary transition-colors"
          >
            <p className="font-medium text-ink truncate">{project.path}</p>
            <p className="text-sm text-muted mt-1">
              {project.session_count} session{project.session_count !== 1 ? "s" : ""} &middot; {formatRelativeTime(project.last_active)}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

function SessionList({
  projectId,
  projectPath,
  onBack,
  onSelect
}: {
  projectId: string;
  projectPath: string;
  onBack: () => void;
  onSelect: (s: Session) => void;
}) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoke<Session[]>("list_sessions", { projectId })
      .then(setSessions)
      .finally(() => setLoading(false));
  }, [projectId]);

  const formatDate = (ts: number) => {
    return new Date(ts * 1000).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted">Loading sessions...</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-8">
      <header className="mb-8">
        <button
          onClick={onBack}
          className="text-muted hover:text-ink mb-2 flex items-center gap-1"
        >
          <span>&larr;</span> Back
        </button>
        <h1 className="font-serif text-2xl font-semibold text-ink truncate">
          {projectPath || projectId}
        </h1>
        <p className="text-muted mt-1">{sessions.length} sessions</p>
      </header>

      <div className="space-y-3">
        {sessions.map((session) => (
          <button
            key={session.id}
            onClick={() => onSelect(session)}
            className="w-full text-left bg-card rounded-xl p-4 border border-border hover:border-primary transition-colors"
          >
            <p className="font-medium text-ink line-clamp-2">
              {session.summary || "Untitled session"}
            </p>
            <p className="text-sm text-muted mt-2">
              {session.message_count} messages &middot; {formatDate(session.last_modified)}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

function restoreSlashCommand(content: string): string {
  // Pattern: <command-message>...</command-message>\n<command-name>/xxx</command-name>\n<command-args>...</command-args>
  const pattern = /<command-message>[^<]*<\/command-message>\s*<command-name>(\/[^<]+)<\/command-name>\s*<command-args>([^<]*)<\/command-args>/g;
  return content.replace(pattern, (_match, cmd, args) => {
    const trimmedArgs = args.trim();
    return trimmedArgs ? `${cmd} ${trimmedArgs}` : cmd;
  });
}

function MessageView({
  projectId,
  sessionId,
  summary,
  onBack
}: {
  projectId: string;
  sessionId: string;
  summary: string | null;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [rawCommands, setRawCommands] = usePersistedState("lovcode:rawCommands", true);
  const [markdownPreview, setMarkdownPreview] = usePersistedState("lovcode:markdownPreview", false);

  useEffect(() => {
    invoke<Message[]>("get_session_messages", { projectId, sessionId })
      .then(setMessages)
      .finally(() => setLoading(false));
  }, [projectId, sessionId]);

  const processContent = (content: string) => {
    return rawCommands ? restoreSlashCommand(content) : content;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted">Loading messages...</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-8">
      <header className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={onBack}
            className="text-muted hover:text-ink flex items-center gap-1"
          >
            <span>&larr;</span> Back
          </button>
          <div className="flex items-center gap-4">
            <label
              className="flex items-center gap-2 text-sm text-muted cursor-pointer"
              title="Restore slash commands to original input format (e.g. /ttt args)"
            >
              <Switch checked={rawCommands} onCheckedChange={setRawCommands} />
              <span>Raw input</span>
            </label>
            <label
              className="flex items-center gap-2 text-sm text-muted cursor-pointer"
              title="Render message content as Markdown"
            >
              <Switch checked={markdownPreview} onCheckedChange={setMarkdownPreview} />
              <span>Preview</span>
            </label>
          </div>
        </div>
        <h1 className="font-serif text-xl font-semibold text-ink line-clamp-2">
          {summary || "Session"}
        </h1>
      </header>

      <div className="space-y-4">
        {messages.map((msg) => {
          const displayContent = processContent(msg.content);
          return (
            <div
              key={msg.uuid}
              className={`group relative rounded-xl p-4 ${
                msg.role === "user"
                  ? "bg-card-alt"
                  : "bg-card border border-border"
              }`}
            >
              <CopyButton text={displayContent} />
              <p className="text-xs text-muted mb-2 uppercase tracking-wide">
                {msg.role}
              </p>
              <CollapsibleContent content={displayContent} markdown={markdownPreview} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default App;
