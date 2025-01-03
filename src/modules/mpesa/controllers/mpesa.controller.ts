import {
  Body,
  Controller,
  Post,
  UseGuards,
  Request,
  Get,
  Query,
  Param,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { MpesaService } from '../services/mpesa.service';
import { InitiateB2CDto, InitiateC2BDto } from '../dtos/mpesa.dto';
import { Public } from 'src/modules/auth/decorators/public.decorator';

@ApiTags('Mpesa')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payment')
export class MpesaController {
  private readonly logger = new Logger(MpesaController.name);

  constructor(private readonly mpesaService: MpesaService) {}

  @Post('initiate-c2b')
  @ApiOperation({ summary: 'Initiate C2B Mpesa payment' })
  async initiateC2B(@Body() dto: InitiateC2BDto, @Request() req) {
    return this.mpesaService.initiateC2B(dto, req.user.id);
  }

  @Post('initiate-b2c')
  @ApiOperation({ summary: 'Initiate B2C Mpesa payment' })
  async initiateB2C(@Body() dto: InitiateB2CDto, @Request() req) {
    return this.mpesaService.initiateB2C(dto, req.user.id);
  }

  @Public()
  @Post('callback')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Mpesa callback endpoint - Called by Mpesa servers',
  })
  async handleCallback(@Body() payload: any) {
    this.logger.log(
      'Received Mpesa callback payload:',
      JSON.stringify(payload, null, 2),
    );
    return this.mpesaService.handleCallback(payload);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Get Mpesa transactions' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'transactionType', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async getTransactions(
    @Request() req,
    @Query('status') status?: string,
    @Query('transactionType') transactionType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.mpesaService.getTransactions(
      req.user.id,
      status,
      transactionType,
      startDate,
      endDate,
    );
  }

  @Get('transaction/:id')
  @ApiOperation({ summary: 'Get Mpesa transaction by ID' })
  async getTransactionById(@Param('id') id: string, @Request() req) {
    return this.mpesaService.getTransactionById(id, req.user.id);
  }

  @Get('balance')
  @ApiOperation({ summary: 'Check Mpesa account balance' })
  async checkBalance(@Request() req) {
    return this.mpesaService.checkAccountBalance(req.user.id);
  }
}
