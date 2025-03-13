export interface UpdateResult {
  updated: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    amountRepaid: number;
  }>;
  failed: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    reason: string;
  }>;
}
