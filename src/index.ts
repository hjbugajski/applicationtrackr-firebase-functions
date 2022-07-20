import { initializeApp } from 'firebase-admin/app';
import { CollectionReference, DocumentReference, getFirestore } from 'firebase-admin/firestore';
import { https, runWith, logger } from 'firebase-functions';

import { ReferenceTypes } from './enums/reference-types.enum';
import { RecursiveDeleteData } from './interfaces/recursive-delete-data.interface';

initializeApp();

const firestore = getFirestore();

export const recursiveDelete = runWith({ timeoutSeconds: 540 }).https.onCall(
  async (data: RecursiveDeleteData, context) => {
    if (!context || !context.auth) {
      throw new https.HttpsError('unauthenticated', 'Request has invalid credentials.');
    }

    if (!data || !data.path || !data.refType) {
      throw new https.HttpsError('invalid-argument', 'Request has invalid data.');
    }

    const path = `users/${context.auth.uid}/${data.path}`;
    let ref: DocumentReference | CollectionReference;

    logger.info(`User ${context.auth.uid} has requested to delete path ${path}`);

    if (data.refType === ReferenceTypes.Doc) {
      ref = firestore.doc(path);
    } else {
      // ReferenceTypes.Collection
      ref = firestore.collection(path);
    }

    return await firestore
      .recursiveDelete(ref)
      .then(() => {
        logger.info('Path has been successfully deleted');
      })
      .catch((error) => {
        logger.error(error);

        throw error;
      });
  }
);
