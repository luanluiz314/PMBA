const SRS_STATES = {
    NEW: 0,
    LEARNING: 1,
    REVIEW: 2,
    RELEARNING: 3,
    SUSPENDED: 4
};

const RATINGS = {
    AGAIN: 1,
    HARD: 2,
    GOOD: 3,
    EASY: 4
};

class SRSEngine {
    // Basic SM-2 inspired implementation to serve as placeholder/baseline for future FSRS.
    
    static processReview(card, rating, now = Date.now()) {
        const log = {
            id: crypto.randomUUID(),
            cardId: card.id,
            deckId: card.deckId,
            timestamp: now,
            rating: rating,
            previousState: card.state,
            previousInterval: card.interval,
            previousEase: card.ease,
            responseTime: 0 // To be set by UI
        };

        if (card.state === SRS_STATES.NEW || card.state === SRS_STATES.LEARNING || card.state === SRS_STATES.RELEARNING) {
            this._processLearning(card, rating);
        } else if (card.state === SRS_STATES.REVIEW) {
            this._processReview(card, rating);
        }

        if (card.ease < 1.3) card.ease = 1.3;

        card.updatedAt = now;
        // Interval is in days. Convert to ms for dueDate.
        card.dueDate = now + (card.interval * 24 * 60 * 60 * 1000); 

        log.newState = card.state;
        log.newInterval = card.interval;
        log.newEase = card.ease;

        return { updatedCard: card, reviewLog: log };
    }

    static _processLearning(card, rating) {
        if (rating === RATINGS.AGAIN) {
            card.interval = 1 / (24 * 60); // 1 minute
            card.state = (card.state === SRS_STATES.RELEARNING) ? SRS_STATES.RELEARNING : SRS_STATES.LEARNING;
        } else if (rating === RATINGS.HARD) {
            card.interval = 5 / (24 * 60); // 5 minutes
            card.state = (card.state === SRS_STATES.RELEARNING) ? SRS_STATES.RELEARNING : SRS_STATES.LEARNING;
        } else if (rating === RATINGS.GOOD) {
            card.interval = 10 / (24 * 60); // 10 minutes
            if (card.state === SRS_STATES.NEW) {
                card.state = SRS_STATES.LEARNING;
            } else {
                card.state = SRS_STATES.REVIEW;
                card.interval = 1; // 1 day
            }
        } else if (rating === RATINGS.EASY) {
            card.interval = 4; // 4 days
            card.state = SRS_STATES.REVIEW;
        }
        card.reps++;
    }

    static _processReview(card, rating) {
        if (rating === RATINGS.AGAIN) {
            card.lapses++;
            card.ease = Math.max(1.3, card.ease - 0.2);
            card.interval = 10 / (24 * 60); // 10 mins
            card.state = SRS_STATES.RELEARNING;
        } else if (rating === RATINGS.HARD) {
            card.ease = Math.max(1.3, card.ease - 0.15);
            card.interval = card.interval * 1.2;
        } else if (rating === RATINGS.GOOD) {
            card.interval = (card.interval === 0 ? 1 : card.interval) * card.ease;
        } else if (rating === RATINGS.EASY) {
            card.ease += 0.15;
            card.interval = (card.interval === 0 ? 1 : card.interval) * card.ease * 1.3;
        }
        card.reps++;
    }

    static buildQueue(cards, limitNew = 20, limitReview = 100) {
        const now = Date.now();
        const queue = [];
        
        // Grouping
        const learning = [];
        const review = [];
        const newCards = [];

        for (let c of cards) {
            if (c.state === SRS_STATES.SUSPENDED) continue;

            if (c.state === SRS_STATES.LEARNING || c.state === SRS_STATES.RELEARNING) {
                if (c.dueDate <= now) learning.push(c);
            } else if (c.state === SRS_STATES.REVIEW) {
                if (c.dueDate <= now) review.push(c);
            } else if (c.state === SRS_STATES.NEW) {
                newCards.push(c);
            }
        }

        // Sort by dueDate
        learning.sort((a,b) => a.dueDate - b.dueDate);
        review.sort((a,b) => a.dueDate - b.dueDate);
        // Sort new cards by creation date (or keep stable)
        
        // Apply limits and push to queue in priority: Learning -> Review -> New
        for (let c of learning) queue.push(c);
        
        let revCount = 0;
        for (let c of review) {
            if (revCount >= limitReview) break;
            queue.push(c);
            revCount++;
        }

        let newCount = 0;
        for (let c of newCards) {
            if (newCount >= limitNew) break;
            queue.push(c);
            newCount++;
        }

        return queue;
    }

    // AI Placeholder
    static generateCardsFromText(text) {
        console.warn("AI generation not implemented yet. Ready for LLM hook.");
        return [];
    }
}

window.SRSEngine = SRSEngine;
window.SRS_STATES = SRS_STATES;
window.RATINGS = RATINGS;
