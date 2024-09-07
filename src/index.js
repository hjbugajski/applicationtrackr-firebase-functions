const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { logger } = require('firebase-functions');
const { setGlobalOptions } = require('firebase-functions/v2');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { process } = require('process');

initializeApp();

const firestore = getFirestore();

setGlobalOptions({ timeoutSeconds: 540 });

async function _batchDelete(query, resolve, reject) {
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

exports.batchDeleteV2 = onCall(async (data, context) => {
  if (!context || !context.auth) {
    throw new HttpsError('unauthenticated', 'Request has invalid credentials.');
  }

  if (!data || !data.field || !data.operator || !data.path || !data.value) {
    throw new HttpsError('invalid-argument', 'Request has invalid data.');
  }

  const collection = firestore.collection(`users/${context.auth.uid}/${data.path}`);
  const query = collection.where(data.field, data.operator, data.value).limit(500);

  logger.info(`User ${context.auth.uid} has requested to delete documents from collection ${data.path}`);

  return new Promise((resolve, reject) => {
    _batchDelete(query, resolve, reject).catch(reject);
  }).catch((error) => {
    logger.error(error);

    throw error;
  });
});

exports.recursiveDeleteV2 = onCall(async (data, context) => {
  if (!context || !context.auth) {
    throw new HttpsError('unauthenticated', 'Request has invalid credentials.');
  }

  if (!data || !data.path || !data.refType) {
    throw new HttpsError('invalid-argument', 'Request has invalid data.');
  }

  const path = `users/${context.auth.uid}/${data.path}`;
  const ref = data.refType === 'doc' ? firestore.doc(path) : firestore.collection(path);

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
});
