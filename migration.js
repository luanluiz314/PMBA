async function migrateLocalDataToFirestore() {
    const uid = window.currentUser.uid;
    const db = window.firebaseDb;
    const userRef = db.collection('users').doc(uid);
    
    // Verifica se a migração já ocorreu
    const doc = await userRef.get();
    if (doc.exists && doc.data().migrationDone) {
        console.log("Migração já realizada anteriormente.");
        return;
    }

    console.log("Iniciando migração de dados locais para o Firestore...");

    try {
        // 1. Migrar LocalStorage (dashboard state)
        const dashboardState = { voltas: 0, pending_simulado: false, theme: 'dark', blocks: {}, notes: {}, subjects: {} };
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const val = localStorage.getItem(key);
            
            if (key === 'pmba_voltas') dashboardState.voltas = parseInt(val, 10);
            else if (key === 'pmba_pending_simulado') dashboardState.pending_simulado = (val === 'true');
            else if (key === 'pmba_theme') dashboardState.theme = val;
            else if (key.startsWith('pmba_block-')) dashboardState.blocks[key.replace('pmba_', '')] = (val === 'true');
            else if (key.startsWith('pmba_note_')) dashboardState.notes[key.replace('pmba_note_', '')] = val;
            else if (key.startsWith('pmba_subj_')) dashboardState.subjects[key.replace('pmba_subj_', '')] = val;
        }

        await userRef.collection('dashboard').doc('state').set(dashboardState);

        // 2. Migrar IndexedDB (Flashcards/SRS) se existir
        if (window.srsDB && window.srsDB.db && window.srsDB.db.constructor.name !== 'Firestore') {
            // O db.js já foi refatorado para Firebase, então o IndexedDB original se foi dessa variável.
            // Precisamos acessá-lo manualmente via IDB para ler os dados antigos, ou usar o data-manager.
            // Para simplificar: o usuário pode usar o Exportar/Importar, mas o escopo pediu automação.
            
            const request = indexedDB.open("PMBA_SRS");
            
            request.onsuccess = async (event) => {
                const idb = event.target.result;
                
                const migrateStore = async (storeName, collectionName) => {
                    if (!idb.objectStoreNames.contains(storeName)) return;
                    return new Promise((resolve) => {
                        const tx = idb.transaction(storeName, 'readonly');
                        const store = tx.objectStore(storeName);
                        const getAllReq = store.getAll();
                        
                        getAllReq.onsuccess = async () => {
                            const items = getAllReq.result;
                            const batch = db.batch();
                            let count = 0;
                            for (const item of items) {
                                // Evita que barras no ID quebrem o Firestore (ex: "deck_matemática_/_rlm")
                                const safeId = item.id.toString().replace(/[\/\\]/g, '-');
                                item.id = safeId;
                                if (item.deckId) {
                                    item.deckId = item.deckId.toString().replace(/[\/\\]/g, '-');
                                }
                                
                                const docRef = userRef.collection(collectionName).doc(safeId);
                                batch.set(docRef, item);
                                count++;
                                if (count === 490) { // Limite do batch do Firestore é 500
                                    await batch.commit();
                                    count = 0;
                                }
                            }
                            if (count > 0) await batch.commit();
                            resolve();
                        };
                    });
                };

                await migrateStore('decks', 'decks');
                await migrateStore('cards', 'cards');
                await migrateStore('reviewLogs', 'reviewLogs');
                
                // Marca como concluído
                await userRef.set({ migrationDone: true, email: window.currentUser.email, createdAt: Date.now() }, { merge: true });
                console.log("Migração concluída com sucesso!");
                
                // Recarrega para usar o Firestore
                window.location.reload();
            };
            
            request.onerror = async () => {
                // Se falhar o IDB, salva só o state e continua
                await userRef.set({ migrationDone: true, email: window.currentUser.email, createdAt: Date.now() }, { merge: true });
                window.location.reload();
            };
        } else {
            // Se não tem IDB, marca como concluído
            await userRef.set({ migrationDone: true, email: window.currentUser.email, createdAt: Date.now() }, { merge: true });
            console.log("Migração de state concluída.");
            window.location.reload();
        }
    } catch (e) {
        console.error("Erro na migração:", e);
        alert("Erro ao migrar seus dados para a nuvem. Operando em modo de segurança.");
    }
}

// Inicia a migração logo que a autenticação estiver pronta, antes de carregar o app
document.addEventListener('auth-success', async (e) => {
    // Aguarda a migração, se houver
    await migrateLocalDataToFirestore();
    
    // Dispara evento para o dashboard iniciar
    document.dispatchEvent(new CustomEvent('app-ready'));
});
