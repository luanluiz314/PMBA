// Redirecionamento e proteção de rota
const isLoginPage = window.location.pathname.endsWith('login.html');

window.firebaseAuth.onAuthStateChanged((user) => {
    if (user) {
        window.currentUser = user; // Disponibiliza o usuário globalmente
        
        if (isLoginPage) {
            // Se logado e na tela de login, vai pro dashboard
            window.location.href = 'index.html';
        } else {
            // Avisa o sistema que a autenticação está pronta (para migração/carregamento)
            document.dispatchEvent(new CustomEvent('auth-success', { detail: user }));
        }
    } else {
        window.currentUser = null;
        if (!isLoginPage) {
            // Se deslogado e no dashboard, bloqueia e manda pro login
            window.location.href = 'login.html';
        }
    }
});

// Funções de Autenticação
window.loginGoogle = async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        await window.firebaseAuth.signInWithPopup(provider);
    } catch (error) {
        console.error("Erro Google Auth:", error);
        alert("Erro ao entrar com Google: " + error.message);
    }
};

window.loginEmail = async (email, password) => {
    try {
        await window.firebaseAuth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        console.error("Erro Email Auth:", error);
        alert("Erro de login. Verifique email e senha.");
    }
};

window.registerEmail = async (email, password) => {
    try {
        await window.firebaseAuth.createUserWithEmailAndPassword(email, password);
    } catch (error) {
        console.error("Erro Register Auth:", error);
        alert("Erro ao criar conta: " + error.message);
    }
};

window.logout = async () => {
    try {
        await window.firebaseAuth.signOut();
    } catch (error) {
        console.error("Erro ao sair:", error);
    }
};
