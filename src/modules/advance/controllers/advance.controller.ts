import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Patch,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { AdvanceService } from '../services/advance.service';
import {
  CreateAdvanceDto,
  UpdateAdvanceStatusDto,
  AdvanceFilterDto,
} from '../dto/advance.dto';
import {
  AdvanceCalculationResponseDto,
  MonthlyAdvanceSummaryDto,
} from '../dto/advance-calculation.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Request } from 'express';

@ApiTags('Advances')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('advances')
export class AdvanceController {
  constructor(private readonly advanceService: AdvanceService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new advance request' })
  @ApiResponse({
    status: 201,
    description: 'Advance request created successfully',
  })
  create(@Body() createAdvanceDto: CreateAdvanceDto, @Req() req: any) {
    const employeeId = (req.user as any)._id;
    return this.advanceService.create(employeeId, createAdvanceDto);
  }

  @Get()
  @Roles('admin', 'hr')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all advance requests' })
  @ApiResponse({
    status: 200,
    description: 'Returns all advance requests',
  })
  findAll(@Query() filterDto: AdvanceFilterDto) {
    return this.advanceService.findAll(filterDto);
  }

  @Get('my-advances')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all advances for the current employee' })
  @ApiResponse({
    status: 200,
    description: 'Returns all advances for the current employee',
  })
  async findMyAdvances(@Req() req: Request) {
    const employeeId = (req.user as any)._id;
    return this.advanceService.findByEmployee(employeeId);
  }

  @Get('summary/current')
  @ApiOperation({
    summary: 'Get available advance amount for the current employee',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns the available advance amount and related details',
    type: AdvanceCalculationResponseDto,
  })
  async getCurrentAdvanceSummary(
    @Req() req: any,
  ): Promise<AdvanceCalculationResponseDto> {
    const employeeId = (req.user as any)._id;
    return this.advanceService.calculateAvailableAdvance(employeeId);
  }

  @Get('summary/monthly/:year/:month')
  @ApiOperation({ summary: 'Get monthly advance summary' })
  @ApiResponse({
    status: 200,
    description: 'Returns the monthly advance summary',
    type: MonthlyAdvanceSummaryDto,
  })
  async getMonthlyAdvanceSummary(
    @Req() req: any,
    @Param('year') year: number,
    @Param('month') month: number,
  ): Promise<MonthlyAdvanceSummaryDto> {
    const employeeId = (req.user as any)._id;
    return this.advanceService.getMonthlyAdvanceSummary(
      employeeId,
      month,
      year,
    );
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a specific advance request' })
  @ApiParam({
    name: 'id',
    description: 'Advance ID',
    example: '64abc123def4567890ghijk0',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns the advance request',
  })
  @ApiResponse({
    status: 404,
    description: 'Advance not found',
  })
  findOne(@Param('id') id: string) {
    return this.advanceService.findOne(id);
  }

  @Patch(':id/status')
  @Roles('admin', 'hr')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update advance request status' })
  @ApiParam({
    name: 'id',
    description: 'Advance ID',
    example: '64abc123def4567890ghijk0',
  })
  @ApiResponse({
    status: 200,
    description: 'Advance request status updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid status transition',
  })
  @ApiResponse({
    status: 404,
    description: 'Advance not found',
  })
  updateStatus(
    @Param('id') id: string,
    @Body() updateAdvanceStatusDto: UpdateAdvanceStatusDto,
    @Req() req: Request,
  ) {
    const adminId = (req.user as any)._id;
    return this.advanceService.updateStatus(
      id,
      adminId,
      updateAdvanceStatusDto,
    );
  }
}
