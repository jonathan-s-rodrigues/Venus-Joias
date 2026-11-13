import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
const firebaseConfig = {
  apiKey: "AIzaSyCW99N-Ok683zmhwcTRSAeZ1o5fxLvSs44",
  authDomain: "pedidos-venus-joias.firebaseapp.com",
  projectId: "pedidos-venus-joias",
  storageBucket: "pedidos-venus-joias.firebasestorage.app",
  messagingSenderId: "504751234156",
  appId: "1:504751234156:web:dcf8f4c9b416c5d0fa4c49",
  measurementId: "G-K4RLW60R85"
};
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
