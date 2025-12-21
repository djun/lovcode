import { useState, useEffect, useRef } from "react";
import { ClipboardList, X, GripVertical } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow, LogicalSize, LogicalPosition } from "@tauri-apps/api/window";
import { motion, AnimatePresence } from "framer-motion";

// ============================================================================
// Types
// ============================================================================

export interface ReviewItem {
  id: string;
  title: string;
  project?: string;
  timestamp: number;
}

// ============================================================================
// FloatWindow Component
// ============================================================================

// 磁吸阈值（px）
const SNAP_THRESHOLD = 240;

export function FloatWindow() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandDirection, setExpandDirection] = useState<"left" | "right">("right");
  const [snapSide, setSnapSide] = useState<"left" | "right" | null>(null);
  const isDraggingRef = useRef(false);


  // 磁吸到边缘
  const snapToEdge = async () => {
    const win = getCurrentWindow();
    const pos = await win.outerPosition();
    const size = await win.outerSize();
    const scale = window.devicePixelRatio;

    // 转换为逻辑坐标
    const windowX = pos.x / scale;
    const windowY = pos.y / scale;
    const windowWidth = size.width / scale;

    // 使用 Web API 获取可用屏幕区域（排除菜单栏和 Dock）
    const screenLeft = window.screen.availLeft ?? 0;
    const screenWidth = window.screen.availWidth;

    // 相对于可用区域的位置
    const relativeX = windowX - screenLeft;

    let newX = windowX;
    let snappedSide: "left" | "right" | null = null;

    // 左边磁吸
    if (relativeX < SNAP_THRESHOLD) {
      newX = screenLeft;
      snappedSide = "left";
    }
    // 右边磁吸
    else if (screenWidth - relativeX - windowWidth < SNAP_THRESHOLD) {
      newX = screenLeft + screenWidth - windowWidth;
      snappedSide = "right";
    }

    setSnapSide(snappedSide);

    if (snappedSide !== null) {
      await win.setPosition(new LogicalPosition(newX, windowY));
    }
  };

  // 监听鼠标松开事件，拖拽结束后磁吸
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        // 延迟一帧确保窗口位置已更新
        requestAnimationFrame(() => {
          snapToEdge();
        });
      }
    };

    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => {
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, []);

  // 监听后端推送
  useEffect(() => {
    const unlisten = listen<ReviewItem[]>("review-queue-update", (event) => {
      setItems(event.payload);
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  // 计算收起状态的宽度
  const getCollapsedWidth = () => {
    const paddingX = 12;
    const badgeSize = 24;
    const gap = 8;
    const brandName = "Lovnotifier";
    const charWidth = 7;
    return Math.ceil(paddingX * 2 + badgeSize + gap + brandName.length * charWidth);
  };

  // 初始化窗口大小（收起状态）
  useEffect(() => {
    const initSize = async () => {
      const win = getCurrentWindow();
      await win.setSize(new LogicalSize(getCollapsedWidth(), 48));
    };
    initSize();
  }, []);

  // Demo数据
  useEffect(() => {
    setItems([
      { id: "1", title: "Fix login validation bug", project: "auth-service", timestamp: Date.now() - 300000 },
      { id: "2", title: "Add dark mode toggle", project: "frontend", timestamp: Date.now() - 600000 },
      { id: "3", title: "Update API documentation", project: "backend", timestamp: Date.now() - 900000 },
    ]);
  }, []);

  // 拖拽 + 点击判断
  const handleMouseDown = (e: React.MouseEvent) => {
    const startX = e.clientX;
    const startY = e.clientY;
    let isDragging = false;

    const handleMouseMove = async (moveEvent: MouseEvent) => {
      const dx = Math.abs(moveEvent.clientX - startX);
      const dy = Math.abs(moveEvent.clientY - startY);

      // 移动超过5px才算拖拽
      if (!isDragging && (dx > 5 || dy > 5)) {
        isDragging = true;
        isDraggingRef.current = true;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);

        const win = getCurrentWindow();
        await win.startDragging();
      }
    };

    const handleMouseUp = async () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);

      // 没有拖拽，视为点击
      if (!isDragging) {
        const win = getCurrentWindow();
        const pos = await win.outerPosition();

        const expandedWidth = 280;
        const expandedHeight = 320;
        const collapsedHeight = 48;
        const collapsedWidth = getCollapsedWidth();

        const scale = window.devicePixelRatio;
        const windowX = pos.x / scale;
        const windowY = pos.y / scale;

        if (!isExpanded) {
          // 展开：先调整窗口大小，再改状态（避免圆角突变）
          const screenLeft = window.screen.availLeft ?? 0;
          const screenWidth = window.screen.availWidth;

          if (windowX + expandedWidth > screenLeft + screenWidth) {
            setExpandDirection("left");
            const newX = windowX - (expandedWidth - collapsedWidth);
            await win.setPosition(new LogicalPosition(Math.max(screenLeft, newX), windowY));
          } else {
            setExpandDirection("right");
          }
          await win.setSize(new LogicalSize(expandedWidth, expandedHeight));
          setIsExpanded(true);
        } else {
          // 收起：先改状态，再调整窗口大小
          setIsExpanded(false);
          if (expandDirection === "left") {
            await win.setPosition(new LogicalPosition(windowX + (expandedWidth - collapsedWidth), windowY));
          }
          await win.setSize(new LogicalSize(collapsedWidth, collapsedHeight));
        }
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleDismiss = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  // 收缩时的圆角样式
  const collapsedRounding = snapSide === "left"
    ? "rounded-r-full" // 靠左边，右边圆
    : snapSide === "right"
    ? "rounded-l-full" // 靠右边，左边圆
    : "rounded-full";  // 未吸附，全圆

  return (
    <div className="w-fit h-fit">
      <div
        className={`bg-primary text-primary-foreground shadow-2xl overflow-hidden ${isExpanded ? "rounded-xl" : collapsedRounding}`}
      >
        {/* Header - click to toggle, drag to move */}
        <div
          className={`flex items-center gap-2 cursor-pointer select-none h-full ${isExpanded ? "justify-center p-3" : "px-3 py-2"}`}
          onMouseDown={handleMouseDown}
        >
          {isExpanded ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 flex-1"
            >
              <ClipboardList className="w-5 h-5 shrink-0" />
              <span className="font-medium text-sm flex-1">Review Queue</span>
              <GripVertical className="w-4 h-4 opacity-50" />
            </motion.div>
          ) : (
            <div className={`flex items-center w-full ${snapSide === "right" ? "flex-row-reverse" : ""}`}>
              <span className="text-xs tracking-wide opacity-90 flex-1 px-1">Lovnotifier</span>
              <span className="w-6 h-6 flex items-center justify-center text-xs font-bold bg-white/20 rounded-full shrink-0">
                {items.length}
              </span>
            </div>
          )}
        </div>

        {/* Expanded content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="px-3 pb-3 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-2 text-xs opacity-80">
                <span>{items.length} pending</span>
              </div>

              {/* Items list */}
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {items.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="group flex items-center gap-2 p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.title}</p>
                      <p className="text-xs opacity-70 truncate">
                        {item.project && <span>{item.project} · </span>}
                        {formatTime(item.timestamp)}
                      </p>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleDismiss(item.id)}
                      className="p-1 opacity-0 group-hover:opacity-100 hover:bg-white/20 rounded transition-opacity"
                    >
                      <X className="w-3.5 h-3.5" />
                    </motion.button>
                  </motion.div>
                ))}
              </div>

              {items.length === 0 && (
                <div className="text-center py-4 text-sm opacity-70">
                  No pending reviews
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
