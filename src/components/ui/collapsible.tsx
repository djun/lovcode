import { createContext, useContext, useState, type ReactNode } from "react";

interface CollapsibleContextValue {
  open: boolean;
  toggle: () => void;
}

const CollapsibleContext = createContext<CollapsibleContextValue | null>(null);

interface CollapsibleProps {
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export function Collapsible({ children, defaultOpen = false, className = "" }: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <CollapsibleContext.Provider value={{ open, toggle: () => setOpen(!open) }}>
      <div className={className} data-state={open ? "open" : "closed"}>
        {children}
      </div>
    </CollapsibleContext.Provider>
  );
}

interface CollapsibleTriggerProps {
  children: ReactNode;
  className?: string;
}

export function CollapsibleTrigger({ children, className = "" }: CollapsibleTriggerProps) {
  const ctx = useContext(CollapsibleContext);
  if (!ctx) throw new Error("CollapsibleTrigger must be inside Collapsible");
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={ctx.toggle}
      onKeyDown={(e) => e.key === "Enter" && ctx.toggle()}
      className={`cursor-pointer ${className}`}
      data-state={ctx.open ? "open" : "closed"}
    >
      {children}
    </div>
  );
}

interface CollapsibleContentProps {
  children: ReactNode;
  className?: string;
}

export function CollapsibleContent({ children, className = "" }: CollapsibleContentProps) {
  const ctx = useContext(CollapsibleContext);
  if (!ctx) throw new Error("CollapsibleContent must be inside Collapsible");
  if (!ctx.open) return null;
  return <div className={className}>{children}</div>;
}

export function useCollapsible() {
  const ctx = useContext(CollapsibleContext);
  if (!ctx) throw new Error("useCollapsible must be inside Collapsible");
  return ctx;
}
