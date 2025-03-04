import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { MpesaAuditService } from '../services/mpesa-audit.service';

@ApiTags('Mpesa Audit')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('mpesa-audit')
export class MpesaAuditController {
  constructor(private readonly mpesaAuditService: MpesaAuditService) {}

  @Get()
  @ApiOperation({
    summary: 'Get Mpesa B2C transaction audit',
    description: 'Retrieves detailed audit information for B2C transactions including balance tracking',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Start date for filtering (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'End date for filtering (YYYY-MM-DD)',
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
    description: 'Transaction audit data retrieved successfully',
    schema: {
      example: {
        success: true,
        data: {
          transactions: [
            {
              transactionId: 'AG_20250105_20104721eade46fcb49e',
              mpesaReceiptNumber: 'TA5427N67O',
              transactionDate: '2025-01-05T09:55:30.700Z',
              amount: 10,
              balanceBeforeTransaction: 54575,
              balanceAfterTransaction: 54565,
              recipientDetails: {
                name: 'Charles Mihunyo Mwaniki',
                phoneNumber: '254740315545',
              },
              employee: {
                email: 'employee@example.com',
                nationalId: '12345678',
              }
            }
          ],
          pagination: {
            total: 50,
            page: 1,
            limit: 10,
            totalPages: 5,
          },
        },
      },
    },
  })
  async getTransactionAudit(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 5000,
  ) {
    return this.mpesaAuditService.getTransactionAudit({
      startDate,
      endDate,
      page,
      limit,
    });
  }
}
