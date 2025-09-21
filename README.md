# ApplicationTrackr Firebase Functions

## ⚠️ Archive Notice

This project has been archived as of September 2025 and is no longer actively maintained.

ApplicationTrackr Firebase Functions provides cloud functions for the ApplicationTrackr job application tracking platform. Built with Firebase Functions and Node.js, this repository contains backend services for data management operations.

## Functions

### [`batchDelete`](src/index.ts#L42)

Deletes all documents that match the provided query parameters from the provided collection path.

### [`recursiveDelete`](src/index.ts#L63)

Recursively deletes all collections and documents in the given document or collection reference from a Firebase Firestore database.
