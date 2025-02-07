import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
  Get,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ReportsService } from '../services/reports.service';
import { GenerateMonthlyReportDto } from '../dto/monthly-report.dto';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post('monthly/generate')
  @Roles('admin', 'hr')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate monthly advance report' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Report generated and sent successfully',
  })
  async generateMonthlyReport(@Body() dto: GenerateMonthlyReportDto) {
    await this.reportsService.generateAndSendMonthlyReport();
    return { message: 'Monthly report generated and sent successfully' };
  }

  @Get('monthly/preview')
  @Roles('admin', 'hr')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Preview monthly report data' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Monthly report data retrieved successfully',
  })
  async previewMonthlyReport(@Query() dto: GenerateMonthlyReportDto) {
    const reportData = await this.reportsService.getMonthlyReportData();
    return reportData;
  }
}
