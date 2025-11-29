import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { FeedbackQueryDto } from './dto/feedback-query.dto';

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createFeedbackDto: CreateFeedbackDto) {
    return this.prisma.feedback.create({
      data: {
        customerId: createFeedbackDto.customerId,
        saleId: createFeedbackDto.saleId,
        rating: createFeedbackDto.rating,
        comment: createFeedbackDto.comment,
        branchId: createFeedbackDto.branchId,
      },
      include: {
        customer: { select: { fullName: true, phone: true } },
        sale: { select: { id: true, total: true, createdAt: true } },
      },
    });
  }

  async findAll(query: FeedbackQueryDto) {
    const where: any = {};

    if (query.branchId) where.branchId = query.branchId;
    if (query.minRating || query.maxRating) {
      where.rating = {};
      if (query.minRating) where.rating.gte = query.minRating;
      if (query.maxRating) where.rating.lte = query.maxRating;
    }

    return this.prisma.feedback.findMany({
      where,
      include: {
        customer: { select: { fullName: true, phone: true } },
        sale: { select: { id: true, total: true, createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const feedback = await this.prisma.feedback.findUnique({
      where: { id },
      include: {
        customer: { select: { fullName: true, phone: true } },
        sale: { select: { id: true, total: true, createdAt: true } },
      },
    });

    if (!feedback) {
      throw new NotFoundException('Feedback not found');
    }

    return feedback;
  }

  async remove(id: string) {
    return this.prisma.feedback.delete({ where: { id } });
  }

  async getCustomerFeedback(customerId: string) {
    return this.prisma.feedback.findMany({
      where: { customerId },
      include: {
        sale: { select: { id: true, total: true, createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getStatistics(query: FeedbackQueryDto) {
    const where: any = {};
    if (query.branchId) where.branchId = query.branchId;

    const [total, ratings, avgRating] = await Promise.all([
      this.prisma.feedback.count({ where }),
      this.prisma.feedback.groupBy({
        by: ['rating'],
        where,
        _count: { rating: true },
      }),
      this.prisma.feedback.aggregate({
        where,
        _avg: { rating: true },
      }),
    ]);

    // Calculate rating distribution
    const distribution = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };

    ratings.forEach((r) => {
      distribution[r.rating] = r._count.rating;
    });

    // Calculate percentages
    const percentages = {
      1: total > 0 ? (distribution[1] / total) * 100 : 0,
      2: total > 0 ? (distribution[2] / total) * 100 : 0,
      3: total > 0 ? (distribution[3] / total) * 100 : 0,
      4: total > 0 ? (distribution[4] / total) * 100 : 0,
      5: total > 0 ? (distribution[5] / total) * 100 : 0,
    };

    // Get recent feedbacks
    const recentFeedback = await this.prisma.feedback.findMany({
      where,
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { fullName: true } },
      },
    });

    return {
      total,
      avgRating: avgRating._avg.rating ? Math.round(avgRating._avg.rating * 100) / 100 : 0,
      distribution,
      percentages: {
        1: Math.round(percentages[1] * 100) / 100,
        2: Math.round(percentages[2] * 100) / 100,
        3: Math.round(percentages[3] * 100) / 100,
        4: Math.round(percentages[4] * 100) / 100,
        5: Math.round(percentages[5] * 100) / 100,
      },
      recentFeedback,
    };
  }
}
