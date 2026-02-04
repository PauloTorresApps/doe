import { create } from "zustand";
import type { Publication } from "../types/models";
import { fetchPublications } from "../services/publications.api";
import {
  cachePublications,
  getCachedPublications,
} from "../services/storage.service";

interface PublicationState {
  publications: Publication[];
  isLoading: boolean;
  isRefreshing: boolean;
  hasMore: boolean;
  page: number;
  error: string | null;

  load: (token: string) => Promise<void>;
  loadMore: (token: string) => Promise<void>;
  refresh: (token: string) => Promise<void>;
  loadCached: () => Promise<void>;
}

export const usePublicationStore = create<PublicationState>((set, get) => ({
  publications: [],
  isLoading: false,
  isRefreshing: false,
  hasMore: true,
  page: 1,
  error: null,

  load: async (token: string) => {
    set({ isLoading: true, error: null });
    try {
      const result = await fetchPublications(token, 1);
      set({
        publications: result.data,
        hasMore: result.hasMore,
        page: 1,
        isLoading: false,
      });
      await cachePublications(result.data);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load publications";
      set({ error: message, isLoading: false });
    }
  },

  loadMore: async (token: string) => {
    const { isLoading, hasMore, page } = get();
    if (isLoading || !hasMore) return;

    set({ isLoading: true });
    try {
      const nextPage = page + 1;
      const result = await fetchPublications(token, nextPage);
      set((state) => ({
        publications: [...state.publications, ...result.data],
        hasMore: result.hasMore,
        page: nextPage,
        isLoading: false,
      }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load more";
      set({ error: message, isLoading: false });
    }
  },

  refresh: async (token: string) => {
    set({ isRefreshing: true, error: null });
    try {
      const result = await fetchPublications(token, 1);
      set({
        publications: result.data,
        hasMore: result.hasMore,
        page: 1,
        isRefreshing: false,
      });
      await cachePublications(result.data);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to refresh";
      set({ error: message, isRefreshing: false });
    }
  },

  loadCached: async () => {
    const cached = await getCachedPublications();
    if (cached.length > 0) {
      set({ publications: cached });
    }
  },
}));
