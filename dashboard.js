document.addEventListener('app-ready', async function() {

    const uid = window.currentUser.uid;
    const db = window.firebaseDb;
    const stateRef = db.collection('users').doc(uid).collection('dashboard').doc('state');
    
    // Busca estado inicial da nuvem
    let docSnap = await stateRef.get();
    let cloudState = docSnap.exists ? docSnap.data() : { voltas: 0, pending_simulado: false, theme: 'dark', blocks: {}, notes: {}, subjects: {} };

    // === 1. Facade Segura (Firebase) ===
    function safeGet(key) {
        if (key === 'pmba_voltas') return cloudState.voltas;
        if (key === 'pmba_pending_simulado') return cloudState.pending_simulado;
        if (key === 'pmba_theme') return cloudState.theme;
        if (key.startsWith('pmba_block-')) return cloudState.blocks[key.replace('pmba_', '')];
        if (key.startsWith('pmba_note_')) return cloudState.notes[key.replace('pmba_note_', '')];
        if (key.startsWith('pmba_subj_')) return cloudState.subjects[key.replace('pmba_subj_', '')];
        return null;
    }
    
    let saveTimeout;
    function safeSet(key, value) {
        // Atualiza objeto local
        if (key === 'pmba_voltas') cloudState.voltas = parseInt(value, 10);
        else if (key === 'pmba_pending_simulado') cloudState.pending_simulado = (value === 'true' || value === true);
        else if (key === 'pmba_theme') cloudState.theme = value;
        else if (key.startsWith('pmba_block-')) cloudState.blocks[key.replace('pmba_', '')] = value;
        else if (key.startsWith('pmba_note_')) cloudState.notes[key.replace('pmba_note_', '')] = value;
        else if (key.startsWith('pmba_subj_')) cloudState.subjects[key.replace('pmba_subj_', '')] = value;

        // Persiste na nuvem com debounce para n�o floodar
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            stateRef.set(cloudState, { merge: true }).catch(e => console.error("Erro ao salvar no Firestore", e));
        }, 1000);
    }
    function safeRemove(key) {
        safeSet(key, false); // No contexto atual, remove = false/empty
    }

            // === 2. Referências DOM ===
            var checkboxes = document.querySelectorAll('.custom-checkbox input');
            var resetBtn = document.getElementById('reset-btn');
            var voltasCountEl = document.getElementById('voltas-count');
            var simuladoAlert = document.getElementById('simulado-alert');
            var dismissSimulado = document.getElementById('dismiss-simulado');
            var progressCountEl = document.getElementById('progress-count');
            var progressFillEl = document.getElementById('progress-fill');
            var noteBtns = document.querySelectorAll('.note-btn');
            var noteTextareas = document.querySelectorAll('.note-area textarea');

            // === 3. Carregar estado salvo ===

            // Voltas
            var voltas = parseInt(safeGet('pmba_voltas') || '0', 10);
            if (isNaN(voltas)) voltas = 0;
            voltasCountEl.textContent = voltas;

            // Simulado pendente
            var pendingSimulado = safeGet('pmba_pending_simulado') === 'true';
            if (pendingSimulado) {
                simuladoAlert.style.display = 'flex';
            }

            // Checkboxes
            checkboxes.forEach(function(chk) {
                var isChecked = safeGet('pmba_' + chk.id) === 'true';
                chk.checked = isChecked;
                if (isChecked) {
                    chk.closest('.block-card').classList.add('completed');
                }

                chk.addEventListener('change', function(e) {
                    safeSet('pmba_' + e.target.id, e.target.checked);
                    var card = e.target.closest('.block-card');
                    if (e.target.checked) {
                        card.classList.add('completed');
                    } else {
                        card.classList.remove('completed');
                    }
                    updateProgress();
                    updateNextBlock();
                });
            });

            // Anotações
            noteTextareas.forEach(function(ta) {
                var blockNum = ta.getAttribute('data-block');
                var savedNote = safeGet('pmba_note_' + blockNum) || '';
                ta.value = savedNote;

                // Indicador visual se existe nota
                if (savedNote.trim()) {
                    var btn = document.querySelector('.note-btn[data-block="' + blockNum + '"]');
                    if (btn) btn.classList.add('has-note');
                }

                // Salvar automaticamente ao digitar
                ta.addEventListener('input', function() {
                    safeSet('pmba_note_' + blockNum, ta.value);
                    var btn = document.querySelector('.note-btn[data-block="' + blockNum + '"]');
                    if (btn) {
                        if (ta.value.trim().length > 0) {
                            btn.classList.add('has-note');
                        } else {
                            btn.classList.remove('has-note');
                        }
                    }
                });
            });

            // Toggle de anotação
            noteBtns.forEach(function(btn) {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    var card = btn.closest('.block-card');
                    var wasOpen = card.classList.contains('note-open');
                    card.classList.toggle('note-open');

                    if (!wasOpen) {
                        var ta = card.querySelector('.note-area textarea');
                        if (ta) setTimeout(function() { ta.focus(); }, 120);
                    }
                });
            });

            // === 4. Progresso da volta ===
            function updateProgress() {
                var total = checkboxes.length;
                var completed = 0;
                checkboxes.forEach(function(chk) { if (chk.checked) completed++; });

                progressCountEl.textContent = completed + ' / ' + total + ' blocos';
                var percent = total > 0 ? (completed / total) * 100 : 0;
                progressFillEl.style.width = percent + '%';
            }

            // === 5. Indicador do próximo bloco ===
            function updateNextBlock() {
                // Limpar indicadores anteriores
                document.querySelectorAll('.block-card.next-block').forEach(function(el) {
                    el.classList.remove('next-block');
                });
                document.querySelectorAll('.next-badge').forEach(function(el) {
                    el.parentNode.removeChild(el);
                });

                // Encontrar o primeiro bloco não marcado
                for (var i = 0; i < checkboxes.length; i++) {
                    if (!checkboxes[i].checked) {
                        var card = checkboxes[i].closest('.block-card');
                        card.classList.add('next-block');

                        var badge = document.createElement('span');
                        badge.className = 'next-badge brutal-label';
                        badge.textContent = 'PRÓXIMO';
                        card.appendChild(badge);
                        break;
                    }
                }
            }

            // === 6. Concluir Volta ===
            resetBtn.addEventListener('click', function() {
                if (confirm('Você terminou todos os 25 blocos?\n\nIsso irá limpar as marcações e registrar +1 volta completa.\nAs anotações serão preservadas.')) {
                    checkboxes.forEach(function(chk) {
                        chk.checked = false;
                        chk.closest('.block-card').classList.remove('completed');
                        safeRemove('pmba_' + chk.id);
                    });

                    voltas++;
                    safeSet('pmba_voltas', voltas);
                    voltasCountEl.textContent = voltas;

                    // Alerta de simulado a cada 2 voltas
                    if (voltas > 0 && voltas % 2 === 0) {
                        pendingSimulado = true;
                        safeSet('pmba_pending_simulado', 'true');
                        simuladoAlert.style.display = 'flex';
                        window.scrollTo(0, 0);
                    }

                    updateProgress();
                    updateNextBlock();
                }
            });

            // === 7. Dispensar alerta de simulado ===
            dismissSimulado.addEventListener('click', function() {
                pendingSimulado = false;
                safeSet('pmba_pending_simulado', 'false');
                simuladoAlert.style.display = 'none';
            });

            // === 8. Carrossel ===
            var slides = document.querySelectorAll('.hero-slide');
            var dots = document.querySelectorAll('.hero-indicators .dot');
            var prevBtn = document.getElementById('hero-prev');
            var nextBtn = document.getElementById('hero-next');
            var currentSlide = 0;
            var slideInterval;

            function goToSlide(n) {
                slides[currentSlide].classList.remove('active');
                dots[currentSlide].classList.remove('active');
                currentSlide = (n + slides.length) % slides.length;
                slides[currentSlide].classList.add('active');
                dots[currentSlide].classList.add('active');
            }

            function nextSlide() { goToSlide(currentSlide + 1); }
            function prevSlide() { goToSlide(currentSlide - 1); }

            nextBtn.addEventListener('click', function() {
                nextSlide();
                resetInterval();
            });
            prevBtn.addEventListener('click', function() {
                prevSlide();
                resetInterval();
            });

            dots.forEach(function(dot) {
                dot.addEventListener('click', function(e) {
                    var idx = parseInt(e.target.getAttribute('data-index'));
                    goToSlide(idx);
                    resetInterval();
                });
            });

            function startInterval() {
                slideInterval = setInterval(nextSlide, 5000);
            }
            function resetInterval() {
                clearInterval(slideInterval);
                startInterval();
            }
            startInterval();

            // === 9. Tema Light/Dark ===
            var themeBtn = document.getElementById('theme-btn');
            var currentTheme = safeGet('pmba_theme') || 'dark';
            
            function applyTheme(theme) {
                if (theme === 'light') {
                    document.documentElement.setAttribute('data-theme', 'light');
                    themeBtn.textContent = 'MODO ESCURO';
                } else {
                    document.documentElement.removeAttribute('data-theme');
                    themeBtn.textContent = 'MODO CLARO';
                }
            }
            applyTheme(currentTheme);
            
            themeBtn.addEventListener('click', function() {
                currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
                safeSet('pmba_theme', currentTheme);
                applyTheme(currentTheme);
            });

            // === 10. Pomodoro HUD ===
            var pomoWrapper = document.getElementById('pomodoro-wrapper');
            var pomoModeBtn = document.getElementById('pomo-mode-btn');
            var pomoPlayBtn = document.getElementById('pomo-play-btn');
            var pomoResetBtn = document.getElementById('pomo-reset-btn');
            var pomoMinBtn = document.getElementById('pomo-min-btn');
            var pomoMinTab = document.getElementById('pomodoro-min-tab');
            var pomoTimeDisplay = document.getElementById('pomo-time');
            var pomoMinTimeDisplay = document.getElementById('pomo-min-time');

            var pomoModes = { foco: 50 * 60, pausa: 10 * 60 };
            var currentPomoMode = 'foco';
            var pomoTimeLeft = pomoModes[currentPomoMode];
            var pomoInterval = null;
            var isPomoRunning = false;

            function formatPomoTime(seconds) {
                var m = Math.floor(seconds / 60);
                var s = seconds % 60;
                return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
            }

            function updatePomoDisplay() {
                var formatted = formatPomoTime(pomoTimeLeft);
                pomoTimeDisplay.textContent = formatted;
                pomoMinTimeDisplay.textContent = formatted;
                document.title = formatted + " - PMBA Dashboard";
            }

            function playBeep() {
                try {
                    var ctx = new (window.AudioContext || window.webkitAudioContext)();
                    var osc = ctx.createOscillator();
                    var gain = ctx.createGain();
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.type = 'square';
                    osc.frequency.value = 800;
                    gain.gain.setValueAtTime(1, ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.0);
                    osc.start(ctx.currentTime);
                    osc.stop(ctx.currentTime + 1.0);
                } catch(e) {}
            }

            function togglePomo() {
                if (isPomoRunning) {
                    clearInterval(pomoInterval);
                    pomoPlayBtn.textContent = 'INICIAR';
                    isPomoRunning = false;
                } else {
                    pomoPlayBtn.textContent = 'PAUSAR';
                    isPomoRunning = true;
                    pomoInterval = setInterval(function() {
                        pomoTimeLeft--;
                        if (pomoTimeLeft <= 0) {
                            clearInterval(pomoInterval);
                            pomoTimeLeft = 0;
                            isPomoRunning = false;
                            pomoPlayBtn.textContent = 'INICIAR';
                            playBeep();
                            // Piscar fundo agressivo
                            var originalBg = document.body.style.backgroundColor;
                            document.body.style.backgroundColor = 'var(--accent-red)';
                            setTimeout(() => { document.body.style.backgroundColor = originalBg; }, 500);
                            setTimeout(() => { document.body.style.backgroundColor = 'var(--accent-red)'; }, 1000);
                            setTimeout(() => { document.body.style.backgroundColor = originalBg; }, 1500);
                        }
                        updatePomoDisplay();
                    }, 1000);
                }
            }

            function resetPomo() {
                clearInterval(pomoInterval);
                isPomoRunning = false;
                pomoPlayBtn.textContent = 'INICIAR';
                pomoTimeLeft = pomoModes[currentPomoMode];
                updatePomoDisplay();
            }

            pomoModeBtn.addEventListener('click', function() {
                currentPomoMode = currentPomoMode === 'foco' ? 'pausa' : 'foco';
                pomoModeBtn.textContent = currentPomoMode === 'foco' ? 'FOCO (50M)' : 'PAUSA (10M)';
                resetPomo();
            });

            pomoPlayBtn.addEventListener('click', togglePomo);
            pomoResetBtn.addEventListener('click', resetPomo);

            pomoMinBtn.addEventListener('click', function() {
                pomoWrapper.classList.add('minimized');
            });
            pomoMinTab.addEventListener('click', function() {
                pomoWrapper.classList.remove('minimized');
            });

            updatePomoDisplay();

            // === 11. Inicialização ===
            updateProgress();
            updateNextBlock();

            // === 12. Diário de Disciplinas (Global Subject Notes) ===
            var subjectsGrid = document.getElementById('subjects-grid');
            if (subjectsGrid) {
                var uniqueSubjects = [];
                document.querySelectorAll('.block-card .info h4').forEach(function(h4) {
                    var subj = h4.textContent.trim();
                    if (uniqueSubjects.indexOf(subj) === -1) {
                        uniqueSubjects.push(subj);
                    }
                });

                uniqueSubjects.forEach(function(subj) {
                    var subjCard = document.createElement('div');
                    subjCard.className = 'subject-card';
                    
                    var header = document.createElement('div');
                    header.className = 'subject-header';
                    
                    var title = document.createElement('h3');
                    title.textContent = subj;
                    header.appendChild(title);
                    
                    var ta = document.createElement('textarea');
                    var storageKey = 'pmba_subj_' + subj;
                    ta.value = safeGet(storageKey) || '';
                    
                    ta.addEventListener('input', function() {
                        safeSet(storageKey, ta.value);
                    });
                    
                    subjCard.appendChild(header);
                    subjCard.appendChild(ta);
                    subjectsGrid.appendChild(subjCard);
                });
            }

        });
