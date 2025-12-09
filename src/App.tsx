import { useState, useEffect, useCallback, useRef } from "react";
import Markdown from "react-markdown";
import { Switch } from "./components/ui/switch";
import { ContextFileItem } from "./components/ContextFileItem";
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

type FeatureType = "chat" | "settings" | "commands" | "mcp" | "skills" | "hooks" | "sub-agents" | "output-styles" | "marketplace";

interface FeatureConfig {
  type: FeatureType;
  label: string;
  icon: string;
  description: string;
  available: boolean;
  group: "history" | "config" | "marketplace";
}

// Group 1: Projects (chat history)
// Group 2: Configuration
// Group 3: Marketplace
const FEATURES: FeatureConfig[] = [
  // Projects
  { type: "chat", label: "Projects", icon: "💬", description: "Browse conversation history", available: true, group: "history" },
  // Configuration
  { type: "settings", label: "Settings", icon: "⚙️", description: "Permissions, context & config", available: true, group: "config" },
  { type: "commands", label: "Commands", icon: "⚡", description: "Slash commands", available: true, group: "config" },
  { type: "mcp", label: "MCPs", icon: "🔌", description: "MCP servers", available: true, group: "config" },
  { type: "skills", label: "Skills", icon: "🎯", description: "Reusable skill templates", available: true, group: "config" },
  { type: "hooks", label: "Hooks", icon: "🪝", description: "Automation triggers", available: true, group: "config" },
  { type: "sub-agents", label: "Sub-agents", icon: "🤖", description: "AI agents with models", available: true, group: "config" },
  { type: "output-styles", label: "Output Styles", icon: "🎨", description: "Response formatting styles", available: true, group: "config" },
  // Marketplace
  { type: "marketplace", label: "Marketplace", icon: "🛒", description: "Browse and install templates", available: true, group: "marketplace" },
];

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

interface LocalCommand {
  name: string;
  path: string;
  description: string | null;
  allowed_tools: string | null;
  argument_hint: string | null;
  content: string;
}

interface LocalAgent {
  name: string;
  path: string;
  description: string | null;
  model: string | null;
  tools: string | null;
  content: string;
}

interface LocalSkill {
  name: string;
  path: string;
  description: string | null;
  content: string;
}

interface McpServer {
  name: string;
  description: string | null;
  command: string;
  args: string[];
  env: Record<string, string>;
}

interface ClaudeSettings {
  raw: unknown;
  permissions: unknown | null;
  hooks: unknown | null;
  mcp_servers: McpServer[];
}

interface ContextFile {
  name: string;
  path: string;
  scope: string;
  content: string;
  last_modified: number;
}

interface TemplateComponent {
  name: string;
  path: string;
  category: string;
  component_type: string;
  description: string | null;
  downloads: number | null;
  content: string | null;
}

interface TemplatesCatalog {
  settings: TemplateComponent[];
  commands: TemplateComponent[];
  mcps: TemplateComponent[];
  skills: TemplateComponent[];
  hooks: TemplateComponent[];
  agents: TemplateComponent[];
  "output-styles": TemplateComponent[];
}

type TemplateCategory = "settings" | "commands" | "mcps" | "skills" | "hooks" | "agents" | "output-styles";

// ============================================================================
// View State
// ============================================================================

type View =
  | { type: "home" }
  | { type: "chat-projects" }
  | { type: "chat-sessions"; projectId: string; projectPath: string }
  | { type: "chat-messages"; projectId: string; sessionId: string; summary: string | null }
  | { type: "settings" }
  | { type: "commands" }
  | { type: "command-detail"; command: LocalCommand }
  | { type: "mcp" }
  | { type: "skills" }
  | { type: "skill-detail"; skill: LocalSkill }
  | { type: "hooks" }
  | { type: "sub-agents" }
  | { type: "sub-agent-detail"; agent: LocalAgent }
  | { type: "output-styles" }
  | { type: "marketplace"; category?: TemplateCategory }
  | { type: "template-detail"; template: TemplateComponent; category: TemplateCategory }
  | { type: "feature-todo"; feature: FeatureType };

// ============================================================================
// App Component
// ============================================================================

function App() {
  const [view, setView] = useState<View>({ type: "home" });
  const [sidebarCollapsed, setSidebarCollapsed] = usePersistedState("lovcode:sidebarCollapsed", false);

  const currentFeature: FeatureType | null =
    view.type === "chat-projects" || view.type === "chat-sessions" || view.type === "chat-messages"
      ? "chat"
      : view.type === "settings"
        ? "settings"
        : view.type === "commands" || view.type === "command-detail"
          ? "commands"
          : view.type === "mcp"
            ? "mcp"
            : view.type === "skills" || view.type === "skill-detail"
              ? "skills"
              : view.type === "hooks"
                ? "hooks"
                : view.type === "sub-agents" || view.type === "sub-agent-detail"
                  ? "sub-agents"
                  : view.type === "output-styles"
                    ? "output-styles"
                    : view.type === "marketplace" || view.type === "template-detail"
                      ? "marketplace"
                      : view.type === "feature-todo"
                        ? view.feature
                        : null;

  const handleFeatureClick = (feature: FeatureType) => {
    switch (feature) {
      case "chat":
        setView({ type: "chat-projects" });
        break;
      case "settings":
        setView({ type: "settings" });
        break;
      case "commands":
        setView({ type: "commands" });
        break;
      case "mcp":
        setView({ type: "mcp" });
        break;
      case "skills":
        setView({ type: "skills" });
        break;
      case "hooks":
        setView({ type: "hooks" });
        break;
      case "sub-agents":
        setView({ type: "sub-agents" });
        break;
      case "output-styles":
        setView({ type: "output-styles" });
        break;
      case "marketplace":
        setView({ type: "marketplace" });
        break;
      default:
        setView({ type: "feature-todo", feature });
    }
  };

  return (
    <div className="flex h-screen bg-canvas">
      <Sidebar
        currentFeature={currentFeature}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onHomeClick={() => setView({ type: "home" })}
        onFeatureClick={handleFeatureClick}
      />

      <main className="flex-1 overflow-auto">
        {view.type === "home" && (
          <Home onFeatureClick={handleFeatureClick} />
        )}

        {view.type === "chat-projects" && (
          <ProjectList
            onSelect={(p) => setView({
              type: "chat-sessions",
              projectId: p.id,
              projectPath: p.path
            })}
          />
        )}

        {view.type === "chat-sessions" && (
          <SessionList
            projectId={view.projectId}
            projectPath={view.projectPath}
            onBack={() => setView({ type: "chat-projects" })}
            onSelect={(s) => setView({
              type: "chat-messages",
              projectId: s.project_id,
              sessionId: s.id,
              summary: s.summary
            })}
          />
        )}

        {view.type === "chat-messages" && (
          <MessageView
            projectId={view.projectId}
            sessionId={view.sessionId}
            summary={view.summary}
            onBack={() => setView({
              type: "chat-sessions",
              projectId: view.projectId,
              projectPath: ""
            })}
          />
        )}

        {view.type === "commands" && (
          <CommandsView
            onSelect={(cmd) => setView({ type: "command-detail", command: cmd })}
          />
        )}

        {view.type === "command-detail" && (
          <CommandDetailView
            command={view.command}
            onBack={() => setView({ type: "commands" })}
          />
        )}

        {view.type === "mcp" && (
          <McpView />
        )}

        {view.type === "skills" && (
          <SkillsView
            onSelect={(skill) => setView({ type: "skill-detail", skill })}
          />
        )}

        {view.type === "skill-detail" && (
          <SkillDetailView
            skill={view.skill}
            onBack={() => setView({ type: "skills" })}
          />
        )}

        {view.type === "hooks" && (
          <HooksView />
        )}

        {view.type === "sub-agents" && (
          <SubAgentsView
            onSelect={(agent) => setView({ type: "sub-agent-detail", agent })}
          />
        )}

        {view.type === "sub-agent-detail" && (
          <SubAgentDetailView
            agent={view.agent}
            onBack={() => setView({ type: "sub-agents" })}
          />
        )}

        {view.type === "output-styles" && (
          <OutputStylesView />
        )}

        {view.type === "settings" && (
          <SettingsView />
        )}

        {view.type === "marketplace" && (
          <MarketplaceView
            initialCategory={view.category}
            onSelectTemplate={(template, category) => setView({ type: "template-detail", template, category })}
          />
        )}

        {view.type === "template-detail" && (
          <TemplateDetailView
            template={view.template}
            category={view.category}
            onBack={() => setView({ type: "marketplace", category: view.category })}
          />
        )}

        {view.type === "feature-todo" && (
          <FeatureTodo feature={view.feature} />
        )}
      </main>
    </div>
  );
}

// ============================================================================
// Sidebar Component
// ============================================================================

function Sidebar({
  currentFeature,
  collapsed,
  onToggleCollapse,
  onHomeClick,
  onFeatureClick,
}: {
  currentFeature: FeatureType | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onHomeClick: () => void;
  onFeatureClick: (feature: FeatureType) => void;
}) {
  return (
    <aside className={`flex flex-col border-r border-border bg-card transition-all ${collapsed ? "w-14" : "w-52"}`}>
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

      <div className="flex-1 overflow-y-auto py-3">
        {/* History Group */}
        <div className="px-2 mb-2">
          {FEATURES.filter(f => f.group === "history").map((feature) => (
            <FeatureButton
              key={feature.type}
              feature={feature}
              active={currentFeature === feature.type}
              collapsed={collapsed}
              onClick={() => onFeatureClick(feature.type)}
            />
          ))}
        </div>

        {/* Config Group */}
        <div className="px-2 py-2 border-t border-border">
          {!collapsed && (
            <p className="text-xs text-muted uppercase tracking-wide px-3 py-2">Configuration</p>
          )}
          {FEATURES.filter(f => f.group === "config").map((feature) => (
            <FeatureButton
              key={feature.type}
              feature={feature}
              active={currentFeature === feature.type}
              collapsed={collapsed}
              onClick={() => onFeatureClick(feature.type)}
            />
          ))}
        </div>

        {/* Marketplace Group */}
        <div className="px-2 py-2 border-t border-border">
          {FEATURES.filter(f => f.group === "marketplace").map((feature) => (
            <FeatureButton
              key={feature.type}
              feature={feature}
              active={currentFeature === feature.type}
              collapsed={collapsed}
              onClick={() => onFeatureClick(feature.type)}
            />
          ))}
        </div>
      </div>

      {!collapsed && (
        <div className="p-3 border-t border-border">
          <p className="text-xs text-muted">Claude Code Viewer</p>
        </div>
      )}
    </aside>
  );
}

function FeatureButton({
  feature,
  active,
  collapsed,
  onClick,
}: {
  feature: FeatureConfig;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
        active
          ? "bg-primary/10 text-primary"
          : feature.available
            ? "text-ink hover:bg-card-alt"
            : "text-muted/60 hover:bg-card-alt"
      } ${collapsed ? "justify-center px-2" : ""}`}
      title={collapsed ? feature.label : undefined}
    >
      <span className="text-lg">{feature.icon}</span>
      {!collapsed && (
        <span className="text-sm">
          {feature.label}
          {!feature.available && <span className="ml-1.5 text-xs opacity-60">(TODO)</span>}
        </span>
      )}
    </button>
  );
}

// ============================================================================
// Home Component
// ============================================================================

function Home({ onFeatureClick }: { onFeatureClick: (feature: FeatureType) => void }) {
  const [stats, setStats] = useState<{ projects: number; sessions: number; commands: number } | null>(null);

  useEffect(() => {
    Promise.all([
      invoke<Project[]>("list_projects"),
      invoke<LocalCommand[]>("list_local_commands")
    ]).then(([projects, commands]) => {
      const sessions = projects.reduce((sum, p) => sum + p.session_count, 0);
      setStats({ projects: projects.length, sessions, commands: commands.length });
    });
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-full px-6 py-12">
      <h1 className="font-serif text-5xl font-bold text-ink mb-2">Lovcode</h1>
      <p className="text-muted mb-10">Claude Code Viewer</p>

      {stats && (
        <div className="flex gap-8 mb-10">
          <div className="text-center">
            <p className="text-3xl font-semibold text-ink">{stats.projects}</p>
            <p className="text-sm text-muted">Projects</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-semibold text-ink">{stats.sessions}</p>
            <p className="text-sm text-muted">Sessions</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-semibold text-ink">{stats.commands}</p>
            <p className="text-sm text-muted">Commands</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-lg">
        {FEATURES.map((feature) => (
          <button
            key={feature.type}
            onClick={() => onFeatureClick(feature.type)}
            className={`flex flex-col items-center p-5 rounded-xl border transition-colors ${
              feature.available
                ? "bg-card border-border hover:border-primary cursor-pointer"
                : "bg-card/50 border-border/50"
            }`}
          >
            <span className="text-3xl mb-2">{feature.icon}</span>
            <span className={`text-sm font-medium ${feature.available ? "text-ink" : "text-muted"}`}>
              {feature.label}
            </span>
            {!feature.available && (
              <span className="text-xs text-muted mt-1">Coming soon</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Sub-agents Feature
// ============================================================================

function SubAgentsView({ onSelect }: { onSelect: (agent: LocalAgent) => void }) {
  const [agents, setAgents] = useState<LocalAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    invoke<LocalAgent[]>("list_local_agents")
      .then(setAgents)
      .finally(() => setLoading(false));
  }, []);

  const filteredAgents = agents.filter(agent =>
    agent.name.toLowerCase().includes(search.toLowerCase()) ||
    agent.description?.toLowerCase().includes(search.toLowerCase()) ||
    agent.model?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted">Loading sub-agents...</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-8">
      <header className="mb-6">
        <h1 className="font-serif text-3xl font-semibold text-ink">Sub-agents</h1>
        <p className="text-muted mt-1">{agents.length} sub-agents in ~/.claude/commands</p>
      </header>

      {agents.length > 0 && (
        <input
          type="text"
          placeholder="Search sub-agents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md mb-6 px-4 py-2 bg-card border border-border rounded-lg text-ink placeholder:text-muted focus:outline-none focus:border-primary"
        />
      )}

      {agents.length === 0 ? (
        <div className="text-center py-12">
          <span className="text-4xl mb-4 block">🤖</span>
          <p className="text-muted">No sub-agents found</p>
          <p className="text-sm text-muted mt-1">Sub-agents are commands with a model field in frontmatter</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredAgents.map((agent) => (
            <button
              key={agent.name}
              onClick={() => onSelect(agent)}
              className="w-full text-left bg-card rounded-xl p-4 border border-border hover:border-primary transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-mono font-medium text-primary">{agent.name}</p>
                  {agent.description && (
                    <p className="text-sm text-muted mt-1 line-clamp-2">{agent.description}</p>
                  )}
                </div>
                {agent.model && (
                  <span className="text-xs bg-accent/20 text-accent px-2 py-1 rounded shrink-0">
                    {agent.model}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SubAgentDetailView({ agent, onBack }: { agent: LocalAgent; onBack: () => void }) {
  return (
    <div className="px-6 py-8">
      <header className="mb-6">
        <button
          onClick={onBack}
          className="text-muted hover:text-ink mb-2 flex items-center gap-1 text-sm"
        >
          <span>←</span> Sub-agents
        </button>
        <h1 className="font-mono text-2xl font-semibold text-primary">{agent.name}</h1>
        {agent.description && (
          <p className="text-muted mt-2">{agent.description}</p>
        )}
      </header>

      <div className="space-y-4">
        {agent.model && (
          <div className="bg-card rounded-xl p-4 border border-border">
            <p className="text-xs text-muted uppercase tracking-wide mb-1">Model</p>
            <p className="font-mono text-accent">{agent.model}</p>
          </div>
        )}

        {agent.tools && (
          <div className="bg-card rounded-xl p-4 border border-border">
            <p className="text-xs text-muted uppercase tracking-wide mb-1">Tools</p>
            <p className="font-mono text-sm text-ink">{agent.tools}</p>
          </div>
        )}

        <div className="bg-card rounded-xl p-4 border border-border">
          <p className="text-xs text-muted uppercase tracking-wide mb-2">Content</p>
          <div className="prose prose-sm max-w-none text-ink">
            <Markdown>{agent.content}</Markdown>
          </div>
        </div>

        <div className="bg-card-alt rounded-xl p-4">
          <p className="text-xs text-muted uppercase tracking-wide mb-1">Path</p>
          <p className="font-mono text-xs text-muted break-all">{agent.path}</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Output Styles Feature
// ============================================================================

function OutputStylesView() {
  return (
    <div className="px-6 py-8">
      <header className="mb-6">
        <h1 className="font-serif text-3xl font-semibold text-ink">Output Styles</h1>
        <p className="text-muted mt-1">Response formatting styles</p>
      </header>

      <div className="text-center py-12">
        <span className="text-4xl mb-4 block">🎨</span>
        <p className="text-muted">Coming soon</p>
        <p className="text-sm text-muted mt-1">Output styles will be available in a future update</p>
      </div>
    </div>
  );
}

// ============================================================================
// Commands Feature
// ============================================================================

function CommandsView({ onSelect }: { onSelect: (cmd: LocalCommand) => void }) {
  const [commands, setCommands] = useState<LocalCommand[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    invoke<LocalCommand[]>("list_local_commands")
      .then(setCommands)
      .finally(() => setLoading(false));
  }, []);

  const filteredCommands = commands.filter(cmd =>
    cmd.name.toLowerCase().includes(search.toLowerCase()) ||
    cmd.description?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted">Loading commands...</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-8">
      <header className="mb-6">
        <h1 className="font-serif text-3xl font-semibold text-ink">Commands</h1>
        <p className="text-muted mt-1">{commands.length} slash commands in ~/.claude/commands</p>
      </header>

      <input
        type="text"
        placeholder="Search commands..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-md mb-6 px-4 py-2 bg-card border border-border rounded-lg text-ink placeholder:text-muted focus:outline-none focus:border-primary"
      />

      <div className="space-y-2">
        {filteredCommands.map((cmd) => (
          <button
            key={cmd.name}
            onClick={() => onSelect(cmd)}
            className="w-full text-left bg-card rounded-xl p-4 border border-border hover:border-primary transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-mono font-medium text-primary">{cmd.name}</p>
                {cmd.description && (
                  <p className="text-sm text-muted mt-1 line-clamp-2">{cmd.description}</p>
                )}
              </div>
              {cmd.argument_hint && (
                <span className="text-xs bg-card-alt px-2 py-1 rounded text-muted shrink-0">
                  {cmd.argument_hint}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function CommandDetailView({ command, onBack }: { command: LocalCommand; onBack: () => void }) {
  return (
    <div className="px-6 py-8">
      <header className="mb-6">
        <button
          onClick={onBack}
          className="text-muted hover:text-ink mb-2 flex items-center gap-1 text-sm"
        >
          <span>←</span> Commands
        </button>
        <h1 className="font-mono text-2xl font-semibold text-primary">{command.name}</h1>
        {command.description && (
          <p className="text-muted mt-2">{command.description}</p>
        )}
      </header>

      <div className="space-y-4">
        {command.argument_hint && (
          <div className="bg-card rounded-xl p-4 border border-border">
            <p className="text-xs text-muted uppercase tracking-wide mb-1">Arguments</p>
            <p className="font-mono text-ink">{command.argument_hint}</p>
          </div>
        )}

        {command.allowed_tools && (
          <div className="bg-card rounded-xl p-4 border border-border">
            <p className="text-xs text-muted uppercase tracking-wide mb-1">Allowed Tools</p>
            <p className="font-mono text-sm text-ink">{command.allowed_tools}</p>
          </div>
        )}

        <div className="bg-card rounded-xl p-4 border border-border">
          <p className="text-xs text-muted uppercase tracking-wide mb-2">Content</p>
          <div className="prose prose-sm max-w-none text-ink">
            <Markdown>{command.content}</Markdown>
          </div>
        </div>

        <div className="bg-card-alt rounded-xl p-4">
          <p className="text-xs text-muted uppercase tracking-wide mb-1">Path</p>
          <p className="font-mono text-xs text-muted break-all">{command.path}</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MCP Feature
// ============================================================================

function McpView() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoke<ClaudeSettings>("get_settings")
      .then((settings) => setServers(settings.mcp_servers))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted">Loading MCP servers...</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-8">
      <header className="mb-6">
        <h1 className="font-serif text-3xl font-semibold text-ink">MCP Servers</h1>
        <p className="text-muted mt-1">{servers.length} configured servers</p>
      </header>

      {servers.length === 0 ? (
        <div className="text-center py-12">
          <span className="text-4xl mb-4 block">🔌</span>
          <p className="text-muted">No MCP servers configured</p>
          <p className="text-sm text-muted mt-2">
            Add servers to mcpServers in ~/.claude/settings.json
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {servers.map((server) => (
            <div
              key={server.name}
              className="bg-card rounded-xl p-4 border border-border"
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <p className="font-medium text-ink">{server.name}</p>
                  {server.description && (
                    <p className="text-sm text-muted mt-1">{server.description}</p>
                  )}
                </div>
              </div>

              <div className="bg-card-alt rounded-lg p-3 font-mono text-xs">
                <p className="text-muted">
                  <span className="text-ink">{server.command}</span>
                  {server.args.length > 0 && (
                    <span className="text-muted"> {server.args.join(" ")}</span>
                  )}
                </p>
              </div>

              {Object.keys(server.env).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {Object.keys(server.env).map((key) => (
                    <span key={key} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                      {key}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Skills Feature
// ============================================================================

function SkillsView({ onSelect }: { onSelect: (skill: LocalSkill) => void }) {
  const [skills, setSkills] = useState<LocalSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    invoke<LocalSkill[]>("list_local_skills")
      .then(setSkills)
      .finally(() => setLoading(false));
  }, []);

  const filteredSkills = skills.filter(skill =>
    skill.name.toLowerCase().includes(search.toLowerCase()) ||
    skill.description?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted">Loading skills...</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-8">
      <header className="mb-6">
        <h1 className="font-serif text-3xl font-semibold text-ink">Skills</h1>
        <p className="text-muted mt-1">{skills.length} skills in ~/.claude/skills</p>
      </header>

      {skills.length > 0 && (
        <input
          type="text"
          placeholder="Search skills..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md mb-6 px-4 py-2 bg-card border border-border rounded-lg text-ink placeholder:text-muted focus:outline-none focus:border-primary"
        />
      )}

      {skills.length === 0 ? (
        <div className="text-center py-12">
          <span className="text-4xl mb-4 block">🎯</span>
          <p className="text-muted">No skills found</p>
          <p className="text-sm text-muted mt-1">Skills are stored as SKILL.md in ~/.claude/skills/</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredSkills.map((skill) => (
            <button
              key={skill.name}
              onClick={() => onSelect(skill)}
              className="w-full text-left bg-card rounded-xl p-4 border border-border hover:border-primary transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-mono font-medium text-primary">{skill.name}</p>
                  {skill.description && (
                    <p className="text-sm text-muted mt-1 line-clamp-2">{skill.description}</p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SkillDetailView({ skill, onBack }: { skill: LocalSkill; onBack: () => void }) {
  return (
    <div className="px-6 py-8">
      <header className="mb-6">
        <button
          onClick={onBack}
          className="text-muted hover:text-ink mb-2 flex items-center gap-1 text-sm"
        >
          <span>←</span> Skills
        </button>
        <h1 className="font-mono text-2xl font-semibold text-primary">{skill.name}</h1>
        {skill.description && (
          <p className="text-muted mt-2">{skill.description}</p>
        )}
      </header>

      <div className="space-y-4">
        <div className="bg-card rounded-xl p-4 border border-border">
          <p className="text-xs text-muted uppercase tracking-wide mb-2">Content</p>
          <div className="prose prose-sm max-w-none text-ink">
            <Markdown>{skill.content}</Markdown>
          </div>
        </div>

        <div className="bg-card-alt rounded-xl p-4">
          <p className="text-xs text-muted uppercase tracking-wide mb-1">Path</p>
          <p className="font-mono text-xs text-muted break-all">{skill.path}</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Hooks Feature
// ============================================================================

function HooksView() {
  const [settings, setSettings] = useState<ClaudeSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoke<ClaudeSettings>("get_settings")
      .then(setSettings)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted">Loading hooks...</p>
      </div>
    );
  }

  const hooks = settings?.hooks as Record<string, unknown[]> | null;
  const hookEntries = hooks ? Object.entries(hooks) : [];

  return (
    <div className="px-6 py-8">
      <header className="mb-6">
        <h1 className="font-serif text-3xl font-semibold text-ink">Hooks</h1>
        <p className="text-muted mt-1">Automation triggers in ~/.claude/settings.json</p>
      </header>

      {hookEntries.length === 0 ? (
        <div className="text-center py-12">
          <span className="text-4xl mb-4 block">🪝</span>
          <p className="text-muted">No hooks configured</p>
          <p className="text-sm text-muted mt-2">
            Add hooks to ~/.claude/settings.json
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {hookEntries.map(([eventType, handlers]) => (
            <div key={eventType} className="bg-card rounded-xl p-4 border border-border">
              <p className="text-sm font-medium text-primary mb-3">{eventType}</p>
              <div className="space-y-2">
                {Array.isArray(handlers) && handlers.map((handler, i) => (
                  <pre
                    key={i}
                    className="bg-card-alt rounded-lg p-3 text-xs font-mono text-ink overflow-x-auto"
                  >
                    {JSON.stringify(handler, null, 2)}
                  </pre>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Settings Feature
// ============================================================================

function SettingsView() {
  const [settings, setSettings] = useState<ClaudeSettings | null>(null);
  const [contextFiles, setContextFiles] = useState<ContextFile[]>([]);
  const [settingsPath, setSettingsPath] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    Promise.all([
      invoke<ClaudeSettings>("get_settings"),
      invoke<ContextFile[]>("get_context_files"),
      invoke<string>("get_settings_path"),
    ])
      .then(([s, c, p]) => {
        setSettings(s);
        setContextFiles(c.filter(f => f.scope === "global"));
        setSettingsPath(p);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleCopy = () => {
    if (settings?.raw) {
      navigator.clipboard.writeText(JSON.stringify(settings.raw, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted">Loading settings...</p>
      </div>
    );
  }

  const hasContent = settings?.raw || contextFiles.length > 0;

  if (!hasContent) {
    return (
      <div className="px-6 py-8">
        <header className="mb-6">
          <h1 className="font-serif text-3xl font-semibold text-ink">Settings</h1>
          <p className="text-muted mt-1">User configuration (~/.claude)</p>
        </header>
        <div className="text-center py-12">
          <span className="text-4xl mb-4 block">⚙️</span>
          <p className="text-muted">No configuration found</p>
          <p className="text-sm text-muted mt-2">
            Create ~/.claude/settings.json or CLAUDE.md
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-8">
      <header className="mb-6">
        <h1 className="font-serif text-3xl font-semibold text-ink">Settings</h1>
        <p className="text-muted mt-1">User configuration (~/.claude)</p>
      </header>

      <div className="space-y-4">
        {/* Context Section */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-2 border-b border-border">
            <span className="text-sm font-medium text-ink">📄 Context ({contextFiles.length})</span>
          </div>
          <div className="p-3 space-y-1">
            {contextFiles.length > 0 ? (
              contextFiles.map((file) => (
                <ContextFileItem key={file.path} file={file} />
              ))
            ) : (
              <p className="text-sm text-muted text-center py-4">No context files</p>
            )}
          </div>
        </div>

        {/* Configuration Section */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-2 border-b border-border flex items-center justify-between">
            <span className="text-sm font-medium text-ink">⚙️ Configuration</span>
            {settings?.raw && (
              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  className="text-xs text-muted hover:text-primary px-2 py-1 rounded hover:bg-card-alt"
                  title="Copy to clipboard"
                >
                  {copied ? "✓ Copied" : "📋 Copy"}
                </button>
                <button
                  onClick={() => invoke("open_in_editor", { path: settingsPath })}
                  className="text-xs text-muted hover:text-primary px-2 py-1 rounded hover:bg-card-alt"
                  title="Open in editor"
                >
                  ✏️ Edit
                </button>
              </div>
            )}
          </div>
          <div className="p-3">
            {settings?.raw ? (
              <>
                <span className="font-mono text-xs text-muted block mb-2">{settingsPath}</span>
                <pre className="bg-card-alt rounded-lg p-3 text-xs font-mono text-ink overflow-x-auto max-h-96">
                  {JSON.stringify(settings.raw, null, 2)}
                </pre>
              </>
            ) : (
              <p className="text-sm text-muted text-center py-4">No settings.json found</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Marketplace Feature
// ============================================================================

// Same order as sidebar Configuration group
const TEMPLATE_CATEGORIES: { key: TemplateCategory; label: string; icon: string }[] = [
  { key: "settings", label: "Settings", icon: "⚙️" },
  { key: "commands", label: "Commands", icon: "⚡" },
  { key: "mcps", label: "MCPs", icon: "🔌" },
  { key: "skills", label: "Skills", icon: "🎯" },
  { key: "hooks", label: "Hooks", icon: "🪝" },
  { key: "agents", label: "Sub-agents", icon: "🤖" },
  { key: "output-styles", label: "Output Styles", icon: "🎨" },
];

function MarketplaceView({
  initialCategory,
  onSelectTemplate,
}: {
  initialCategory?: TemplateCategory;
  onSelectTemplate: (template: TemplateComponent, category: TemplateCategory) => void;
}) {
  const [catalog, setCatalog] = useState<TemplatesCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<TemplateCategory>(initialCategory || "commands");
  const [search, setSearch] = useState("");

  useEffect(() => {
    invoke<TemplatesCatalog>("get_templates_catalog")
      .then(setCatalog)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted">Loading templates catalog...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6">
        <span className="text-4xl mb-4">❌</span>
        <p className="text-ink font-medium mb-2">Failed to load templates</p>
        <p className="text-sm text-muted text-center max-w-md">{error}</p>
      </div>
    );
  }

  if (!catalog) return null;

  const components = catalog[activeCategory] || [];
  const filtered = components.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.description?.toLowerCase().includes(search.toLowerCase()) ||
    c.category.toLowerCase().includes(search.toLowerCase())
  );

  // Sort by downloads (popular first)
  const sorted = [...filtered].sort((a, b) => (b.downloads || 0) - (a.downloads || 0));

  return (
    <div className="px-6 py-8">
      <header className="mb-6">
        <h1 className="font-serif text-3xl font-semibold text-ink">Marketplace</h1>
        <p className="text-muted mt-1">Browse and install Claude Code templates</p>
      </header>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {TEMPLATE_CATEGORIES.map((cat) => {
          const count = catalog[cat.key]?.length || 0;
          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
                activeCategory === cat.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-card-alt text-muted hover:text-ink"
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
              <span className="opacity-60">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder={`Search ${TEMPLATE_CATEGORIES.find(c => c.key === activeCategory)?.label.toLowerCase()}...`}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-md mb-6 px-4 py-2 bg-card border border-border rounded-lg text-ink placeholder:text-muted focus:outline-none focus:border-primary"
      />

      {/* Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((template) => (
          <button
            key={template.path}
            onClick={() => onSelectTemplate(template, activeCategory)}
            className="text-left bg-card rounded-xl p-4 border border-border hover:border-primary transition-colors"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="font-medium text-ink truncate">{template.name}</p>
              {template.downloads != null && (
                <span className="text-xs text-muted shrink-0">
                  ↓{template.downloads}
                </span>
              )}
            </div>
            {template.description && (
              <p className="text-sm text-muted line-clamp-2">{template.description}</p>
            )}
            <p className="text-xs text-muted/60 mt-2">{template.category}</p>
          </button>
        ))}
      </div>

      {sorted.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted">No templates found</p>
        </div>
      )}
    </div>
  );
}

function TemplateDetailView({
  template,
  category,
  onBack,
}: {
  template: TemplateComponent;
  category: TemplateCategory;
  onBack: () => void;
}) {
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInstall = async () => {
    if (!template.content) {
      setError("No content available for this template");
      return;
    }

    setInstalling(true);
    setError(null);

    try {
      switch (category) {
        case "commands":
        case "agents":
        case "skills":
          await invoke("install_command_template", { name: template.name, content: template.content });
          break;
        case "mcps":
          await invoke("install_mcp_template", { name: template.name, config: template.content });
          break;
        case "hooks":
          await invoke("install_hook_template", { name: template.name, config: template.content });
          break;
        case "settings":
        case "output-styles":
          await invoke("install_setting_template", { config: template.content });
          break;
      }
      setInstalled(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setInstalling(false);
    }
  };

  const categoryInfo = TEMPLATE_CATEGORIES.find(c => c.key === category);

  return (
    <div className="px-6 py-8">
      <header className="mb-6">
        <button
          onClick={onBack}
          className="text-muted hover:text-ink mb-2 flex items-center gap-1 text-sm"
        >
          <span>←</span> {categoryInfo?.label}
        </button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-ink">{template.name}</h1>
            {template.description && (
              <p className="text-muted mt-2">{template.description}</p>
            )}
            <div className="flex items-center gap-3 mt-3 text-sm text-muted">
              <span>{categoryInfo?.icon} {categoryInfo?.label}</span>
              <span>•</span>
              <span>{template.category}</span>
              {template.downloads != null && (
                <>
                  <span>•</span>
                  <span>↓ {template.downloads} downloads</span>
                </>
              )}
            </div>
          </div>

          <button
            onClick={handleInstall}
            disabled={installing || installed}
            className={`px-4 py-2 rounded-lg font-medium transition-colors shrink-0 ${
              installed
                ? "bg-green-500/20 text-green-600"
                : installing
                  ? "bg-card-alt text-muted"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}
          >
            {installed ? "✓ Installed" : installing ? "Installing..." : "Install"}
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-500/10 text-red-600 rounded-lg text-sm">
            {error}
          </div>
        )}
      </header>

      <div className="space-y-4">
        {template.content && (
          <div className="bg-card rounded-xl p-4 border border-border">
            <p className="text-xs text-muted uppercase tracking-wide mb-3">Content Preview</p>
            <div className="prose prose-sm max-w-none text-ink">
              {category === "mcps" || category === "hooks" || category === "settings" ? (
                <pre className="bg-card-alt rounded-lg p-3 text-xs font-mono overflow-x-auto">
                  {template.content}
                </pre>
              ) : (
                <Markdown>{template.content}</Markdown>
              )}
            </div>
          </div>
        )}

        <div className="bg-card-alt rounded-xl p-4">
          <p className="text-xs text-muted uppercase tracking-wide mb-1">Path</p>
          <p className="font-mono text-xs text-muted break-all">{template.path}</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Feature TODO Placeholder
// ============================================================================

function FeatureTodo({ feature }: { feature: FeatureType }) {
  const feat = FEATURES.find(f => f.type === feature);

  return (
    <div className="flex flex-col items-center justify-center min-h-full px-6">
      <span className="text-6xl mb-4">{feat?.icon || "🚧"}</span>
      <h1 className="font-serif text-2xl font-semibold text-ink mb-2">
        {feat?.label}
      </h1>
      <p className="text-muted text-center max-w-md mb-6">
        {feat?.description}
      </p>
      <div className="px-4 py-2 rounded-lg bg-card-alt text-muted text-sm">
        Coming soon
      </div>
    </div>
  );
}

// ============================================================================
// Chat Feature Components
// ============================================================================

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
      <div className="flex items-center justify-center h-full">
        <p className="text-muted">Loading projects...</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-8">
      <header className="mb-6">
        <h1 className="font-serif text-3xl font-semibold text-ink">Projects</h1>
        <p className="text-muted mt-1">{projects.length} projects with Claude Code history</p>
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
  const [globalContext, setGlobalContext] = useState<ContextFile[]>([]);
  const [projectContext, setProjectContext] = useState<ContextFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [contextTab, setContextTab] = useState<"global" | "project">("project");

  useEffect(() => {
    Promise.all([
      invoke<Session[]>("list_sessions", { projectId }),
      invoke<ContextFile[]>("get_context_files"),
      projectPath ? invoke<ContextFile[]>("get_project_context", { projectPath }) : Promise.resolve([]),
    ])
      .then(([s, global, project]) => {
        setSessions(s);
        setGlobalContext(global.filter(f => f.scope === "global"));
        setProjectContext(project);
      })
      .finally(() => setLoading(false));
  }, [projectId, projectPath]);

  const formatDate = (ts: number) => {
    return new Date(ts * 1000).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted">Loading project...</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-8">
      <header className="mb-6">
        <button
          onClick={onBack}
          className="text-muted hover:text-ink mb-2 flex items-center gap-1 text-sm"
        >
          <span>←</span> Projects
        </button>
        <h1 className="font-serif text-2xl font-semibold text-ink truncate">
          {projectPath || projectId}
        </h1>
      </header>

      {/* Context Card with Tabs */}
      {(globalContext.length > 0 || projectContext.length > 0) && (
        <div className="mb-4 bg-card rounded-xl border border-border overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-border">
            <button
              onClick={() => setContextTab("project")}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                contextTab === "project"
                  ? "text-primary border-b-2 border-primary -mb-px"
                  : "text-muted hover:text-ink"
              }`}
            >
              📁 Project ({projectContext.length})
            </button>
            <button
              onClick={() => setContextTab("global")}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                contextTab === "global"
                  ? "text-primary border-b-2 border-primary -mb-px"
                  : "text-muted hover:text-ink"
              }`}
            >
              🌐 Global ({globalContext.length})
            </button>
          </div>

          {/* Content */}
          <div className="p-3 space-y-1">
            {(contextTab === "global" ? globalContext : projectContext).map((file) => (
              <ContextFileItem key={file.path} file={file} showIcon />
            ))}
            {(contextTab === "global" ? globalContext : projectContext).length === 0 && (
              <p className="text-sm text-muted text-center py-4">No context files</p>
            )}
          </div>
        </div>
      )}

      {/* Sessions */}
      <div className="mb-4">
        <p className="text-xs text-muted uppercase tracking-wide">
          💬 Sessions ({sessions.length})
        </p>
      </div>

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
            <span>←</span> Sessions
          </button>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
              <Switch checked={rawCommands} onCheckedChange={setRawCommands} />
              <span>Raw input</span>
            </label>
            <label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
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
