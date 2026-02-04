import type { PrismaClient, Keyword } from "@prisma/client";

export class KeywordRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByUserId(userId: string): Promise<Keyword[]> {
    return this.prisma.keyword.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  async findById(id: string): Promise<Keyword | null> {
    return this.prisma.keyword.findUnique({ where: { id } });
  }

  async countByUserId(userId: string): Promise<number> {
    return this.prisma.keyword.count({ where: { userId } });
  }

  async create(userId: string, expression: string): Promise<Keyword> {
    return this.prisma.keyword.create({
      data: { userId, expression },
    });
  }

  async update(id: string, expression: string): Promise<Keyword> {
    return this.prisma.keyword.update({
      where: { id },
      data: { expression },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.keyword.delete({ where: { id } });
  }
}
