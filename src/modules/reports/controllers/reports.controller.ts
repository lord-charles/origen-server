import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
  Get,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ReportsService } from '../services/reports.service';
import { GenerateMonthlyReportDto } from '../dto/monthly-report.dto';
import { Response } from 'express';
import { HttpException } from '@nestjs/common';

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

  @Get('generate')
  @ApiOperation({ summary: 'Generate a report manually in the specified format' })
  @ApiQuery({
    name: 'format',
    enum: ['pdf', 'excel', 'csv'],
    description: 'The format of the report to generate',
    required: true,
  })
  @ApiResponse({ status: 200, description: 'Report generated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid format specified' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async generateReport(
    @Query('format') format: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      if (!['pdf', 'excel', 'csv'].includes(format.toLowerCase())) {
        throw new HttpException(
          'Invalid format specified. Must be one of: pdf, excel, csv',
          HttpStatus.BAD_REQUEST,
        );
      }

      const report = await this.reportsService.generateManualReport(
        format.toLowerCase() as 'pdf' | 'excel' | 'csv',
      );

      res.setHeader('Content-Type', report.contentType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${report.filename}"`,
      );
      res.send(report.buffer);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to generate report: ' + error.message,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // @Get('monthly/preview')
  // @Roles('admin', 'hr')
  // @HttpCode(HttpStatus.OK)
  // @ApiOperation({ summary: 'Preview monthly report data' })
  // @ApiResponse({
  //   status: HttpStatus.OK,
  //   description: 'Monthly report data retrieved successfully',
  // })
  // async previewMonthlyReport(@Query() dto: GenerateMonthlyReportDto) {
  //   const reportData = await this.reportsService.getMonthlyReportData();
  //   return reportData;
  // }
}
