const firebaseConfig = {
  apiKey: "AIzaSyDjOL4ceAGxTSUi2txVMrqVibMORRynKVM",
  authDomain: "pmba-20296.firebaseapp.com",
  projectId: "pmba-20296",
  storageBucket: "pmba-20296.firebasestorage.app",
  messagingSenderId: "3945262553",
  appId: "1:3945262553:web:0d3b78ae09f80335fdfdc8",
  measurementId: "G-8BNWKTE0MM"
};

// Inicializa Firebase usando bibliotecas Compat (suporta protocolo file:// local)
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

// Ativa persistência offline (Cache local = suporte de desempenho/offline)
db.enablePersistence({ synchronizeTabs: true })
  .catch((err) => {
      console.warn("Falha ao ativar cache offline do Firestore:", err.code);
  });

// Expõe globalmente para a aplicação
window.firebaseAuth = auth;
window.firebaseDb = db;
