import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ForecastService } from './forecast.service';
import { ForecastQueryDto } from './dto/forecast-query.dto';

@Controller('forecast')
@UseGuards(JwtAuthGuard)
export class ForecastController {
  constructor(private readonly forecastService: ForecastService) {}

  @Get('demand')
  getDemandForecast(@Query() query: ForecastQueryDto) {
    return this.forecastService.getDemandForecast(
      query.branchId,
      query.productId,
      query.days || 30,
    );
  }

  @Get('inventory-needs')
  getInventoryNeeds(@Query() query: ForecastQueryDto) {
    return this.forecastService.getInventoryNeeds(query.branchId, query.days || 30);
  }

  @Get('seasonal-trends')
  getSeasonalTrends(@Query() query: ForecastQueryDto) {
    return this.forecastService.getSeasonalTrends(query.branchId, query.productId);
  }

  @Get('reorder-recommendations')
  getReorderRecommendations(@Query() query: ForecastQueryDto) {
    return this.forecastService.getReorderRecommendations(query.branchId);
  }
}
