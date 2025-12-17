import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LoyaltyService } from './loyalty.service';
import { AddPointsDto } from './dto/add-points.dto';
import { RedeemPointsDto } from './dto/redeem-points.dto';
import { CreateRewardDto } from './dto/create-reward.dto';

@Controller('loyalty')
@UseGuards(JwtAuthGuard)
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  // Points management
  @Post('points')
  addPointsAlt(@Body() addPointsDto: AddPointsDto) {
    return this.loyaltyService.addPoints(addPointsDto);
  }

  @Post('points/add')
  addPoints(@Body() addPointsDto: AddPointsDto) {
    return this.loyaltyService.addPoints(addPointsDto);
  }

  @Post('points/redeem')
  redeemPoints(@Body() redeemPointsDto: RedeemPointsDto) {
    return this.loyaltyService.redeemPoints(redeemPointsDto);
  }

  @Get('points/:customerId')
  getCustomerPoints(@Param('customerId') customerId: string) {
    return this.loyaltyService.getCustomerPoints(customerId);
  }

  @Get('history/:customerId')
  getPointsHistory(@Param('customerId') customerId: string) {
    return this.loyaltyService.getPointsHistory(customerId);
  }

  // Rewards management
  @Post('rewards')
  createReward(@Body() createRewardDto: CreateRewardDto) {
    return this.loyaltyService.createReward(createRewardDto);
  }

  @Get('rewards')
  getAllRewards(@Query('available') available?: string) {
    return this.loyaltyService.getAllRewards(available === 'true');
  }

  @Get('rewards/:id')
  getReward(@Param('id') id: string) {
    return this.loyaltyService.getReward(id);
  }

  @Put('rewards/:id')
  updateReward(@Param('id') id: string, @Body() updateRewardDto: CreateRewardDto) {
    return this.loyaltyService.updateReward(id, updateRewardDto);
  }

  @Delete('rewards/:id')
  deleteReward(@Param('id') id: string) {
    return this.loyaltyService.deleteReward(id);
  }

  // Statistics
  @Get('stats/top-customers')
  getTopCustomers(@Query('limit') limit?: string) {
    return this.loyaltyService.getTopCustomers(parseInt(limit || '10'));
  }

  @Get('stats/overview')
  getLoyaltyOverview() {
    return this.loyaltyService.getLoyaltyOverview();
  }
}
