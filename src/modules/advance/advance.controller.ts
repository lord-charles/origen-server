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
import { AdvanceService } from './advance.service';
import {
  CreateAdvanceDto,
  UpdateAdvanceStatusDto,
  AdvanceFilterDto,
} from './dto/advance.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
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
  async create(
    @Req() req: Request,
    @Body() createAdvanceDto: CreateAdvanceDto,
  ) {
    const employeeId = (req.user as any)._id;
    return this.advanceService.create(employeeId, createAdvanceDto);
  }

  @Get()
  @Roles('admin', 'hr')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all advances with optional filters' })
  @ApiResponse({
    status: 200,
    description: 'Returns all advances matching the filters',
  })
  async findAll(@Query() filterDto: AdvanceFilterDto) {
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

  @Get('statistics')
  @Roles('admin', 'hr')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get advance statistics' })
  @ApiResponse({
    status: 200,
    description: 'Returns advance statistics',
  })
  async getStatistics() {
    return this.advanceService.getAdvanceStatistics();
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a specific advance by ID' })
  @ApiParam({
    name: 'id',
    description: 'Advance ID',
    example: '64abc123def4567890ghijk0',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns the advance details',
  })
  @ApiResponse({
    status: 404,
    description: 'Advance not found',
  })
  async findOne(@Param('id') id: string) {
    return this.advanceService.findOne(id);
  }

  @Patch(':id/status')
  @Roles('admin', 'hr')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update advance status' })
  @ApiParam({
    name: 'id',
    description: 'Advance ID',
    example: '64abc123def4567890ghijk0',
  })
  @ApiResponse({
    status: 200,
    description: 'Advance status updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid status transition',
  })
  @ApiResponse({
    status: 404,
    description: 'Advance not found',
  })
  async updateStatus(
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
