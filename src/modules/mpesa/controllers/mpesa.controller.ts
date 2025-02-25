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
  ApiResponse,
  ApiHideProperty,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { MpesaService } from '../services/mpesa.service';
import { InitiateB2CDto, InitiateC2BDto } from '../dtos/mpesa.dto';
import { Public } from 'src/modules/auth/decorators/public.decorator';
import { HttpException } from '@nestjs/common';

@ApiTags('Mpesa')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payment')
export class MpesaController {
  private readonly logger = new Logger(MpesaController.name);

  constructor(private readonly mpesaService: MpesaService) {}

  @Post('initiate-c2b')
  @ApiExcludeEndpoint()
  @ApiOperation({
    summary: 'Initiate C2B Mpesa payment',
    description:
      "Initiates an STK push request to the customer's phone for payment",
  })
  @ApiResponse({
    status: 200,
    description: 'STK push initiated successfully',
    schema: {
      example: {
        success: true,
        message: 'Success. Request accepted for processing',
        data: {
          merchantRequestId: '486b-4336-91ac-cdd61fd99f3765484483',
          checkoutRequestId: 'ws_CO_05012025105205632740315545',
          responseDescription: 'Success. Request accepted for processing',
          transactionId: '65abc123def4567890ghijk0',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request',
    schema: {
      example: {
        success: false,
        message: 'Invalid phone number format',
      },
    },
  })
  async initiateC2B(@Body() dto: InitiateC2BDto, @Request() req) {
    try {
      const result = await this.mpesaService.initiateC2B(dto, req.user.id);
      return result;
    } catch (error) {
      this.logger.error('C2B initiation error:', error);
      throw new HttpException(
        {
          success: false,
          message: error.message || 'Failed to initiate payment',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('initiate-b2c')
  @ApiExcludeEndpoint()
  @ApiOperation({ summary: 'Initiate B2C Mpesa payment' })
  async initiateB2C(@Body() dto: InitiateB2CDto, @Request() req) {
    return this.mpesaService.initiateB2C(dto, req.user.id);
  }

  @Public()
  @Post('callback')
  @ApiExcludeEndpoint()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mpesa callback endpoint',
    description: 'Handles callbacks from Mpesa for STK push completion',
  })
  @ApiResponse({
    status: 200,
    description: 'Callback processed successfully',
    schema: {
      example: {
        success: true,
        message: 'Callback processed successfully',
        data: {
          transactionId: '65abc123def4567890ghijk0',
          status: 'completed',
          mpesaReceiptNumber: 'PLJ3RK6TO2',
        },
      },
    },
  })
  async handleCallback(@Body() callbackData: any) {
    try {
      const result = await this.mpesaService.handleCallback(callbackData);
      return result;
    } catch (error) {
      this.logger.error('Callback processing error:', error);
      throw new HttpException(
        {
          success: false,
          message: error.message || 'Failed to process callback',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
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
  @ApiExcludeEndpoint()
  @ApiOperation({ summary: 'Check Mpesa account balance' })
  async checkBalance() {
    return this.mpesaService.checkAccountBalance();
  }

  @Public()
  @Post('balance/callback')
  @ApiExcludeEndpoint()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mpesa balance callback endpoint',
    description: 'Handles callbacks from Mpesa for account balance queries',
  })
  @ApiResponse({
    status: 200,
    description: 'Balance callback processed successfully',
    schema: {
      example: {
        success: true,
        message: 'Balance updated successfully',
        data: {
          working: {
            balance: 1000.0,
            currency: 'KES',
            lastUpdated: '2025-02-23T16:33:17.000Z',
          },
          utility: {
            balance: 1246.5,
            currency: 'KES',
            lastUpdated: '2025-02-23T16:33:17.000Z',
          },
        },
      },
    },
  })
  async handleBalanceCallback(@Body() callbackData: any) {
    return this.mpesaService.handleBalanceCallback(callbackData);
  }

  @Get('balance/current')
  @ApiOperation({ summary: 'Get current Mpesa account balances' })
  @ApiResponse({
    status: 200,
    description: 'Current balance retrieved successfully',
    schema: {
      example: {
        success: true,
        message: 'Balance retrieved successfully',
        data: {
          working: {
            balance: 1000.0,
            currency: 'KES',
            lastUpdated: '2025-02-23T16:33:17.000Z',
          },
          utility: {
            balance: 1246.5,
            currency: 'KES',
            lastUpdated: '2025-02-23T16:33:17.000Z',
          },
        },
      },
    },
  })
  async getCurrentBalance() {
    return this.mpesaService.getCurrentBalance();
  }
}
