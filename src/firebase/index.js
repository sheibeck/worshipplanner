"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.auth = exports.app = void 0;
var app_1 = require("firebase/app");
var auth_1 = require("firebase/auth");
var firestore_1 = require("firebase/firestore");
var firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};
exports.app = (0, app_1.initializeApp)(firebaseConfig);
exports.auth = (0, auth_1.getAuth)(exports.app);
exports.db = (0, firestore_1.getFirestore)(exports.app);
if (import.meta.env.VITE_USE_EMULATORS === 'true') {
    (0, auth_1.connectAuthEmulator)(exports.auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    (0, firestore_1.connectFirestoreEmulator)(exports.db, '127.0.0.1', 8080);
}
