import { v4 as uuidv4 } from 'uuid';

export const generateTransactionId = (): string => {
  const timestamp = new Date().getTime().toString(36);
  const uniqueId = uuidv4().split('-')[0];
  return `TRX${timestamp}${uniqueId}`.toUpperCase();
};
