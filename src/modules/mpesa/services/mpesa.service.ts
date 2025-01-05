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

  constructor(
    @InjectModel(MpesaTransaction.name)
    private mpesaModel: Model<MpesaTransactionDocument>,
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

      // Create transaction record with response details
      const transaction = await this.mpesaModel.create({
        employee: employeeId,
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
      const accessToken = await this.getAccessToken();
      const uniqueId = new Date()
        .toISOString()
        .replace(/[^0-9]/g, '')
        .slice(0, 12);

      const response = await axios.post(
        `${this.baseUrl}/mpesa/b2c/v1/paymentrequest`,
        {
          InitiatorName: this.initiatorName,
          SecurityCredential: this.initiatorPassword,
          CommandID: 'SalaryPayment',
          Amount: dto.amount,
          PartyA: this.shortCode,
          PartyB: dto.phoneNumber,
          Remarks: dto.remarks || 'Payment remarks',
          QueueTimeOutURL: `${this.configService.get('APP_URL')}/mpesa/b2c-timeout`,
          ResultURL: `${this.configService.get('APP_URL')}/mpesa/b2c-result`,
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

      // Create transaction record
      await this.mpesaModel.create({
        employee: employeeId,
        transactionType: 'b2c',
        amount: dto.amount,
        phoneNumber: dto.phoneNumber,
        status: 'pending',
        uniqueId: uniqueId,
        occasion: dto.occasion,
        remarks: dto.remarks,
      });

      return response.data;
    } catch (error) {
      this.logger.error('Error initiating B2C transaction:', error);
      throw error;
    }
  }

  async handleCallback(callbackData: any) {
    this.logger.debug(
      'Received callback data:',
      JSON.stringify(callbackData, null, 2),
    );

    const { Body } = callbackData;
    if (!Body?.stkCallback) {
      throw new Error('Invalid callback data structure');
    }

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
        message: 'Callback processed successfully',
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
      this.logger.error('Error processing callback:', error);
      throw new Error(`Failed to process callback: ${error.message}`);
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
      const query: any = { employee: employeeId };

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
        .findOne({ _id: id, employee: employeeId })
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

      // Create a record for the balance query
      await this.mpesaModel.create({
        employee: employeeId,
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
