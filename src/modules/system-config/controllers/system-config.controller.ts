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
  Delete,
  Put,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { SystemConfigService } from '../services/system-config.service';
import {
  CreateSystemConfigDto,
  UpdateSystemConfigDto,
} from '../dto/system-config.dto';
import {
  AddSuspensionPeriodDto,
} from '../dto/suspension-period.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Request } from 'express';
import { UpdateSuspensionPeriodDto } from '../dto/update-suspension-period.dto';

@ApiTags('System Configuration')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('system-config')
export class SystemConfigController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  @Post()
  @Roles('admin', 'hr')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new system configuration' })
  @ApiResponse({
    status: 201,
    description: 'System configuration created successfully',
  })
  create(@Body() createDto: CreateSystemConfigDto, @Req() req: Request) {
    const userId = (req.user as any)._id;
    return this.systemConfigService.create(createDto, userId);
  }

  @Get()
  @Roles('admin', 'hr')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all system configurations' })
  @ApiResponse({
    status: 200,
    description: 'Returns all system configurations',
  })
  findAll() {
    return this.systemConfigService.findAll();
  }

  @Get('key/:key')
  @Roles('admin', 'hr')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get configuration by key' })
  @ApiResponse({
    status: 200,
    description: 'Returns configuration by key',
  })
  findByKey(@Param('key') key: string) {
    return this.systemConfigService.findByKey(key);
  }

  @Get('type/:type')
  @Roles('admin', 'hr')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get configurations by type' })
  @ApiResponse({
    status: 200,
    description: 'Returns configurations by type',
  })
  findByType(@Param('type') type: string) {
    return this.systemConfigService.findByType(type);
  }

  @Patch(':key')
  @Roles('admin', 'hr')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update configuration by key' })
  @ApiResponse({
    status: 200,
    description: 'Configuration updated successfully',
  })
  update(
    @Param('key') key: string,
    @Body() updateDto: UpdateSystemConfigDto,
    @Req() req: Request,
  ) {
    const userId = (req.user as any)._id;
    return this.systemConfigService.update(key, updateDto, userId);
  }

  @Delete(':key')
  @Roles('admin', 'hr')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete configuration by key' })
  @ApiResponse({
    status: 200,
    description: 'Configuration deleted successfully',
  })
  remove(@Param('key') key: string) {
    return this.systemConfigService.remove(key);
  }

  @Get('loan/config')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get loan configuration' })
  @ApiResponse({
    status: 200,
    description: 'Returns loan configuration',
  })
  getLoanConfig() {
    return this.systemConfigService.getLoanConfig();
  }

  @Get('advance/config')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get advance configuration' })
  @ApiResponse({
    status: 200,
    description: 'Returns advance configuration',
  })
  getAdvanceConfig() {
    return this.systemConfigService.getAdvanceConfig();
  }

  @Get('wallet/config')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get wallet configuration' })
  @ApiResponse({
    status: 200,
    description: 'Returns wallet configuration',
  })
  getWalletConfig() {
    return this.systemConfigService.getWalletConfig();
  }

  @Get('mpesa/config')
  @Roles('admin', 'hr')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get M-Pesa configuration' })
  @ApiResponse({
    status: 200,
    description: 'Returns M-Pesa configuration',
  })
  getMpesaConfig() {
    return this.systemConfigService.getMpesaConfig();
  }

  @Post(':key/suspension-periods')
  @Roles('admin', 'hr')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a new suspension period to a configuration' })
  @ApiParam({
    name: 'key',
    description: 'Configuration key (e.g., advance_config)',
  })
  @ApiResponse({
    status: 201,
    description: 'Suspension period added successfully',
  })
  addSuspensionPeriod(
    @Param('key') key: string,
    @Body() addDto: AddSuspensionPeriodDto,
    @Req() req: Request,
  ) {
    const userId = (req.user as any)._id;
    return this.systemConfigService.addSuspensionPeriod(key, addDto, userId);
  }

  @Patch(':key/suspension-periods/:id')
  @Roles('admin', 'hr')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update an existing suspension period' })
  @ApiParam({
    name: 'key',
    description: 'Configuration key (e.g., advance_config)',
  })
  @ApiParam({
    name: 'id',
    description: 'ID of the suspension period to update',
  })
  @ApiResponse({
    status: 200,
    description: 'Suspension period updated successfully',
  })
  updateSuspensionPeriod(
    @Param('key') key: string,
    @Param('id') id: string,
    @Body() updateDto: UpdateSuspensionPeriodDto,
    @Req() req: Request,
  ) {
    const userId = (req.user as any)._id;
    updateDto.id = id;
    return this.systemConfigService.updateSuspensionPeriod(key, updateDto, userId);
  }

  @Patch(':key/suspension-periods/:index/toggle')
  @Roles('admin', 'hr')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Toggle a suspension period active/inactive' })
  @ApiParam({
    name: 'key',
    description: 'Configuration key (e.g., advance_config)',
  })
  @ApiParam({
    name: 'index',
    description: 'Index of the suspension period to toggle',
  })
  @ApiResponse({
    status: 200,
    description: 'Suspension period toggled successfully',
  })
  toggleSuspensionPeriod(
    @Param('key') key: string,
    @Param('index') index: string,
    @Body('isActive') isActive: boolean,
    @Req() req: Request,
  ) {
    const userId = (req.user as any)._id;
    return this.systemConfigService.toggleSuspensionPeriod(
      key,
      parseInt(index, 10),
      isActive,
      userId,
    );
  }
}
