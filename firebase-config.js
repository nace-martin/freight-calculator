// firebase-config.js

// Import the functions you need from the SDKs using the full URL
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
// ===================================================================

const firebaseConfig = {
  apiKey: "AIzaSyCCvVJkvhNO3AwqM4BB24iCa4GnZylAJZQ",
  authDomain: "long-justice-454003-b0.firebaseapp.com",
  projectId: "long-justice-454003-b0",
  storageBucket: "long-justice-454003-b0.firebasestorage.app",
  messagingSenderId: "279324077076",
  appId: "1:279324077076:web:ef6314e624e69c51ea0b01",
  measurementId: "G-77SWT3WWE0"
};
// ===================================================================

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export the auth service so other files can use it
export const auth = getAuth(app);
export const db = getFirestore(app);