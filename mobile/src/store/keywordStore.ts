import { create } from "zustand";
import type { Keyword } from "../types/models";
import {
  fetchKeywords,
  createKeyword,
  updateKeyword,
  deleteKeyword,
} from "../services/keywords.api";

interface KeywordState {
  keywords: Keyword[];
  isLoading: boolean;
  error: string | null;

  load: (token: string) => Promise<void>;
  add: (token: string, expression: string) => Promise<void>;
  update: (token: string, id: string, expression: string) => Promise<void>;
  remove: (token: string, id: string) => Promise<void>;
  clearError: () => void;
}

export const useKeywordStore = create<KeywordState>((set) => ({
  keywords: [],
  isLoading: false,
  error: null,

  load: async (token: string) => {
    set({ isLoading: true, error: null });
    try {
      const keywords = await fetchKeywords(token);
      set({ keywords, isLoading: false });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Falha ao carregar expressões";
      set({ error: message, isLoading: false });
    }
  },

  add: async (token: string, expression: string) => {
    set({ isLoading: true, error: null });
    try {
      const keyword = await createKeyword(token, expression);
      set((state) => ({
        keywords: [...state.keywords, keyword],
        isLoading: false,
      }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Falha ao adicionar expressão";
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  update: async (token: string, id: string, expression: string) => {
    set({ isLoading: true, error: null });
    try {
      const updated = await updateKeyword(token, id, expression);
      set((state) => ({
        keywords: state.keywords.map((k) => (k.id === id ? updated : k)),
        isLoading: false,
      }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Falha ao atualizar expressão";
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  remove: async (token: string, id: string) => {
    set({ isLoading: true, error: null });
    try {
      await deleteKeyword(token, id);
      set((state) => ({
        keywords: state.keywords.filter((k) => k.id !== id),
        isLoading: false,
      }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Falha ao remover expressão";
      set({ error: message, isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
