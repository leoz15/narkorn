// Import Firebase functions from SDKs
import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";

// Your web app's Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSyA9e2r2wkK2natHyRfY5dKbHetSeLb0mKI",
  authDomain: "nakkon-c0464.firebaseapp.com",
  projectId: "nakkon-c0464",
  storageBucket: "nakkon-c0464.firebasestorage.app",
  messagingSenderId: "1082618011425",
  appId: "1:1082618011425:web:00c3bf555cca1375ba6860",
  measurementId: "G-GDWQS9TK23"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Initialize Analytics (safely check browser environment support)
export let analytics = null;
isSupported()
  .then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
      console.log("Firebase Analytics initialized successfully");
    }
  })
  .catch((err) => {
    console.warn("Firebase Analytics could not be initialized:", err);
  });

console.log("Firebase initialized for project:", firebaseConfig.projectId);
