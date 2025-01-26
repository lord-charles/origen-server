import {
  Controller,
  Get,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { StatisticsService } from '../services/statistics.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@ApiTags('Statistics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('statistics')
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('dashboard')
  @HttpCode(HttpStatus.OK)
  @Roles('admin', 'hr', 'finance')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Returns dashboard statistics including employee and advance metrics',
  })
  async getDashboardStatistics() {
    return this.statisticsService.getDashboardStatistics();
  }

  @Get('overview-charts')
  @ApiOperation({ summary: 'Get overview charts data for the last 30 days' })
  @ApiResponse({
    status: 200,
    description: 'Returns line chart data for daily applications and pie chart data for status distribution',
    schema: {
      example: {
        lineChart: [
          {
            date: '2024-12-10',
            applications: 19
          }
        ],
        pieChart: [
          {
            name: 'Pending',
            value: 203
          }
        ]
      }
    }
  })
  async getOverviewCharts() {
    return this.statisticsService.getOverviewCharts();
  }

  @Get('detailed-stats')
  @ApiOperation({ summary: 'Get detailed statistics including totals and payment methods' })
  @ApiResponse({
    status: 200,
    description: 'Returns total amounts and payment method distribution',
    schema: {
      example: {
        totals: {
          totalAdvanceAmount: 1000000,
          totalRepaidAmount: 500000
        },
        paymentMethods: [
          {
            name: 'Mpesa',
            value: 330
          },
          {
            name: 'Bank Transfer',
            value: 340
          },
          {
            name: 'Cash',
            value: 330
          }
        ]
      }
    }
  })
  async getDetailedStats() {
    return this.statisticsService.getDetailedStats();
  }

  @Get('monthly-trends')
  @ApiOperation({ summary: 'Get monthly trends for advances' })
  @ApiQuery({
    name: 'months',
    required: false,
    type: Number,
    description: 'Number of months to retrieve (6 or 12). Defaults to 6.'
  })
  @ApiResponse({
    status: 200,
    description: 'Returns monthly trends data including total requests, approved requests, and approval rate',
    schema: {
      example: [
        {
          date: '2024-08-08',
          totalRequests: 323,
          approvedRequests: 199,
          approvalRate: 62
        }
      ]
    }
  })
  async getMonthlyTrends(@Query('months') months?: number) {
    // Validate months parameter
    const validMonths = months === 12 ? 12 : 6;
    return this.statisticsService.getMonthlyTrends(validMonths);
  }

  @Get('recent-advance-stats')
  @ApiOperation({ summary: 'Get recent advance statistics for dashboard cards' })
  @ApiResponse({
    status: 200,
    description: 'Returns statistics for total requested amount, approved amount, pending requests, and unique requesters',
    schema: {
      example: {
        totalRequested: {
          amount: 6162069,
          period: 'For January 2025'
        },
        approvedAmount: {
          amount: 1335062,
          period: 'For January 2025'
        },
        pendingRequests: {
          count: 203,
          description: 'Awaiting approval'
        },
        uniqueRequesters: {
          count: 636,
          description: 'Unique requesters'
        }
      }
    }
  })
  async getRecentAdvanceStats() {
    return this.statisticsService.getRecentAdvanceStatCards();
  }
}
