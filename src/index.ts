import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Query } from 'firebase-admin/firestore';
import { https, runWith, logger } from 'firebase-functions';

import { ReferenceTypes } from './enums/reference-types.enum';
import { BatchDeleteData } from './interfaces/batch-delete-data.interface';
import { RecursiveDeleteData } from './interfaces/recursive-delete-data.interface';

initializeApp();

const firestore = getFirestore();

async function _batchDelete(query: Query, resolve: (value?: undefined) => void, reject: (error: string) => void) {
  const snapshot = await query.get();

  if (snapshot.size === 0) {
    return resolve();
  }

  const batch = firestore.batch();

  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  await batch
    .commit()
    .then(() => {
      logger.info('Batch has been successfully deleted');
    })
    .catch((error) => {
      logger.error(error);

      return reject(error);
    });

  process.nextTick(() => {
    _batchDelete(query, resolve, reject);
  });
}

export const batchDelete = runWith({ timeoutSeconds: 540 }).https.onCall(async (data: BatchDeleteData, context) => {
  if (!context || !context.auth) {
    throw new https.HttpsError('unauthenticated', 'Request has invalid credentials.');
  }

  if (!data || !data.field || !data.operator || !data.path || !data.value) {
    throw new https.HttpsError('invalid-argument', 'Request has invalid data.');
  }

  const collection = firestore.collection(`users/${context.auth.uid}/${data.path}`);
  const query = collection.where(data.field, data.operator, data.value).limit(500);

  logger.info(`User ${context.auth.uid} has requested to delete documents from collection ${data.path}`);

  return new Promise((resolve, reject) => {
    _batchDelete(query, resolve, reject).catch(reject);
  }).catch((error) => {
    throw error;
  });
});

export const recursiveDelete = runWith({ timeoutSeconds: 540 }).https.onCall(
  async (data: RecursiveDeleteData, context) => {
    if (!context || !context.auth) {
      throw new https.HttpsError('unauthenticated', 'Request has invalid credentials.');
    }

    if (!data || !data.path || !data.refType) {
      throw new https.HttpsError('invalid-argument', 'Request has invalid data.');
    }

    const path = `users/${context.auth.uid}/${data.path}`;
    const ref = data.refType === ReferenceTypes.Doc ? firestore.doc(path) : firestore.collection(path);

    logger.info(`User ${context.auth.uid} has requested to delete path ${path}`);

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
