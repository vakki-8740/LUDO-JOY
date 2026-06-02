const config = window.FIREBASE_CONFIG || {};

if (!config.apiKey || !config.projectId) {
    console.error('❌ Firebase config missing! Check user/env.js');
    document.getElementById('toast').textContent = 'Firebase config missing! Check user/env.js';
    document.getElementById('toast').style.display = 'block';
}

const firebaseConfig = {
  apiKey: config.apiKey,
  authDomain: config.authDomain,
  databaseURL: config.databaseURL,
  projectId: config.projectId,
  storageBucket: config.storageBucket,
  messagingSenderId: config.messagingSenderId,
  appId: config.appId
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

console.log('✅ Firebase initialized:', config.projectId);
