import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class BackupService {
  private backupDir = path.join(process.cwd(), 'backups');

  constructor(private readonly prisma: PrismaService) {
    // Ensure backup directory exists
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  async createBackup(userId: string) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.json`;
    const filepath = path.join(this.backupDir, filename);

    // Export all data
    const data = {
      metadata: {
        timestamp: new Date().toISOString(),
        userId,
        version: '1.0',
      },
      branches: await this.prisma.branch.findMany({ include: { _count: true } }),
      users: await this.prisma.user.findMany({ select: { id: true, email: true, role: true, branchId: true, isActive: true } }),
      customers: await this.prisma.customer.findMany(),
      products: await this.prisma.product.findMany(),
      suppliers: await this.prisma.supplier.findMany(),
      sales: await this.prisma.sale.findMany({ include: { items: true, payments: true } }),
      debts: await this.prisma.debt.findMany(),
    };

    // Write to file
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));

    return {
      filename,
      filepath,
      size: fs.statSync(filepath).size,
      timestamp: new Date(),
    };
  }

  async listBackups() {
    const files = fs.readdirSync(this.backupDir)
      .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
      .map(f => {
        const filepath = path.join(this.backupDir, f);
        const stats = fs.statSync(filepath);
        return {
          filename: f,
          filepath,
          size: stats.size,
          created: stats.birthtime,
        };
      })
      .sort((a, b) => b.created.getTime() - a.created.getTime());

    return files;
  }

  async getLatestBackup() {
    const backups = await this.listBackups();
    if (backups.length === 0) {
      throw new Error('No backups found');
    }
    return backups[0];
  }

  getAutoBackupStatus() {
    return {
      enabled: true,
      schedule: 'Daily at 2 AM',
      lastBackup: fs.existsSync(this.backupDir) 
        ? fs.readdirSync(this.backupDir).length > 0 
          ? 'Available' 
          : 'No backups yet'
        : 'Backup directory not found',
    };
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async autoBackup() {
    try {
      await this.createBackup('system');
      console.log('Automatic backup created successfully');
    } catch (error) {
      console.error('Auto backup failed:', error);
    }
  }
}
