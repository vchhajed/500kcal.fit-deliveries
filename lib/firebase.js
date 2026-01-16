// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCrZBZKvkqzoKtYIv8gDtG3HciQfESlHmY",
  authDomain: "kcal-83641.firebaseapp.com",
  projectId: "kcal-83641",
  storageBucket: "kcal-83641.firebasestorage.app",
  messagingSenderId: "232588569886",
  appId: "1:232588569886:web:e6a1260e9adcc800cbed0f",
  measurementId: "G-QZRPHCH386"
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Initialize Firebase Authentication and set device language
export const auth = getAuth(app)
auth.useDeviceLanguage()

export { app }
