import { useState, useEffect, useCallback, useRef } from "react";
import Markdown from "react-markdown";
import { Switch } from "./components/ui/switch";
import { invoke } from "@tauri-apps/api/core";

// ============================================================================
// Hooks
// ============================================================================

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

// ============================================================================
// Types & Config
// ============================================================================

type AgentId = "claude-code" | "codex" | "gemini" | "aider" | "cursor";
type FeatureType = "chat" | "prompts" | "commands" | "mcp" | "skills" | "context";

interface AgentConfig {
  id: AgentId;
  name: string;
  provider: string;
  icon: string;
}

interface FeatureConfig {
  type: FeatureType;
  label: string;
  icon: string;
  description: string;
}

// Feature × Agent 可用性矩阵
// true = 已实现, false = TODO, null = 该 Agent 不支持此 Feature
type AvailabilityMatrix = Record<FeatureType, Record<AgentId, boolean | null>>;

const AGENTS: AgentConfig[] = [
  { id: "claude-code", name: "Claude Code", provider: "Anthropic", icon: "🤖" },
  { id: "codex", name: "Codex CLI", provider: "OpenAI", icon: "🧠" },
  { id: "gemini", name: "Gemini CLI", provider: "Google", icon: "✨" },
  { id: "aider", name: "Aider", provider: "Open Source", icon: "🛠️" },
  { id: "cursor", name: "Cursor", provider: "Cursor", icon: "📍" },
];

const FEATURES: FeatureConfig[] = [
  { type: "chat", label: "Chat History", icon: "💬", description: "Browse conversation history" },
  { type: "prompts", label: "Prompts", icon: "📝", description: "System prompts and templates" },
  { type: "commands", label: "Commands", icon: "⚡", description: "Slash commands" },
  { type: "mcp", label: "MCP Servers", icon: "🔌", description: "Model Context Protocol servers" },
  { type: "skills", label: "Skills", icon: "🎯", description: "Reusable skill packages" },
  { type: "context", label: "Context Files", icon: "📄", description: "CLAUDE.md, .cursorrules, etc." },
];

const AVAILABILITY: AvailabilityMatrix = {
  chat: {
    "claude-code": true,
    "codex": false,
    "gemini": false,
    "aider": false,
    "cursor": false,
  },
  prompts: {
    "claude-code": false,
    "codex": false,
    "gemini": false,
    "aider": false,
    "cursor": false,
  },
  commands: {
    "claude-code": false,
    "codex": null,  // Codex 不支持 commands
    "gemini": null,
    "aider": null,
    "cursor": null,
  },
  mcp: {
    "claude-code": false,
    "codex": null,
    "gemini": false,
    "aider": null,
    "cursor": null,
  },
  skills: {
    "claude-code": false,
    "codex": null,
    "gemini": null,
    "aider": null,
    "cursor": null,
  },
  context: {
    "claude-code": false,
    "codex": false,
    "gemini": false,
    "aider": false,
    "cursor": false,
  },
};

// ============================================================================
// Data Types
// ============================================================================

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

// ============================================================================
// View State
// ============================================================================

type View =
  | { type: "home" }
  | { type: "chat-projects"; agentId: AgentId }
  | { type: "chat-sessions"; agentId: AgentId; projectId: string; projectPath: string }
  | { type: "chat-messages"; agentId: AgentId; projectId: string; sessionId: string; summary: string | null }
  | { type: "feature-todo"; agentId: AgentId; feature: FeatureType };

// ============================================================================
// App Component
// ============================================================================

function App() {
  const [view, setView] = useState<View>({ type: "home" });
  const [sidebarCollapsed, setSidebarCollapsed] = usePersistedState("lovcode:sidebarCollapsed", false);
  const [expandedFeature, setExpandedFeature] = usePersistedState<FeatureType | null>("lovcode:expandedFeature", null);

  // 从 view 推导当前选中状态
  const currentAgentId = view.type !== "home" ? view.agentId : null;
  const currentFeature: FeatureType | null =
    view.type === "chat-projects" || view.type === "chat-sessions" || view.type === "chat-messages"
      ? "chat"
      : view.type === "feature-todo"
        ? view.feature
        : null;

  const handleFeatureClick = (feature: FeatureType) => {
    setExpandedFeature(expandedFeature === feature ? null : feature);
  };

  const handleAgentFeatureClick = (agentId: AgentId, feature: FeatureType) => {
    const availability = AVAILABILITY[feature][agentId];
    if (availability === null) return; // 不支持

    if (feature === "chat" && availability === true) {
      setView({ type: "chat-projects", agentId });
    } else {
      setView({ type: "feature-todo", agentId, feature });
    }
  };

  return (
    <div className="flex h-screen bg-canvas">
      <Sidebar
        currentAgentId={currentAgentId}
        currentFeature={currentFeature}
        expandedFeature={expandedFeature}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onHomeClick={() => setView({ type: "home" })}
        onFeatureClick={handleFeatureClick}
        onAgentFeatureClick={handleAgentFeatureClick}
      />

      <main className="flex-1 overflow-auto">
        {view.type === "home" && (
          <Home onNavigate={(agentId, feature) => handleAgentFeatureClick(agentId, feature)} />
        )}

        {view.type === "chat-projects" && (
          <ProjectList
            agentId={view.agentId}
            onSelect={(p) => setView({
              type: "chat-sessions",
              agentId: view.agentId,
              projectId: p.id,
              projectPath: p.path
            })}
          />
        )}

        {view.type === "chat-sessions" && (
          <SessionList
            agentId={view.agentId}
            projectId={view.projectId}
            projectPath={view.projectPath}
            onBack={() => setView({ type: "chat-projects", agentId: view.agentId })}
            onSelect={(s) => setView({
              type: "chat-messages",
              agentId: view.agentId,
              projectId: s.project_id,
              sessionId: s.id,
              summary: s.summary
            })}
          />
        )}

        {view.type === "chat-messages" && (
          <MessageView
            agentId={view.agentId}
            projectId={view.projectId}
            sessionId={view.sessionId}
            summary={view.summary}
            onBack={() => setView({
              type: "chat-sessions",
              agentId: view.agentId,
              projectId: view.projectId,
              projectPath: ""
            })}
          />
        )}

        {view.type === "feature-todo" && (
          <FeatureTodo agentId={view.agentId} feature={view.feature} />
        )}
      </main>
    </div>
  );
}

// ============================================================================
// Sidebar Component
// ============================================================================

function Sidebar({
  currentAgentId,
  currentFeature,
  expandedFeature,
  collapsed,
  onToggleCollapse,
  onHomeClick,
  onFeatureClick,
  onAgentFeatureClick,
}: {
  currentAgentId: AgentId | null;
  currentFeature: FeatureType | null;
  expandedFeature: FeatureType | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onHomeClick: () => void;
  onFeatureClick: (feature: FeatureType) => void;
  onAgentFeatureClick: (agentId: AgentId, feature: FeatureType) => void;
}) {
  return (
    <aside className={`flex flex-col border-r border-border bg-card transition-all ${collapsed ? "w-14" : "w-60"}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        {!collapsed && (
          <button onClick={onHomeClick} className="font-serif text-lg font-semibold text-ink hover:text-primary">
            Lovcode
          </button>
        )}
        <button
          onClick={onToggleCollapse}
          className={`p-1.5 rounded-md text-muted hover:text-ink hover:bg-card-alt ${collapsed ? "mx-auto" : ""}`}
          title={collapsed ? "Expand" : "Collapse"}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {collapsed ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            )}
          </svg>
        </button>
      </div>

      {/* Features */}
      <div className="flex-1 overflow-y-auto py-3">
        {!collapsed && (
          <p className="px-3 mb-2 text-xs font-medium text-muted uppercase tracking-wider">Features</p>
        )}

        <div className="space-y-0.5">
          {FEATURES.map((feature) => {
            const isExpanded = expandedFeature === feature.type;
            const agents = AGENTS.filter(a => AVAILABILITY[feature.type][a.id] !== null);
            const implementedCount = agents.filter(a => AVAILABILITY[feature.type][a.id] === true).length;

            return (
              <div key={feature.type}>
                {/* Feature Header */}
                <button
                  onClick={() => onFeatureClick(feature.type)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                    currentFeature === feature.type
                      ? "bg-primary/10 text-primary"
                      : "text-ink hover:bg-card-alt"
                  } ${collapsed ? "justify-center" : ""}`}
                  title={collapsed ? feature.label : undefined}
                >
                  <span className="text-base">{feature.icon}</span>
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-sm">{feature.label}</span>
                      <span className="text-xs text-muted">
                        {implementedCount}/{agents.length}
                      </span>
                      <svg
                        className={`w-3 h-3 text-muted transition-transform ${isExpanded ? "rotate-90" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
                </button>

                {/* Agent List (expanded) */}
                {!collapsed && isExpanded && (
                  <div className="ml-6 border-l border-border">
                    {agents.map((agent) => {
                      const availability = AVAILABILITY[feature.type][agent.id];
                      const isImplemented = availability === true;
                      const isSelected = currentAgentId === agent.id && currentFeature === feature.type;

                      return (
                        <button
                          key={agent.id}
                          onClick={() => onAgentFeatureClick(agent.id, feature.type)}
                          className={`w-full flex items-center gap-2 pl-3 pr-3 py-1.5 text-left text-sm transition-colors ${
                            isSelected
                              ? "bg-primary/10 text-primary"
                              : isImplemented
                                ? "text-ink hover:bg-card-alt"
                                : "text-muted/60 hover:bg-card-alt"
                          }`}
                        >
                          <span className="text-sm">{agent.icon}</span>
                          <span className="flex-1 truncate">{agent.name}</span>
                          {isImplemented ? (
                            <span className="text-xs text-green-500">✓</span>
                          ) : (
                            <span className="text-xs text-muted">TODO</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      {!collapsed && (
        <div className="p-3 border-t border-border">
          <p className="text-xs text-muted">v0.1.0</p>
        </div>
      )}
    </aside>
  );
}

// ============================================================================
// Home Component
// ============================================================================

function Home({ onNavigate }: { onNavigate: (agentId: AgentId, feature: FeatureType) => void }) {
  const [stats, setStats] = useState<{ projects: number; sessions: number } | null>(null);

  useEffect(() => {
    invoke<Project[]>("list_projects").then((projects) => {
      const sessions = projects.reduce((sum, p) => sum + p.session_count, 0);
      setStats({ projects: projects.length, sessions });
    });
  }, []);

  // 计算实现进度
  const totalCells = FEATURES.reduce((sum, f) => {
    return sum + AGENTS.filter(a => AVAILABILITY[f.type][a.id] !== null).length;
  }, 0);
  const implementedCells = FEATURES.reduce((sum, f) => {
    return sum + AGENTS.filter(a => AVAILABILITY[f.type][a.id] === true).length;
  }, 0);

  return (
    <div className="px-8 py-10 max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="font-serif text-4xl font-bold text-ink mb-2">Lovcode</h1>
        <p className="text-muted">AI Coding Assistant Ecosystem Viewer</p>
      </div>

      {/* Stats */}
      <div className="flex justify-center gap-8 mb-10">
        {stats && (
          <>
            <div className="text-center">
              <p className="text-3xl font-semibold text-ink">{stats.projects}</p>
              <p className="text-sm text-muted">Projects</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-semibold text-ink">{stats.sessions}</p>
              <p className="text-sm text-muted">Sessions</p>
            </div>
          </>
        )}
        <div className="text-center">
          <p className="text-3xl font-semibold text-ink">{implementedCells}/{totalCells}</p>
          <p className="text-sm text-muted">Implemented</p>
        </div>
      </div>

      {/* Feature × Agent Matrix */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-card-alt">
                <th className="text-left px-4 py-3 font-medium text-muted">Feature</th>
                {AGENTS.map((agent) => (
                  <th key={agent.id} className="px-3 py-3 text-center font-medium text-muted">
                    <span className="block text-lg mb-1">{agent.icon}</span>
                    <span className="text-xs">{agent.name.split(" ")[0]}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((feature) => (
                <tr key={feature.type} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <span className="mr-2">{feature.icon}</span>
                    <span className="text-ink">{feature.label}</span>
                  </td>
                  {AGENTS.map((agent) => {
                    const availability = AVAILABILITY[feature.type][agent.id];
                    return (
                      <td key={agent.id} className="px-3 py-3 text-center">
                        {availability === null ? (
                          <span className="text-muted/30">—</span>
                        ) : availability ? (
                          <button
                            onClick={() => onNavigate(agent.id, feature.type)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-green-500/10 text-green-500 hover:bg-green-500/20 transition-colors"
                            title={`View ${agent.name} ${feature.label}`}
                          >
                            ✓
                          </button>
                        ) : (
                          <button
                            onClick={() => onNavigate(agent.id, feature.type)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-card-alt text-muted hover:text-ink transition-colors"
                            title={`${agent.name} ${feature.label} - TODO`}
                          >
                            ○
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-6 mt-4 text-sm text-muted">
        <span><span className="text-green-500">✓</span> Implemented</span>
        <span>○ TODO</span>
        <span><span className="opacity-30">—</span> Not supported</span>
      </div>
    </div>
  );
}

// ============================================================================
// Feature TODO Placeholder
// ============================================================================

function FeatureTodo({ agentId, feature }: { agentId: AgentId; feature: FeatureType }) {
  const agent = AGENTS.find(a => a.id === agentId);
  const feat = FEATURES.find(f => f.type === feature);

  return (
    <div className="flex flex-col items-center justify-center min-h-full px-6">
      <span className="text-6xl mb-4">{feat?.icon || "🚧"}</span>
      <h1 className="font-serif text-2xl font-semibold text-ink mb-2">
        {agent?.name} / {feat?.label}
      </h1>
      <p className="text-muted text-center max-w-md mb-6">
        {feat?.description}
      </p>
      <div className="px-4 py-2 rounded-lg bg-card-alt text-muted text-sm">
        TODO: Implement {feature} parser for {agentId}
      </div>
    </div>
  );
}

// ============================================================================
// Chat Feature Components
// ============================================================================

type SortKey = "recent" | "sessions" | "name";

function ProjectList({
  agentId,
  onSelect
}: {
  agentId: AgentId;
  onSelect: (p: Project) => void;
}) {
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

  const agent = AGENTS.find(a => a.id === agentId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted">Loading projects...</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-8">
      <header className="mb-6">
        <p className="text-sm text-muted mb-1">💬 Chat History / {agent?.name}</p>
        <h1 className="font-serif text-3xl font-semibold text-ink">Projects</h1>
        <p className="text-muted mt-1">{projects.length} projects</p>
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
              {project.session_count} session{project.session_count !== 1 ? "s" : ""} · {formatRelativeTime(project.last_active)}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

function SessionList({
  agentId,
  projectId,
  projectPath,
  onBack,
  onSelect
}: {
  agentId: AgentId;
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

  const agent = AGENTS.find(a => a.id === agentId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted">Loading sessions...</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-8">
      <header className="mb-8">
        <button
          onClick={onBack}
          className="text-muted hover:text-ink mb-2 flex items-center gap-1 text-sm"
        >
          <span>←</span> 💬 Chat / {agent?.name} / Projects
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
              {session.message_count} messages · {formatDate(session.last_modified)}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

function restoreSlashCommand(content: string): string {
  const pattern = /<command-message>[^<]*<\/command-message>\s*<command-name>(\/[^<]+)<\/command-name>\s*<command-args>([^<]*)<\/command-args>/g;
  return content.replace(pattern, (_match, cmd, args) => {
    const trimmedArgs = args.trim();
    return trimmedArgs ? `${cmd} ${trimmedArgs}` : cmd;
  });
}

function MessageView({
  agentId,
  projectId,
  sessionId,
  summary,
  onBack
}: {
  agentId: AgentId;
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

  const agent = AGENTS.find(a => a.id === agentId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
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
            className="text-muted hover:text-ink flex items-center gap-1 text-sm"
          >
            <span>←</span> 💬 Chat / {agent?.name} / Sessions
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

// ============================================================================
// Shared Components
// ============================================================================

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

export default App;
