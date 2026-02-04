import type { PrismaClient } from "@prisma/client";

const MIN_SEARCH_LENGTH = 3;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export class SearchServiceError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "QUERY_TOO_SHORT"
      | "INVALID_DATE_RANGE"
      | "INVALID_PAGINATION",
  ) {
    super(message);
    this.name = "SearchServiceError";
  }
}

export interface SearchResultItem {
  publication: {
    id: string;
    doeId: number;
    edition: string;
    publishedDate: Date;
    pdfUrl: string;
    thumbnailUrl: string | null;
    pageCount: number | null;
    title: string | null;
    content: string | null;
    supplement: boolean;
  };
  snippet: string;
}

export interface SearchResponse {
  data: SearchResultItem[];
  hasMore: boolean;
  total: number;
}

export interface SearchParams {
  query: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export class SearchService {
  constructor(private readonly prisma: PrismaClient) {}

  async search(params: SearchParams): Promise<SearchResponse> {
    const trimmed = params.query.trim();
    if (trimmed.length < MIN_SEARCH_LENGTH) {
      throw new SearchServiceError(
        `Search query must have at least ${MIN_SEARCH_LENGTH} characters`,
        "QUERY_TOO_SHORT",
      );
    }

    const page = params.page ?? DEFAULT_PAGE;
    const limit = Math.min(params.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    if (page < 1 || limit < 1) {
      throw new SearchServiceError(
        "Page and limit must be positive integers",
        "INVALID_PAGINATION",
      );
    }

    if (params.startDate && params.endDate) {
      if (new Date(params.startDate) > new Date(params.endDate)) {
        throw new SearchServiceError(
          "Start date must be before end date",
          "INVALID_DATE_RANGE",
        );
      }
    }

    const sanitized = this.sanitizeForTsQuery(trimmed);
    const offset = (page - 1) * limit;

    let dateClause = "";
    const baseParams: unknown[] = [sanitized];
    let paramIndex = 2;

    if (params.startDate) {
      dateClause += ` AND p.published_date >= $${paramIndex}::timestamp`;
      baseParams.push(new Date(params.startDate));
      paramIndex++;
    }
    if (params.endDate) {
      dateClause += ` AND p.published_date <= $${paramIndex}::timestamp`;
      baseParams.push(new Date(params.endDate));
      paramIndex++;
    }

    const ftsCondition = `to_tsvector('portuguese', COALESCE(p.title, '') || ' ' || COALESCE(p.content, '')) @@ plainto_tsquery('portuguese', $1)`;

    const countQuery = `
      SELECT COUNT(*)::int as total
      FROM publications p
      WHERE ${ftsCondition}
      ${dateClause}
    `;

    const dataQuery = `
      SELECT
        p.id,
        p.doe_id AS "doeId",
        p.edition,
        p.published_date AS "publishedDate",
        p.pdf_url AS "pdfUrl",
        p.thumbnail_url AS "thumbnailUrl",
        p.page_count AS "pageCount",
        p.title,
        p.content,
        p.supplement,
        ts_headline(
          'portuguese',
          COALESCE(p.content, ''),
          plainto_tsquery('portuguese', $1),
          'StartSel=<<, StopSel=>>, MaxWords=35, MinWords=15, MaxFragments=2, FragmentDelimiter= ... '
        ) AS snippet
      FROM publications p
      WHERE ${ftsCondition}
      ${dateClause}
      ORDER BY ts_rank(
        to_tsvector('portuguese', COALESCE(p.title, '') || ' ' || COALESCE(p.content, '')),
        plainto_tsquery('portuguese', $1)
      ) DESC, p.published_date DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const countParams = [...baseParams];
    const dataParams = [...baseParams, limit, offset];

    const [countResult, rows] = await Promise.all([
      this.prisma.$queryRawUnsafe<[{ total: number }]>(
        countQuery,
        ...countParams,
      ),
      this.prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        dataQuery,
        ...dataParams,
      ),
    ]);

    const total = countResult[0]?.total ?? 0;

    const data: SearchResultItem[] = rows.map((row) => ({
      publication: {
        id: row.id as string,
        doeId: row.doeId as number,
        edition: row.edition as string,
        publishedDate: row.publishedDate as Date,
        pdfUrl: row.pdfUrl as string,
        thumbnailUrl: row.thumbnailUrl as string | null,
        pageCount: row.pageCount as number | null,
        title: row.title as string | null,
        content: row.content as string | null,
        supplement: row.supplement as boolean,
      },
      snippet: (row.snippet as string) || "",
    }));

    return {
      data,
      hasMore: page * limit < total,
      total,
    };
  }

  private sanitizeForTsQuery(input: string): string {
    return input
      .replace(/[\\:*!&|()'"<>]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
}
