import { WhereFilterOp } from 'firebase-admin/firestore';

export interface BatchDeleteData {
  field: string;
  operator: WhereFilterOp;
  path: string;
  value: string;
}
