import { ReferenceTypes } from '../enums/reference-types.enum';

export interface RecursiveDeleteData {
  path: string;
  refType: ReferenceTypes;
}
