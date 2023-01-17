import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAT7JGoTPb4yAurkmoIjOIUSwZM9C5YiWk",
  authDomain: "fir-rtc-5962f.firebaseapp.com",
  projectId: "fir-rtc-5962f",
  storageBucket: "fir-rtc-5962f.appspot.com",
  messagingSenderId: "40195545663",
  appId: "1:40195545663:web:f6fe184112a16c095cf68a",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
