import type { PrismaClient, Publication } from "@prisma/client";

export interface CreatePublicationData {
  doeId: number;
  edition: string;
  publishedDate: Date;
  pdfUrl: string;
  thumbnailUrl?: string | null;
  pageCount?: number | null;
  title?: string | null;
  content?: string | null;
  supplement?: boolean;
}

export class PublicationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByDoeId(doeId: number): Promise<Publication | null> {
    return this.prisma.publication.findUnique({ where: { doeId } });
  }

  async findLatest(limit = 10): Promise<Publication[]> {
    return this.prisma.publication.findMany({
      orderBy: { publishedDate: "desc" },
      take: limit,
    });
  }

  async findPaginated(page: number, limit: number): Promise<{ data: Publication[]; total: number }> {
    const [data, total] = await Promise.all([
      this.prisma.publication.findMany({
        orderBy: { publishedDate: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.publication.count(),
    ]);
    return { data, total };
  }

  async search(
    query: string,
    startDate?: string,
    endDate?: string,
  ): Promise<Publication[]> {
    const where: Record<string, unknown> = {};

    if (query) {
      where.OR = [
        { title: { contains: query, mode: "insensitive" } },
        { content: { contains: query, mode: "insensitive" } },
      ];
    }

    if (startDate || endDate) {
      const dateFilter: Record<string, Date> = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) dateFilter.lte = new Date(endDate);
      where.publishedDate = dateFilter;
    }

    return this.prisma.publication.findMany({
      where,
      orderBy: { publishedDate: "desc" },
      take: 50,
    });
  }

  async upsert(data: CreatePublicationData): Promise<{ publication: Publication; isNew: boolean }> {
    const existing = await this.findByDoeId(data.doeId);

    if (existing) {
      const updated = await this.prisma.publication.update({
        where: { doeId: data.doeId },
        data: {
          title: data.title ?? existing.title,
          content: data.content ?? existing.content,
          pageCount: data.pageCount ?? existing.pageCount,
          thumbnailUrl: data.thumbnailUrl ?? existing.thumbnailUrl,
        },
      });
      return { publication: updated, isNew: false };
    }

    const publication = await this.prisma.publication.create({ data });
    return { publication, isNew: true };
  }

  async markProcessed(id: string): Promise<Publication> {
    return this.prisma.publication.update({
      where: { id },
      data: { processedAt: new Date() },
    });
  }

  async findUnprocessed(): Promise<Publication[]> {
    return this.prisma.publication.findMany({
      where: { processedAt: null },
      orderBy: { publishedDate: "desc" },
    });
  }
}
