import { PersonIcon } from "@radix-ui/react-icons";
import { Store } from "lucide-react";
import type { LocalAgent } from "../../types";
import {
  LoadingState,
  EmptyState,
  SearchInput,
  PageHeader,
  ItemCard,
  ConfigPage,
  MarketplaceSection,
  useSearch,
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

interface SubAgentsViewProps {
  onSelect: (agent: LocalAgent) => void;
  marketplaceItems: MarketplaceItem[];
  onMarketplaceSelect: (item: MarketplaceItem) => void;
  onBrowseMore?: () => void;
}

export function SubAgentsView({
  onSelect,
  marketplaceItems,
  onMarketplaceSelect,
  onBrowseMore,
}: SubAgentsViewProps) {
  const { data: agents = [], isLoading } = useInvokeQuery<LocalAgent[]>(["agents"], "list_local_agents");
  const { search, setSearch, filtered } = useSearch(agents, ["name", "description", "model"]);

  if (isLoading) return <LoadingState message="Loading sub-agents..." />;

  return (
    <ConfigPage>
      <PageHeader
        title="Sub Agents"
        subtitle={`${agents.length} sub-agents in ~/.claude/commands`}
        action={<BrowseMarketplaceButton onClick={onBrowseMore} />}
      />
      <SearchInput
        placeholder="Search local & marketplace..."
        value={search}
        onChange={setSearch}
      />

      {filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((agent) => (
            <ItemCard
              key={agent.name}
              name={agent.name}
              description={agent.description}
              badge={agent.model}
              onClick={() => onSelect(agent)}
            />
          ))}
        </div>
      )}

      {filtered.length === 0 && !search && (
        <EmptyState
          icon={PersonIcon}
          message="No sub-agents found"
          hint="Sub-agents are commands with a model field in frontmatter"
        />
      )}

      {filtered.length === 0 && search && (
        <p className="text-muted-foreground text-sm">No local sub-agents match "{search}"</p>
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
