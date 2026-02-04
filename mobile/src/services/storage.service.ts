import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Publication } from "../types/models";

const PUBLICATIONS_CACHE_KEY = "doe_cached_publications";
const MAX_CACHED_PUBLICATIONS = 10;
const KEYWORDS_CACHE_KEY = "doe_cached_keywords";
const SEARCH_HISTORY_KEY = "doe_search_history";
const MAX_SEARCH_HISTORY = 10;

export async function cachePublications(
  publications: Publication[],
): Promise<void> {
  const toCache = publications.slice(0, MAX_CACHED_PUBLICATIONS);
  await AsyncStorage.setItem(PUBLICATIONS_CACHE_KEY, JSON.stringify(toCache));
}

export async function getCachedPublications(): Promise<Publication[]> {
  const raw = await AsyncStorage.getItem(PUBLICATIONS_CACHE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Publication[];
  } catch {
    return [];
  }
}

export async function cacheKeywords(keywords: string[]): Promise<void> {
  await AsyncStorage.setItem(KEYWORDS_CACHE_KEY, JSON.stringify(keywords));
}

export async function getCachedKeywords(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(KEYWORDS_CACHE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export async function addSearchToHistory(query: string): Promise<void> {
  const history = await getSearchHistory();
  const filtered = history.filter((h) => h !== query);
  const updated = [query, ...filtered].slice(0, MAX_SEARCH_HISTORY);
  await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
}

export async function getSearchHistory(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export async function clearSearchHistory(): Promise<void> {
  await AsyncStorage.removeItem(SEARCH_HISTORY_KEY);
}
