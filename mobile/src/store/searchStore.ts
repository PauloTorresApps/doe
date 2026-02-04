import { create } from "zustand";
import type { SearchResultItem } from "../types/models";
import { searchPublications } from "../services/publications.api";
import {
  addSearchToHistory,
  getSearchHistory,
  clearSearchHistory,
} from "../services/storage.service";

const MIN_SEARCH_LENGTH = 3;

interface SearchState {
  results: SearchResultItem[];
  query: string;
  startDate: string | null;
  endDate: string | null;
  isSearching: boolean;
  isLoadingMore: boolean;
  error: string | null;
  history: string[];
  page: number;
  hasMore: boolean;
  total: number;

  setQuery: (query: string) => void;
  setStartDate: (date: string | null) => void;
  setEndDate: (date: string | null) => void;
  search: (token: string) => Promise<void>;
  loadMore: (token: string) => Promise<void>;
  loadHistory: () => Promise<void>;
  clearHistory: () => Promise<void>;
  clearResults: () => void;
}

export const useSearchStore = create<SearchState>((set, get) => ({
  results: [],
  query: "",
  startDate: null,
  endDate: null,
  isSearching: false,
  isLoadingMore: false,
  error: null,
  history: [],
  page: 1,
  hasMore: false,
  total: 0,

  setQuery: (query: string) => set({ query }),
  setStartDate: (date: string | null) => set({ startDate: date }),
  setEndDate: (date: string | null) => set({ endDate: date }),

  search: async (token: string) => {
    const { query, startDate, endDate } = get();
    const trimmed = query.trim();
    if (!trimmed) return;

    if (trimmed.length < MIN_SEARCH_LENGTH) {
      set({ error: "Digite pelo menos 3 caracteres" });
      return;
    }

    set({ isSearching: true, error: null, results: [], page: 1 });
    try {
      const response = await searchPublications(
        token,
        trimmed,
        startDate ?? undefined,
        endDate ?? undefined,
        1,
      );
      set({
        results: response.data,
        hasMore: response.hasMore,
        total: response.total,
        page: 1,
        isSearching: false,
      });
      await addSearchToHistory(trimmed);
      const history = await getSearchHistory();
      set({ history });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Busca falhou";
      set({ error: message, isSearching: false });
    }
  },

  loadMore: async (token: string) => {
    const { query, startDate, endDate, hasMore, isLoadingMore, page } = get();
    if (!hasMore || isLoadingMore) return;

    const trimmed = query.trim();
    if (!trimmed) return;

    const nextPage = page + 1;
    set({ isLoadingMore: true });
    try {
      const response = await searchPublications(
        token,
        trimmed,
        startDate ?? undefined,
        endDate ?? undefined,
        nextPage,
      );
      set((state) => ({
        results: [...state.results, ...response.data],
        hasMore: response.hasMore,
        total: response.total,
        page: nextPage,
        isLoadingMore: false,
      }));
    } catch {
      set({ isLoadingMore: false });
    }
  },

  loadHistory: async () => {
    const history = await getSearchHistory();
    set({ history });
  },

  clearHistory: async () => {
    await clearSearchHistory();
    set({ history: [] });
  },

  clearResults: () =>
    set({ results: [], error: null, hasMore: false, total: 0, page: 1 }),
}));
