// Inicializa a UI do Flashcard APÓS o login e a nuvem estarem prontos
document.addEventListener('app-ready', async () => {
    
    // UI Elements
    const elDecksGrid = document.getElementById('decks-grid');
    const btnFcAdd = document.getElementById('btn-fc-add');
    
    // Add Modal Elements
    const modalAdd = document.getElementById('modal-fc-add');
    const btnCloseAdd = document.getElementById('btn-fc-close-add');
    const inputAddDeck = document.getElementById('fc-add-deck');
    const inputAddFront = document.getElementById('fc-add-front');
    const inputAddBack = document.getElementById('fc-add-back');
    const inputAddTags = document.getElementById('fc-add-tags');
    const btnSaveCard = document.getElementById('btn-fc-save');

    // Review Modal Elements
    const overlayReview = document.getElementById('fc-review-overlay');
    const btnRevClose = document.getElementById('btn-rev-close');
    const revDeckName = document.getElementById('rev-deck-name');
    const revCount = document.getElementById('rev-count');
    const card3d = document.getElementById('fc-card-3d');
    const revFrontText = document.getElementById('rev-front-text');
    const revFrontClone = document.getElementById('rev-front-text-clone');
    const revBackText = document.getElementById('rev-back-text');
    const btnShow = document.getElementById('btn-rev-show');
    const showContainer = document.getElementById('rev-show-container');
    const rateContainer = document.getElementById('rev-rate-container');
    const rateButtons = document.querySelectorAll('.btn-rate');

    let currentQueue = [];
    let currentCard = null;
    let reviewSessionActive = false;

    // --- Init ---
    try {
        await window.srsDB.init();
        await syncDecks();
        await renderDecks();
    } catch (e) {
        console.error("Failed to initialize SRS DB:", e);
        elDecksGrid.innerHTML = `<p style="color:red; padding:1rem;">Erro Anki: ${e.message}</p>`;
    }

    // --- Core Logic ---
    async function syncDecks() {
        const uniqueSubjects = [];
        document.querySelectorAll('.block-card .info h4').forEach(h4 => {
            const subj = h4.textContent.trim();
            if (uniqueSubjects.indexOf(subj) === -1) uniqueSubjects.push(subj);
        });

        for (const subj of uniqueSubjects) {
            // Remove barras para não quebrar o caminho do Firestore (users/uid/decks/ID)
            let deckId = 'deck_' + subj.toLowerCase().replace(/[\/\\]/g, '-').replace(/\s+/g, '_');
            let existing = await window.srsDB.getDeck(deckId);
            if (!existing) {
                await window.srsDB.putDeck({
                    id: deckId,
                    name: subj,
                    createdAt: Date.now()
                });
            }
        }
    }

    async function renderDecks() {
        elDecksGrid.innerHTML = '';
        inputAddDeck.innerHTML = '';

        const decks = await window.srsDB.getDecks();
        const now = Date.now();

        for (const deck of decks) {
            // Add to dropdown
            const opt = document.createElement('option');
            opt.value = deck.id;
            opt.textContent = deck.name;
            inputAddDeck.appendChild(opt);

            // Fetch cards to calculate stats
            const cards = await window.srsDB.getCardsByDeck(deck.id);
            
            let newCount = 0;
            let learnCount = 0;
            let revCount = 0;

            for (const c of cards) {
                if (c.state === window.SRS_STATES.SUSPENDED) continue;
                if (c.state === window.SRS_STATES.NEW) newCount++;
                else if (c.state === window.SRS_STATES.LEARNING || c.state === window.SRS_STATES.RELEARNING) {
                    if (c.dueDate <= now) learnCount++;
                } else if (c.state === window.SRS_STATES.REVIEW) {
                    if (c.dueDate <= now) revCount++;
                }
            }

            const totalDue = newCount + learnCount + revCount;

            const cardHtml = `
                <div class="deck-card brutal-label">
                    <h3>${deck.name}</h3>
                    <div class="deck-stats">
                        <span>NOVOS: <strong class="new">${newCount}</strong></span>
                        <span>APRENDER: <strong class="learn">${learnCount}</strong></span>
                        <span style="margin-top:0.5rem;">REVISAR: <strong class="review">${revCount}</strong></span>
                    </div>
                    <button class="btn-hero btn-deck-study" data-deck="${deck.id}" ${totalDue === 0 ? 'disabled' : ''}>
                        ${totalDue === 0 ? 'TUDO FEITO' : 'ESTUDAR (' + totalDue + ')'}
                    </button>
                </div>
            `;
            elDecksGrid.insertAdjacentHTML('beforeend', cardHtml);
        }

        document.querySelectorAll('.btn-deck-study').forEach(btn => {
            btn.addEventListener('click', (e) => {
                startReviewSession(e.target.getAttribute('data-deck'));
            });
        });
    }

    // --- Modal Add Card ---
    btnFcAdd.addEventListener('click', () => { modalAdd.style.display = 'flex'; });
    btnCloseAdd.addEventListener('click', () => { modalAdd.style.display = 'none'; });

    btnSaveCard.addEventListener('click', async () => {
        const front = inputAddFront.value.trim();
        const back = inputAddBack.value.trim();
        const deckId = inputAddDeck.value;
        const tags = inputAddTags.value.split(',').map(t => t.trim()).filter(t => t);

        if (!front || !back || !deckId) {
            alert('Preencha deck, frente e verso.');
            return;
        }

        const newCard = {
            id: crypto.randomUUID(),
            deckId: deckId,
            front: front,
            back: back,
            tags: tags,
            state: window.SRS_STATES.NEW,
            dueDate: Date.now(),
            interval: 0,
            ease: 2.5,
            reps: 0,
            lapses: 0,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        await window.srsDB.putCard(newCard);
        
        inputAddFront.value = '';
        inputAddBack.value = '';
        inputAddTags.value = '';
        
        // Visual feedback
        const oldText = btnSaveCard.textContent;
        btnSaveCard.textContent = 'SALVO COM SUCESSO!';
        btnSaveCard.style.background = '#00ffaa';
        btnSaveCard.style.color = '#000';
        setTimeout(() => {
            btnSaveCard.textContent = oldText;
            btnSaveCard.style.background = '';
            btnSaveCard.style.color = '';
        }, 1500);

        await renderDecks();
    });

    // --- Review Session ---
    async function startReviewSession(deckId) {
        const deck = await window.srsDB.getDeck(deckId);
        const cards = await window.srsDB.getCardsByDeck(deckId);
        
        currentQueue = window.SRSEngine.buildQueue(cards);
        
        if (currentQueue.length === 0) {
            alert("Não há cartões pendentes para este deck agora.");
            return;
        }

        reviewSessionActive = true;
        revDeckName.textContent = deck.name;
        overlayReview.style.display = 'flex';
        
        loadNextCard();
    }

    function loadNextCard() {
        if (currentQueue.length === 0) {
            endReviewSession();
            return;
        }

        currentCard = currentQueue[0]; // peek
        revCount.textContent = currentQueue.length;
        
        // Reset UI
        card3d.classList.remove('flipped');
        showContainer.style.display = 'flex';
        rateContainer.style.display = 'none';

        revFrontText.textContent = currentCard.front;
        revFrontClone.textContent = currentCard.front;
        revBackText.textContent = currentCard.back;
    }

    function revealAnswer() {
        if (!reviewSessionActive || card3d.classList.contains('flipped')) return;
        card3d.classList.add('flipped');
        showContainer.style.display = 'none';
        rateContainer.style.display = 'flex';
    }

    async function submitRating(ratingStr) {
        if (!reviewSessionActive || !card3d.classList.contains('flipped')) return;
        
        const rating = parseInt(ratingStr);
        if (isNaN(rating) || rating < 1 || rating > 4) return;

        // Process SRS logic
        const { updatedCard, reviewLog } = window.SRSEngine.processReview(currentCard, rating);
        
        // Save to IndexedDB
        await window.srsDB.putCard(updatedCard);
        await window.srsDB.addReviewLog(reviewLog);

        // Remove from queue
        currentQueue.shift();

        // If user pressed AGAIN (1) or HARD (2) in Learning, we might want to re-insert it in the queue for this same session.
        // For simplicity in this v1, if it's due today still, re-append it.
        if (updatedCard.dueDate <= Date.now()) {
            currentQueue.push(updatedCard);
        }

        loadNextCard();
    }

    function endReviewSession() {
        reviewSessionActive = false;
        currentCard = null;
        currentQueue = [];
        overlayReview.style.display = 'none';
        renderDecks();
    }

    btnShow.addEventListener('click', revealAnswer);
    btnRevClose.addEventListener('click', endReviewSession);
    
    rateButtons.forEach(btn => {
        btn.addEventListener('click', (e) => submitRating(e.target.getAttribute('data-rating')));
    });

    // --- Keyboard Shortcuts ---
    document.addEventListener('keydown', (e) => {
        // Ignore if typing in inputs
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

        if (reviewSessionActive) {
            if (e.key === 'Escape') {
                endReviewSession();
            } else if (e.code === 'Space' || e.key === ' ') {
                e.preventDefault();
                revealAnswer();
            } else if (['1','2','3','4'].includes(e.key)) {
                submitRating(e.key);
            }
        }
    });
    // --- Delete in Review ---
    const btnRevDelete = document.getElementById('btn-rev-delete');
    if (btnRevDelete) {
        btnRevDelete.addEventListener('click', async () => {
            if (!currentCard) return;
            if (confirm('Tem certeza que deseja apagar este cartão permanentemente?')) {
                await window.srsDB.deleteCard(currentCard.id);
                currentQueue.shift(); // Remove from current queue
                loadNextCard();
            }
        });
    }

    // --- Manage Cards ---
    const btnFcManage = document.getElementById('btn-fc-manage');
    const modalManage = document.getElementById('modal-fc-manage');
    const btnCloseManage = document.getElementById('btn-fc-close-manage');
    const selectManageDeck = document.getElementById('fc-manage-deck');
    const listManageCards = document.getElementById('fc-manage-list');

    if (btnFcManage) {
        btnFcManage.addEventListener('click', async () => {
            modalManage.style.display = 'flex';
            await loadManageDecks();
        });

        btnCloseManage.addEventListener('click', () => {
            modalManage.style.display = 'none';
            renderDecks(); // update stats if cards were deleted
        });

        selectManageDeck.addEventListener('change', async () => {
            await renderManageCardsList(selectManageDeck.value);
        });

        async function loadManageDecks() {
            selectManageDeck.innerHTML = '<option value="">-- Todos os Decks --</option>';
            const decks = await window.srsDB.getDecks();
            for (const deck of decks) {
                const opt = document.createElement('option');
                opt.value = deck.id;
                opt.textContent = deck.name;
                selectManageDeck.appendChild(opt);
            }
            await renderManageCardsList(''); // load all by default
        }

        async function renderManageCardsList(deckId) {
            listManageCards.innerHTML = '<p class="brutal-label" style="color:var(--text-secondary); padding:1rem;">Carregando...</p>';
            let cards = [];
            if (deckId) {
                cards = await window.srsDB.getCardsByDeck(deckId);
            } else {
                cards = await window.srsDB._getAll('cards');
            }

            if (cards.length === 0) {
                listManageCards.innerHTML = '<p class="brutal-label" style="color:var(--text-secondary); padding:1rem;">Nenhum cartão encontrado.</p>';
                return;
            }

            listManageCards.innerHTML = '';
            for (const card of cards) {
                const cardEl = document.createElement('div');
                cardEl.style.cssText = 'border: 1px solid var(--border-color); padding: 0.75rem; display:flex; justify-content:space-between; gap:1rem; align-items:center; background: var(--bg-main);';
                
                const textDiv = document.createElement('div');
                textDiv.style.cssText = 'flex:1; overflow:hidden; display:flex; flex-direction:column; gap:0.25rem;';
                textDiv.innerHTML = `
                    <div style="font-size:0.75rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:var(--text-primary);"><strong>F:</strong> ${card.front}</div>
                    <div style="font-size:0.65rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:var(--text-secondary);"><strong>V:</strong> ${card.back}</div>
                `;

                const delBtn = document.createElement('button');
                delBtn.className = 'btn-hero';
                delBtn.style.cssText = 'padding:0.3rem 0.5rem; font-size:0.6rem; color:var(--accent-red); border-color:var(--accent-red); margin-bottom:0; cursor:pointer;';
                delBtn.textContent = 'APAGAR';
                delBtn.onclick = async () => {
                    if (confirm('Apagar este cartão permanentemente?')) {
                        await window.srsDB.deleteCard(card.id);
                        cardEl.remove();
                    }
                };

                cardEl.appendChild(textDiv);
                cardEl.appendChild(delBtn);
                listManageCards.appendChild(cardEl);
            }
        }
    }
});
