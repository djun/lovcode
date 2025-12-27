import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { LightningBoltIcon } from "@radix-ui/react-icons";
import type { DistillDocument } from "../../types";
import {
  LoadingState,
  EmptyState,
  SearchInput,
  PageHeader,
  ItemCard,
  ConfigPage,
  useSearch,
} from "../../components/config";
import { DistillMenu } from "./DistillMenu";
import { useInvokeQuery, useQueryClient } from "../../hooks";

interface DistillViewProps {
  onSelect: (doc: DistillDocument) => void;
  watchEnabled: boolean;
  onWatchToggle: (enabled: boolean) => void;
}

export function DistillView({ onSelect, watchEnabled, onWatchToggle }: DistillViewProps) {
  const queryClient = useQueryClient();
  const { data: documents = [], isLoading } = useInvokeQuery<DistillDocument[]>(["distillDocuments"], "list_distill_documents");
  const { search, setSearch, filtered } = useSearch(documents, ["title", "tags"]);

  const refreshDocuments = () => {
    queryClient.invalidateQueries({ queryKey: ["distillDocuments"] });
  };

  useEffect(() => {
    // Listen for distill directory changes
    const unlisten = listen("distill-changed", () => {
      refreshDocuments();
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  if (isLoading) return <LoadingState message="Loading distill documents..." />;

  return (
    <ConfigPage>
      <PageHeader
        title="Distill (CC)"
        subtitle={`${documents.length} summaries`}
        action={
          <DistillMenu
            watchEnabled={watchEnabled}
            onWatchToggle={onWatchToggle}
            onRefresh={refreshDocuments}
          />
        }
      />

      <SearchInput placeholder="Search by title or tags..." value={search} onChange={setSearch} />

      {filtered.length > 0 ? (
        <div className="space-y-2">
          {filtered.map((doc) => (
            <ItemCard
              key={doc.file}
              name={doc.title}
              description={doc.tags.map((t) => `#${t}`).join(" ")}
              timestamp={doc.date}
              onClick={() => onSelect(doc)}
            />
          ))}
        </div>
      ) : !search ? (
        <EmptyState
          icon={LightningBoltIcon}
          message="No distill documents yet"
          hint="Use /distill in Claude Code to capture wisdom"
        />
      ) : (
        <p className="text-muted-foreground text-sm">No documents match "{search}"</p>
      )}
    </ConfigPage>
  );
}
