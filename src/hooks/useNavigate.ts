import { useCallback } from "react";
import { useAtom } from "jotai";
import { navigationStateAtom } from "@/store";
import type { View } from "@/types";

const MAX_HISTORY = 50;

export function useNavigate() {
  const [, setNavigationState] = useAtom(navigationStateAtom);

  const navigate = useCallback((newView: View) => {
    setNavigationState(prev => {
      // 原子性更新：在一个 functional update 中同时处理 history 和 index
      const newHistory = prev.history.slice(0, prev.index + 1);
      newHistory.push(newView);

      let newIndex = prev.index + 1;
      if (newHistory.length > MAX_HISTORY) {
        newHistory.shift();
        newIndex = MAX_HISTORY - 1;
      }

      return { history: newHistory, index: newIndex };
    });
  }, [setNavigationState]);

  return navigate;
}
