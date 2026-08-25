const DB_NAME = 'PMBA_SRS';
const DB_VERSION = 1;

class SRSDatabase {
    constructor() {
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                if (!db.objectStoreNames.contains('decks')) {
                    db.createObjectStore('decks', { keyPath: 'id' });
                }
                
                if (!db.objectStoreNames.contains('cards')) {
                    const cardsStore = db.createObjectStore('cards', { keyPath: 'id' });
                    cardsStore.createIndex('deckId', 'deckId', { unique: false });
                    cardsStore.createIndex('dueDate', 'dueDate', { unique: false });
                    cardsStore.createIndex('state', 'state', { unique: false });
                }
                
                if (!db.objectStoreNames.contains('reviewLogs')) {
                    const logsStore = db.createObjectStore('reviewLogs', { keyPath: 'id' });
                    logsStore.createIndex('cardId', 'cardId', { unique: false });
                    logsStore.createIndex('deckId', 'deckId', { unique: false });
                    logsStore.createIndex('timestamp', 'timestamp', { unique: false });
                }

                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve();
            };

            request.onerror = (event) => {
                console.error("IndexedDB initialization error:", event.target.error);
                reject(event.target.error);
            };
        });
    }

    // --- Decks ---
    async getDecks() { return this._getAll('decks'); }
    async putDeck(deck) { return this._put('decks', deck); }
    async getDeck(id) { return this._get('decks', id); }

    // --- Cards ---
    async getCardsByDeck(deckId) { return this._getAllByIndex('cards', 'deckId', deckId); }
    async putCard(card) { return this._put('cards', card); }
    async getCard(id) { return this._get('cards', id); }
    async deleteCard(id) { return this._delete('cards', id); }

    // --- Logs ---
    async addReviewLog(log) { return this._put('reviewLogs', log); }

    // --- Generic Internal Methods ---
    _put(storeName, item) {
        return new Promise((resolve, reject) => {
            if(!this.db) return reject('DB not initialized');
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(item);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    _get(storeName, id) {
        return new Promise((resolve, reject) => {
            if(!this.db) return reject('DB not initialized');
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    _getAll(storeName) {
        return new Promise((resolve, reject) => {
            if(!this.db) return reject('DB not initialized');
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    _getAllByIndex(storeName, indexName, indexValue) {
        return new Promise((resolve, reject) => {
            if(!this.db) return reject('DB not initialized');
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const index = store.index(indexName);
            const request = index.getAll(indexValue);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    _delete(storeName, id) {
        return new Promise((resolve, reject) => {
            if(!this.db) return reject('DB not initialized');
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}

window.srsDB = new SRSDatabase();
