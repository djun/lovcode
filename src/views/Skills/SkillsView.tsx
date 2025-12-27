import { TargetIcon } from "@radix-ui/react-icons";
import { Store } from "lucide-react";
import type { LocalSkill } from "../../types";
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

interface SkillsViewProps {
  onSelect: (skill: LocalSkill) => void;
  marketplaceItems: MarketplaceItem[];
  onMarketplaceSelect: (item: MarketplaceItem) => void;
  onBrowseMore?: () => void;
}

export function SkillsView({
  onSelect,
  marketplaceItems,
  onMarketplaceSelect,
  onBrowseMore,
}: SkillsViewProps) {
  const { data: skills = [], isLoading } = useInvokeQuery<LocalSkill[]>(["skills"], "list_local_skills");
  const { search, setSearch, filtered } = useSearch(skills, ["name", "description"]);

  if (isLoading) return <LoadingState message="Loading skills..." />;

  return (
    <ConfigPage>
      <PageHeader
        title="Skills"
        subtitle={`${skills.length} skills in ~/.claude/skills`}
        action={<BrowseMarketplaceButton onClick={onBrowseMore} />}
      />
      <SearchInput
        placeholder="Search local & marketplace..."
        value={search}
        onChange={setSearch}
      />

      {filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((skill) => (
            <ItemCard
              key={skill.name}
              name={skill.name}
              description={skill.description}
              onClick={() => onSelect(skill)}
            />
          ))}
        </div>
      )}

      {filtered.length === 0 && !search && (
        <EmptyState
          icon={TargetIcon}
          message="No skills found"
          hint="Skills are stored as SKILL.md in ~/.claude/skills/"
        />
      )}

      {filtered.length === 0 && search && (
        <p className="text-muted-foreground text-sm">No local skills match "{search}"</p>
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
