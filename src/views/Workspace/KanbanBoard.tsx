import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CheckCircledIcon,
  UpdateIcon,
  ExclamationTriangleIcon,
  TimerIcon,
  DrawingPinFilledIcon,
} from "@radix-ui/react-icons";
import type { Feature, FeatureStatus } from "./types";

interface KanbanBoardProps {
  features: Feature[];
  onFeatureClick: (featureId: string) => void;
  onFeatureStatusChange: (featureId: string, status: FeatureStatus) => void;
}

const COLUMNS: { id: FeatureStatus; label: string }[] = [
  { id: "pending", label: "Pending" },
  { id: "running", label: "Running" },
  { id: "needs-review", label: "Needs Review" },
  { id: "completed", label: "Completed" },
];

function StatusIcon({ status }: { status: FeatureStatus }) {
  switch (status) {
    case "pending":
      return <TimerIcon className="w-4 h-4 text-muted-foreground" />;
    case "running":
      return <UpdateIcon className="w-4 h-4 text-blue-500" />;
    case "completed":
      return <CheckCircledIcon className="w-4 h-4 text-green-500" />;
    case "needs-review":
      return <ExclamationTriangleIcon className="w-4 h-4 text-amber-500" />;
  }
}

interface FeatureCardProps {
  feature: Feature;
  onClick: () => void;
  isDragging?: boolean;
}

function FeatureCard({ feature, onClick, isDragging }: FeatureCardProps) {
  return (
    <div
      onClick={onClick}
      className={`p-3 bg-card border border-border rounded-lg cursor-pointer transition-all ${
        isDragging ? "opacity-50 shadow-lg" : "hover:border-primary/50 hover:shadow-sm"
      }`}
    >
      <div className="flex items-center gap-2">
        {feature.pinned && (
          <DrawingPinFilledIcon className="w-3 h-3 text-primary/70 flex-shrink-0" />
        )}
        <StatusIcon status={feature.status} />
        {feature.seq > 0 && (
          <span className="text-xs text-muted-foreground">#{feature.seq}</span>
        )}
        <span className="text-sm font-medium text-ink truncate flex-1">
          {feature.name}
        </span>
      </div>
      {feature.git_branch && (
        <div className="mt-2 text-xs text-muted-foreground truncate">
          {feature.git_branch}
        </div>
      )}
    </div>
  );
}

function SortableFeatureCard({ feature, onClick }: { feature: Feature; onClick: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: feature.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <FeatureCard feature={feature} onClick={onClick} isDragging={isDragging} />
    </div>
  );
}

interface KanbanColumnProps {
  status: FeatureStatus;
  label: string;
  features: Feature[];
  onFeatureClick: (featureId: string) => void;
}

function KanbanColumn({ status, label, features, onFeatureClick }: KanbanColumnProps) {
  const columnColors: Record<FeatureStatus, string> = {
    pending: "border-muted-foreground/30",
    running: "border-blue-500/30",
    "needs-review": "border-amber-500/30",
    completed: "border-green-500/30",
  };

  return (
    <div className="flex-1 min-w-[200px] flex flex-col">
      <div className={`px-3 py-2 border-b-2 ${columnColors[status]}`}>
        <div className="flex items-center justify-between">
          <span className="font-medium text-sm text-ink">{label}</span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {features.length}
          </span>
        </div>
      </div>
      <div className="flex-1 p-2 space-y-2 overflow-y-auto bg-muted/30 min-h-[100px]">
        <SortableContext items={features.map((f) => f.id)} strategy={verticalListSortingStrategy}>
          {features.map((feature) => (
            <SortableFeatureCard
              key={feature.id}
              feature={feature}
              onClick={() => onFeatureClick(feature.id)}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

export function KanbanBoard({
  features,
  onFeatureClick,
  onFeatureStatusChange,
}: KanbanBoardProps) {
  const [activeFeature, setActiveFeature] = useState<Feature | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const featuresByStatus = COLUMNS.reduce(
    (acc, col) => {
      acc[col.id] = features.filter((f) => f.status === col.id && !f.archived);
      return acc;
    },
    {} as Record<FeatureStatus, Feature[]>
  );

  const handleDragStart = (event: DragStartEvent) => {
    const feature = features.find((f) => f.id === event.active.id);
    setActiveFeature(feature || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveFeature(null);

    if (!over) return;

    const activeFeatureId = active.id as string;
    const overId = over.id as string;

    // Check if dropped on a column
    const targetColumn = COLUMNS.find((col) => col.id === overId);
    if (targetColumn) {
      const feature = features.find((f) => f.id === activeFeatureId);
      if (feature && feature.status !== targetColumn.id) {
        onFeatureStatusChange(activeFeatureId, targetColumn.id);
      }
      return;
    }

    // Check if dropped on another feature - use that feature's status
    const targetFeature = features.find((f) => f.id === overId);
    if (targetFeature) {
      const sourceFeature = features.find((f) => f.id === activeFeatureId);
      if (sourceFeature && sourceFeature.status !== targetFeature.status) {
        onFeatureStatusChange(activeFeatureId, targetFeature.status);
      }
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 h-full p-4 overflow-x-auto">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            status={col.id}
            label={col.label}
            features={featuresByStatus[col.id]}
            onFeatureClick={onFeatureClick}
          />
        ))}
      </div>
      <DragOverlay>
        {activeFeature && (
          <FeatureCard feature={activeFeature} onClick={() => {}} isDragging />
        )}
      </DragOverlay>
    </DndContext>
  );
}
