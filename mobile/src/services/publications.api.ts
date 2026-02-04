import { apiRequest } from "./api.client";
import type { Publication, SearchResultsResponse } from "../types/models";

interface PublicationsResponse {
  data: Publication[];
  hasMore: boolean;
  total: number;
}

export async function fetchPublications(
  token: string,
  page = 1,
  limit = 20,
): Promise<PublicationsResponse> {
  const result = await apiRequest<PublicationsResponse>({
    method: "GET",
    path: `/publications?page=${page}&limit=${limit}`,
    token,
  });

  if (result.error || !result.data) {
    throw new Error(result.error ?? "Failed to fetch publications");
  }

  return result.data;
}

export async function searchPublications(
  token: string,
  query: string,
  startDate?: string,
  endDate?: string,
  page = 1,
  limit = 20,
): Promise<SearchResultsResponse> {
  let path = `/publications/search?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`;
  if (startDate) path += `&startDate=${startDate}`;
  if (endDate) path += `&endDate=${endDate}`;

  const result = await apiRequest<SearchResultsResponse>({
    method: "GET",
    path,
    token,
  });

  if (result.error || !result.data) {
    throw new Error(result.error ?? "Search failed");
  }

  return result.data;
}
