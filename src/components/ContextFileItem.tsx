import { invoke } from "@tauri-apps/api/core";
import Markdown from "react-markdown";
import { Collapsible, CollapsibleTrigger, CollapsibleContent, useCollapsible } from "./ui/collapsible";

interface ContextFile {
  name: string;
  path: string;
  scope: string;
  content: string;
}

function ChevronIcon() {
  const { open } = useCollapsible();
  return <span className="text-xs text-muted">{open ? "▼" : "▶"}</span>;
}

interface ContextFileItemProps {
  file: ContextFile;
  showIcon?: boolean;
  variant?: "card" | "card-alt";
}

export function ContextFileItem({ file, showIcon = false, variant = "card-alt" }: ContextFileItemProps) {
  const bgClass = variant === "card" ? "bg-card border border-border" : "bg-card-alt";
  const hoverClass = variant === "card" ? "hover:bg-card-alt/50" : "hover:bg-card-alt/80";

  return (
    <Collapsible className={`${bgClass} rounded-lg overflow-hidden`}>
      <CollapsibleTrigger className={`flex items-center gap-2 px-3 py-1.5 w-full ${hoverClass}`}>
        <ChevronIcon />
        <span className="text-sm text-ink shrink-0">
          {showIcon && (file.scope === "command" ? "⚡ " : "📄 ")}
          {file.name}
        </span>
        <span className="flex-1 font-mono text-xs text-muted truncate text-left">{file.path}</span>
        <button
          onClick={(e) => { e.stopPropagation(); invoke("open_in_editor", { path: file.path }); }}
          className="text-xs text-muted hover:text-primary shrink-0"
          title="Open in editor"
        >
          ✏️
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-2 prose prose-sm max-w-none text-ink border-t border-border/50 pt-2">
        <Markdown>{file.content}</Markdown>
      </CollapsibleContent>
    </Collapsible>
  );
}
