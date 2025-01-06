import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import {
  MpesaToWalletDto,
  SalaryAdvanceToWalletDto,
  WalletToMpesaDto,
  WalletToWalletDto,
} from '../dto/wallet-payment.dto';
import { WalletPaymentService } from '../services/wallet-payment.service';

@ApiTags('Wallet Payments')
@Controller('wallet-payments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WalletPaymentController {
  constructor(private readonly walletPaymentService: WalletPaymentService) {}

  @Post('wallet-to-wallet')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Transfer money from one wallet to another' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Transfer successful',
  })
  async walletToWallet(@Request() req, @Body() dto: WalletToWalletDto) {
    return this.walletPaymentService.walletToWallet(req.user._id, dto);
  }

  @Post('mpesa-to-wallet')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Transfer money from M-PESA to wallet' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'M-PESA transaction initiated',
  })
  async mpesaToWallet(@Request() req, @Body() dto: MpesaToWalletDto) {
    return this.walletPaymentService.mpesaToWallet(req.user._id, dto);
  }

  @Post('wallet-to-mpesa')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Transfer money from wallet to M-PESA' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'M-PESA transaction initiated',
  })
  async walletToMpesa(@Request() req, @Body() dto: WalletToMpesaDto) {
    return this.walletPaymentService.walletToMpesa(req.user._id, dto);
  }

  // @Post('salary-advance')
  // @HttpCode(HttpStatus.CREATED)
  // @ApiOperation({ summary: 'Request salary advance to wallet' })
  // @ApiResponse({
  //   status: HttpStatus.CREATED,
  //   description: 'Advance request created',
  // })
  // async salaryAdvanceToWallet(
  //   @Request() req,
  //   @Body() dto: SalaryAdvanceToWalletDto,
  // ) {
  //   return this.walletPaymentService.salaryAdvanceToWallet(req.user._id, dto);
  // }
}
