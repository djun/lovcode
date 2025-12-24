import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CubeIcon, StarFilledIcon, HeartFilledIcon } from "@radix-ui/react-icons";
import type { TemplatesCatalog, TemplateComponent, TemplateCategory } from "../../types";
import { SOURCE_FILTERS, TEMPLATE_CATEGORIES, type SourceFilterId } from "../../constants";
import { LoadingState, EmptyState, SearchInput, PageHeader, ConfigPage } from "../../components/config";

interface MarketplaceViewProps {
  initialCategory?: TemplateCategory;
  onSelectTemplate: (template: TemplateComponent, category: TemplateCategory) => void;
}

export function MarketplaceView({ initialCategory, onSelectTemplate }: MarketplaceViewProps) {
  const [catalog, setCatalog] = useState<TemplatesCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const activeCategory = initialCategory || "commands";
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilterId>("all");

  useEffect(() => {
    invoke<TemplatesCatalog>("get_templates_catalog")
      .then(setCatalog)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading templates catalog..." />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6">
        <span className="text-4xl mb-4">❌</span>
        <p className="text-ink font-medium mb-2">Failed to load templates</p>
        <p className="text-sm text-muted-foreground text-center max-w-md">{error}</p>
      </div>
    );
  }

  if (!catalog) return null;

  const components = catalog[activeCategory] || [];

  // Apply source filter
  const sourceFiltered =
    sourceFilter === "all"
      ? components
      : components.filter((c) => c.source_id === sourceFilter);

  // Apply search filter
  const filtered = sourceFiltered.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.description?.toLowerCase().includes(search.toLowerCase()) ||
      c.category.toLowerCase().includes(search.toLowerCase())
  );

  // Sort: official sources first, then by downloads
  const sorted = [...filtered].sort((a, b) => {
    // Priority: anthropic > lovstudio > community
    const priorityMap: Record<string, number> = { anthropic: 1, lovstudio: 2, community: 3 };
    const aPriority = priorityMap[a.source_id || "community"] || 3;
    const bPriority = priorityMap[b.source_id || "community"] || 3;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return (b.downloads || 0) - (a.downloads || 0);
  });

  const categoryInfo = TEMPLATE_CATEGORIES.find((c) => c.key === activeCategory);

  // Count components per source for this category
  const sourceCounts = SOURCE_FILTERS.map((sf) => ({
    ...sf,
    count:
      sf.id === "all"
        ? components.length
        : components.filter((c) => c.source_id === sf.id).length,
  }));

  return (
    <ConfigPage>
      <PageHeader
        title={categoryInfo?.label || "Marketplace"}
        subtitle={`Browse and install ${categoryInfo?.label.toLowerCase()} templates`}
      />

      {/* Source filter tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {sourceCounts.map((sf) => (
          <button
            key={sf.id}
            onClick={() => setSourceFilter(sf.id as SourceFilterId)}
            title={sf.tooltip}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-1.5 ${
              sourceFilter === sf.id
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-ink hover:border-primary/50"
            }`}
          >
            <span>{sf.label}</span>
            {sf.count > 0 && (
              <span
                className={`text-xs px-1.5 py-0.5 rounded ${
                  sourceFilter === sf.id ? "bg-primary-foreground/20" : "bg-card-alt"
                }`}
              >
                {sf.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <SearchInput
        placeholder={`Search ${categoryInfo?.label.toLowerCase()}...`}
        value={search}
        onChange={setSearch}
      />

      {/* Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((template) => (
          <button
            key={`${template.source_id}-${template.path}`}
            onClick={() => onSelectTemplate(template, activeCategory)}
            className="text-left bg-card rounded-xl p-4 border border-border hover:border-primary transition-colors"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <p className="font-medium text-ink truncate">{template.name}</p>
                {/* Source badge */}
                {template.source_id && template.source_id !== "community" && (
                  <span className="text-xs px-1.5 py-0.5 rounded shrink-0 flex items-center gap-1 bg-primary/10 text-primary">
                    {template.source_id === "anthropic" ? (
                      <StarFilledIcon className="w-3 h-3" />
                    ) : (
                      <HeartFilledIcon className="w-3 h-3" />
                    )}
                  </span>
                )}
              </div>
              {template.downloads != null && (
                <span className="text-xs text-muted-foreground shrink-0">
                  ↓{template.downloads}
                </span>
              )}
            </div>
            {template.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">{template.description}</p>
            )}
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-muted-foreground/60">{template.category}</p>
              {template.plugin_name && template.plugin_name !== template.category && (
                <p className="text-xs text-muted-foreground/60">from {template.plugin_name}</p>
              )}
            </div>
          </button>
        ))}
      </div>

      {sorted.length === 0 && <EmptyState icon={CubeIcon} message="No templates found" />}
    </ConfigPage>
  );
}
