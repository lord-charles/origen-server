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
import { WalletTransactionService } from '../services/wallet-transaction.service';
import {
  CreateWalletTransactionDto,
  UpdateTransactionStatusDto,
  WalletTransactionFilterDto,
} from '../dto/wallet-transaction.dto';
import { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@ApiTags('Wallet Transactions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('wallet-transactions')
export class WalletTransactionController {
  constructor(
    private readonly walletTransactionService: WalletTransactionService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new wallet transaction' })
  @ApiResponse({
    status: 201,
    description: 'Transaction created successfully',
  })
  async create(
    @Req() req: Request,
    @Body() createTransactionDto: CreateWalletTransactionDto,
  ) {
    const walletId = (req.user as any)._id;
    return this.walletTransactionService.create({
      walletId,
      createTransactionDto,
    });
  }

  @Get()
  @Roles('admin', 'hr')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get all wallet transactions with optional filters',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns all transactions matching the filters',
  })
  async findAll(@Query() filterDto: WalletTransactionFilterDto) {
    return this.walletTransactionService.findAll(filterDto);
  }

  @Get('my-transactions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all transactions for the current wallet' })
  @ApiResponse({
    status: 200,
    description: 'Returns all transactions for the current wallet',
  })
  async findMyTransactions(@Req() req: Request) {
    const walletId = (req.user as any)._id;
    return this.walletTransactionService.findByWallet(walletId);
  }

  @Get('statistics')
  @Roles('admin', 'hr')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get transaction statistics' })
  @ApiResponse({
    status: 200,
    description: 'Returns transaction statistics',
  })
  async getStatistics(@Query('walletId') walletId?: string) {
    return this.walletTransactionService.getTransactionStatistics(walletId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a specific transaction by ID' })
  @ApiParam({
    name: 'id',
    description: 'Transaction ID',
    example: '64abc123def4567890ghijk0',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns the transaction details',
  })
  @ApiResponse({
    status: 404,
    description: 'Transaction not found',
  })
  async findOne(@Param('id') id: string) {
    return this.walletTransactionService.findOne(id);
  }

  @Get('by-transaction-id/:transactionId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a specific transaction by transaction ID' })
  @ApiParam({
    name: 'transactionId',
    description: 'Transaction reference ID',
    example: 'TRX1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns the transaction details',
  })
  @ApiResponse({
    status: 404,
    description: 'Transaction not found',
  })
  async findByTransactionId(@Param('transactionId') transactionId: string) {
    return this.walletTransactionService.findByTransactionId(transactionId);
  }

  @Patch(':id/status')
  @Roles('admin', 'hr')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update transaction status' })
  @ApiParam({
    name: 'id',
    description: 'Transaction ID',
    example: '64abc123def4567890ghijk0',
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction status updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid status transition',
  })
  @ApiResponse({
    status: 404,
    description: 'Transaction not found',
  })
  async updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateTransactionStatusDto,
  ) {
    return this.walletTransactionService.updateStatus(id, updateStatusDto);
  }
}
