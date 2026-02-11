import { create } from 'zustand';
import { bienApi } from '../services/api';
import type { Bien, BienListResponse, SearchParams } from '../types';

interface BienState {
  biens: Bien[];
  mesBiens: Bien[];
  currentBien: Bien | null;
  isLoading: boolean;
  error: string | null;
  pagination: {
    total: number;
    page: number;
    par_page: number;
    pages_total: number;
  };
  fetchBiens: (page?: number) => Promise<void>;
  searchBiens: (params: SearchParams) => Promise<void>;
  fetchMesBiens: (page?: number) => Promise<void>;
  fetchBienById: (id: string) => Promise<void>;
  clearCurrentBien: () => void;
  clearError: () => void;
}

export const useBienStore = create<BienState>((set) => ({
  biens: [],
  mesBiens: [],
  currentBien: null,
  isLoading: false,
  error: null,
  pagination: {
    total: 0,
    page: 1,
    par_page: 10,
    pages_total: 0,
  },

  fetchBiens: async (page = 1) => {
    set({ isLoading: true, error: null });
    try {
      const response = await bienApi.getAll(page, 10);
      set({
        biens: response.biens,
        pagination: {
          total: response.total,
          page: response.page,
          par_page: response.par_page,
          pages_total: response.pages_total,
        },
        isLoading: false,
      });
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Erreur de chargement';
      set({ error: errorMessage, isLoading: false });
    }
  },

  searchBiens: async (params) => {
    set({ isLoading: true, error: null });
    try {
      const response = await bienApi.search(params);
      set({
        biens: response.biens,
        pagination: {
          total: response.total,
          page: response.page,
          par_page: response.par_page,
          pages_total: response.pages_total,
        },
        isLoading: false,
      });
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Erreur de recherche';
      set({ error: errorMessage, isLoading: false });
    }
  },

  fetchMesBiens: async (page = 1) => {
    set({ isLoading: true, error: null });
    try {
      const response = await bienApi.getMesBiens(page, 10);
      set({
        mesBiens: response.biens,
        isLoading: false,
      });
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Erreur de chargement';
      set({ error: errorMessage, isLoading: false });
    }
  },

  fetchBienById: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const bien = await bienApi.getById(id);
      set({ currentBien: bien, isLoading: false });
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Bien introuvable';
      set({ error: errorMessage, isLoading: false });
    }
  },

  clearCurrentBien: () => set({ currentBien: null }),
  clearError: () => set({ error: null }),
}));
