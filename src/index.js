import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { setGlobalOptions } from 'firebase-functions/v2';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

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

export const batchDelete = onCall(async (req) => {
  if (!req || !req.auth) {
    throw new HttpsError('unauthenticated', 'Request has invalid credentials.');
  }

  const { auth, data } = req;

  if (!data || !data.field || !data.operator || !data.path || !data.value) {
    throw new HttpsError('invalid-argument', 'Request has invalid data.');
  }

  const collection = firestore.collection(`users/${auth.uid}/${data.path}`);
  const query = collection.where(data.field, data.operator, data.value).orderBy('__name__').limit(500);

  logger.info(`User ${auth.uid} has requested to delete documents from collection ${data.path}`);

  return new Promise((resolve, reject) => {
    _batchDelete(query, resolve, reject).catch(reject);
  }).catch((error) => {
    logger.error(error);

    throw error;
  });
});

export const recursiveDelete = onCall(async (req) => {
  if (!req || !req.auth) {
    throw new HttpsError('unauthenticated', 'Request has invalid credentials.');
  }

  const { auth, data } = req;

  if (!data || !data.path || !data.refType) {
    throw new HttpsError('invalid-argument', 'Request has invalid data.');
  }

  const path = `users/${auth.uid}/${data.path}`;
  const ref = data.refType === 'doc' ? firestore.doc(path) : firestore.collection(path);

  logger.info(`User ${auth.uid} has requested to delete path ${path}`);

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

async function _exportJobBoard(jobBoardDoc) {
  const jobBoardData = jobBoardDoc.data();
  const jobBoard = {
    id: jobBoardDoc.id,
    ...jobBoardData,
    applications: [],
    columns: []
  };

  const applicationsRef = jobBoardDoc.ref.collection('applications');
  const applicationsSnapshot = await applicationsRef.get();

  applicationsSnapshot.docs.forEach((doc) => {
    jobBoard.applications.push({
      id: doc.id,
      ...doc.data()
    });
  });

  const columnsRef = jobBoardDoc.ref.collection('columns');
  const columnsSnapshot = await columnsRef.get();

  columnsSnapshot.docs.forEach((doc) => {
    jobBoard.columns.push({
      id: doc.id,
      ...doc.data()
    });
  });

  return jobBoard;
}

export const bulkExport = onCall(async (req) => {
  if (!req || !req.auth) {
    throw new HttpsError('unauthenticated', 'Request has invalid credentials.');
  }

  const { auth } = req;
  const userPath = `users/${auth.uid}`;

  logger.info(`User ${auth.uid} has requested to export all their data`);

  try {
    const userDocRef = firestore.doc(userPath);
    const userDoc = await userDocRef.get();

    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        userId: auth.uid,
        version: '1.0.0'
      },
      data: {
        profile: null,
        jobBoards: []
      }
    };

    if (userDoc.exists) {
      exportData.data.profile = userDoc.data();
    }

    const jobBoardsRef = firestore.collection(`${userPath}/jobBoards`);
    const jobBoardsSnapshot = await jobBoardsRef.get();

    logger.info(`Found ${jobBoardsSnapshot.size} job boards for user ${auth.uid}`);

    for (const jobBoardDoc of jobBoardsSnapshot.docs) {
      const jobBoard = await _exportJobBoard(jobBoardDoc);
      exportData.data.jobBoards.push(jobBoard);
    }

    logger.info(`Successfully exported data for user ${auth.uid}. Job boards: ${exportData.data.jobBoards.length}`);

    return exportData;
  } catch (error) {
    logger.error(`Error exporting data for user ${auth.uid}:`, error);
    throw new HttpsError('internal', 'Failed to export user data.');
  }
});
