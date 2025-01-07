import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MpesaService } from '../../mpesa/services/mpesa.service';
import { WalletTransactionService } from './wallet-transaction.service';
import { User, UserDocument } from '../../auth/schemas/user.schema';
import { Advance, AdvanceDocument } from '../../advance/schemas/advance.schema';
import { NotificationService } from '../../notifications/services/notification.service';
import {
  MpesaToWalletDto,
  SalaryAdvanceToWalletDto,
  WalletToMpesaDto,
  WalletToWalletDto,
} from '../dto/wallet-payment.dto';

@Injectable()
export class WalletPaymentService {
  private readonly logger = new Logger(WalletPaymentService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private mpesaService: MpesaService,
    private walletTransactionService: WalletTransactionService,
    private notificationService: NotificationService,
  ) {}

  async walletToWallet(userId: string, dto: WalletToWalletDto) {
    try {
      // Prevent self-transfer by comparing string representations
      const senderIdStr = userId.toString();
      const recipientIdStr = dto.recipientWalletId.toString();

      if (senderIdStr === recipientIdStr) {
        throw new BadRequestException(
          'Cannot transfer money to your own wallet',
        );
      }

      // Validate both wallets exist
      const [sender, recipient] = await Promise.all([
        this.userModel.findById(userId),
        this.userModel.findById(dto.recipientWalletId),
      ]);

      if (!sender || !recipient) {
        throw new NotFoundException('Sender or recipient wallet not found');
      }

      // Validate amount is positive
      if (dto.amount <= 0) {
        throw new BadRequestException('Amount must be greater than 0');
      }

      // Check if sender has sufficient balance
      if (sender.walletBalance < dto.amount) {
        throw new BadRequestException('Insufficient wallet balance');
      }

      // Create wallet transaction
      const transaction = await this.walletTransactionService.create({
        walletId: userId,
        createTransactionDto: {
          amount: dto.amount,
          description: dto.description || 'Wallet to wallet transfer',
          transactionType: 'transfer_to_wallet',
          recipientDetails: {
            recipientWalletId: new Types.ObjectId(dto.recipientWalletId),
          },
        },
      });

      // Update sender's wallet balance (subtract amount)
      const updatedSender = await this.userModel.findByIdAndUpdate(
        userId,
        { $inc: { walletBalance: -dto.amount } },
        { new: true },
      );

      // Update recipient's wallet balance (add amount)
      const updatedRecipient = await this.userModel.findByIdAndUpdate(
        dto.recipientWalletId,
        { $inc: { walletBalance: dto.amount } },
        { new: true },
      );

      // Send SMS notifications
      await this.notificationService.sendTransactionNotification(
        sender.phoneNumber,
        recipient.phoneNumber,
        dto.amount,
        'wallet transfer',
        updatedSender.walletBalance,
        updatedRecipient.walletBalance,
        `${sender.firstName} ${sender.lastName}`,
        `${recipient.firstName} ${recipient.lastName}`,
      );

      // Log the successful transaction
      this.logger.log(
        `Successful wallet transfer: ${userId} -> ${dto.recipientWalletId}, Amount: ${dto.amount}`,
      );

      return {
        status: 'success',
        message: 'Transfer completed successfully',
        data: {
          transactionId: transaction.transactionId,
          amount: dto.amount,
          description: transaction.description,
          timestamp: transaction.transactionDate,
          recipientName: `${recipient.firstName} ${recipient.lastName}`,
          senderBalance: updatedSender.walletBalance,
          recipientBalance: updatedRecipient.walletBalance,
        },
      };
    } catch (error) {
      // Log the error
      this.logger.error(
        `Failed wallet transfer: ${userId} -> ${dto.recipientWalletId}, Error: ${error.message}`,
      );

      // Rethrow the error with appropriate status
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new BadRequestException('Failed to process wallet transfer');
    }
  }

  async mpesaToWallet(userId: string, dto: MpesaToWalletDto) {
    // Validate recipient wallet exists
    const recipient = await this.userModel.findById(dto.recipientWalletId);
    if (!recipient) {
      throw new NotFoundException('Recipient wallet not found');
    }

    // Initiate C2B transaction
    const mpesaTransaction = await this.mpesaService.initiateC2B(
      {
        phoneNumber: dto.phoneNumber,
        amount: dto.amount,
        accountReference: `mpesa-to-wallet:${dto.recipientWalletId}`,
      },
      userId,
    );

    // Create wallet transaction (will be updated when mpesa callback is received)
    // await this.walletTransactionService.create({
    //   walletId: dto.recipientWalletId,
    //   createTransactionDto: {
    //     transactionType: 'receive_from_mpesa',
    //     amount: dto.amount,
    //     recipientDetails: {
    //       recipientMpesaNumber: dto.phoneNumber,
    //       recipientWalletId: new Types.ObjectId(dto.recipientWalletId),
    //     },
    //     description: `Received ${dto.amount} from ${dto.phoneNumber}`,
    //   },
    // });

    return mpesaTransaction;
  }

  async walletToMpesa(userId: string, dto: WalletToMpesaDto) {
    // Validate sender wallet exists
    const sender = await this.userModel.findById(userId);
    if (!sender) {
      throw new NotFoundException('Withdrawal wallet not found');
    }

    // Check if wallet balance is sufficient
    if (sender.walletBalance < dto.amount) {
      throw new BadRequestException('Insufficient wallet balance');
    }

    // Initiate B2C transaction
    const mpesaTransaction = await this.mpesaService.initiateB2C(
      {
        phoneNumber: dto.phoneNumber,
        amount: dto.amount,
        occasion: `Withdrawal:${userId}`,
        remarks: 'Wallet to M-Pesa Transfer',
      },
      userId,
    );

    // Deduct amount from wallet after successful transaction
    await this.userModel.findByIdAndUpdate(userId, {
      $inc: { walletBalance: -dto.amount },
    });

    // Create wallet transaction record
    await this.walletTransactionService.create({
      walletId: userId,
      createTransactionDto: {
        transactionType: 'withdrawal',
        amount: dto.amount,
        recipientDetails: {
          recipientMpesaNumber: dto.phoneNumber,
        },
        description: 'Wallet to M-Pesa Transfer',
      },
    });

    return mpesaTransaction;
  }

  // async salaryAdvanceToWallet(userId: string, dto: SalaryAdvanceToWalletDto) {
  //   // Validate employee exists
  //   const employee = await this.userModel.findById(userId);
  //   if (!employee) {
  //     throw new NotFoundException('Employee not found');
  //   }

  //   // Create advance request
  //   const advance = await this.advanceModel.create({
  //     employee: new Types.ObjectId(userId),
  //     amount: dto.amount,
  //     purpose: dto.purpose,
  //     status: 'pending',
  //   });

  //   // When advance is approved, create wallet transaction
  //   if (advance.status === 'approved') {
  //     await this.walletTransactionService.create({
  //       walletId: new Types.ObjectId(userId),
  //       amount: dto.amount,
  //       transactionType: 'receive_from_advance',
  //       advanceId: advance._id,
  //     });
  //   }

  //   return advance;
  // }
}
