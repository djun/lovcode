import { useState } from "react";
import { useAtom } from "jotai";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { ArchiveIcon } from "@radix-ui/react-icons";
import { workspaceDataAtom, collapsedProjectGroupsAtom } from "@/store";
import { invoke } from "@tauri-apps/api/core";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FeatureTabGroup } from "./FeatureTabGroup";
import { FeatureTab } from "./FeatureTab";
import type { Feature, WorkspaceData } from "@/views/Workspace/types";

export function GlobalFeatureTabs() {
  const [workspace, setWorkspace] = useAtom(workspaceDataAtom);
  const [collapsedGroups] = useAtom(collapsedProjectGroupsAtom);
  const [activeFeature, setActiveFeature] = useState<{ feature: Feature; projectId: string } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  if (!workspace) return null;

  const activeProjects = workspace.projects.filter(p => !p.archived);
  const archivedProjects = workspace.projects.filter(p => p.archived);

  const handleUnarchiveProject = async (id: string) => {
    const newProjects = workspace.projects.map((p) =>
      p.id === id ? { ...p, archived: false } : p
    );
    const newWorkspace: WorkspaceData = {
      ...workspace,
      projects: newProjects,
      active_project_id: id,
    };
    setWorkspace(newWorkspace);
    await invoke("workspace_save", { data: newWorkspace });
  };

  const handleDragStart = (event: DragStartEvent) => {
    const featureId = event.active.id as string;
    // Find which project this feature belongs to
    for (const project of workspace.projects) {
      const feature = project.features.find(f => f.id === featureId);
      if (feature) {
        setActiveFeature({ feature, projectId: project.id });
        break;
      }
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveFeature(null);

    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find which project the active feature belongs to
    let activeProjectId: string | null = null;
    for (const project of workspace.projects) {
      if (project.features.some(f => f.id === activeId)) {
        activeProjectId = project.id;
        break;
      }
    }

    if (!activeProjectId) return;

    // Find which project the over feature belongs to
    let overProjectId: string | null = null;
    for (const project of workspace.projects) {
      if (project.features.some(f => f.id === overId)) {
        overProjectId = project.id;
        break;
      }
    }

    // Only allow reordering within the same project
    if (activeProjectId !== overProjectId) return;

    // Reorder features within the project
    const newProjects = workspace.projects.map(p => {
      if (p.id !== activeProjectId) return p;

      const features = [...p.features];
      const activeIndex = features.findIndex(f => f.id === activeId);
      const overIndex = features.findIndex(f => f.id === overId);

      if (activeIndex === -1 || overIndex === -1) return p;

      // Move the feature
      const [movedFeature] = features.splice(activeIndex, 1);
      features.splice(overIndex, 0, movedFeature);

      return { ...p, features };
    });

    const newWorkspace: WorkspaceData = { ...workspace, projects: newProjects };
    setWorkspace(newWorkspace);
    await invoke("workspace_save", { data: newWorkspace });
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex items-center gap-1 overflow-x-auto max-w-[calc(100vw-500px)]">
        {activeProjects.map((project) => {
          const activeFeatures = project.features.filter(f => !f.archived);

          return (
            <FeatureTabGroup
              key={project.id}
              project={project}
              features={activeFeatures}
              isActiveProject={project.id === workspace.active_project_id}
              isCollapsed={collapsedGroups.includes(project.id)}
            />
          );
        })}

        {/* Archived Projects Dropdown */}
        {archivedProjects.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              onPointerDown={(e) => e.stopPropagation()}
              className="p-1.5 text-muted-foreground hover:text-ink hover:bg-card-alt rounded transition-colors flex-shrink-0"
            >
              <ArchiveIcon className="w-4 h-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[160px]">
              {archivedProjects.map((project) => (
                <DropdownMenuItem
                  key={project.id}
                  onClick={() => handleUnarchiveProject(project.id)}
                  className="cursor-pointer"
                >
                  <span className="truncate">{project.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <DragOverlay>
        {activeFeature && (
          <FeatureTab
            feature={activeFeature.feature}
            projectId={activeFeature.projectId}
            isActive={false}
            onSelect={() => {}}
            isDragging
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}
