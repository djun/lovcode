import { useQuery, useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";

/**
 * Hook for cached Tauri invoke calls using react-query
 * Data persists across tab switches, invalidated on app restart
 */
export function useInvokeQuery<T>(
  queryKey: QueryKey,
  command: string,
  args?: Record<string, unknown>,
) {
  return useQuery<T>({
    queryKey,
    queryFn: () => invoke<T>(command, args),
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook for Tauri invoke mutations with automatic cache invalidation
 */
export function useInvokeMutation<T, V = void>(
  command: string,
  invalidateKeys?: QueryKey[],
) {
  const queryClient = useQueryClient();

  return useMutation<T, Error, V>({
    mutationFn: (variables) => invoke<T>(command, variables as Record<string, unknown>),
    onSuccess: () => {
      invalidateKeys?.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });
    },
  });
}

/**
 * Re-export useQueryClient for manual invalidation
 */
export { useQueryClient };
