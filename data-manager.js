document.addEventListener('DOMContentLoaded', () => {
    const btnExport = document.getElementById('btn-export-data');
    const btnImport = document.getElementById('btn-import-data');
    const inputImport = document.getElementById('input-import-data');

    if (!btnExport || !btnImport || !inputImport) return;

    btnExport.addEventListener('click', async () => {
        try {
            const exportData = {
                version: "1.0",
                exportedAt: new Date().toISOString(),
                localStorage: {},
                indexedDB: {
                    decks: [],
                    cards: [],
                    reviewLogs: [],
                    settings: []
                }
            };

            // 1. Coletar localStorage
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith('pmba_')) {
                    exportData.localStorage[key] = localStorage.getItem(key);
                }
            }

            // 2. Coletar IndexedDB
            if (window.srsDB && window.srsDB.db) {
                exportData.indexedDB.decks = await window.srsDB._getAll('decks');
                exportData.indexedDB.cards = await window.srsDB._getAll('cards');
                exportData.indexedDB.reviewLogs = await window.srsDB._getAll('reviewLogs');
                exportData.indexedDB.settings = await window.srsDB._getAll('settings');
            }

            // 3. Gerar arquivo JSON
            const dataStr = JSON.stringify(exportData, null, 2);
            const blob = new Blob([dataStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            
            // 4. Download
            const a = document.createElement('a');
            a.href = url;
            const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
            a.download = `pmba-backup-${dateStr}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            alert("Backup exportado com sucesso!");
        } catch (e) {
            console.error("Erro ao exportar dados:", e);
            alert("Erro ao exportar dados. Veja o console.");
        }
    });

    btnImport.addEventListener('click', () => {
        inputImport.click();
    });

    inputImport.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const importData = JSON.parse(event.target.result);
                
                if (!importData.version || !importData.localStorage || !importData.indexedDB) {
                    throw new Error("Formato de arquivo inválido.");
                }

                if (!confirm("Atenção! Isso irá APAGAR todos os seus dados atuais (progresso, notas, flashcards) e substituir pelos dados do arquivo.\n\nDeseja continuar?")) {
                    inputImport.value = ''; // Reset input
                    return;
                }

                // 1. Restaurar localStorage
                // Primeiro limpa apenas as chaves pmba_ atuais
                const keysToRemove = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key.startsWith('pmba_')) keysToRemove.push(key);
                }
                keysToRemove.forEach(k => localStorage.removeItem(k));
                
                // Depois insere as novas
                for (const [key, value] of Object.entries(importData.localStorage)) {
                    localStorage.setItem(key, value);
                }

                // 2. Restaurar IndexedDB
                if (window.srsDB && window.srsDB.db) {
                    // Helper para limpar object store
                    const clearStore = (storeName) => {
                        return new Promise((resolve, reject) => {
                            const tx = window.srsDB.db.transaction([storeName], 'readwrite');
                            const store = tx.objectStore(storeName);
                            const req = store.clear();
                            req.onsuccess = resolve;
                            req.onerror = reject;
                        });
                    };

                    await clearStore('decks');
                    await clearStore('cards');
                    await clearStore('reviewLogs');
                    await clearStore('settings');

                    for (const deck of importData.indexedDB.decks) await window.srsDB.putDeck(deck);
                    for (const card of importData.indexedDB.cards) await window.srsDB.putCard(card);
                    for (const log of importData.indexedDB.reviewLogs) await window.srsDB.addReviewLog(log);
                }

                alert("Dados importados com sucesso! A página será recarregada.");
                window.location.reload();
                
            } catch (err) {
                console.error("Erro ao importar dados:", err);
                alert("Erro ao importar dados: " + err.message);
            }
            inputImport.value = ''; // Reset
        };
        reader.readAsText(file);
    });
});
