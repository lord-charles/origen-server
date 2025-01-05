import { Controller, Get, UseGuards, Req, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TransactionService } from '../services/transaction.service';

@ApiTags('Transactions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('transactions')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Get()
  @ApiOperation({
    summary: 'Get recent transactions',
    description: 'Fetches recent transactions with pagination',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number for pagination',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of items per page',
  })
  @ApiResponse({
    status: 200,
    description: 'Transactions retrieved successfully',
    schema: {
      example: {
        success: true,
        data: {
          transactions: [
            {
              id: '507f1f77bcf86cd799439011',
              type: 'MPESA_B2C',
              reason: 'Salary Payment',
              amount: 1000,
              phoneNumber: '254712345678',
              status: 'completed',
              date: '2025-01-05T10:30:00.000Z',
            },
          ],
          pagination: {
            total: 50,
            page: 1,
            limit: 10,
            totalPages: 5,
            hasNextPage: true,
            hasPreviousPage: false,
          },
        },
      },
    },
  })
  async getRecentTransactions(
    @Req() req: any,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    const userId = req.user.id;
    return this.transactionService.getRecentTransactions(userId, { page, limit });
  }
}
