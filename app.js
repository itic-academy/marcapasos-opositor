/**
 * MARCAPASOS DEL OPOSITOR
 * Gestor de tiempo estrategico para examenes de oposiciones TIC
 * ITIC Academy
 */

// ==========================================
// ESTADO GLOBAL
// ==========================================

const state = {
    // Configuracion
    totalMinutes: 240,
    blocks: [],
    options: {
        biometric: true,
        halfway: true,
        finalSprint: true,
        warningTime: 5
    },

    // Estado del examen
    isRunning: false,
    isPaused: false,
    currentBlockIndex: 0,

    // Tiempos
    totalSecondsRemaining: 0,
    blockSecondsRemaining: 0,
    blockSecondsAllocated: 0,

    // Historial
    startTime: null,
    blockStartTimes: [],
    blockActualTimes: [],
    panicCount: 0,

    // Intervalos
    timerInterval: null,
    biometricInterval: null,

    // Sonido
    soundEnabled: true,
    volume: 0.7,
    audioContext: null
};

// ==========================================
// PLANTILLAS PREDEFINIDAS
// ==========================================

const templates = {
    'a1': [
        { name: 'Lectura y analisis del enunciado', percentage: 12 },
        { name: 'Pregunta 1', percentage: 8 },
        { name: 'Pregunta 2', percentage: 8 },
        { name: 'Pregunta 3', percentage: 8 },
        { name: 'Pregunta 4', percentage: 8 },
        { name: 'Pregunta 5', percentage: 8 },
        { name: 'Pregunta 6', percentage: 8 },
        { name: 'Pregunta 7', percentage: 8 },
        { name: 'Pregunta 8', percentage: 8 },
        { name: 'Pregunta 9', percentage: 8 },
        { name: 'Pregunta 10', percentage: 8 },
        { name: 'Repaso final', percentage: 8 }
    ],
    'a2': [
        { name: 'Lectura y analisis del enunciado', percentage: 12 },
        { name: 'Pregunta 1', percentage: 16 },
        { name: 'Pregunta 2', percentage: 16 },
        { name: 'Pregunta 3', percentage: 16 },
        { name: 'Pregunta 4', percentage: 16 },
        { name: 'Pregunta 5', percentage: 16 },
        { name: 'Repaso final', percentage: 8 }
    ],
    'informe': [
        { name: 'Lectura y analisis del enunciado', percentage: 12 },
        { name: 'Introduccion', percentage: 13 },
        { name: 'Bloque 1', percentage: 18 },
        { name: 'Bloque 2', percentage: 18 },
        { name: 'Bloque 3', percentage: 18 },
        { name: 'Conclusion', percentage: 13 },
        { name: 'Repaso final', percentage: 8 }
    ],
    'balanced': [
        { name: 'Bloque 1', percentage: 50 },
        { name: 'Bloque 2', percentage: 50 }
    ]
};

// ==========================================
// INICIALIZACION
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    loadSavedState();
    setupEventListeners();
    initializeAudio();
});

function initializeApp() {
    // Cargar plantilla por defecto
    applyTemplate('a2');
    updateTotalTimeDisplay();
}

function loadSavedState() {
    const saved = localStorage.getItem('marcapasos_config');
    if (saved) {
        try {
            const config = JSON.parse(saved);
            state.totalMinutes = config.totalMinutes || 240;
            state.options = { ...state.options, ...config.options };
            if (config.blocks && config.blocks.length > 0) {
                state.blocks = config.blocks;
                renderBlocks();
            }
        } catch (e) {
            console.log('No se pudo cargar configuracion guardada');
        }
    }
}

function saveState() {
    const config = {
        totalMinutes: state.totalMinutes,
        blocks: state.blocks,
        options: state.options
    };
    localStorage.setItem('marcapasos_config', JSON.stringify(config));
}

// ==========================================
// EVENT LISTENERS
// ==========================================

function setupEventListeners() {
    // Selector de tiempo
    document.querySelectorAll('.time-option').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.time-option').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.totalMinutes = parseInt(btn.dataset.minutes);
            document.getElementById('custom-minutes').value = '';
            updateTotalTimeDisplay();
            updateBlockTimes();
        });
    });

    document.getElementById('custom-minutes').addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        if (value >= 30 && value <= 480) {
            document.querySelectorAll('.time-option').forEach(b => b.classList.remove('active'));
            state.totalMinutes = value;
            updateTotalTimeDisplay();
            updateBlockTimes();
        }
    });

    // Plantillas
    document.querySelectorAll('.template-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            applyTemplate(btn.dataset.template);
        });
    });

    // Anadir bloque
    document.getElementById('btn-add-block').addEventListener('click', addBlock);

    // Opciones avanzadas
    document.getElementById('advanced-toggle').addEventListener('click', () => {
        const header = document.getElementById('advanced-toggle');
        const content = document.getElementById('advanced-options');
        header.classList.toggle('open');
        content.classList.toggle('hidden');
    });

    // Checkboxes de opciones
    document.getElementById('opt-biometric').addEventListener('change', (e) => {
        state.options.biometric = e.target.checked;
        saveState();
    });
    document.getElementById('opt-halfway').addEventListener('change', (e) => {
        state.options.halfway = e.target.checked;
        saveState();
    });
    document.getElementById('opt-final-sprint').addEventListener('change', (e) => {
        state.options.finalSprint = e.target.checked;
        saveState();
    });
    document.getElementById('warning-time').addEventListener('change', (e) => {
        state.options.warningTime = parseInt(e.target.value);
        saveState();
    });

    // Boton iniciar
    document.getElementById('btn-start').addEventListener('click', startExam);

    // Controles del examen
    document.getElementById('btn-pause').addEventListener('click', togglePause);
    document.getElementById('btn-next').addEventListener('click', nextBlock);
    document.getElementById('btn-panic').addEventListener('click', showPanicModal);
    document.getElementById('btn-finish').addEventListener('click', confirmFinish);

    // Modal panico
    document.getElementById('btn-panic-cancel').addEventListener('click', hidePanicModal);
    document.getElementById('btn-panic-confirm').addEventListener('click', applyRecalculation);
    document.querySelectorAll('input[name="recalc-mode"]').forEach(input => {
        input.addEventListener('change', updatePanicPreview);
    });

    // Resultados
    document.getElementById('btn-new-exam').addEventListener('click', resetToConfig);
    document.getElementById('btn-export-results').addEventListener('click', exportResults);

    // Configuracion
    document.getElementById('btn-settings').addEventListener('click', showSettingsModal);
    document.getElementById('btn-close-settings').addEventListener('click', hideSettingsModal);
    document.getElementById('btn-sound').addEventListener('click', toggleSound);
    document.getElementById('volume-slider').addEventListener('input', (e) => {
        state.volume = e.target.value / 100;
    });

    // Borrar historial
    const clearDataBtn = document.getElementById('btn-clear-data');
    if (clearDataBtn) {
        clearDataBtn.addEventListener('click', () => {
            if (confirm('Estas seguro de borrar todo el historial?')) {
                localStorage.removeItem('marcapasos_history');
                localStorage.removeItem('marcapasos_config');
                showToast('Historial borrado', 'success');
            }
        });
    }
}

// ==========================================
// GESTION DE BLOQUES
// ==========================================

function applyTemplate(templateName) {
    const template = templates[templateName];
    if (template) {
        state.blocks = template.map(b => ({ ...b }));
        renderBlocks();
        updateSummary();
        saveState();
    }
}

function renderBlocks() {
    const container = document.getElementById('blocks-list');
    container.innerHTML = '';

    state.blocks.forEach((block, index) => {
        const item = document.createElement('div');
        item.className = 'block-item';
        item.draggable = true;
        item.dataset.index = index;

        const minutes = Math.round(state.totalMinutes * block.percentage / 100);

        item.innerHTML = `
            <span class="block-drag-handle">&#9776;</span>
            <input type="text" class="block-name-input" value="${block.name}"
                   data-index="${index}" placeholder="Nombre del bloque">
            <input type="number" class="block-percentage-input" value="${block.percentage}"
                   data-index="${index}" min="1" max="100">
            <span class="block-percentage-label">%</span>
            <span class="block-time-preview">${minutes} min</span>
            <button class="block-delete" data-index="${index}">&times;</button>
        `;

        // Event listeners para inputs
        item.querySelector('.block-name-input').addEventListener('input', (e) => {
            state.blocks[e.target.dataset.index].name = e.target.value;
            saveState();
        });

        item.querySelector('.block-percentage-input').addEventListener('input', (e) => {
            const value = parseInt(e.target.value) || 0;
            state.blocks[e.target.dataset.index].percentage = Math.min(100, Math.max(0, value));
            updateBlockTimes();
            updateSummary();
            saveState();
        });

        item.querySelector('.block-delete').addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.index);
            state.blocks.splice(idx, 1);
            renderBlocks();
            updateSummary();
            saveState();
        });

        // Drag and drop
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('drop', handleDrop);
        item.addEventListener('dragend', handleDragEnd);

        container.appendChild(item);
    });

    updateSummary();
    validateConfig();
}

function addBlock() {
    const newBlock = {
        name: `Bloque ${state.blocks.length + 1}`,
        percentage: 10
    };
    state.blocks.push(newBlock);
    renderBlocks();
    saveState();
}

function updateBlockTimes() {
    document.querySelectorAll('.block-item').forEach((item, index) => {
        if (state.blocks[index]) {
            const minutes = Math.round(state.totalMinutes * state.blocks[index].percentage / 100);
            item.querySelector('.block-time-preview').textContent = `${minutes} min`;
        }
    });
}

function updateTotalTimeDisplay() {
    const hours = Math.floor(state.totalMinutes / 60);
    const mins = state.totalMinutes % 60;
    const display = hours > 0
        ? `${hours} hora${hours > 1 ? 's' : ''}${mins > 0 ? ` ${mins} min` : ''} (${state.totalMinutes} min)`
        : `${state.totalMinutes} minutos`;
    document.getElementById('total-time-display').textContent = display;
}

function updateSummary() {
    const total = state.blocks.reduce((sum, b) => sum + b.percentage, 0);
    const fill = document.getElementById('summary-fill');
    const percentage = document.getElementById('total-percentage');
    const warning = document.getElementById('percentage-warning');

    fill.style.width = `${Math.min(total, 100)}%`;
    percentage.textContent = `${total}%`;

    if (total > 100) {
        fill.classList.add('over');
        fill.classList.remove('complete');
        warning.classList.remove('hidden');
        warning.textContent = '! Excede el 100%';
    } else if (total < 100) {
        fill.classList.remove('over', 'complete');
        warning.classList.remove('hidden');
        warning.textContent = `! Faltan ${100 - total}%`;
    } else {
        fill.classList.remove('over');
        fill.classList.add('complete');
        warning.classList.add('hidden');
    }

    validateConfig();
}

function validateConfig() {
    const total = state.blocks.reduce((sum, b) => sum + b.percentage, 0);
    const startBtn = document.getElementById('btn-start');

    if (total === 100 && state.blocks.length > 0) {
        startBtn.disabled = false;
    } else {
        startBtn.disabled = true;
    }
}

// Drag and drop handlers
let draggedItem = null;

function handleDragStart(e) {
    draggedItem = this;
    this.classList.add('dragging');
}

function handleDragOver(e) {
    e.preventDefault();
}

function handleDrop(e) {
    e.preventDefault();
    if (draggedItem !== this) {
        const fromIndex = parseInt(draggedItem.dataset.index);
        const toIndex = parseInt(this.dataset.index);

        const [removed] = state.blocks.splice(fromIndex, 1);
        state.blocks.splice(toIndex, 0, removed);

        renderBlocks();
        saveState();
    }
}

function handleDragEnd() {
    this.classList.remove('dragging');
    draggedItem = null;
}

// ==========================================
// CONTROL DEL EXAMEN
// ==========================================

function startExam() {
    // Inicializar estado
    state.isRunning = true;
    state.isPaused = false;
    state.currentBlockIndex = 0;
    state.panicCount = 0;
    state.startTime = Date.now();
    state.blockStartTimes = [];
    state.blockActualTimes = state.blocks.map(() => 0);

    // Calcular tiempos
    state.totalSecondsRemaining = state.totalMinutes * 60;
    calculateBlockTime(0);

    // Cambiar pantalla
    document.getElementById('config-screen').classList.add('hidden');
    document.getElementById('exam-screen').classList.remove('hidden');

    // Renderizar navegacion
    renderBlocksNavigation();

    // Actualizar UI
    updateExamUI();

    // Iniciar timer
    state.timerInterval = setInterval(tick, 1000);

    // Iniciar gong biometrico
    if (state.options.biometric) {
        startBiometricTraining();
    }

    // Registrar inicio de bloque
    state.blockStartTimes[0] = Date.now();

    // Sonido de inicio
    playSound('start');

    showToast('Examen iniciado. Mucha suerte!', 'success');
}

function calculateBlockTime(blockIndex) {
    if (blockIndex >= state.blocks.length) return;

    const block = state.blocks[blockIndex];
    state.blockSecondsAllocated = Math.round(state.totalMinutes * 60 * block.percentage / 100);
    state.blockSecondsRemaining = state.blockSecondsAllocated;
}

function tick() {
    if (state.isPaused || !state.isRunning) return;

    // Decrementar tiempos
    state.totalSecondsRemaining--;
    state.blockSecondsRemaining--;

    // Registrar tiempo usado en bloque actual
    state.blockActualTimes[state.currentBlockIndex]++;

    // Actualizar UI
    updateExamUI();

    // Verificar alertas
    checkAlerts();

    // Verificar fin de tiempo total
    if (state.totalSecondsRemaining <= 0) {
        finishExam();
    }
}

function updateExamUI() {
    // Timer principal
    document.getElementById('main-timer').textContent = formatTime(state.totalSecondsRemaining);

    // Progreso principal
    const mainProgress = ((state.totalMinutes * 60 - state.totalSecondsRemaining) / (state.totalMinutes * 60)) * 100;
    document.getElementById('main-progress').style.width = `${mainProgress}%`;

    // Bloque actual
    const block = state.blocks[state.currentBlockIndex];
    document.getElementById('block-number').textContent = state.currentBlockIndex + 1;
    document.getElementById('block-name').textContent = block.name;
    document.getElementById('block-allocated').textContent = `${Math.round(state.blockSecondsAllocated / 60)} min asignados`;
    document.getElementById('block-percentage').textContent = `${block.percentage}%`;

    // Timer del bloque
    const blockTimeDisplay = state.blockSecondsRemaining >= 0
        ? formatTime(state.blockSecondsRemaining)
        : '-' + formatTime(Math.abs(state.blockSecondsRemaining));
    document.getElementById('block-timer').textContent = blockTimeDisplay;

    // Progreso del bloque
    const blockProgress = ((state.blockSecondsAllocated - state.blockSecondsRemaining) / state.blockSecondsAllocated) * 100;
    const blockProgressEl = document.getElementById('block-progress');
    blockProgressEl.style.width = `${Math.min(blockProgress, 100)}%`;

    // Estado del semaforo
    updateTrafficLight();
}

function updateTrafficLight() {
    const container = document.getElementById('app-container');
    const currentBlock = document.getElementById('current-block');
    const blockProgress = document.getElementById('block-progress');
    const lights = {
        green: document.getElementById('light-green'),
        yellow: document.getElementById('light-yellow'),
        red: document.getElementById('light-red')
    };
    const statusText = document.getElementById('status-text');

    // Resetear estados
    Object.values(lights).forEach(l => l.classList.remove('active'));
    container.classList.remove('status-green', 'status-yellow', 'status-red');
    currentBlock.classList.remove('warning', 'danger');
    blockProgress.classList.remove('warning', 'danger');

    const warningSeconds = state.options.warningTime * 60;

    if (state.blockSecondsRemaining <= 0) {
        // ROJO - Tiempo agotado
        lights.red.classList.add('active');
        container.classList.add('status-red');
        currentBlock.classList.add('danger');
        blockProgress.classList.add('danger');
        statusText.textContent = 'PASA A LA SIGUIENTE!';

    } else if (state.blockSecondsRemaining <= warningSeconds) {
        // AMARILLO - Quedan pocos minutos
        lights.yellow.classList.add('active');
        container.classList.add('status-yellow');
        currentBlock.classList.add('warning');
        blockProgress.classList.add('warning');
        statusText.textContent = `Quedan ${Math.ceil(state.blockSecondsRemaining / 60)} minutos`;

    } else {
        // VERDE - Todo bien
        lights.green.classList.add('active');
        container.classList.add('status-green');
        statusText.textContent = 'Todo bajo control';
    }
}

function checkAlerts() {
    const warningSeconds = state.options.warningTime * 60;

    // Alerta de fin de bloque
    if (state.blockSecondsRemaining === warningSeconds) {
        playSound('warning');
        showToast(`Quedan ${state.options.warningTime} minutos para este bloque`, 'warning');
    }

    // Alerta de tiempo agotado de bloque
    if (state.blockSecondsRemaining === 0) {
        playSound('urgent');
        showToast('Tiempo de bloque agotado! Considera pasar al siguiente', 'danger');
    }

    // Alerta a mitad de bloque
    if (state.options.halfway && state.blockSecondsRemaining === Math.floor(state.blockSecondsAllocated / 2)) {
        playSound('chime');
        showToast('Mitad del tiempo del bloque', 'info');
    }

    // Sprint final (ultimos 30 minutos)
    if (state.options.finalSprint && state.totalSecondsRemaining === 1800) {
        playSound('urgent');
        showToast('SPRINT FINAL - Ultimos 30 minutos!', 'warning');
    }

    // Ultimos 10 minutos
    if (state.totalSecondsRemaining === 600) {
        playSound('urgent');
        showToast('ATENCION: Ultimos 10 minutos!', 'danger');
    }

    // Ultimo minuto
    if (state.totalSecondsRemaining === 60) {
        playSound('urgent');
        showToast('ULTIMO MINUTO!', 'danger');
    }
}

function renderBlocksNavigation() {
    const grid = document.getElementById('blocks-nav-grid');
    grid.innerHTML = '';

    state.blocks.forEach((block, index) => {
        const navBlock = document.createElement('div');
        navBlock.className = 'nav-block';
        navBlock.textContent = index + 1;
        navBlock.dataset.index = index;

        if (index === state.currentBlockIndex) {
            navBlock.classList.add('current');
        }

        navBlock.addEventListener('click', () => jumpToBlock(index));
        grid.appendChild(navBlock);
    });
}

function updateBlocksNavigation() {
    const navBlocks = document.querySelectorAll('.nav-block');
    navBlocks.forEach((nav, index) => {
        nav.classList.remove('current', 'completed', 'skipped');

        if (index < state.currentBlockIndex) {
            nav.classList.add('completed');
        } else if (index === state.currentBlockIndex) {
            nav.classList.add('current');
        }
    });
}

function jumpToBlock(index) {
    if (index === state.currentBlockIndex) return;
    if (index >= state.blocks.length) return;

    // Cambiar al nuevo bloque
    state.currentBlockIndex = index;
    calculateBlockTime(index);
    state.blockStartTimes[index] = Date.now();

    updateBlocksNavigation();
    updateExamUI();

    playSound('chime');
}

function nextBlock() {
    if (state.currentBlockIndex >= state.blocks.length - 1) {
        // Es el ultimo bloque
        confirmFinish();
        return;
    }

    jumpToBlock(state.currentBlockIndex + 1);
    showToast(`Bloque ${state.currentBlockIndex + 1} iniciado`, 'success');
}

function togglePause() {
    state.isPaused = !state.isPaused;

    const btn = document.getElementById('btn-pause');
    if (state.isPaused) {
        btn.innerHTML = '<span class="btn-icon-large">&#9654;</span><span>Reanudar</span>';
        showToast('Examen pausado', 'info');
    } else {
        btn.innerHTML = '<span class="btn-icon-large">&#10074;&#10074;</span><span>Pausar</span>';
        showToast('Examen reanudado', 'info');
    }
}

// ==========================================
// MODO PANICO
// ==========================================

function showPanicModal() {
    const modal = document.getElementById('panic-modal');

    // Calcular tiempo de mas usado
    const overtime = state.blockSecondsAllocated - state.blockSecondsRemaining;
    const overtimeMinutes = Math.max(0, Math.floor(overtime / 60));

    document.getElementById('panic-overtime').textContent = `+${overtimeMinutes} min`;
    document.getElementById('panic-remaining-blocks').textContent =
        state.blocks.length - state.currentBlockIndex - 1;

    updatePanicPreview();
    modal.classList.remove('hidden');
}

function hidePanicModal() {
    document.getElementById('panic-modal').classList.add('hidden');
}

function updatePanicPreview() {
    const mode = document.querySelector('input[name="recalc-mode"]:checked').value;
    const preview = document.getElementById('panic-preview');

    // Tiempo de mas usado
    const overtime = Math.max(0, state.blockSecondsAllocated - state.blockSecondsRemaining);
    const remainingBlocks = state.blocks.slice(state.currentBlockIndex + 1);

    if (remainingBlocks.length === 0) {
        preview.innerHTML = '<p>No hay mas bloques. Finaliza el examen.</p>';
        return;
    }

    let html = '';

    if (mode === 'proportional') {
        // Recorte proporcional
        const totalRemainingPercent = remainingBlocks.reduce((sum, b) => sum + b.percentage, 0);

        remainingBlocks.forEach((block, i) => {
            const originalSeconds = Math.round(state.totalMinutes * 60 * block.percentage / 100);
            const reduction = Math.round(overtime * (block.percentage / totalRemainingPercent));
            const newSeconds = Math.max(60, originalSeconds - reduction);

            html += `
                <div class="panic-preview-item">
                    <span>${block.name}</span>
                    <span class="panic-preview-old">${Math.round(originalSeconds/60)} min</span>
                    <span class="panic-preview-new">${Math.round(newSeconds/60)} min</span>
                </div>
            `;
        });
    } else {
        // Sacrificar repaso (ultimo bloque)
        const lastBlock = remainingBlocks[remainingBlocks.length - 1];
        const lastBlockSeconds = Math.round(state.totalMinutes * 60 * lastBlock.percentage / 100);
        const newLastSeconds = Math.max(0, lastBlockSeconds - overtime);

        remainingBlocks.forEach((block, i) => {
            const originalSeconds = Math.round(state.totalMinutes * 60 * block.percentage / 100);
            const isLast = i === remainingBlocks.length - 1;
            const newSeconds = isLast ? newLastSeconds : originalSeconds;

            html += `
                <div class="panic-preview-item">
                    <span>${block.name}</span>
                    <span class="panic-preview-old">${Math.round(originalSeconds/60)} min</span>
                    <span class="panic-preview-new">${Math.round(newSeconds/60)} min</span>
                </div>
            `;
        });
    }

    preview.innerHTML = html;
}

function applyRecalculation() {
    const mode = document.querySelector('input[name="recalc-mode"]:checked').value;
    const overtime = Math.max(0, state.blockSecondsAllocated - state.blockSecondsRemaining);
    const remainingBlocks = state.blocks.slice(state.currentBlockIndex + 1);

    if (remainingBlocks.length === 0) {
        hidePanicModal();
        return;
    }

    if (mode === 'proportional') {
        const totalRemainingPercent = remainingBlocks.reduce((sum, b) => sum + b.percentage, 0);

        state.blocks.forEach((block, i) => {
            if (i > state.currentBlockIndex) {
                const reduction = Math.round(overtime * (block.percentage / totalRemainingPercent));
                const originalSeconds = Math.round(state.totalMinutes * 60 * block.percentage / 100);
                const newSeconds = Math.max(60, originalSeconds - reduction);
                block.adjustedSeconds = newSeconds;
            }
        });
    } else {
        // Sacrificar el ultimo bloque
        const lastIndex = state.blocks.length - 1;
        if (lastIndex > state.currentBlockIndex) {
            const lastBlock = state.blocks[lastIndex];
            const lastBlockSeconds = Math.round(state.totalMinutes * 60 * lastBlock.percentage / 100);
            lastBlock.adjustedSeconds = Math.max(0, lastBlockSeconds - overtime);
        }
    }

    // Avanzar al siguiente bloque
    state.panicCount++;

    // Recalcular tiempo del siguiente bloque
    if (state.currentBlockIndex < state.blocks.length - 1) {
        const nextBlock = state.blocks[state.currentBlockIndex + 1];
        if (nextBlock.adjustedSeconds !== undefined) {
            state.blockSecondsAllocated = nextBlock.adjustedSeconds;
        }
    }

    hidePanicModal();
    nextBlock();

    playSound('recalc');
    showToast('Tiempo recalculado. Animo!', 'warning');
}

// ==========================================
// FINALIZACION
// ==========================================

function confirmFinish() {
    if (confirm('Estas seguro de que quieres finalizar el examen?')) {
        finishExam();
    }
}

function finishExam() {
    state.isRunning = false;

    // Detener timers
    if (state.timerInterval) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
    }
    if (state.biometricInterval) {
        clearInterval(state.biometricInterval);
        state.biometricInterval = null;
    }

    // Calcular resultados
    const totalTimeUsed = state.totalMinutes * 60 - state.totalSecondsRemaining;
    const completedBlocks = state.currentBlockIndex + 1;

    // Mostrar pantalla de resultados
    document.getElementById('exam-screen').classList.add('hidden');
    document.getElementById('results-screen').classList.remove('hidden');

    // Actualizar resultados
    document.getElementById('result-total-time').textContent = formatTime(totalTimeUsed);
    document.getElementById('result-completed').textContent = `${completedBlocks}/${state.blocks.length}`;
    document.getElementById('result-panics').textContent = state.panicCount;

    // Desglose por bloque
    renderBreakdown();

    // Generar consejos
    generateTips();

    // Guardar historial
    saveExamHistory(totalTimeUsed, completedBlocks);

    playSound('complete');
}

function renderBreakdown() {
    const container = document.getElementById('breakdown-list');
    container.innerHTML = '';

    state.blocks.forEach((block, index) => {
        const allocated = Math.round(state.totalMinutes * 60 * block.percentage / 100);
        const actual = state.blockActualTimes[index] || 0;
        const diff = actual - allocated;

        let statusClass = '';
        let statusIcon = '';

        if (actual === 0) {
            statusIcon = '&#9744;'; // Sin completar
        } else if (diff > 60) {
            statusClass = 'over';
            statusIcon = '&#9888;'; // Excedido
        } else if (diff < -60) {
            statusClass = 'under';
            statusIcon = '&#9889;'; // Rapido
        } else {
            statusIcon = '&#9989;'; // OK
        }

        container.innerHTML += `
            <div class="breakdown-item">
                <div class="breakdown-number">${index + 1}</div>
                <div class="breakdown-name">${block.name}</div>
                <div class="breakdown-times">
                    <span class="breakdown-allocated">${Math.round(allocated/60)} min</span>
                    <span class="breakdown-actual ${statusClass}">${Math.round(actual/60)} min</span>
                </div>
                <div class="breakdown-status">${statusIcon}</div>
            </div>
        `;
    });
}

function generateTips() {
    const container = document.getElementById('tips-list');
    const tips = [];

    // Analizar rendimiento
    let totalOvertime = 0;
    let blocksOvertime = 0;

    state.blocks.forEach((block, index) => {
        const allocated = Math.round(state.totalMinutes * 60 * block.percentage / 100);
        const actual = state.blockActualTimes[index] || 0;

        if (actual > allocated + 120) {
            totalOvertime += (actual - allocated);
            blocksOvertime++;
        }
    });

    if (blocksOvertime > 2) {
        tips.push({
            icon: '&#9201;',
            text: 'Tendencia a exceder el tiempo. Practica con limites mas estrictos.'
        });
    }

    if (state.panicCount > 0) {
        tips.push({
            icon: '&#9888;',
            text: `Usaste el recalculo ${state.panicCount} vez(ces). Intenta mejorar la planificacion inicial.`
        });
    }

    const firstBlockTime = state.blockActualTimes[0] || 0;
    const firstBlockAllocated = Math.round(state.totalMinutes * 60 * state.blocks[0].percentage / 100);

    if (firstBlockTime > firstBlockAllocated * 1.3) {
        tips.push({
            icon: '&#128161;',
            text: 'La primera pregunta te llevo demasiado tiempo. Considera empezar por preguntas mas cortas.'
        });
    }

    if (tips.length === 0) {
        tips.push({
            icon: '&#127881;',
            text: 'Excelente gestion del tiempo! Sigue asi.'
        });
    }

    container.innerHTML = tips.map(tip => `
        <div class="tip-item">
            <span class="tip-icon">${tip.icon}</span>
            <span>${tip.text}</span>
        </div>
    `).join('');
}

function saveExamHistory(timeUsed, completedBlocks) {
    const history = JSON.parse(localStorage.getItem('marcapasos_history') || '[]');

    history.push({
        date: new Date().toISOString(),
        totalMinutes: state.totalMinutes,
        timeUsed,
        completedBlocks,
        totalBlocks: state.blocks.length,
        panicCount: state.panicCount,
        blocks: state.blocks.map((b, i) => ({
            name: b.name,
            allocated: Math.round(state.totalMinutes * 60 * b.percentage / 100),
            actual: state.blockActualTimes[i] || 0
        }))
    });

    // Mantener solo los ultimos 20 examenes
    if (history.length > 20) {
        history.shift();
    }

    localStorage.setItem('marcapasos_history', JSON.stringify(history));
}

function exportResults() {
    const results = {
        fecha: new Date().toLocaleString('es-ES'),
        tiempoTotal: state.totalMinutes + ' minutos',
        tiempoUsado: formatTime(state.totalMinutes * 60 - state.totalSecondsRemaining),
        bloquesCompletados: state.currentBlockIndex + 1,
        totalBloques: state.blocks.length,
        recalculos: state.panicCount,
        desglose: state.blocks.map((b, i) => ({
            nombre: b.name,
            tiempoAsignado: Math.round(state.totalMinutes * 60 * b.percentage / 100 / 60) + ' min',
            tiempoReal: Math.round((state.blockActualTimes[i] || 0) / 60) + ' min'
        }))
    };

    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `marcapasos_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    showToast('Resultados exportados', 'success');
}

function resetToConfig() {
    // Resetear estado
    state.isRunning = false;
    state.isPaused = false;
    state.currentBlockIndex = 0;
    state.blockActualTimes = [];

    // Limpiar intervalos
    if (state.timerInterval) clearInterval(state.timerInterval);
    if (state.biometricInterval) clearInterval(state.biometricInterval);

    // Cambiar pantalla
    document.getElementById('results-screen').classList.add('hidden');
    document.getElementById('exam-screen').classList.add('hidden');
    document.getElementById('config-screen').classList.remove('hidden');

    // Limpiar estado visual del semaforo
    document.getElementById('app-container').classList.remove('status-green', 'status-yellow', 'status-red');
}

// ==========================================
// ENTRENAMIENTO BIOMETRICO
// ==========================================

function startBiometricTraining() {
    // Gong cada 15 minutos para entrenar el reloj biologico
    let biometricCount = 0;

    state.biometricInterval = setInterval(() => {
        if (!state.isPaused && state.isRunning) {
            biometricCount++;
            if (biometricCount % 15 === 0) { // Cada 15 minutos (15 * 60 segundos)
                playSound('gong');
            }
        }
    }, 60000); // Check cada minuto
}

// ==========================================
// SISTEMA DE AUDIO
// ==========================================

function initializeAudio() {
    // Web Audio API para mejor control
    try {
        state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
        console.log('Web Audio API no disponible');
    }
}

function playSound(type) {
    if (!state.soundEnabled) return;

    // Crear sonidos sintetizados
    if (!state.audioContext) {
        initializeAudio();
    }

    if (!state.audioContext) return;

    const ctx = state.audioContext;
    const now = ctx.currentTime;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    gainNode.gain.value = state.volume;

    switch(type) {
        case 'start':
            // Sonido de inicio - acorde mayor ascendente
            playChord([261.63, 329.63, 392.00], 0.3);
            break;

        case 'chime':
            // Campanada suave
            oscillator.frequency.value = 523.25;
            oscillator.type = 'sine';
            gainNode.gain.setValueAtTime(state.volume * 0.5, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
            oscillator.start(now);
            oscillator.stop(now + 0.8);
            break;

        case 'warning':
            // Dos pitidos de advertencia
            playBeeps([440, 440], 0.15, 0.1);
            break;

        case 'urgent':
            // Tres pitidos urgentes
            playBeeps([880, 880, 880], 0.1, 0.05);
            break;

        case 'gong':
            // Gong tibetano (frecuencia baja con armonicos)
            playGong();
            break;

        case 'complete':
            // Fanfarria de fin
            playChord([261.63, 329.63, 392.00, 523.25], 0.5);
            break;

        case 'recalc':
            // Sonido de recalculo
            playBeeps([330, 440], 0.2, 0.1);
            break;

        default:
            oscillator.frequency.value = 440;
            oscillator.type = 'sine';
            gainNode.gain.setValueAtTime(state.volume * 0.3, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            oscillator.start(now);
            oscillator.stop(now + 0.3);
    }
}

function playBeeps(frequencies, duration, gap) {
    const ctx = state.audioContext;
    let time = ctx.currentTime;

    frequencies.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.frequency.value = freq;
        osc.type = 'sine';

        const startTime = time + i * (duration + gap);
        gain.gain.setValueAtTime(state.volume * 0.4, startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

        osc.start(startTime);
        osc.stop(startTime + duration);
    });
}

function playChord(frequencies, duration) {
    const ctx = state.audioContext;
    const now = ctx.currentTime;

    frequencies.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.frequency.value = freq;
        osc.type = 'sine';

        const delay = i * 0.05;
        gain.gain.setValueAtTime(0, now + delay);
        gain.gain.linearRampToValueAtTime(state.volume * 0.2, now + delay + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, now + delay + duration);

        osc.start(now + delay);
        osc.stop(now + delay + duration);
    });
}

function playGong() {
    const ctx = state.audioContext;
    const now = ctx.currentTime;

    // Frecuencia base baja con armonicos
    const frequencies = [65.41, 130.81, 196.00, 261.63];

    frequencies.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.frequency.value = freq;
        osc.type = 'sine';

        const volume = state.volume * (0.3 - i * 0.05);
        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 3);

        osc.start(now);
        osc.stop(now + 3);
    });
}

function toggleSound() {
    state.soundEnabled = !state.soundEnabled;
    const icon = document.getElementById('sound-icon');
    icon.textContent = state.soundEnabled ? '\u{1F50A}' : '\u{1F507}';
    showToast(state.soundEnabled ? 'Sonido activado' : 'Sonido desactivado', 'info');
}

// ==========================================
// UTILIDADES
// ==========================================

function formatTime(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const icon = toast.querySelector('.toast-icon');
    const msg = toast.querySelector('.toast-message');

    const icons = {
        success: '&#9989;',
        warning: '&#9888;',
        danger: '&#10060;',
        info: '&#8505;'
    };

    icon.innerHTML = icons[type] || icons.info;
    msg.textContent = message;

    toast.classList.remove('hidden');

    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

function showSettingsModal() {
    document.getElementById('settings-modal').classList.remove('hidden');
}

function hideSettingsModal() {
    document.getElementById('settings-modal').classList.add('hidden');
}

// Inicializacion al cargar opciones guardadas
document.getElementById('opt-biometric').checked = state.options.biometric;
document.getElementById('opt-halfway').checked = state.options.halfway;
document.getElementById('opt-final-sprint').checked = state.options.finalSprint;
document.getElementById('warning-time').value = state.options.warningTime;
