import { apiRequest } from "./api.client";
import type { Keyword } from "../types/models";

export async function fetchKeywords(token: string): Promise<Keyword[]> {
  const result = await apiRequest<{ keywords: Keyword[] }>({
    method: "GET",
    path: "/keywords",
    token,
  });

  if (result.error || !result.data) {
    throw new Error(result.error ?? "Failed to fetch keywords");
  }

  return result.data.keywords;
}

export async function createKeyword(
  token: string,
  expression: string,
): Promise<Keyword> {
  const result = await apiRequest<{ keyword: Keyword }>({
    method: "POST",
    path: "/keywords",
    body: { expression },
    token,
  });

  if (result.error || !result.data) {
    throw new Error(result.error ?? "Failed to create keyword");
  }

  return result.data.keyword;
}

export async function updateKeyword(
  token: string,
  id: string,
  expression: string,
): Promise<Keyword> {
  const result = await apiRequest<{ keyword: Keyword }>({
    method: "PUT",
    path: `/keywords/${id}`,
    body: { expression },
    token,
  });

  if (result.error || !result.data) {
    throw new Error(result.error ?? "Failed to update keyword");
  }

  return result.data.keyword;
}

export async function deleteKeyword(
  token: string,
  id: string,
): Promise<void> {
  const result = await apiRequest<void>({
    method: "DELETE",
    path: `/keywords/${id}`,
    token,
  });

  if (result.error) {
    throw new Error(result.error);
  }
}
