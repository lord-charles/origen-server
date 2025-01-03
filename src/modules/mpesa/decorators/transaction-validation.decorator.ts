import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import { CreateMpesaTransactionDto } from '../dto/mpesa.dto';
import { TransactionType } from '../dto/mpesa.dto';

export function IsValidTransactionDetails(
  validationOptions?: ValidationOptions,
) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isValidTransactionDetails',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const dto = args.object as CreateMpesaTransactionDto;

          switch (dto.transactionType) {
            case TransactionType.PAYBILL:
              return value?.paybillNumber && value?.accountNumber;
            case TransactionType.TILL:
              return value?.tillNumber;
            case TransactionType.SEND_MONEY:
              return value?.recipientName;
            default:
              return true;
          }
        },
        defaultMessage(args: ValidationArguments) {
          const dto = args.object as CreateMpesaTransactionDto;
          switch (dto.transactionType) {
            case TransactionType.PAYBILL:
              return 'Paybill number and account number are required for paybill transactions';
            case TransactionType.TILL:
              return 'Till number is required for till transactions';
            case TransactionType.SEND_MONEY:
              return 'Recipient name is required for send money transactions';
            default:
              return 'Invalid transaction details';
          }
        },
      },
    });
  };
}
