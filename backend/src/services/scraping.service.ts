import * as cheerio from "cheerio";
import { getRandomUserAgent } from "./user-agents.js";
import type { CreatePublicationData } from "../repositories/publication.repository.js";

export interface DoeApiItem {
  id: number;
  edicao: string;
  data: string;
  data_iso8601: string;
  suplemento: boolean;
  paginas: number;
  tamanho: string;
  downloads: number;
  link: string;
  imagem: string;
}

export interface FetchOptions {
  timeoutMs?: number;
}

const DOE_API_URL = "https://diariooficial.to.gov.br/api.json";
const DOE_BASE_URL = "https://diariooficial.to.gov.br";
const DEFAULT_TIMEOUT_MS = 30_000;

export class ScrapingService {
  private apiUrl: string;
  private baseUrl: string;

  constructor(opts?: { apiUrl?: string; baseUrl?: string }) {
    this.apiUrl = opts?.apiUrl ?? DOE_API_URL;
    this.baseUrl = opts?.baseUrl ?? DOE_BASE_URL;
  }

  async fetchPublicationList(options?: FetchOptions): Promise<DoeApiItem[]> {
    const response = await fetch(this.apiUrl, {
      headers: {
        "User-Agent": getRandomUserAgent(),
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(options?.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`DOE API returned ${response.status}: ${response.statusText}`);
    }

    const data: unknown = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("DOE API response is not an array");
    }

    return data as DoeApiItem[];
  }

  async fetchPublicationPage(doeId: number, options?: FetchOptions): Promise<string> {
    const url = `${this.baseUrl}/diario/${doeId}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": getRandomUserAgent(),
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(options?.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`DOE page ${doeId} returned ${response.status}: ${response.statusText}`);
    }

    return response.text();
  }

  parsePublicationPage(html: string): { title: string | null; content: string | null } {
    const $ = cheerio.load(html);

    const title =
      $("h1.diario-titulo, .diario-header h1, article h1, .content h1").first().text().trim() ||
      $("title").text().trim() ||
      null;

    const content =
      $(".diario-conteudo, .diario-body, article .content, .publication-content")
        .first()
        .text()
        .trim() || null;

    return { title, content };
  }

  apiItemToPublicationData(item: DoeApiItem): CreatePublicationData {
    return {
      doeId: item.id,
      edition: item.edicao,
      publishedDate: new Date(item.data_iso8601),
      pdfUrl: item.link,
      thumbnailUrl: item.imagem,
      pageCount: item.paginas,
      supplement: item.suplemento,
    };
  }
}
