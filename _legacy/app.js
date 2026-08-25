const EDITAL_PMBA = {
    gerais: [
        "Língua Portuguesa",
        "Matemática",
        "História do Brasil",
        "Geografia do Brasil",
        "Atualidades",
        "Informática"
    ],
    especificos: [
        "Direito Constitucional",
        "Direitos Humanos",
        "Direito Administrativo",
        "Direito Penal",
        "Igualdade Racial e de Gênero",
        "Direito Penal Militar"
    ]
};

let appState = {
    hours: 3,
    subjects: [],
    cycleDay: 1,
    currentPool: [],
    todayBlocks: [],
    tomorrowBlocks: [],
    afterBlocks: [],
    completedTasksToday: 0,
    totalTasksToday: 0
};

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialization and State Loading
    let savedState = null;
    try {
        savedState = localStorage.getItem('pmba_state');
    } catch (e) {
        console.warn("LocalStorage is not available (common in file:///):", e);
    }
    
    if (savedState) {
        try {
            appState = JSON.parse(savedState);
            renderDashboardView();
            document.getElementById('setup-view').classList.remove('active');
            document.getElementById('dashboard-view').classList.add('active');
        } catch (e) {
            console.error("Failed to parse saved state:", e);
            initSetup();
        }
    } else {
        initSetup();
    }
    
    // 2. Event Listeners Setup
    document.getElementById('generate-btn').addEventListener('click', generateAlgorithm);
    document.getElementById('reset-btn').addEventListener('click', resetSetup);
    document.getElementById('finish-day-btn').addEventListener('click', finishDay);
    
    // Event Delegation for Task Completion (Removes need for global inline handlers)
    document.getElementById('dashboard-view').addEventListener('click', handleDashboardClicks);
});

function initSetup() {
    renderSetupList('gerais-list', EDITAL_PMBA.gerais);
    renderSetupList('especificos-list', EDITAL_PMBA.especificos);
}

function handleDashboardClicks(e) {
    if (e.target.classList.contains('check-btn') && !e.target.disabled) {
        const btn = e.target;
        const card = btn.closest('.task-card');
        
        if (!card.classList.contains('completed')) {
            card.classList.add('completed');
            btn.textContent = btn.classList.contains('block-complete-btn') ? 'Finalizado' : 'Concluído';
            btn.disabled = true;
            
            card.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.disabled = true);
            
            appState.completedTasksToday++;
            updateProgress();
        }
    }
}

function renderSetupList(containerId, subjects) {
    const container = document.getElementById(containerId);
    subjects.forEach(sub => {
        const div = document.createElement('div');
        div.className = 'subject-item';
        
        const isHighWeight = (sub === "Língua Portuguesa" || sub === "Matemática");
        
        div.innerHTML = `
            <span class="subject-name">${sub}</span>
            <div class="select-group">
                <select class="difficulty-select" data-subject="${sub}" data-type="${containerId.includes('gerais') ? 'gerais' : 'especificos'}">
                    <option value="1">Dificuldade: Fácil</option>
                    <option value="2" selected>Dificuldade: Média</option>
                    <option value="3">Dificuldade: Difícil</option>
                </select>
                <select class="weight-select">
                    <option value="1" ${!isHighWeight ? 'selected' : ''}>Peso: Normal</option>
                    <option value="2" ${isHighWeight ? 'selected' : ''}>Peso: Alto</option>
                </select>
            </div>
        `;
        container.appendChild(div);
    });
}

function generateAlgorithm() {
    appState.hours = parseInt(document.getElementById('available-hours').value) || 3;
    appState.subjects = [];
    appState.cycleDay = 1;
    
    const items = document.querySelectorAll('.subject-item');
    items.forEach(item => {
        const diffSelect = item.querySelector('.difficulty-select');
        const weightSelect = item.querySelector('.weight-select');
        
        const difficulty = parseInt(diffSelect.value);
        const weight = parseInt(weightSelect.value);
        
        appState.subjects.push({
            name: diffSelect.getAttribute('data-subject'),
            type: diffSelect.getAttribute('data-type'),
            priority: difficulty * weight
        });
    });

    appState.currentPool = [...appState.subjects].sort((a, b) => b.priority - a.priority);
    
    calculateUpcomingDays();
    saveState();
    
    renderDashboardView();
    
    document.getElementById('setup-view').classList.remove('active');
    document.getElementById('dashboard-view').classList.add('active');
}

function calculateUpcomingDays() {
    let tempPool = JSON.parse(JSON.stringify(appState.currentPool));
    let lastType = null;
    let allDays = [];

    // Calculate 3 days ahead
    for (let d = 0; d < 3; d++) {
        let dailyBlocks = [];
        let simDay = appState.cycleDay + d;
        let hoursToDraw = appState.hours;
        
        // Inject Redação Logic elegantly
        if (simDay % 7 === 0) {
            dailyBlocks.push({ name: "Produção de Redação (Prova Discursiva)", type: "especificos", priority: 99, isRedacao: true });
            hoursToDraw--;
        }
        
        for (let h = 0; h < hoursToDraw; h++) {
            lastType = drawFromPool(tempPool, dailyBlocks, lastType);
        }
        allDays.push(dailyBlocks);
    }
    
    appState.todayBlocks = allDays[0];
    appState.tomorrowBlocks = allDays[1];
    appState.afterBlocks = allDays[2];
    
    // Commit tempPool state changes for TODAY's blocks to the real pool
    appState.currentPool = JSON.parse(JSON.stringify(appState.currentPool));
    let realLastType = null;
    let todayHoursToDraw = appState.hours;
    appState.todayBlocks = [];
    
    if (appState.cycleDay % 7 === 0) {
        appState.todayBlocks.push({ name: "Produção de Redação (Prova Discursiva)", type: "especificos", priority: 99, isRedacao: true });
        todayHoursToDraw--;
    }
    
    for (let h = 0; h < todayHoursToDraw; h++) {
        realLastType = drawFromPool(appState.currentPool, appState.todayBlocks, realLastType);
    }
}

// BUGFIX: Return the selected.type to correctly update the lastType reference in the caller loop
function drawFromPool(pool, dailyBlocksArray, lastType) {
    let bestIndex = pool.findIndex(sub => sub.type !== lastType);
    if (bestIndex === -1) bestIndex = 0;
    
    let selected = pool.splice(bestIndex, 1)[0];
    dailyBlocksArray.push(selected);
    
    if (pool.length === 0) {
        pool.push(...JSON.parse(JSON.stringify(appState.subjects)).sort((a, b) => b.priority - a.priority));
    }
    
    return selected.type; 
}

function renderDashboardView() {
    document.getElementById('cycle-stats').textContent = `Dia de Estudo #${appState.cycleDay}`;
    
    appState.completedTasksToday = 0;
    appState.totalTasksToday = 2 + appState.todayBlocks.length;
    updateProgress();

    const container = document.getElementById('daily-blocks');
    container.innerHTML = '';
    const template = document.getElementById('block-template');

    appState.todayBlocks.forEach((block, index) => {
        const clone = template.content.cloneNode(true);
        const card = clone.querySelector('.block-card');
        
        if (block.isRedacao) {
            clone.querySelector('.subject-tag').textContent = 'Prática Discursiva';
            clone.querySelector('.subject-title').textContent = block.name;
            clone.querySelector('.flow-steps').innerHTML = `
                <div class="step"><label><b>1h</b> Escrever redação estilo FCC (20-30 linhas)</label></div>
            `;
        } else {
            clone.querySelector('.subject-tag').textContent = block.type === 'gerais' ? 'Gerais' : 'Específicos';
            clone.querySelector('.subject-title').textContent = `Bloco ${index + 1}: ${block.name}`;
        }
        
        const checkboxes = clone.querySelectorAll('.step-check');
        const completeBtn = clone.querySelector('.block-complete-btn');
        
        if (checkboxes.length > 0) {
            checkboxes.forEach(cb => {
                cb.addEventListener('change', () => {
                    const allChecked = Array.from(checkboxes).every(c => c.checked);
                    completeBtn.disabled = !allChecked;
                    completeBtn.textContent = allChecked ? "Concluir" : "Em Andamento";
                });
            });
        } else {
             completeBtn.disabled = false;
             completeBtn.textContent = "Concluir Redação";
        }

        container.appendChild(clone);
    });
    
    renderPredictions(appState.tomorrowBlocks, appState.afterBlocks);
    checkFinishDay();
}

// BUGFIX: XSS Prevention - Use DOM creation instead of innerHTML for external dynamic text
function renderPredictions(tomorrow, dayAfter) {
    const tomContainer = document.getElementById('pred-tomorrow');
    const afterContainer = document.getElementById('pred-after');
    
    tomContainer.innerHTML = '';
    afterContainer.innerHTML = '';
    
    tomorrow.forEach(b => {
        const li = document.createElement('li');
        li.textContent = b.name;
        tomContainer.appendChild(li);
    });
    
    dayAfter.forEach(b => {
        const li = document.createElement('li');
        li.textContent = b.name;
        afterContainer.appendChild(li);
    });
}

function updateProgress() {
    const percent = Math.round((appState.completedTasksToday / appState.totalTasksToday) * 100);
    document.getElementById('progress-percent').textContent = `${percent}%`;
    document.getElementById('progress-bar-fill').style.width = `${percent}%`;
    
    checkFinishDay();
}

function checkFinishDay() {
    const btn = document.getElementById('finish-day-btn');
    if (appState.completedTasksToday === appState.totalTasksToday) {
        btn.disabled = false;
        btn.style.background = 'var(--text-primary)';
        btn.style.color = 'var(--bg-base)';
    } else {
        btn.disabled = true;
        btn.style.background = 'var(--border-color)';
        btn.style.color = 'var(--text-secondary)';
    }
}

function finishDay() {
    appState.cycleDay++;
    calculateUpcomingDays();
    saveState();
    
    document.querySelectorAll('.priority-card').forEach(card => {
        card.classList.remove('completed');
        card.querySelector('.check-btn').textContent = 'Concluir';
        card.querySelector('.check-btn').disabled = false;
    });
    
    renderDashboardView();
    window.scrollTo({ top: 0, behavior: 'smooth' }); // UX Improvement
}

function saveState() {
    try {
        localStorage.setItem('pmba_state', JSON.stringify(appState));
    } catch (e) {
        console.warn("Could not save state to localStorage:", e);
    }
}

function resetSetup() {
    if(confirm("Tem certeza? Isso apagará todo o seu progresso salvo.")) {
        try {
            localStorage.removeItem('pmba_state');
        } catch (e) {}
        location.reload();
    }
}
