import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  PlayIcon,
  CheckCircledIcon,
  CrossCircledIcon,
  ExclamationTriangleIcon,
  ChevronDownIcon,
  LockClosedIcon,
  CodeIcon,
  FileTextIcon,
  Cross1Icon,
  EyeNoneIcon,
  MixIcon,
  ColorWheelIcon,
  LayersIcon,
} from "@radix-ui/react-icons";
import { Collapsible, CollapsibleContent } from "../../components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { FilePath } from "../../components/shared/FilePath";
import type { TechStack, EnvCheckResult, FileLineCount } from "./types";

interface ProjectDiagnosticsProps {
  projectPath: string;
  embedded?: boolean;
}

type DiagnosticStatus = "idle" | "loading" | "success" | "warning" | "error";

interface DiagnosticItemProps {
  title: string;
  icon: React.ReactNode;
  status: DiagnosticStatus;
  summary?: string;
  isExpanded: boolean;
  onToggle: () => void;
  onRun?: () => void;
  children?: React.ReactNode;
}

// 章节组件（可折叠）
function DiagnosticSection({
  title,
  isExpanded,
  onToggle,
  children,
}: {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-1.5 bg-muted/20 border-b border-border hover:bg-muted/40 transition-colors"
      >
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{title}</span>
        <ChevronDownIcon
          className={`w-3 h-3 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
        />
      </button>
      <CollapsibleContent>
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

function DiagnosticItem({
  title,
  icon,
  status,
  summary,
  isExpanded,
  onToggle,
  onRun,
  children,
}: DiagnosticItemProps) {
  const handleClick = () => {
    if (status === "idle" && onRun) {
      onRun();
    } else if (children) {
      onToggle();
    }
  };

  const statusIcons = {
    idle: <PlayIcon className="w-3 h-3 text-muted-foreground" />,
    loading: <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />,
    success: <CheckCircledIcon className="w-3.5 h-3.5 text-green-500" />,
    warning: <ExclamationTriangleIcon className="w-3.5 h-3.5 text-amber-500" />,
    error: <CrossCircledIcon className="w-3.5 h-3.5 text-red-500" />,
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className="border-b border-border last:border-b-0">
        <button
          onClick={handleClick}
          className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-muted/30 transition-colors cursor-pointer text-left"
        >
          <div className="text-muted-foreground">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-ink">{title}</span>
            {summary && (
              <span className="text-xs text-muted-foreground ml-2">{summary}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {statusIcons[status]}
            {children && status !== "idle" && (
              <ChevronDownIcon
                className={`w-4 h-4 text-muted-foreground transition-transform ${
                  isExpanded ? "rotate-180" : ""
                }`}
              />
            )}
          </div>
        </button>
        {children && (
          <CollapsibleContent>
            <div className="px-4 pb-3 pt-1 ml-7">
              {children}
            </div>
          </CollapsibleContent>
        )}
      </div>
    </Collapsible>
  );
}

// 获取项目的忽略路径存储 key
const getIgnoredPathsKey = (projectPath: string) => `lovcode:ignoredPaths:${projectPath}`;

export function ProjectDiagnostics({ projectPath, embedded = false }: ProjectDiagnosticsProps) {
  // 每个诊断项独立的 loading 状态
  const [loadingTech, setLoadingTech] = useState(false);
  const [loadingEnv, setLoadingEnv] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingHardcode, setLoadingHardcode] = useState(false);
  const [loadingBrand, setLoadingBrand] = useState(false);
  const [loadingDesign, setLoadingDesign] = useState(false);

  const [techStack, setTechStack] = useState<TechStack | null>(null);
  const [envResult, setEnvResult] = useState<EnvCheckResult | null>(null);
  const [fileLines, setFileLines] = useState<FileLineCount[] | null>(null);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["code-quality"]));
  const [showAllKeys, setShowAllKeys] = useState(false);
  const [showAllSecrets, setShowAllSecrets] = useState(false);
  const [showAllFiles, setShowAllFiles] = useState(false);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  // 忽略的文件路径（项目级别存储）
  const [ignoredPaths, setIgnoredPaths] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(getIgnoredPathsKey(projectPath));
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const addIgnoredPath = (path: string) => {
    const newPaths = [...ignoredPaths, path];
    setIgnoredPaths(newPaths);
    localStorage.setItem(getIgnoredPathsKey(projectPath), JSON.stringify(newPaths));
  };

  const removeIgnoredPath = (path: string) => {
    const newPaths = ignoredPaths.filter(p => p !== path);
    setIgnoredPaths(newPaths);
    localStorage.setItem(getIgnoredPathsKey(projectPath), JSON.stringify(newPaths));
  };

  // 独立运行函数
  const runTechStack = async () => {
    setLoadingTech(true);
    try {
      const stack = await invoke<TechStack>("diagnostics_detect_stack", { projectPath });
      setTechStack(stack);
    } catch (error) {
      console.error("Tech stack detection failed:", error);
    } finally {
      setLoadingTech(false);
    }
  };

  const runEnvCheck = async () => {
    setLoadingEnv(true);
    try {
      const env = await invoke<EnvCheckResult>("diagnostics_check_env", { projectPath });
      setEnvResult(env);
    } catch (error) {
      console.error("Env check failed:", error);
    } finally {
      setLoadingEnv(false);
    }
  };

  const runFileLines = async () => {
    setLoadingFiles(true);
    try {
      const files = await invoke<FileLineCount[]>("diagnostics_scan_file_lines", {
        projectPath,
        limit: 20,
        ignoredPaths,
      });
      setFileLines(files);
    } catch (error) {
      console.error("File lines scan failed:", error);
    } finally {
      setLoadingFiles(false);
    }
  };

  const runHardcodeCheck = async () => {
    setLoadingHardcode(true);
    // TODO: 实现硬编码检测
    await new Promise(resolve => setTimeout(resolve, 500));
    setLoadingHardcode(false);
  };

  const runBrandAnalysis = async () => {
    setLoadingBrand(true);
    // TODO: 实现品牌系统分析
    await new Promise(resolve => setTimeout(resolve, 500));
    setLoadingBrand(false);
  };

  const runDesignAnalysis = async () => {
    setLoadingDesign(true);
    // TODO: 实现设计系统分析
    await new Promise(resolve => setTimeout(resolve, 500));
    setLoadingDesign(false);
  };

  const runAll = () => {
    runTechStack();
    runEnvCheck();
    runFileLines();
    runHardcodeCheck();
    runBrandAnalysis();
    runDesignAnalysis();
  };

  const isLoading = loadingTech || loadingEnv || loadingFiles || loadingHardcode || loadingBrand || loadingDesign;

  // 当 ignoredPaths 变化时重新扫描文件行数
  useEffect(() => {
    if (fileLines) {
      runFileLines();
    }
  }, [ignoredPaths]);

  const getTechStackStatus = (): DiagnosticStatus => {
    if (loadingTech) return "loading";
    if (!techStack) return "idle";
    return "success";
  };

  const getEnvStatus = (): DiagnosticStatus => {
    if (loadingEnv) return "loading";
    if (!envResult) return "idle";
    if (envResult.leaked_secrets.length > 0) return "error";
    if (envResult.missing_keys.length > 0) return "warning";
    return "success";
  };

  const getFileLinesStatus = (): DiagnosticStatus => {
    if (loadingFiles) return "loading";
    if (!fileLines) return "idle";
    const longFiles = fileLines.filter(f => f.lines > 500);
    if (longFiles.length > 0) return "warning";
    return "success";
  };

  const getTechStackSummary = () => {
    if (!techStack) return undefined;
    const parts = [techStack.runtime];
    if (techStack.package_manager) parts.push(techStack.package_manager);
    if (techStack.frameworks.length > 0) parts.push(techStack.frameworks[0]);
    return parts.join(" • ");
  };

  const getEnvSummary = () => {
    if (!envResult) return undefined;
    const issues = [];
    if (envResult.leaked_secrets.length > 0) issues.push(`${envResult.leaked_secrets.length} leaked`);
    if (envResult.missing_keys.length > 0) issues.push(`${envResult.missing_keys.length} missing`);
    return issues.length > 0 ? issues.join(", ") : "All good";
  };

  const getFileLinesSummary = () => {
    if (!fileLines) return undefined;
    if (fileLines.length === 0) return "No files";
    const longest = fileLines[0];
    return `${longest.file.split('/').pop()} (${longest.lines})`;
  };

  const toggleExpand = (id: string) => {
    setExpandedItem(expandedItem === id ? null : id);
  };

  return (
    <div className={embedded ? "" : "flex-shrink-0 border-b border-border"}>
      {!embedded && (
        <div className="flex items-center justify-between px-6 py-2 bg-muted/30">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Diagnostics
          </h3>
          <button
            onClick={runAll}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-2 py-0.5 text-xs text-muted-foreground hover:text-ink hover:bg-muted rounded transition-colors disabled:opacity-50"
          >
            <PlayIcon className="w-3 h-3" />
            Run All
          </button>
        </div>
      )}

      <div className={embedded ? "" : "bg-card"}>
        {/* Code Quality Section */}
        <DiagnosticSection
          title="Code Quality"
          isExpanded={expandedSections.has("code-quality")}
          onToggle={() => toggleSection("code-quality")}
        >
          <DiagnosticItem
            title="Tech Stack"
            icon={<CodeIcon className="w-4 h-4" />}
            status={getTechStackStatus()}
            summary={getTechStackSummary()}
            isExpanded={expandedItem === "tech"}
            onToggle={() => toggleExpand("tech")}
            onRun={runTechStack}
          >
            {techStack && (
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Runtime</span>
                  <span className="text-ink">{techStack.runtime}</span>
                </div>
                {techStack.package_manager && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Package Manager</span>
                    <span className="text-ink">{techStack.package_manager}</span>
                  </div>
                )}
                {techStack.orm && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ORM</span>
                    <span className="text-ink">{techStack.orm}</span>
                  </div>
                )}
                {techStack.frameworks.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Frameworks</span>
                    <span className="text-ink">{techStack.frameworks.join(", ")}</span>
                  </div>
                )}
              </div>
            )}
          </DiagnosticItem>

          <DiagnosticItem
            title="Environment"
            icon={<LockClosedIcon className="w-4 h-4" />}
            status={getEnvStatus()}
            summary={getEnvSummary()}
            isExpanded={expandedItem === "env"}
            onToggle={() => toggleExpand("env")}
            onRun={runEnvCheck}
          >
          {envResult && (
            <div className="space-y-2 text-xs">
              <div className="flex gap-3">
                <span className={envResult.env_example_exists ? "text-green-600" : "text-muted-foreground"}>
                  {envResult.env_example_exists ? "✓" : "○"} .env.example
                </span>
                <span className={envResult.env_exists ? "text-green-600" : "text-amber-600"}>
                  {envResult.env_exists ? "✓" : "○"} .env
                </span>
              </div>

              {envResult.missing_keys.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-amber-600 font-medium">
                      Missing Keys ({envResult.missing_keys.length})
                    </span>
                    <button
                      onClick={async () => {
                        if (!confirm(`Add ${envResult.missing_keys.length} missing keys to .env?`)) return;
                        try {
                          const count = await invoke<number>("diagnostics_add_missing_keys", {
                            projectPath,
                            keys: envResult.missing_keys,
                          });
                          alert(`Added ${count} keys to .env`);
                          runEnvCheck();
                        } catch (error) {
                          alert(`Failed: ${error}`);
                        }
                      }}
                      className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-800 hover:bg-amber-200 rounded"
                    >
                      Add to .env
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(showAllKeys ? envResult.missing_keys : envResult.missing_keys.slice(0, 5)).map((key) => (
                      <span key={key} className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded text-[10px]">
                        {key}
                      </span>
                    ))}
                    {envResult.missing_keys.length > 5 && (
                      <button
                        onClick={() => setShowAllKeys(!showAllKeys)}
                        className="text-muted-foreground hover:text-ink text-[10px]"
                      >
                        {showAllKeys ? "less" : `+${envResult.missing_keys.length - 5}`}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {envResult.leaked_secrets.length > 0 && (
                <div>
                  <div className="text-red-600 font-medium mb-1">
                    Leaked Secrets ({envResult.leaked_secrets.length})
                  </div>
                  <div className="space-y-1">
                    {(showAllSecrets ? envResult.leaked_secrets : envResult.leaked_secrets.slice(0, 3)).map((leak, i) => (
                      <div key={i} className="flex items-center gap-2 text-[10px]">
                        <div className="flex items-center gap-1">
                          <FilePath
                            path={`${projectPath}/${leak.file}`}
                            basePath={projectPath}
                            className="text-[10px] text-red-600"
                            showIcon
                          />
                          <button
                            onClick={() => invoke("open_file_at_line", { path: `${projectPath}/${leak.file}`, line: leak.line })}
                            className="text-red-600 font-mono hover:underline"
                          >
                            :{leak.line}
                          </button>
                        </div>
                        <span className="text-muted-foreground">{leak.key_name}</span>
                      </div>
                    ))}
                    {envResult.leaked_secrets.length > 3 && (
                      <button
                        onClick={() => setShowAllSecrets(!showAllSecrets)}
                        className="text-muted-foreground hover:text-ink text-[10px]"
                      >
                        {showAllSecrets ? "less" : `+${envResult.leaked_secrets.length - 3}`}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {envResult.missing_keys.length === 0 && envResult.leaked_secrets.length === 0 && (
                <div className="text-green-600">✓ No issues</div>
              )}
            </div>
          )}
        </DiagnosticItem>

        <DiagnosticItem
          title="File Lines"
          icon={<FileTextIcon className="w-4 h-4" />}
          status={getFileLinesStatus()}
          summary={getFileLinesSummary()}
          isExpanded={expandedItem === "files"}
          onToggle={() => toggleExpand("files")}
          onRun={runFileLines}
        >
          {fileLines && fileLines.length > 0 && (
            <div className="space-y-1 text-xs">
              {(showAllFiles ? fileLines : fileLines.slice(0, 5)).map((f, i) => (
                <div key={i} className="flex items-center justify-between gap-2 group">
                  <FilePath
                    path={`${projectPath}/${f.file}`}
                    basePath={projectPath}
                    className="text-[10px] flex-1 min-w-0"
                    showIcon
                  />
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className={`font-medium ${f.lines > 500 ? "text-amber-600" : "text-ink"}`}>
                      {f.lines}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-muted rounded transition-opacity">
                          <EyeNoneIcon className="w-3 h-3 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[160px]">
                        <DropdownMenuItem onClick={() => addIgnoredPath(f.file)}>
                          <span className="truncate text-xs">{f.file.split('/').pop()}</span>
                        </DropdownMenuItem>
                        {f.file.includes('/') && f.file.split('/').slice(0, -1).map((_, idx, arr) => {
                          const folderPath = arr.slice(0, idx + 1).join('/');
                          return (
                            <DropdownMenuItem key={folderPath} onClick={() => addIgnoredPath(folderPath)}>
                              <span className="truncate text-xs">{folderPath}/</span>
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
              {fileLines.length > 5 && (
                <button
                  onClick={() => setShowAllFiles(!showAllFiles)}
                  className="text-muted-foreground hover:text-ink text-[10px]"
                >
                  {showAllFiles ? "less" : `+${fileLines.length - 5}`}
                </button>
              )}
              {ignoredPaths.length > 0 && (
                <div className="pt-2 border-t border-border mt-2">
                  <div className="text-muted-foreground text-[10px] mb-1">Ignored:</div>
                  {ignoredPaths.map((p) => (
                    <div key={p} className="flex items-center justify-between text-[10px] text-muted-foreground/50">
                      <span className="truncate">{p}</span>
                      <button onClick={() => removeIgnoredPath(p)} className="p-0.5 hover:bg-muted rounded">
                        <Cross1Icon className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DiagnosticItem>

          <DiagnosticItem
            title="Hardcoded Values"
            icon={<MixIcon className="w-4 h-4" />}
            status={loadingHardcode ? "loading" : "idle"}
            summary={undefined}
            isExpanded={expandedItem === "hardcode"}
            onToggle={() => toggleExpand("hardcode")}
            onRun={runHardcodeCheck}
          />
        </DiagnosticSection>

        {/* Brand System Section */}
        <DiagnosticSection
          title="Brand System"
          isExpanded={expandedSections.has("brand-system")}
          onToggle={() => toggleSection("brand-system")}
        >
          <DiagnosticItem
            title="Brand Consistency"
            icon={<ColorWheelIcon className="w-4 h-4" />}
            status={loadingBrand ? "loading" : "idle"}
            summary={undefined}
            isExpanded={expandedItem === "brand"}
            onToggle={() => toggleExpand("brand")}
            onRun={runBrandAnalysis}
          />
        </DiagnosticSection>

        {/* Design System Section */}
        <DiagnosticSection
          title="Design System"
          isExpanded={expandedSections.has("design-system")}
          onToggle={() => toggleSection("design-system")}
        >
          <DiagnosticItem
            title="Design Tokens"
            icon={<LayersIcon className="w-4 h-4" />}
            status={loadingDesign ? "loading" : "idle"}
            summary={undefined}
            isExpanded={expandedItem === "design"}
            onToggle={() => toggleExpand("design")}
            onRun={runDesignAnalysis}
          />
        </DiagnosticSection>
      </div>
    </div>
  );
}
