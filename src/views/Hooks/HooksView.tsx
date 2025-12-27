import { useState } from "react";
import { Link2Icon } from "@radix-ui/react-icons";
import { Store } from "lucide-react";
import type { ClaudeSettings } from "../../types";
import {
  LoadingState,
  EmptyState,
  SearchInput,
  PageHeader,
  ConfigPage,
  MarketplaceSection,
  type MarketplaceItem,
} from "../../components/config";
import { useInvokeQuery } from "../../hooks";

function BrowseMarketplaceButton({ onClick }: { onClick?: () => void }) {
  if (!onClick) return null;
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-ink hover:bg-card-alt rounded-lg transition-colors"
      title="Browse marketplace"
    >
      <Store className="w-4 h-4" />
      <span>Marketplace</span>
    </button>
  );
}

interface HooksViewProps {
  marketplaceItems: MarketplaceItem[];
  onMarketplaceSelect: (item: MarketplaceItem) => void;
  onBrowseMore?: () => void;
}

export function HooksView({
  marketplaceItems,
  onMarketplaceSelect,
  onBrowseMore,
}: HooksViewProps) {
  const { data: settings, isLoading } = useInvokeQuery<ClaudeSettings>(["settings"], "get_settings");
  const [search, setSearch] = useState("");

  if (isLoading) return <LoadingState message="Loading hooks..." />;

  const hooks = settings?.hooks as Record<string, unknown[]> | null;
  const hookEntries = hooks ? Object.entries(hooks) : [];
  const filtered = hookEntries.filter(([eventType]) =>
    eventType.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <ConfigPage>
      <PageHeader
        title="Hooks"
        subtitle="Automation triggers in ~/.claude/settings.json"
        action={<BrowseMarketplaceButton onClick={onBrowseMore} />}
      />
      <SearchInput
        placeholder="Search local & marketplace..."
        value={search}
        onChange={setSearch}
      />

      {filtered.length > 0 && (
        <div className="space-y-4">
          {filtered.map(([eventType, handlers]) => (
            <div key={eventType} className="bg-card rounded-xl p-4 border border-border">
              <p className="text-sm font-medium text-primary mb-3">{eventType}</p>
              <div className="space-y-2">
                {Array.isArray(handlers) &&
                  handlers.map((handler, i) => (
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

      {filtered.length === 0 && !search && (
        <EmptyState
          icon={Link2Icon}
          message="No hooks configured"
          hint="Add hooks to ~/.claude/settings.json"
        />
      )}

      {filtered.length === 0 && search && (
        <p className="text-muted-foreground text-sm">No local hooks match "{search}"</p>
      )}

      <MarketplaceSection
        items={marketplaceItems}
        search={search}
        onSelect={onMarketplaceSelect}
        onBrowseMore={onBrowseMore}
      />
    </ConfigPage>
  );
}
