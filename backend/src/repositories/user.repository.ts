import type { PrismaClient, User } from "@prisma/client";

export interface CreateOrUpdateUserData {
  email: string;
  name: string;
  provider: string;
  providerId: string;
  avatarUrl?: string | null;
}

export interface UpdateFcmTokenData {
  userId: string;
  fcmToken: string;
}

export class UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByProvider(provider: string, providerId: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { provider_providerId: { provider, providerId } },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async createOrUpdate(data: CreateOrUpdateUserData): Promise<User> {
    return this.prisma.user.upsert({
      where: {
        provider_providerId: {
          provider: data.provider,
          providerId: data.providerId,
        },
      },
      create: {
        email: data.email,
        name: data.name,
        provider: data.provider,
        providerId: data.providerId,
        avatarUrl: data.avatarUrl ?? null,
      },
      update: {
        email: data.email,
        name: data.name,
        avatarUrl: data.avatarUrl ?? undefined,
      },
    });
  }

  async updateFcmToken(userId: string, fcmToken: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { fcmToken },
    });
  }
}
