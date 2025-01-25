import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MpesaService } from '../../mpesa/services/mpesa.service';
import { WalletTransactionService } from '../../wallet/services/wallet-transaction.service';
import { NotificationService } from '../../notifications/services/notification.service';
import { Advance, AdvanceDocument } from '../schemas/advance.schema';
import {
  AdvanceToMpesaDto,
  CheckApprovedAdvanceAmountResponseDto,
} from '../dto/advance-to-mpesa.dto';
import { AdvanceRepaymentDto } from '../dto/advance-repayment.dto';

@Injectable()
export class AdvancePaymentService {
  private readonly logger = new Logger(AdvancePaymentService.name);

  constructor(
    @InjectModel(Advance.name)
    private readonly advanceModel: Model<AdvanceDocument>,
    private mpesaService: MpesaService,
    private walletTransactionService: WalletTransactionService,
    private notificationService: NotificationService,
  ) {}

  async checkApprovedAdvanceAmount(
    employeeId: string,
  ): Promise<CheckApprovedAdvanceAmountResponseDto> {
    // Get all approved advances for the employee
    const approvedAdvances = await this.advanceModel.find({
      employee: new Types.ObjectId(employeeId),
      status: 'disbursed',
    });

    if (!approvedAdvances || approvedAdvances.length === 0) {
      return {
        approvedAmount: 0,
        withdrawnAmount: 0,
        availableAmount: 0,
      };
    }

    // Calculate total approved amount
    const totalApprovedAmount = approvedAdvances.reduce(
      (sum, advance) => sum + advance.amount,
      0,
    );

    // Calculate total withdrawn amount
    const totalWithdrawnAmount = approvedAdvances.reduce(
      (sum, advance) => sum + (advance.amountWithdrawn || 0),
      0,
    );

    // Calculate available amount
    const availableAmount = totalApprovedAmount - totalWithdrawnAmount;

    return {
      approvedAmount: totalApprovedAmount,
      withdrawnAmount: totalWithdrawnAmount,
      availableAmount,
    };
  }

  async advanceToMpesa(employeeId: string, dto: AdvanceToMpesaDto) {
    // Check available advance amount
    const { availableAmount } =
      await this.checkApprovedAdvanceAmount(employeeId);

    // Validate withdrawal amount
    if (dto.amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    if (dto.amount > availableAmount) {
      throw new BadRequestException(
        `Insufficient approved advance balance. Available amount: ${availableAmount}`,
      );
    }

    // Get approved advances ordered by approval date
    const approvedAdvances = await this.advanceModel
      .find({
        employee: new Types.ObjectId(employeeId),
        status: 'disbursed',
      })
      .sort({ approvedDate: 1 });

    if (!approvedAdvances || approvedAdvances.length === 0) {
      throw new NotFoundException('No disbursed advances found');
    }

    // Initiate B2C transaction
    const mpesaTransaction = await this.mpesaService.initiateB2C(
      {
        phoneNumber: dto.phoneNumber,
        amount: dto.amount,
        occasion: `advance:${employeeId}`,
        remarks: 'Advance to M-Pesa Transfer',
      },
      employeeId,
    );

    // Update advance records with withdrawn amounts
    let remainingAmount = dto.amount;
    for (const advance of approvedAdvances) {
      const availableInAdvance =
        advance.amount - (advance.amountWithdrawn || 0);
      if (availableInAdvance > 0) {
        const amountToWithdraw = Math.min(remainingAmount, availableInAdvance);
        await this.advanceModel.findByIdAndUpdate(advance._id, {
          $inc: { amountWithdrawn: amountToWithdraw },
          $set: {
            lastWithdrawalDate: new Date(),
            status:
              amountToWithdraw === availableInAdvance
                ? 'repaying'
                : 'disbursed',
          },
        });
        remainingAmount -= amountToWithdraw;
        if (remainingAmount === 0) break;
      }
    }

    // Create wallet transaction record
    await this.walletTransactionService.create({
      walletId: employeeId,
      createTransactionDto: {
        transactionType: 'receive_from_advance',
        amount: dto.amount,
        recipientDetails: {
          recipientMpesaNumber: dto.phoneNumber,
        },
        description: 'Advance to M-Pesa Transfer',
      },
    });

    // Calculate remaining available advance after this withdrawal
    const { availableAmount: remainingAdvance } =
      await this.checkApprovedAdvanceAmount(employeeId);

    // Send notification
    await this.notificationService.sendSMS(
      dto.phoneNumber,
      `Your advance withdrawal of KES ${dto.amount.toLocaleString()} has been processed and sent to your M-PESA. Remaining advance balance: KES ${remainingAdvance.toLocaleString()}. Thank you for using Innova Services.`,
    );

    return mpesaTransaction;
  }

  async initiateAdvanceRepayment(employeeId: string, dto: AdvanceRepaymentDto) {
    // Get all advances that need repayment
    const allAdvances = await this.advanceModel
      .find({
        employee: new Types.ObjectId(employeeId),
        status: { $in: ['disbursed', 'repaying'] },
      })
      .sort({ approvedDate: 1 });

    if (!allAdvances || allAdvances.length === 0) {
      throw new NotFoundException('No advances found that require repayment');
    }

    // Filter advances that still need repayment
    const repayableAdvances = allAdvances.filter(
      (advance) => advance.amountRepaid < advance.totalRepayment,
    );

    if (repayableAdvances.length === 0) {
      throw new NotFoundException('No advances found that require repayment');
    }

    // Calculate total amount due
    const totalAmountDue = repayableAdvances.reduce((total, advance) => {
      const remainingAmount =
        advance.totalRepayment - (advance.amountRepaid || 0);
      return total + remainingAmount;
    }, 0);

    // Validate repayment amount
    if (dto.amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    if (dto.amount > totalAmountDue) {
      throw new BadRequestException(
        `Repayment amount (${dto.amount}) exceeds total amount due (${totalAmountDue})`,
      );
    }

    // Initiate STK Push for M-PESA payment
    const stkPushResult = await this.mpesaService.initiateC2B(
      {
        phoneNumber: dto.phoneNumber,
        amount: dto.amount,
        accountReference: `repay_advance:${employeeId}`,
      },
      employeeId,
    );

    return stkPushResult;
  }
}
