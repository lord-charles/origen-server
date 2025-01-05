import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { SystemConfigService } from '../services/system-config.service';
import {
  CreateSystemConfigDto,
  UpdateSystemConfigDto,
} from '../dto/system-config.dto';

@ApiTags('System Configuration')
@Controller('system-config')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SystemConfigController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  @Post()
  @Roles('admin', 'hr')
  @ApiOperation({ summary: 'Create a new system configuration' })
  create(@Body() createDto: CreateSystemConfigDto, @Req() req) {
    return this.systemConfigService.create(createDto, req.user.id);
  }

  @Get()
  @Roles('admin', 'hr')
  @ApiOperation({ summary: 'Get all system configurations' })
  findAll() {
    return this.systemConfigService.findAll();
  }

  @Get('key/:key')
  @Roles('admin', 'hr')
  @ApiOperation({ summary: 'Get configuration by key' })
  findByKey(@Param('key') key: string) {
    return this.systemConfigService.findByKey(key);
  }

  @Get('type/:type')
  @Roles('admin', 'hr')
  @ApiOperation({ summary: 'Get configurations by type' })
  findByType(@Param('type') type: string) {
    return this.systemConfigService.findByType(type);
  }

  @Patch(':key')
  @Roles('admin', 'hr')
  @ApiOperation({ summary: 'Update configuration by key' })
  update(
    @Param('key') key: string,
    @Body() updateDto: UpdateSystemConfigDto,
    @Req() req,
  ) {
    return this.systemConfigService.update(key, updateDto, req.user.id);
  }

  @Delete(':key')
  @Roles('admin', 'hr')
  @ApiOperation({ summary: 'Delete configuration by key' })
  remove(@Param('key') key: string) {
    return this.systemConfigService.remove(key);
  }

  // Convenience endpoints for specific configurations
  @Get('loan/config')
  @ApiOperation({ summary: 'Get loan configuration' })
  getLoanConfig() {
    return this.systemConfigService.getLoanConfig();
  }

  @Get('advance/config')
  @ApiOperation({ summary: 'Get advance configuration' })
  getAdvanceConfig() {
    return this.systemConfigService.getAdvanceConfig();
  }

  @Get('wallet/config')
  @ApiOperation({ summary: 'Get wallet configuration' })
  getWalletConfig() {
    return this.systemConfigService.getWalletConfig();
  }

  @Get('mpesa/config')
  @Roles('admin', 'hr')
  @ApiOperation({ summary: 'Get M-Pesa configuration' })
  getMpesaConfig() {
    return this.systemConfigService.getMpesaConfig();
  }
}
