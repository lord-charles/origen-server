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
  }

  private async getAccessToken(): Promise<string> {
    try {
      const auth = Buffer.from(
        `${this.consumerKey}:${this.consumerSecret}`,
      ).toString('base64');
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
      const timestamp = new Date()
        .toISOString()
        .replace(/[^0-9]/g, '')
        .slice(0, -3);
      const password = Buffer.from(
        `${this.shortCode}${this.initiatorPassword}${timestamp}`,
      ).toString('base64');

      const response = await axios.post(
        `${this.baseUrl}/mpesa/stkpush/v1/processrequest`,
        {
          BusinessShortCode: this.shortCode,
          Password: password,
          Timestamp: timestamp,
          TransactionType: 'CustomerPayBillOnline',
          Amount: dto.amount,
          PartyA: dto.phoneNumber,
          PartyB: this.shortCode,
          PhoneNumber: dto.phoneNumber,
          CallBackURL: `${this.configService.get('APP_URL')}/mpesa/callback`,
          AccountReference: dto.accountReference,
          TransactionDesc: 'Payment for services',
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      // Create transaction record
      await this.mpesaModel.create({
        employee: employeeId,
        transactionType: 'paybill',
        amount: dto.amount,
        phoneNumber: dto.phoneNumber,
        accountReference: dto.accountReference,
        status: 'pending',
        checkoutRequestId: response.data.CheckoutRequestID,
      });

      return response.data;
    } catch (error) {
      this.logger.error('Error initiating C2B transaction:', error);
      throw error;
    }
  }

  async initiateB2C(dto: InitiateB2CDto, employeeId: string) {
    try {
      const accessToken = await this.getAccessToken();

      const response = await axios.post(
        `${this.baseUrl}/mpesa/b2c/v1/paymentrequest`,
        {
          InitiatorName: this.initiatorName,
          SecurityCredential: this.initiatorPassword,
          CommandID: 'BusinessPayment',
          Amount: dto.amount,
          PartyA: this.shortCode,
          PartyB: dto.phoneNumber,
          Remarks: dto.occasion,
          QueueTimeOutURL: `${this.configService.get('APP_URL')}/mpesa/timeout`,
          ResultURL: `${this.configService.get('APP_URL')}/mpesa/callback`,
          Occasion: dto.occasion,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      // Create transaction record
      await this.mpesaModel.create({
        employee: employeeId,
        transactionType: 'send_money',
        amount: dto.amount,
        phoneNumber: dto.phoneNumber,
        status: 'pending',
        occasion: dto.occasion,
        conversationId: response.data.ConversationID,
        originatorConversationId: response.data.OriginatorConversationID,
      });

      return response.data;
    } catch (error) {
      this.logger.error('Error initiating B2C transaction:', error);
      throw error;
    }
  }

  async handleCallback(payload: any) {
    this.logger.log(
      'Processing Mpesa callback payload:',
      JSON.stringify(payload, null, 2),
    );

    try {
      if (payload.Body?.stkCallback) {
        // STK Push callback
        const { ResultCode, CheckoutRequestID, ResultDesc, CallbackMetadata } =
          payload.Body.stkCallback;

        this.logger.log('STK Push callback details:', {
          ResultCode,
          CheckoutRequestID,
          ResultDesc,
          CallbackMetadata,
          timestamp: new Date().toISOString(),
        });

        const transaction = await this.mpesaModel.findOneAndUpdate(
          { checkoutRequestId: CheckoutRequestID },
          {
            status: ResultCode === 0 ? 'completed' : 'failed',
            resultDescription: ResultDesc,
            rawCallback: payload,
            ...(CallbackMetadata?.Item && {
              mpesaReceiptNumber: CallbackMetadata.Item.find(
                (item: any) => item.Name === 'MpesaReceiptNumber',
              )?.Value,
              transactionDate: CallbackMetadata.Item.find(
                (item: any) => item.Name === 'TransactionDate',
              )?.Value,
              phoneNumber: CallbackMetadata.Item.find(
                (item: any) => item.Name === 'PhoneNumber',
              )?.Value,
            }),
          },
          { new: true },
        );

        // this.logger.log('Updated transaction:', {
        //   checkoutRequestId: CheckoutRequestID,
        //   status: transaction?.status,
        //   mpesaReceiptNumber: transaction?.mpesaReceiptNumber,
        // });
      } else if (payload.Result) {
        // B2C callback
        const {
          ResultCode,
          ResultDesc,
          ConversationID,
          TransactionID,
          ResultParameters,
        } = payload.Result;

        this.logger.log('B2C callback details:', {
          ResultCode,
          ResultDesc,
          ConversationID,
          TransactionID,
          ResultParameters,
          timestamp: new Date().toISOString(),
        });

        const transaction = await this.mpesaModel.findOneAndUpdate(
          { conversationId: ConversationID },
          {
            status: ResultCode === 0 ? 'completed' : 'failed',
            resultDescription: ResultDesc,
            rawCallback: payload,
            mpesaReceiptNumber: TransactionID,
            transactionDate: new Date(),
            ...(ResultParameters?.ResultParameter && {
              amount: ResultParameters.ResultParameter.find(
                (param: any) => param.Key === 'TransactionAmount',
              )?.Value,
              recipientDetails: ResultParameters.ResultParameter.find(
                (param: any) => param.Key === 'ReceiverPartyPublicName',
              )?.Value,
            }),
          },
          { new: true },
        );

        // this.logger.log('Updated transaction:', {
        //   conversationId: ConversationID,
        //   status: transaction?.status,
        //   mpesaReceiptNumber: transaction?.mpesaReceiptNumber,
        // });
      } else {
        this.logger.warn('Unknown callback payload format:', payload);
      }

      return { success: true };
    } catch (error) {
      this.logger.error('Error processing callback:', error);
      this.logger.error('Problematic payload:', payload);
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
