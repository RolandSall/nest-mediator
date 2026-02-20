import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { DiagramGraph } from './types';

export function useDiagrams() {
  return useQuery({
    queryKey: ['diagrams'],
    queryFn: () => api.getDiagrams(),
  });
}

export function useDiagram(id: string | undefined) {
  return useQuery({
    queryKey: ['diagram', id],
    queryFn: () => api.getDiagram(id!),
    enabled: !!id,
  });
}

export function useSaveDiagram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      id?: string;
      name: string;
      description?: string;
      graph: DiagramGraph;
    }) => {
      if (data.id) {
        return api.updateDiagram(data.id, {
          name: data.name,
          description: data.description,
          graph: data.graph,
        });
      }
      return api.createDiagram({
        name: data.name,
        description: data.description,
        graph: data.graph,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['diagrams'] });
    },
  });
}

export function useDeleteDiagram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteDiagram(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['diagrams'] });
    },
  });
}

export function useImportTopology() {
  return useMutation({
    mutationFn: (service?: string) => api.importTopology(service),
  });
}

export function useGenerate() {
  return useMutation({
    mutationFn: (body: { diagramId: string } | { graph: DiagramGraph }) =>
      api.generate(body),
  });
}

export function useDownloadZip() {
  return useMutation({
    mutationFn: async (body: { diagramId: string } | { graph: DiagramGraph }) => {
      const blob = await api.downloadZip(body);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'generated-code.zip';
      a.click();
      URL.revokeObjectURL(url);
    },
  });
}
