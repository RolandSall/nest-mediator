import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useAutoRefresh(queryKeys: string[][], intervalMs = 5000) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const timer = setInterval(() => {
      queryKeys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
    }, intervalMs);
    return () => clearInterval(timer);
  }, [queryClient, queryKeys, intervalMs]);
}
