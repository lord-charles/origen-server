import { Body, Controller, Get, Post, UseGuards, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdvancePaymentService } from '../services/advance-payment.service';
import {
  AdvanceToMpesaDto,
  CheckApprovedAdvanceAmountResponseDto,
} from '../dto/advance-to-mpesa.dto';
import { AdvanceRepaymentDto } from '../dto/advance-repayment.dto';
import { Request } from 'express';
import { User } from '../../auth/schemas/user.schema';

interface AuthenticatedRequest extends Request {
  user: User & { id: string };
}

@ApiTags('Advance Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('advance-payments')
export class AdvancePaymentController {
  constructor(private readonly advancePaymentService: AdvancePaymentService) {}

  @Get('check-approved-amount')
  @ApiOperation({
    summary: 'Check approved advance amount',
    description:
      'Returns the total approved, withdrawn and available advance amounts',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns advance amount details',
    type: CheckApprovedAdvanceAmountResponseDto,
  })
  async checkApprovedAmount(@Req() req: AuthenticatedRequest) {
    return this.advancePaymentService.checkApprovedAdvanceAmount(req.user?.id);
  }

  @Post('withdraw')
  @ApiOperation({
    summary: 'Withdraw approved advance to M-Pesa',

    description: 'Initiates an M-Pesa transfer for the approved advance amount',
  })
  @ApiResponse({
    status: 200,
    description: 'M-Pesa transfer initiated successfully',
  })
  async withdrawToMpesa(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdvanceToMpesaDto,
  ) {
    return this.advancePaymentService.advanceToMpesa(req.user.id, dto, req);
  }

  @Post('mpesa/repay')
  @ApiOperation({ summary: 'Repay advance via M-PESA' })
  async repayAdvanceViaMpesa(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdvanceRepaymentDto,
  ) {
    return this.advancePaymentService.initiateAdvanceRepayment(
      req.user.id,
      dto,
      req,
    );
  }
}
