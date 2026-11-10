import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBREXrsgOg2AmaO_QINITJs-k4c0p0xiWs",
  authDomain: "sl-mobile-d1476.firebaseapp.com",
  projectId: "sl-mobile-d1476",
  storageBucket: "sl-mobile-d1476.firebasestorage.app",
  messagingSenderId: "763939726214",
  appId: "1:763939726214:web:b6230bd9f1e13a92948207"
};
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
