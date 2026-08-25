class SRSDatabase {
    constructor() {
        this.db = window.firebaseDb;
    }

    _getUserRef() {
        if (!window.currentUser) throw new Error("Usuário não autenticado");
        return this.db.collection('users').doc(window.currentUser.uid);
    }

    async init() {
        // Inicialização vazia pois o Firebase já está iniciado no firebase-config.js
        return Promise.resolve();
    }

    // --- Decks ---
    async getDecks() {
        const snapshot = await this._getUserRef().collection('decks').get();
        return snapshot.docs.map(doc => doc.data());
    }

    async putDeck(deck) {
        deck.updatedAt = Date.now();
        await this._getUserRef().collection('decks').doc(deck.id).set(deck);
        return deck;
    }

    async getDeck(id) {
        const doc = await this._getUserRef().collection('decks').doc(id).get();
        return doc.exists ? doc.data() : null;
    }

    // --- Cards ---
    async getCardsByDeck(deckId) {
        const snapshot = await this._getUserRef().collection('cards').where('deckId', '==', deckId).get();
        return snapshot.docs.map(doc => doc.data());
    }

    async putCard(card) {
        card.updatedAt = Date.now();
        await this._getUserRef().collection('cards').doc(card.id).set(card);
        return card;
    }

    async getCard(id) {
        const doc = await this._getUserRef().collection('cards').doc(id).get();
        return doc.exists ? doc.data() : null;
    }

    async deleteCard(id) {
        await this._getUserRef().collection('cards').doc(id).delete();
    }

    // --- Logs ---
    async addReviewLog(log) {
        await this._getUserRef().collection('reviewLogs').doc(log.id).set(log);
        return log;
    }

    // --- Generic Internal Methods para manter compatibilidade com migração ---
    async _getAll(collectionName) {
        const snapshot = await this._getUserRef().collection(collectionName).get();
        return snapshot.docs.map(doc => doc.data());
    }
}

// Substitui o IndexedDB antigo pelo novo baseado em Firestore
window.srsDB = new SRSDatabase();
