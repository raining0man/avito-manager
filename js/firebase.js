import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getFirestore, enableIndexedDbPersistence,
    collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
    onSnapshot, writeBatch, query, where, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
    getAuth, signInAnonymously, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyA3xBY633zOFgmDtoESeTZAviXGoRAKQnQ",
    authDomain: "avito-manager-3a84b.firebaseapp.com",
    projectId: "avito-manager-3a84b",
    storageBucket: "avito-manager-3a84b.firebasestorage.app",
    messagingSenderId: "205598987349",
    appId: "1:205598987349:web:d8ae2abe3fc8c9ba1f70dc"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Offline persistence — не критично, если упадёт (например, несколько вкладок)
enableIndexedDbPersistence(db).catch(err => {
    console.warn('IndexedDB persistence:', err.code);
});

export {
    collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
    onSnapshot, writeBatch, query, where, orderBy, serverTimestamp,
    signInAnonymously, onAuthStateChanged
};
