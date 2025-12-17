import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.setting.findMany();
  }

  async findOne(key: string) {
    return this.prisma.setting.findUnique({
      where: { key },
    });
  }

  async upsert(key: string, value: string) {
    return this.prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  async upsertMany(settings: Array<{ key: string; value: string }>) {
    const results = [];
    for (const setting of settings) {
      const result = await this.upsert(setting.key, setting.value);
      results.push(result);
    }
    return results;
  }

  async delete(key: string) {
    return this.prisma.setting.delete({
      where: { key },
    });
  }
}
