import { create } from 'zustand';

interface UIState {
  selectedService: string | undefined;
  setSelectedService: (service: string | undefined) => void;
  selectedNodeId: string | undefined;
  setSelectedNodeId: (id: string | undefined) => void;
}

export const useUIStore = create<UIState>((set) => ({
  selectedService: undefined,
  setSelectedService: (service) => set({ selectedService: service }),
  selectedNodeId: undefined,
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
}));
