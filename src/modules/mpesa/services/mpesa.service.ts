import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import {
  MpesaTransaction,
  MpesaTransactionDocument,
} from '../schemas/mpesa.schema';
import { InitiateB2CDto, InitiateC2BDto } from '../dtos/mpesa.dto';
import { User, UserDocument } from 'src/modules/auth/schemas/user.schema';
import { HttpException, HttpStatus } from '@nestjs/common';
import { Types } from 'mongoose';
import { WalletTransactionService } from 'src/modules/wallet/services/wallet-transaction.service';
import { NotificationService } from 'src/modules/notifications/services/notification.service';
import {
  Advance,
  AdvanceDocument,
} from 'src/modules/advance/schemas/advance.schema';
import { SystemConfig, SystemConfigDocument } from 'src/modules/system-config/schemas/system-config.schema';

@Injectable()
export class MpesaService {
  private readonly logger = new Logger(MpesaService.name);
  private readonly baseUrl: string;
  private readonly consumerKey: string;
  private readonly consumerSecret: string;
  private readonly shortCode: string;
  private readonly initiatorName: string;
  private readonly initiatorPassword: string;
  private readonly passKey: string;
  private readonly MPESA_CALLBACK_URL: string;
  private readonly MPESA_STATIC_PASSWORD: string;
  private readonly MPESA_STATIC_TIMESTAMP: string;
  private readonly MPESA_SECURITY_CREDENTIAL: string;

  constructor(
    @InjectModel(MpesaTransaction.name)
    private mpesaModel: Model<MpesaTransactionDocument>,
    @InjectModel(User.name)
    private employeeModel: Model<UserDocument>,
    @InjectModel(Advance.name)
    private advanceModel: Model<AdvanceDocument>,
    @InjectModel(SystemConfig.name)
    private systemConfigModel: Model<SystemConfigDocument>,
    private walletTransactionService: WalletTransactionService,
    private notificationService: NotificationService,
    private configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('MPESA_BASE_URL');
    this.consumerKey = this.configService.get<string>('MPESA_CONSUMER_KEY');
    this.consumerSecret = this.configService.get<string>(
      'MPESA_CONSUMER_SECRET',
    );
    this.shortCode = this.configService.get<string>('MPESA_SHORTCODE');
    this.initiatorName = this.configService.get<string>('MPESA_INITIATOR_NAME');
    this.initiatorPassword = this.configService.get<string>(
      'MPESA_INITIATOR_PASSWORD',
    );
    this.passKey = this.configService.get<string>('MPESA_PASS_KEY');
    this.MPESA_CALLBACK_URL =
      this.configService.get<string>('MPESA_CALLBACK_URL');
    this.MPESA_STATIC_PASSWORD = this.configService.get<string>(
      'MPESA_STATIC_PASSWORD',
    );
    this.MPESA_STATIC_TIMESTAMP = this.configService.get<string>(
      'MPESA_STATIC_TIMESTAMP',
    );
    this.MPESA_SECURITY_CREDENTIAL = this.configService.get<string>(
      'MPESA_SECURITY_CREDENTIAL',
    );
  }

  private async getAccessToken(): Promise<string> {
    try {
      const auth = Buffer.from(
        `${this.consumerKey}:${this.consumerSecret}`,
      ).toString('base64');

      console.log('auth', auth);
      const response = await axios.get(
        `${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
        {
          headers: {
            Authorization: `Basic ${auth}`,
          },
        },
      );
      return response.data.access_token;
    } catch (error) {
      this.logger.error('Error getting access token:', error);
      throw error;
    }
  }

  async initiateC2B(dto: InitiateC2BDto, employeeId: string) {
    try {
      const accessToken = await this.getAccessToken();

      const requestBody = {
        BusinessShortCode: this.shortCode,
        Password: this.MPESA_STATIC_PASSWORD,
        Timestamp: this.MPESA_STATIC_TIMESTAMP,
        TransactionType: 'CustomerPayBillOnline',
        Amount: dto.amount,
        PartyA: dto.phoneNumber,
        PartyB: this.shortCode,
        PhoneNumber: dto.phoneNumber,
        CallBackURL: this.MPESA_CALLBACK_URL,
        AccountReference: dto.accountReference,
        TransactionDesc: 'CustomerPayBillOnline',
        Remark: 'INITIATE STK PUSH',
      };

      this.logger.debug(
        'STK Push Request:',
        JSON.stringify(requestBody, null, 2),
      );

      const response = await axios.post(
        `${this.baseUrl}/mpesa/stkpush/v1/processrequest`,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      this.logger.debug(
        'STK Push Response:',
        JSON.stringify(response.data, null, 2),
      );

      // For C2B, always use the authenticated user's ID as ObjectId
      const transaction = await this.mpesaModel.create({
        employee: new Types.ObjectId(employeeId),
        transactionType: 'paybill',
        amount: dto.amount,
        phoneNumber: dto.phoneNumber,
        accountReference: dto.accountReference,
        status: 'pending',
        merchantRequestId: response.data.MerchantRequestID,
        checkoutRequestId: response.data.CheckoutRequestID,
        responseCode: response.data.ResponseCode,
        responseDescription: response.data.ResponseDescription,
        customerMessage: response.data.CustomerMessage,
      });

      return {
        success: response.data.ResponseCode === '0',
        message: response.data.CustomerMessage,
        data: {
          merchantRequestId: response.data.MerchantRequestID,
          checkoutRequestId: response.data.CheckoutRequestID,
          responseDescription: response.data.ResponseDescription,
          transactionId: transaction._id,
        },
      };
    } catch (error) {
      if (error.response) {
        this.logger.error('Error Response Data:', error.response.data);
        this.logger.error('Error Response Status:', error.response.status);
        this.logger.error('Error Response Headers:', error.response.headers);
        throw new Error(
          `Mpesa API Error: ${JSON.stringify(error.response.data)}`,
        );
      } else if (error.request) {
        this.logger.error('Error Request:', error.request);
        throw new Error('No response received from Mpesa API');
      } else {
        this.logger.error('Error:', error.message);
        throw new Error(`Error setting up request: ${error.message}`);
      }
    }
  }

  async initiateB2C(dto: InitiateB2CDto, employeeId: string) {
    try {
      // Format phone number to match database format
      const formattedPhoneNumber = dto.phoneNumber.startsWith('0')
        ? '+254' + dto.phoneNumber.slice(1)
        : dto.phoneNumber;

      // For B2C, always try to find user by phone number
      const user = await this.employeeModel.findOne({
        phoneNumber: formattedPhoneNumber,
      });

      if (!user) {
        this.logger.warn(
          `B2C payment failed: No user found with phone number ${formattedPhoneNumber}`,
        );
        throw new HttpException(
          {
            success: false,
            status: HttpStatus.NOT_FOUND,
            message: 'B2C payment initiation failed',
            error: 'User not found',
            details: `No registered user found with phone number ${formattedPhoneNumber}. Please verify the phone number or contact support.`,
          },
          HttpStatus.NOT_FOUND,
        );
      }

      const accessToken = await this.getAccessToken();
      const uniqueId = new Date()
        .toISOString()
        .replace(/[^0-9]/g, '')
        .slice(0, 12);

      await axios.post(
        `${this.baseUrl}/mpesa/b2c/v1/paymentrequest`,
        {
          InitiatorName: this.initiatorName,
          SecurityCredential: this.MPESA_SECURITY_CREDENTIAL,
          CommandID: 'SalaryPayment',
          Amount: dto.amount,
          PartyA: this.shortCode,
          PartyB: dto.phoneNumber,
          Remarks: dto.remarks || 'Payment remarks',
          QueueTimeOutURL: this.MPESA_CALLBACK_URL,
          ResultURL: this.MPESA_CALLBACK_URL,
          Occasion: dto.occasion || 'Payment',
          uniqueId: uniqueId,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      // For B2C, always use the user ID found by phone number
      const transaction = await this.mpesaModel.create({
        employee: user._id,
        transactionType: 'b2c',
        amount: dto.amount,
        phoneNumber: dto.phoneNumber,
        status: 'pending',
        callbackStatus: 'pending',
      });

      return {
        success: true,
        status: HttpStatus.OK,
        message: 'B2C payment initiated successfully',
        data: {
          transactionId: transaction._id,
          employeeId: user._id,
          amount: dto.amount,
          phoneNumber: dto.phoneNumber,
          status: transaction.status,
        },
      };
    } catch (error) {
      // If it's already a HttpException, rethrow it
      if (error instanceof HttpException) {
        throw error;
      }

      // Handle other errors
      this.logger.error('Error initiating B2C payment:', error);
      throw new HttpException(
        {
          success: false,
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'B2C payment initiation failed',
          error: 'Internal server error',
          details:
            'An unexpected error occurred while processing your request. Please try again later.',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async handleCallback(callbackData: any) {
    this.logger.debug(
      'Received callback data:',
      JSON.stringify(callbackData, null, 2),
    );

    // Handle C2B callback
    if (callbackData.Body?.stkCallback) {
      return this.handleC2BCallback(callbackData);
    }
    // Handle B2C callback
    else if (callbackData.Result) {
      return this.handleB2CCallback(callbackData);
    }
    // Handle direct Pay Bill callback
    else if (
      callbackData.TransactionType === 'Pay Bill' &&
      callbackData.BillRefNumber
    ) {
      return this.handlePayBillCallback(callbackData);
    } else {
      throw new Error('Unknown callback type');
    }
  }

  private async handleC2BCallback(callbackData: any) {
    const { Body } = callbackData;
    console.log('Received C2B callback data:', JSON.stringify(Body, null, 2));

    const {
      MerchantRequestID,
      CheckoutRequestID,
      ResultCode,
      ResultDesc,
      CallbackMetadata,
    } = Body.stkCallback;

    try {
      // Find the transaction
      const transaction = await this.mpesaModel.findOne({
        merchantRequestId: MerchantRequestID,
        checkoutRequestId: CheckoutRequestID,
      });

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      // Base update data
      const updateData: any = {
        resultCode: ResultCode.toString(),
        resultDesc: ResultDesc,
        callbackStatus: 'processed',
        status: ResultCode === 0 ? 'completed' : 'failed',
      };

      // Process callback metadata if payment was successful
      if (ResultCode === 0 && CallbackMetadata?.Item) {
        const metadataMap = new Map(
          CallbackMetadata.Item.map((item: any) => [item.Name, item.Value]),
        );

        // Update with metadata fields
        updateData.confirmedAmount = metadataMap.get('Amount');
        updateData.mpesaReceiptNumber = metadataMap.get('MpesaReceiptNumber');
        updateData.balance = metadataMap.get('Balance');
        updateData.transactionDate = metadataMap
          .get('TransactionDate')
          ?.toString();
        updateData.callbackPhoneNumber = metadataMap
          .get('PhoneNumber')
          ?.toString();
      }

      // Update the transaction
      const updatedTransaction = await this.mpesaModel.findByIdAndUpdate(
        transaction._id,
        updateData,
        { new: true },
      );

      return {
        success: true,
        message: 'C2B callback processed successfully',
        data: {
          transactionId: updatedTransaction._id,
          status: updatedTransaction.status,
          mpesaReceiptNumber: updatedTransaction.mpesaReceiptNumber,
          resultDesc: updatedTransaction.resultDesc,
          amount: updatedTransaction.confirmedAmount,
          transactionDate: updatedTransaction.transactionDate,
          phoneNumber: updatedTransaction.callbackPhoneNumber,
        },
      };
    } catch (error) {
      this.logger.error('Error processing C2B callback:', error);
      throw new Error(`Failed to process C2B callback: ${error.message}`);
    }
  }

  private async handleB2CCallback(callbackData: any) {
    console.log(
      'Received B2C callback data:',
      JSON.stringify(callbackData, null, 2),
    );

    const {
      Result: {
        ResultType,
        ResultCode,
        ResultDesc,
        OriginatorConversationID,
        ConversationID,
        TransactionID,
        ResultParameters,
      },
    } = callbackData;

    try {
      // Create a map of result parameters
      const resultParamsMap = new Map(
        ResultParameters?.ResultParameter?.map((param: any) => [
          param.Key,
          param.Value,
        ]) || [],
      );

      // Extract phone number from ReceiverPartyPublicName
      const receiverPartyPublicName = resultParamsMap.get(
        'ReceiverPartyPublicName',
      ) as string;
      const phoneNumber = receiverPartyPublicName.split(' ')[0];

      console.log('b2c phone', phoneNumber)

      // Find existing transaction by originatorConversationId
      const existingTransaction = await this.mpesaModel.findOne({
        $or: [
          { originatorConversationId: OriginatorConversationID },
          { phoneNumber: { $in: [phoneNumber, `254${phoneNumber.slice(1)}`] } },
        ],
        transactionType: 'b2c',
        status: 'pending',
      });

      console.log('existing transaction', existingTransaction)

      if (!existingTransaction) {
        throw new Error(
          `No pending B2C transaction found for conversation ID: ${OriginatorConversationID} or phone: ${phoneNumber}`,
        );
      }

      // Update transaction data
      const updateData = {
        status: ResultCode === 0 || ResultCode === '0' ? 'completed' : 'failed',
        resultCode: ResultCode.toString(),
        resultDesc: ResultDesc,
        callbackStatus: 'processed',
        originatorConversationId: OriginatorConversationID,
        conversationId: ConversationID,
        transactionId: TransactionID,
        mpesaReceiptNumber: TransactionID,
        confirmedAmount: resultParamsMap.get('TransactionAmount'),
        receiverPartyPublicName,
        transactionCompletedDateTime: resultParamsMap.get(
          'TransactionCompletedDateTime',
        ),
        b2cUtilityAccountFunds: resultParamsMap.get(
          'B2CUtilityAccountAvailableFunds',
        ),
        b2cWorkingAccountFunds: resultParamsMap.get(
          'B2CWorkingAccountAvailableFunds',
        ),
        b2cChargesPaidAccountFunds: resultParamsMap.get(
          'B2CChargesPaidAccountAvailableFunds',
        ),
        b2cRecipientIsRegistered: resultParamsMap.get(
          'B2CRecipientIsRegisteredCustomer',
        ),
      };

      // Update the existing transaction
      const updatedTransaction = await this.mpesaModel.findByIdAndUpdate(
        existingTransaction._id,
        updateData,
        { new: true },
      );

      // Check balance threshold and notify admins if necessary
      const b2cUtilityAccountFunds = Number(resultParamsMap.get('B2CUtilityAccountAvailableFunds'));
      const systemConfig = await this.systemConfigModel.findOne();
      console.log('system config', systemConfig)
      console.log('b2cUtilityAccountFunds', b2cUtilityAccountFunds)
      console.log('balanceThreshold', systemConfig.data.balanceThreshold)

      if (systemConfig?.data?.balanceThreshold && b2cUtilityAccountFunds <= systemConfig.data.balanceThreshold) {
        const balanceAlertAdmins = systemConfig.data.notificationAdmins?.filter(admin =>
          admin.notificationTypes.includes('balance_alert')
        ) || [];

        const alertMessage = `⚠️ LOW BALANCE ALERT: M-Pesa utility account balance (KES ${b2cUtilityAccountFunds}) has fallen below the threshold of KES ${systemConfig.data.balanceThreshold}. Please top up to ensure uninterrupted service.`;

        // Send notifications to all balance alert admins
        for (const admin of balanceAlertAdmins) {
          if (systemConfig.data.enableSMSNotifications && admin.phone) {
            await this.notificationService.sendSMS(admin.phone, alertMessage);
          }
          if (systemConfig.data.enableEmailNotifications && admin.email) {
            await this.notificationService.sendEmail(
              admin.email,
              'M-Pesa Account Low Balance Alert',
              alertMessage
            );
          }
        }
      }

      return {
        success: true,
        message: 'B2C callback processed successfully',
        data: updatedTransaction,
      };
    } catch (error) {
      this.logger.error('Error processing B2C callback:', error);
      throw new Error(`Failed to process B2C callback: ${error.message}`);
    }
  }

  private async handlePayBillCallback(callbackData: any) {
    try {
      const { BillRefNumber, TransAmount } = callbackData;
      const amount = parseFloat(TransAmount);
      if (isNaN(amount)) {
        throw new Error('Invalid transaction amount');
      }

      // Handle advance repayment if BillRefNumber starts with repay_advance:
      if (BillRefNumber?.startsWith('repay_advance:')) {
        const employeeId = BillRefNumber.split(':')[1];
        this.logger.log(
          'Processing advance repayment for employee:',
          employeeId,
        );

        // Get employee details for notification
        const employee = await this.employeeModel.findById(employeeId);
        if (!employee) {
          throw new Error('Employee not found');
        }

        // Get all advances that need repayment
        const repayableAdvances = await this.advanceModel
          .find({
            employee: new Types.ObjectId(employeeId),
            status: { $in: ['disbursed', 'repaying'] },
            $expr: {
              $lt: ['$amountRepaid', '$totalRepayment'],
            },
          })
          .sort({ approvedDate: 1 })
          .lean();

        if (repayableAdvances && repayableAdvances.length > 0) {
          let remainingAmount: number = amount;

          // Update each advance with the repaid amount, starting from the oldest
          for (const advance of repayableAdvances) {
            if (remainingAmount <= 0) break;

            const currentDue =
              advance.amount +
              (advance.totalRepayment - advance.amount) -
              (advance.amountRepaid || 0);
            const amountToRepay = Math.min(remainingAmount, currentDue);

            // Update advance record
            const updatedAmountRepaid =
              (advance.amountRepaid || 0) + amountToRepay;

            // Check if fully repaid by comparing with totalRepayment directly
            const isFullyRepaid = updatedAmountRepaid >= advance.totalRepayment;

            await this.advanceModel.findByIdAndUpdate(advance._id, {
              $inc: { amountRepaid: amountToRepay },
              $set: {
                status: isFullyRepaid ? 'repaid' : 'repaying',
                lastRepaymentDate: new Date(),
              },
            });

            remainingAmount -= amountToRepay;
          }

          // Send notification to user's actual phone number
          await this.notificationService.sendSMS(
            employee.phoneNumber, // Use actual phone number from employee record
            `Your advance repayment of KES ${amount.toLocaleString()} has been received. Thank you for using Innova Services.`,
          );
        }
      } else {
        this.logger.log('Processing wallet recharge');
        // Handle wallet recharge (existing logic)
        const userId = BillRefNumber.split(':')[1];
        if (!userId) {
          throw new Error('Invalid BillRefNumber format');
        }

        // Find the user
        const user = await this.employeeModel.findById(userId);
        if (!user) {
          throw new Error('User not found');
        }

        // Update user's wallet balance
        await this.employeeModel.findByIdAndUpdate(
          userId,
          { $inc: { walletBalance: amount } },
          { new: true },
        );
      }

      return {
        status: 'success',
        message: 'Payment processed successfully',
      };
    } catch (error) {
      this.logger.error(
        `Failed to process Pay Bill callback: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getTransactions(
    employeeId: string,
    status?: string,
    transactionType?: string,
    startDate?: string,
    endDate?: string,
  ) {
    try {
      const query: any = { employee: new Types.ObjectId(employeeId) };

      if (status) {
        query.status = status;
      }

      if (transactionType) {
        query.transactionType = transactionType;
      }

      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) {
          query.createdAt.$gte = new Date(startDate);
        }
        if (endDate) {
          query.createdAt.$lte = new Date(endDate);
        }
      }

      return this.mpesaModel.find(query).sort({ createdAt: -1 }).exec();
    } catch (error) {
      this.logger.error('Error fetching transactions:', error);
      throw error;
    }
  }

  async getTransactionById(id: string, employeeId: string) {
    try {
      const transaction = await this.mpesaModel
        .findOne({ _id: id, employee: new Types.ObjectId(employeeId) })
        .exec();

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      return transaction;
    } catch (error) {
      this.logger.error('Error fetching transaction:', error);
      throw error;
    }
  }

  async checkAccountBalance(employeeId: string) {
    try {
      const accessToken = await this.getAccessToken();

      const response = await axios.post(
        `${this.baseUrl}/mpesa/accountbalance/v1/query`,
        {
          Initiator: this.initiatorName,
          SecurityCredential: this.initiatorPassword,
          CommandID: 'AccountBalance',
          PartyA: this.shortCode,
          IdentifierType: '4', // Organization's shortcode
          Remarks: 'Account Balance Query',
          QueueTimeOutURL: `${this.configService.get('APP_URL')}/mpesa/timeout`,
          ResultURL: `${this.configService.get('APP_URL')}/mpesa/callback`,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      // Create a record for the balance query with ObjectId
      await this.mpesaModel.create({
        employee: new Types.ObjectId(employeeId),
        transactionType: 'balance_query',
        status: 'pending',
        conversationId: response.data.ConversationID,
        originatorConversationId: response.data.OriginatorConversationID,
      });

      return response.data;
    } catch (error) {
      this.logger.error('Error checking account balance:', error);
      throw error;
    }
  }
}
