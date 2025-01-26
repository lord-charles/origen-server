import {
  Controller,
  Get,
  Query,
  UseGuards,
  ParseIntPipe,
  ParseEnumPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { SystemLogsService } from '../services/system-logs.service';
import { LogSeverity } from '../schemas/system-log.schema';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('System Logs')
@Controller('system-logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class SystemLogsController {
  constructor(private readonly systemLogsService: SystemLogsService) {}

  @Get()
  @ApiOperation({ summary: 'Get system logs with pagination and filters' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'severity', required: false, enum: LogSeverity })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated system logs',
  })
  async getLogs(
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 10,
    @Query('severity', new ParseEnumPipe(LogSeverity, { optional: true }))
    severity?: LogSeverity,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.systemLogsService.getLogs(
      page,
      limit,
      severity,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }
}
