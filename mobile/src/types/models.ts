export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  provider: string;
}

export interface Publication {
  id: string;
  doeId: number;
  edition: string;
  publishedDate: string;
  pdfUrl: string;
  thumbnailUrl: string | null;
  pageCount: number | null;
  title: string | null;
  content: string | null;
  supplement: boolean;
}

export interface Keyword {
  id: string;
  expression: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface SearchResult {
  publication: Publication;
  matchedKeyword: string;
  snippet: string;
}

export interface SearchResultItem {
  publication: Publication;
  snippet: string;
}

export interface SearchResultsResponse {
  data: SearchResultItem[];
  hasMore: boolean;
  total: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  hasMore: boolean;
  total: number;
}
