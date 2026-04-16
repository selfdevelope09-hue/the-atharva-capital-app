import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// In details ko apne Firebase Console se replace karein
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "the-atharva-capital.firebaseapp.com",
  projectId: "the-atharva-capital",
  storageBucket: "the-atharva-capital.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
