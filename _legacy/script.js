const cycleBlocks = [
    { name: "Língua Portuguesa", category: "Linguagens" },
    { name: "Direito Constitucional", category: "Direito Base" },
    { name: "Matemática / RLM", category: "Exatas" },
    { name: "História (BR e BA)", category: "Humanas" },
    { name: "Direito Penal", category: "Direito" },
    { name: "Informática", category: "Tecnologia" },
    { name: "Língua Portuguesa", category: "Linguagens" },
    { name: "Direito Administrativo", category: "Direito" },
    { name: "Matemática / RLM", category: "Exatas" },
    { name: "Geografia (BR e BA)", category: "Humanas" },
    { name: "Direito Penal Militar", category: "Direito Específico" },
    { name: "Direitos Humanos", category: "Direito / Leis Secas" },
    { name: "Língua Portuguesa", category: "Linguagens" },
    { name: "Direito Constitucional", category: "Direito Base" },
    { name: "Matemática / RLM", category: "Exatas" },
    { name: "História (BR e BA)", category: "Humanas" },
    { name: "Direito Penal", category: "Direito" },
    { name: "Informática", category: "Tecnologia" },
    { name: "Direito Constitucional", category: "Direito Base" },
    { name: "Direito Administrativo", category: "Direito" },
    { name: "Geografia (BR e BA)", category: "Humanas" },
    { name: "Direito Penal Militar", category: "Direito Específico" },
    { name: "Igualdade Racial e de Gênero", category: "Direito / Leis Secas" },
    { name: "Atualidades", category: "Humanas" },
    { name: "Prática de Redação", category: "Simulado" }
];

const phases = [
    { id: 1, name: "Aquecimento & Recuperação", duration: 15 * 60 },
    { id: 2, name: "Absorção Ativa", duration: 45 * 60 },
    { id: 3, name: "Prática Imediata", duration: 30 * 60 },
    { id: 4, name: "Consolidação", duration: 10 * 60 }
];

// State
let state = {
    cycle: 1,
    currentBlockIndex: 0,
};

let timerState = {
    intervalId: null,
    timeLeft: 0,
    currentPhaseIndex: -1,
    isRunning: false
};

// Elements
const el = {
    cycleText: document.getElementById('current-cycle-text'),
    progressText: document.getElementById('progress-text'),
    progressFill: document.getElementById('progress-fill'),
    blockCategory: document.getElementById('block-category'),
    blockName: document.getElementById('block-name'),
    blocksList: document.getElementById('blocks-list'),
    
    btnStart: document.getElementById('btn-start'),
    btnComplete: document.getElementById('btn-complete'),
    
    timeDisplay: document.getElementById('time-display'),
    phaseName: document.getElementById('phase-name'),
    btnToggleTimer: document.getElementById('btn-timer-toggle'),
    btnSkipTimer: document.getElementById('btn-timer-skip')
};

// Initialize
function init() {
    loadState();
    renderSidebar();
    updateHeader();
    updateActiveBlockCard();
}

function loadState() {
    const saved = localStorage.getItem('pmba-cycle-state');
    if (saved) {
        state = JSON.parse(saved);
    }
}

function saveState() {
    localStorage.setItem('pmba-cycle-state', JSON.stringify(state));
}

function updateHeader() {
    el.cycleText.textContent = `Ciclo ${state.cycle}`;
    el.progressText.textContent = `Bloco ${state.currentBlockIndex + 1} / 25`;
    const percent = ((state.currentBlockIndex) / 25) * 100;
    el.progressFill.style.width = `${percent}%`;
}

function renderSidebar() {
    el.blocksList.innerHTML = '';
    cycleBlocks.forEach((block, index) => {
        const li = document.createElement('li');
        li.className = 'list-item';
        if (index < state.currentBlockIndex) li.classList.add('completed-item');
        if (index === state.currentBlockIndex) li.classList.add('active-item');
        
        li.innerHTML = `
            <div class="item-number">${index + 1}</div>
            <div class="item-details">
                <div class="item-name">${block.name}</div>
            </div>
        `;
        el.blocksList.appendChild(li);
    });
}

function updateActiveBlockCard() {
    const block = cycleBlocks[state.currentBlockIndex];
    el.blockCategory.textContent = block.category;
    el.blockName.textContent = block.name;
    document.querySelector('.block-status').textContent = 'Pronto para iniciar a sessão.';
}

// Timer Logic
function startSession() {
    el.btnStart.disabled = true;
    el.btnComplete.disabled = true;
    el.btnToggleTimer.disabled = false;
    el.btnSkipTimer.disabled = false;
    
    document.querySelector('.block-status').textContent = 'Sessão em andamento. Foco total.';
    startPhase(0);
}

function startPhase(index) {
    if (index >= phases.length) {
        finishSession();
        return;
    }
    
    timerState.currentPhaseIndex = index;
    timerState.timeLeft = phases[index].duration;
    timerState.isRunning = true;
    
    el.phaseName.textContent = phases[index].name;
    updatePhaseUI();
    
    clearInterval(timerState.intervalId);
    timerState.intervalId = setInterval(tickTimer, 1000);
    el.btnToggleTimer.textContent = 'Pausar';
    updateTimerDisplay();
}

function tickTimer() {
    if (timerState.timeLeft > 0) {
        timerState.timeLeft--;
        updateTimerDisplay();
    } else {
        // Auto-advance to next phase
        new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play().catch(e=>console.log(e));
        startPhase(timerState.currentPhaseIndex + 1);
    }
}

function updateTimerDisplay() {
    const m = Math.floor(timerState.timeLeft / 60).toString().padStart(2, '0');
    const s = (timerState.timeLeft % 60).toString().padStart(2, '0');
    el.timeDisplay.textContent = `${m}:${s}`;
}

function toggleTimer() {
    if (timerState.isRunning) {
        clearInterval(timerState.intervalId);
        timerState.isRunning = false;
        el.btnToggleTimer.textContent = 'Retomar';
    } else {
        timerState.intervalId = setInterval(tickTimer, 1000);
        timerState.isRunning = true;
        el.btnToggleTimer.textContent = 'Pausar';
    }
}

function skipPhase() {
    startPhase(timerState.currentPhaseIndex + 1);
}

function updatePhaseUI() {
    for (let i = 1; i <= 4; i++) {
        const step = document.getElementById(`phase-${i}`);
        step.classList.remove('active', 'completed');
        
        if (i - 1 < timerState.currentPhaseIndex) {
            step.classList.add('completed');
        } else if (i - 1 === timerState.currentPhaseIndex) {
            step.classList.add('active');
        }
    }
}

function finishSession() {
    clearInterval(timerState.intervalId);
    timerState.isRunning = false;
    
    el.timeDisplay.textContent = '00:00';
    el.phaseName.textContent = 'Sessão Concluída!';
    
    for (let i = 1; i <= 4; i++) {
        document.getElementById(`phase-${i}`).classList.remove('active');
        document.getElementById(`phase-${i}`).classList.add('completed');
    }
    
    el.btnToggleTimer.disabled = true;
    el.btnSkipTimer.disabled = true;
    el.btnComplete.disabled = false;
    
    document.querySelector('.block-status').textContent = 'Excelente trabalho! Conclua o bloco para avançar.';
}

function completeBlock() {
    state.currentBlockIndex++;
    if (state.currentBlockIndex >= cycleBlocks.length) {
        state.currentBlockIndex = 0;
        state.cycle++;
    }
    saveState();
    
    // Reset UI
    el.btnStart.disabled = false;
    el.btnComplete.disabled = true;
    el.timeDisplay.textContent = '00:00';
    el.phaseName.textContent = 'Aguardando...';
    
    for (let i = 1; i <= 4; i++) {
        document.getElementById(`phase-${i}`).classList.remove('active', 'completed');
    }
    
    init();
}

// Listeners
el.btnStart.addEventListener('click', startSession);
el.btnComplete.addEventListener('click', completeBlock);
el.btnToggleTimer.addEventListener('click', toggleTimer);
el.btnSkipTimer.addEventListener('click', skipPhase);

// Boot
init();
