/**
 * @file script.js
 * @description Gestione completa per un planner di turni interattivo.
 * @version 23 
 * @summary Versione consolidata con tutte le funzionalità, inclusi Schemi di Ordinamento e Scambio Matrici.
 */

// Test e fallback per localStorage
try {
    localStorage.setItem('test', 'test');
    localStorage.removeItem('test');
} catch(e) {
    console.warn('LocalStorage non disponibile, usando memoria temporanea');
    // Fallback per localStorage
    window.localStorage = {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
        clear: () => {}
    };
}

// Dichiarazione globale di appState
let appState = {
    currentDate: new Date(),
    currentTheme: "standard",
    colorizeShiftText: false,
    show3DEffect: true,
    showModSymbols: true,
    showCoverageInfo: true,
    showPerformanceBars: true,
    showAssignments: true,
    showShiftHours: false, 
    showMatrixOnly: false,
    isAssignmentMode: false,
    appearance: {
        toggleColor: "#4f46e5",
        workCellBgColor: "#dbeafe",
        workCellTextColor: "#1e40af",
        highlightBgColor: "#eef2ff",
        showSundayBars: true
    },
    daySummaryModalPosition: { top: null, left: null },
    operatori: [],
    turni: [],
    matrici: [],
    assignments: [],
    reasons: [],
    plannerData: {},
    coverageOptimal: {},
    validationRules: {
        minRestHours: 11,
        maxConsecutiveDays: 5
    },
    matriceSwaps: [],
    orderingSchemes: []
};

// Funzioni di utilità globali
function getMonthKey(date) { return `${date.getFullYear()}-${date.getMonth()}`; }
function getDaysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }
function dateDiffInDays(a, b) { const _MS_PER_DAY = 86400000; const utc1 = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate()); const utc2 = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()); return Math.floor((utc2 - utc1) / _MS_PER_DAY); }
function getActiveOperators(year, month, includeInactive = false) {
    const monthStartDate = new Date(year, month, 1);
    const monthEndDate = new Date(year, month + 1, 0);
    return appState.operatori.filter(op => {
        if (!includeInactive && !op.isActive) return false;
        if (op.isCounted === undefined) op.isCounted = true; 
        const opStartDate = new Date(op.dataInizio);
        const opEndDate = new Date(op.dataFine);
        return monthEndDate >= opStartDate && monthStartDate <= opEndDate;
    });
}
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    const typeClasses = {
        info: 'bg-gray-800 text-white',
        success: 'bg-green-600 text-white',
        error: 'bg-red-600 text-white',
        warning: 'bg-yellow-600 text-white'
    };
    toast.className = `p-4 rounded-lg shadow-xl text-sm font-semibold transition-all duration-300 transform translate-x-full opacity-0 ${typeClasses[type] || typeClasses.info}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.remove('translate-x-full', 'opacity-0');
    }, 10);
    setTimeout(() => {
        toast.classList.add('translate-x-full', 'opacity-0');
        setTimeout(() => container.removeChild(toast), 300);
    }, duration);
}

// Funzioni di supporto mobile
function isMobileDevice() {
    return window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function setupMobileOptimizations() {
    if (isMobileDevice()) {
        // Aggiungi classe mobile al body
        document.body.classList.add('mobile-device');
        
        // Ottimizza scroll per mobile
        const plannerContainer = document.querySelector('.planner-container-wrapper');
        if (plannerContainer) {
            plannerContainer.style.overflowX = 'auto';
            plannerContainer.style.webkitOverflowScrolling = 'touch';
        }
        
        // Gestione orientamento
        window.addEventListener('orientationchange', function() {
            setTimeout(() => {
                renderPlanner();
            }, 100);
        });
        
        // Migliora performance touch
        document.addEventListener('touchstart', function() {}, { passive: true });
        document.addEventListener('touchmove', function() {}, { passive: true });
    }
}

// Funzione per gestire il merge dei turni su mobile
function handleMobileTurnMerge(cellElement) {
    if (!isMobileDevice()) return false;
    
    // Implementa logica di merge touch-friendly
    const longPressTimer = setTimeout(() => {
        cellElement.classList.add('merge-mode');
        // Mostra indicatori visivi per merge
        showMergeIndicators(cellElement);
    }, 800); // Long press di 800ms
    
    cellElement.addEventListener('touchend', () => {
        clearTimeout(longPressTimer);
    }, { once: true });
    
    return true;
}

function showMergeIndicators(cellElement) {
    // Aggiungi indicatori visivi per il merge
    const indicator = document.createElement('div');
    indicator.className = 'merge-indicator';
    indicator.innerHTML = '🔗';
    cellElement.appendChild(indicator);
    
    setTimeout(() => {
        if (indicator.parentNode) {
            indicator.parentNode.removeChild(indicator);
        }
    }, 3000);
}

// Funzione per gestire tap rapidi su mobile
function handleMobileTap(cellElement, event) {
    if (!isMobileDevice()) return false;
    
    // Previeni il comportamento di default per evitare doppi click
    event.preventDefault();
    
    // Aggiungi feedback visivo per il tap
    cellElement.classList.add('tap-feedback');
    setTimeout(() => {
        cellElement.classList.remove('tap-feedback');
    }, 150);
    
    // Simula il click normale
    const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
    });
    cellElement.dispatchEvent(clickEvent);
    
    return true;
}

// Funzione per migliorare la gestione dei modali su mobile
function optimizeModalForMobile(modalElement) {
    if (!isMobileDevice() || !modalElement) return;
    
    // Aggiungi classe mobile al modale
    modalElement.classList.add('mobile-optimized');
    
    // Gestisci il ridimensionamento del viewport
    const handleViewportChange = () => {
        const vh = window.innerHeight * 0.01;
        modalElement.style.setProperty('--vh', `${vh}px`);
    };
    
    handleViewportChange();
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('orientationchange', handleViewportChange);
}

document.addEventListener('DOMContentLoaded', function() {
    
    // Setup ottimizzazioni mobile
    setupMobileOptimizations();
    
    // =================================================================================
    // STATO, COSTANTI E CONFIGURAZIONE
    // ================================================================================

    const APP_VERSION = "Versione 23";

    let undoStack = [];
    let redoStack = [];
    const HISTORY_LIMIT = 50;

    let selectionState = {
        isActive: false,
        startCell: null,
        endCell: null,
        selectedCells: []
    };

    const viewPresets = {
        planning: { showPerformanceBars: true, showModSymbols: true, showAssignments: true, showCoverageInfo: true },
        review: { showPerformanceBars: false, showModSymbols: true, showAssignments: true, showCoverageInfo: false },
        clean: { showPerformanceBars: false, showModSymbols: false, showAssignments: false, showCoverageInfo: false }
    };

    const defaultSettings = {
      "operatori": [
        { "id": 1, "cognome": "BUZZARELLO", "nome": "LARA", "idMatrice": 1, "dataInizio": "2024-01-01", "dataFine": "2050-12-31", "isActive": true, "colore": "#f0d07f", "ordine": 1, "isCounted": true, "qualita": 100, "reperibilita": true, "unavailabilities": [], "ferieAnnuali": 152, "permessiAnnuali": 88 },
        { "id": 2, "cognome": "CERESER", "nome": "ALESSANDRA", "idMatrice": 1, "dataInizio": "2024-01-01", "dataFine": "2050-12-31", "isActive": true, "colore": "#94f0ce", "ordine": 2, "isCounted": true, "qualita": 100, "reperibilita": true, "unavailabilities": [], "ferieAnnuali": 152, "permessiAnnuali": 88 },
        { "id": 3, "cognome": "BOSCOLO", "nome": "LORENA", "idMatrice": 1, "dataInizio": "2024-01-01", "dataFine": "2050-12-31", "isActive": true, "colore": "#fbe4f0", "ordine": 12, "isCounted": true, "qualita": 120, "reperibilita": true, "unavailabilities": [], "ferieAnnuali": 152, "permessiAnnuali": 88 },    { "id": 14, "cognome": "DONA'", "nome": "VALENTINA", "idMatrice": 1, "dataInizio": "2024-01-01", "dataFine": "2050-12-31", "isActive": true, "colore": "#fbbf24", "ordine": 3, "isCounted": true, "qualita": 80, "reperibilita": true, "unavailabilities": [], "ferieAnnuali": 152, "permessiAnnuali": 88 },
        { "id": 4, "cognome": "ZAHOROVA", "nome": "ZUZANA", "idMatrice": 1, "dataInizio": "2024-01-01", "dataFine": "2050-12-31", "isActive": true, "colore": "#b5f7df", "ordine": 13, "isCounted": true, "qualita": 95, "reperibilita": true, "unavailabilities": [], "ferieAnnuali": 152, "permessiAnnuali": 88 },
        { "id": 5, "cognome": "DALLA BELLA", "nome": "MANUELA", "idMatrice": 1, "dataInizio": "2024-01-01", "dataFine": "2050-12-31", "isActive": true, "colore": "#fbb1c8", "ordine": 10, "isCounted": true, "qualita": 120, "reperibilita": true, "unavailabilities": [], "ferieAnnuali": 152, "permessiAnnuali": 88 },        { "id": 6, "cognome": "BEJENARU", "nome": "CARMEN", "idMatrice": 1, "dataInizio": "2024-01-01", "dataFine": "2050-12-31", "isActive": true, "colore": "#afc2da", "ordine": 14, "isCounted": true, "qualita": 100, "reperibilita": true, "unavailabilities": [], "ferieAnnuali": 152, "permessiAnnuali": 88 },    { "id": 8, "cognome": "BOZZA", "nome": "EMANUELA", "idMatrice": 1, "dataInizio": "2024-01-01", "dataFine": "2050-12-31", "isActive": true, "colore": "#bed1ea", "ordine": 4, "isCounted": true, "qualita": 90, "reperibilita": true, "unavailabilities": [], "ferieAnnuali": 152, "permessiAnnuali": 88 },
        { "id": 6, "cognome": "BEJENARU", "nome": "CARMEN", "idMatrice": 1, "dataInizio": "2024-01-01", "dataFine": "2050-12-31", "isActive": true, "colore": "#d9bff2", "ordine": 5, "isCounted": true, "qualita": 80, "reperibilita": true, "unavailabilities": [], "ferieAnnuali": 152, "permessiAnnuali": 88 },
        { "id": 7, "cognome": "CANAVESI", "nome": "MILENA", "idMatrice": 1, "dataInizio": "2024-01-01", "dataFine": "2050-12-31", "isActive": true, "colore": "#d9bff2", "ordine": 5, "isCounted": true, "qualita": 80, "reperibilita": true, "unavailabilities": [], "ferieAnnuali": 152, "permessiAnnuali": 88 },
        { "id": 8, "cognome": "BOZZA", "nome": "EMANUELA", "idMatrice": 1, "dataInizio": "2024-01-01", "dataFine": "2050-12-31", "isActive": true, "colore": "#d9bff2", "ordine": 5, "isCounted": true, "qualita": 80, "reperibilita": true, "unavailabilities": [], "ferieAnnuali": 152, "permessiAnnuali": 88 }, 
        { "id": 9, "cognome": "DE ANGELIS", "nome": "PASQUALE", "idMatrice": 1, "dataInizio": "2024-01-01", "dataFine": "2050-12-31", "isActive": true, "colore": "#d9bff2", "ordine": 5, "isCounted": true, "qualita": 80, "reperibilita": true, "unavailabilities": [], "ferieAnnuali": 152, "permessiAnnuali": 88 },
        { "id": 10, "cognome": "BARBETTA", "nome": "LORENA", "idMatrice": 1, "dataInizio": "2024-01-01", "dataFine": "2050-12-31", "isActive": true, "colore": "#eeb4b4", "ordine": 6, "isCounted": true, "qualita": 110, "reperibilita": true, "unavailabilities": [], "ferieAnnuali": 152, "permessiAnnuali": 88 },
        { "id": 11, "cognome": "SARDO", "nome": "CHIARA", "idMatrice": 1, "dataInizio": "2024-01-01", "dataFine": "2050-12-31", "isActive": true, "colore": "#f9d3b3", "ordine": 7, "isCounted": true, "qualita": 100, "reperibilita": true, "unavailabilities": [], "ferieAnnuali": 152, "permessiAnnuali": 88 },
        { "id": 12, "cognome": "ZUCCHERI", "nome": "FABIO", "idMatrice": 1, "dataInizio": "2024-01-01", "dataFine": "2050-12-31", "isActive": true, "colore": "#b2eaae", "ordine": 8, "isCounted": true, "qualita": 110, "reperibilita": true, "unavailabilities": [], "ferieAnnuali": 152, "permessiAnnuali": 88 },
        { "id": 13, "cognome": "MARTINAZZI", "nome": "SONIA", "idMatrice": 1, "dataInizio": "2024-01-01", "dataFine": "2050-12-31", "isActive": true, "colore": "#9deefb", "ordine": 9, "isCounted": true, "qualita": 95, "reperibilita": true, "unavailabilities": [], "ferieAnnuali": 152, "permessiAnnuali": 88 },
        { "id": 14, "cognome": "DONA'", "nome": "VALENTINA", "idMatrice": 1, "dataInizio": "2024-01-01", "dataFine": "2050-12-31", "isActive": true, "colore": "#d9bff2", "ordine": 5, "isCounted": true, "qualita": 80, "reperibilita": true, "unavailabilities": [], "ferieAnnuali": 152, "permessiAnnuali": 88 },
        { "id": 15, "cognome": "DE MARTIN", "nome": "ANDREA", "idMatrice": 3, "dataInizio": "2024-01-01", "dataFine": "2050-12-31", "isActive": true, "colore": "#bfbac4", "ordine": 15, "isCounted": true, "qualita": 90, "reperibilita": true, "unavailabilities": [], "ferieAnnuali": 152, "permessiAnnuali": 88 },
        { "id": 16, "cognome": "LUCCHESE", "nome": "GIULIANA", "idMatrice": 1, "dataInizio": "2024-01-01", "dataFine": "2050-12-31", "isActive": false, "colore": "#b4bbaf", "ordine": 16, "isCounted": false, "qualita": 90, "reperibilita": true, "unavailabilities": [], "ferieAnnuali": 152, "permessiAnnuali": 88 },
        { "id": 17, "cognome": "BORTOLOT", "nome": "PAOLA", "idMatrice": 2, "dataInizio": "2024-01-01", "dataFine": "2050-12-31", "isActive": true, "colore": "#fb923c", "ordine": 17, "isCounted": true, "qualita": 90, "reperibilita": true, "unavailabilities": [], "ferieAnnuali": 152, "permessiAnnuali": 88 },
        { "id": 18, "cognome": "MORETTO", "nome": "GENNY", "idMatrice": 2, "dataInizio": "2024-01-01", "dataFine": "2050-12-31", "isActive": true, "colore": "#a3f0bf", "ordine": 18, "isCounted": true, "qualita": 90, "reperibilita": true, "unavailabilities": [], "ferieAnnuali": 152, "permessiAnnuali": 88 },
        { "id": 19, "cognome": "FURLAN", "nome": "PATRICK", "idMatrice": 2, "dataInizio": "2024-01-01", "dataFine": "2050-12-31", "isActive": true, "colore": "#86b4bb", "ordine": 19, "isCounted": true, "qualita": 90, "reperibilita": true, "unavailabilities": [], "ferieAnnuali": 152, "permessiAnnuali": 88 },
        { "id": 20, "cognome": "OULY", "nome": "-", "idMatrice": 3, "dataInizio": "2024-01-01", "dataFine": "2050-12-31", "isActive": true, "colore": "#d7cdf4", "ordine": 20, "isCounted": true, "qualita": 100, "reperibilita": true, "unavailabilities": [], "ferieAnnuali": 152, "permessiAnnuali": 88 }
      ],
      "turni": [
        { "id": 1, "sigla": "M7", "descrizione": "Mattina 7 ore", "inizio": "06:00", "fine": "13:00", "ore": 7, "conteggioOre": "orario", "colore": "#a6e7a7", "isOperativo": true },
        { "id": 2, "sigla": "M8", "descrizione": "Mattina 8 ore", "inizio": "06:00", "fine": "14:00", "ore": 8, "conteggioOre": "orario", "colore": "#88dd92", "isOperativo": true },
        { "id": 21, "sigla": "M6", "descrizione": "Mattina 6 ore", "inizio": "08:00", "fine": "14:00", "ore": 6, "conteggioOre": "orario", "colore": "#cff2cf", "isOperativo": true },
        { "id": 22, "sigla": "M7-", "descrizione": "Mattina 7 ore ridotta", "inizio": "07:00", "fine": "13:00", "ore": 6, "conteggioOre": "orario", "colore": "#b8e8b8", "isOperativo": true },
        { "id": 23, "sigla": "M8-", "descrizione": "Mattina 8 ore ridotta", "inizio": "07:00", "fine": "14:00", "ore": 7, "conteggioOre": "orario", "colore": "#9fe09f", "isOperativo": true },
        { "id": 3, "sigla": "P", "descrizione": "Pomeriggio", "inizio": "13:00", "fine": "20:00", "ore": 7, "conteggioOre": "orario", "colore": "#f9cf9f", "isOperativo": true },
        { "id": 4, "sigla": "N", "descrizione": "Notte", "inizio": "20:00", "fine": "06:00", "ore": 10, "conteggioOre": "orario", "colore": "#9198b6", "isOperativo": true },
        { "id": 5, "sigla": "SN", "descrizione": "Smonto Notte", "inizio": "00:00", "fine": "00:00", "ore": 0, "conteggioOre": "zero", "colore": "#c4c9de" },
        { "id": 6, "sigla": "R", "descrizione": "Riposo", "inizio": "00:00", "fine": "00:00", "ore": 0, "conteggioOre": "zero", "colore": "#ffffff" },
        { "id": 7, "sigla": "PER", "descrizione": "Permesso", "inizio": "00:00", "fine": "00:00", "ore": 0, "conteggioOre": "sostitutivo", "colore": "#eca2e8" },
        { "id": 8, "sigla": "F", "descrizione": "Ferie", "inizio": "00:00", "fine": "00:00", "ore": 6, "conteggioOre": "orario", "colore": "#fde68a", "isOperativo": false },
        { "id": 10, "sigla": "P-", "descrizione": "Pomeriggio ridotto", "inizio": "14:00", "fine": "20:00", "ore": 6, "conteggioOre": "orario", "colore": "#eac28a", "isOperativo": true },
        { "id": 11, "sigla": "DM", "descrizione": "Doppio Mattino", "inizio": "07:00", "fine": "15:30", "ore": 8.5, "conteggioOre": "orario", "colore": "#b0e694", "isOperativo": true },
        { "id": 12, "sigla": "DP", "descrizione": "Doppio Pomeriggio", "inizio": "14:00", "fine": "21:00", "ore": 7, "conteggioOre": "orario", "colore": "#d9b34a", "isOperativo": true },
        { "id": 13, "sigla": "A", "descrizione": "Assenza generica", "inizio": "00:00", "fine": "00:00", "ore": 0, "conteggioOre": "sostitutivo", "colore": "#e92f2f", "isOperativo": false },
        { "id": 1754087365011, "sigla": "-", "descrizione": "", "inizio": "", "fine": "", "conteggioOre": "orario", "ore": 0, "colore": "#f5f5f5" },
        { "id": 1754320382312, "sigla": "FE", "descrizione": "Ferie", "inizio": "00:00", "fine": "00:00", "conteggioOre": "orario", "ore": 6, "colore": "#fff700" },
        { "id": 1754324830817, "sigla": "104", "descrizione": "Permesso 104", "inizio": "", "fine": "", "conteggioOre": "sostitutivo", "ore": 0, "colore": "#cc99be" },
        { "id": 1754324872514, "sigla": "P.S.", "descrizione": "Permesso Sindacale", "inizio": "", "fine": "", "conteggioOre": "sostitutivo", "ore": 0, "colore": "#f49f9f" }
      ],
      "matrici": [
        { "id": 1, "nome": "Matrice Default", "sequenza": [ "M8","M7","P","R","M8","M7","P","R","M8","P","N","SN","R","M8","M7","P","R","M8","M7","P","R","M7","P","N","SN","R"], "colore": "#4f46e5", "dataInizio": "2024-01-20", "dataFine": "2050-12-31" },
        { "id": 1754087154898, "nome": "prescrizioni", "colore": "#4bec4e", "dataInizio": "2025-02-01", "dataFine": "2027-01-10", "sequenza": [ "DM", "DM", "DP", "DP", "R", "R" ] },
        { "id": 1754087399498, "nome": "Esterno a chiamata", "colore": "#8a8a8a", "dataInizio": "", "dataFine": "", "sequenza": [ "_" ] }
      ],
      "assignments": [
        { "id": 1, "nome": "Rubino", "colore": "#e11d48" },
        { "id": 2, "nome": "Turchese", "colore": "#14b8a6" },
        { "id": 3, "nome": "Ambra", "colore": "#f59e0b" },
        { "id": 4, "nome": "5° Unita Saletta", "colore": "#6366f1" },
        { "id": 5, "nome": "3° Unità Saletta", "colore": "#8b5cf6" },
        { "id": 6, "nome": "scende al piano terra dalle 16 alle 17,50", "colore": "#ec4899" }
      ],
      "reasons": [
        { "id": 1, "text": "Esigenza di Servizio", "isDefault": true, "hasSubReasons": true },
        { "id": 2, "text": "Richiesta Personale", "isDefault": true }
      ],
      "coverageOptimal": { "M": 5, "P": 4, "N": 1, "SN": 1 },
      "appearance": {
          "toggleColor": "#4f46e5",
          "workCellBgColor": "#dbeafe",
          "workCellTextColor": "#1e40af",
          "highlightBgColor": "#eef2ff",
          "showSundayBars": true
      },
      "matriceSwaps": [],
      "orderingSchemes": [],
      "validationRules": {
          "minRestHours": 11,
          "maxConsecutiveDays": 5,
          "maxWeeklyHours": 36,
          "maxMonthlyHours": 160
      }
    };

    // appState è ora dichiarato globalmente all'inizio del file
    
    let swapState = { isActive: false, step: 0, firstCell: null, secondCell: null };
    let currentAssignmentContext = { opId: null, day: null };
    let activeFilters = new Set();
    let currentModalOpId = null;
    let operatorToggleTarget = null;
    let modTooltipTimer = null;
    let activeDaySummary = null;
    let resolveConfirm; 
    let currentSequenza = []; 
    let currentMiniMenuContext = { opId: null, day: null, element: null };
    let activeOperatorInfoPanel = null;
    let clickTimer = null;
    let equityChart = null;
    let dashboardTurniChart = null;
    let dashboardEquitaChart = null;
    let currentUnavailabilityOpId = null;
    let settingsMasterDetail = {
        currentCategory: 'operatori',
        selectedId: null,
    };
    let currentSuggestions = [];

    // =================================================================================
    // NUOVA FUNZIONALITA': Sezione dedicata ai miglioramenti di usabilità
    // =================================================================================

    function saveHistoryState() {
        redoStack = [];
        if (undoStack.length >= HISTORY_LIMIT) {
            undoStack.shift();
        }
        undoStack.push(JSON.parse(JSON.stringify(appState.plannerData)));
    }

    function handleUndoRedo(e) {
        if (e.ctrlKey && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            if (undoStack.length > 1) { 
                const currentState = undoStack.pop();
                redoStack.push(currentState);
                appState.plannerData = JSON.parse(JSON.stringify(undoStack[undoStack.length - 1]));
                renderPlanner();
                renderDashboard();
                showToast("Annullato", "info", 1500);
            } else {
                showToast("Niente da annullare", "info", 1500);
            }
        } else if (e.ctrlKey && e.key.toLowerCase() === 'y') {
            e.preventDefault();
            if (redoStack.length > 0) {
                const nextState = redoStack.pop();
                undoStack.push(nextState);
                appState.plannerData = JSON.parse(JSON.stringify(nextState));
                renderPlanner();
                renderDashboard();
                showToast("Ripristinato", "info", 1500);
            } else {
                showToast("Niente da ripristinare", "info", 1500);
            }
        }
    }

    // showToast ora dichiarata globalmente

    // Emergency Management System
    let emergencyState = {
        activeAlerts: [],
        criticalThresholds: {
            minCoverage: 1,
            maxViolations: 3,
            criticalRestHours: 8
        },
        lastCheck: null
    };

    function showEmergencyAlert(message, type = 'critical') {
        const container = document.getElementById('emergency-alert-container');
        const messageEl = document.getElementById('emergency-alert-message');
        
        if (!container || !messageEl) return;
        
        messageEl.textContent = message;
        container.classList.remove('hidden');
        
        logEmergencyEvent('ALERT_SHOWN', { message, type, timestamp: new Date().toISOString() });
    }

    function showCriticalCoverageAlert(deficits) {
        // Funzione disabilitata per rimuovere definitivamente l'alert di copertura critica
        return;
        
        const container = document.getElementById('critical-coverage-alert');
        const messageEl = document.getElementById('critical-coverage-message');
        
        if (!container || !messageEl) return;
        
        const deficitText = deficits.map(d => `${d.shift}: -${d.missing}`).join(', ');
        messageEl.textContent = `Copertura insufficiente: ${deficitText}`;
        container.classList.remove('hidden');
        
        logEmergencyEvent('COVERAGE_CRITICAL', { deficits, timestamp: new Date().toISOString() });
    }
    
    function getDaySummary(day) {
        const year = appState.currentDate.getFullYear();
        const month = appState.currentDate.getMonth();
        const monthKey = getMonthKey(appState.currentDate);
        const dayData = { coverage: { M: 0, P: 0, N: 0, SN: 0 } };
        const operators = getActiveOperators(year, month).filter(op => op.isCounted);
    
        operators.forEach(op => {
            const data = appState.plannerData[monthKey]?.[`${op.id}-${day}`];
            if (data && data.turno) {
                const shiftType = getShiftType(data.turno);
                if (dayData.coverage[shiftType] !== undefined) {
                    dayData.coverage[shiftType]++;
                }
            }
        });
        
        return dayData;
    }


    function checkEmergencyConditions() {
        const year = appState.currentDate.getFullYear();
        const month = appState.currentDate.getMonth();
        const monthKey = getMonthKey(appState.currentDate);
        const activeOps = getActiveOperators(year, month);
        
        let emergencyDetected = false;
        let criticalViolations = 0;
        let coverageDeficits = [];
        
        for (let day = 1; day <= getDaysInMonth(year, month); day++) {
            const dayData = getDaySummary(day);
            
            ['M', 'P', 'N', 'SN'].forEach(shiftType => {
                const optimal = appState.coverageOptimal[shiftType] || 0;
                const actual = dayData.coverage[shiftType] || 0;
                const deficit = optimal - actual;
                
                if (deficit >= emergencyState.criticalThresholds.minCoverage) {
                    coverageDeficits.push({
                        day,
                        shift: shiftType,
                        missing: deficit,
                        severity: deficit >= 2 ? 'critical' : 'warning'
                    });
                }
            });
        }
        
        activeOps.forEach(op => {
            for (let day = 1; day <= getDaysInMonth(year, month); day++) {
                const cellKey = `${op.id}-${day}`;
                const data = appState.plannerData[monthKey]?.[cellKey];
                
                if (data?.violations) {
                    const criticalViolationCount = data.violations.filter(v => 
                        v.includes('Riposo insufficiente') && 
                        parseFloat(v.match(/\((\d+\.\d+)h\)/)?.[1] || 0) < emergencyState.criticalRestHours
                    ).length;
                    
                    if (criticalViolationCount > 0) {
                        criticalViolations++;
                        emergencyDetected = true;
                    }
                }
            }
        });
        
        if (criticalViolations >= emergencyState.criticalThresholds.maxViolations) {
            showEmergencyAlert(
                `Rilevate ${criticalViolations} violazioni critiche delle regole di sicurezza. Intervento immediato richiesto.`,
                'critical'
            );
            emergencyDetected = true;
        }
        
        const criticalDeficits = coverageDeficits.filter(d => d.severity === 'critical');
        if (criticalDeficits.length > 0) {
            showCriticalCoverageAlert(criticalDeficits);
            emergencyDetected = true;
        }
        
        emergencyState.lastCheck = new Date();
        return emergencyDetected;
    }

    function logEmergencyEvent(eventType, data) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            type: eventType,
            data: data,
            user: 'system',
            plannerState: {
                month: appState.currentDate.getMonth() + 1,
                year: appState.currentDate.getFullYear()
            }
        };
        
        const existingLogs = JSON.parse(localStorage.getItem('emergencyLogs') || '[]');
        existingLogs.push(logEntry);
        
        if (existingLogs.length > 100) {
            existingLogs.splice(0, existingLogs.length - 100);
        }
        
        localStorage.setItem('emergencyLogs', JSON.stringify(existingLogs));
        console.warn(`[EMERGENCY LOG] ${eventType}:`, data);
    }

    // Sistema di registrazione avanzato per tutti i cambi
    function logChangeEvent(changeData) {
        const changeLogs = JSON.parse(localStorage.getItem('changeLogs') || '[]');
        const logEntry = {
            id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            timestamp: new Date().toISOString(),
            date: changeData.date,
            operatorId: changeData.operatorId,
            operatorName: changeData.operatorName,
            changeType: changeData.changeType, // 'C' = Cambio, 'S' = Scambio, 'E' = Emergenza, 'M' = Modifica Extra
            originalShift: changeData.originalShift,
            newShift: changeData.newShift,
            reason: changeData.reason,
            subReason: changeData.subReason,
            note: changeData.note,
            extraInfo: changeData.extraInfo,
            swapPartner: changeData.swapPartner,
            userId: 'system', // Può essere esteso per multi-utente
            sessionId: sessionStorage.getItem('sessionId') || 'unknown',
            plannerMonth: changeData.plannerMonth,
            cellKey: changeData.cellKey,
            violations: changeData.violations || [],
            metadata: {
                userAgent: navigator.userAgent,
                timestamp: Date.now(),
                appVersion: APP_VERSION
            }
        };
        
        changeLogs.push(logEntry);
        
        // Mantieni solo gli ultimi 1000 cambi
        if (changeLogs.length > 1000) {
            changeLogs.splice(0, changeLogs.length - 1000);
        }
        
        localStorage.setItem('changeLogs', JSON.stringify(changeLogs));
        return logEntry.id;
    }

    // Funzione per ottenere i log dei cambi con filtri
    function getChangeLogs(filters = {}) {
        const changeLogs = JSON.parse(localStorage.getItem('changeLogs') || '[]');
        let filteredLogs = [...changeLogs];
        
        // Filtro per data
        if (filters.startDate) {
            const startDate = new Date(filters.startDate);
            filteredLogs = filteredLogs.filter(log => new Date(log.date) >= startDate);
        }
        
        if (filters.endDate) {
            const endDate = new Date(filters.endDate);
            filteredLogs = filteredLogs.filter(log => new Date(log.date) <= endDate);
        }
        
        // Filtro per operatore
        if (filters.operatorId) {
            filteredLogs = filteredLogs.filter(log => log.operatorId === filters.operatorId);
        }
        
        // Filtro per tipo di cambio
        if (filters.changeType) {
            filteredLogs = filteredLogs.filter(log => log.changeType === filters.changeType);
        }
        
        // Filtro per motivo
        if (filters.reason) {
            filteredLogs = filteredLogs.filter(log => 
                log.reason && log.reason.toLowerCase().includes(filters.reason.toLowerCase())
            );
        }
        
        // Ordinamento per timestamp (più recenti prima)
        filteredLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        return filteredLogs;
    }

    // ===== GESTIONE INTERFACCIA LOG CAMBI =====
    let currentLogPage = 1;
    const logsPerPage = 10;
    let filteredLogs = [];
    let allLogs = [];

    // Inizializza l'interfaccia del registro cambi
    function initializeChangeLogsInterface() {
        // Popola il dropdown degli operatori
        populateOperatorFilter();
        
        // Imposta le date di default (ultimo mese)
        const today = new Date();
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
        
        document.getElementById('filter-start-date').value = formatDateForInput(lastMonth);
        document.getElementById('filter-end-date').value = formatDateForInput(today);
        
        // Event listeners per i filtri
        document.getElementById('apply-filters-btn').addEventListener('click', applyLogFilters);
        document.getElementById('reset-filters-btn').addEventListener('click', resetLogFilters);
        
        // Event listeners per la paginazione
        document.getElementById('prev-page').addEventListener('click', () => changeLogPage(currentLogPage - 1));
        document.getElementById('next-page').addEventListener('click', () => changeLogPage(currentLogPage + 1));
        document.getElementById('prev-page-mobile').addEventListener('click', () => changeLogPage(currentLogPage - 1));
        document.getElementById('next-page-mobile').addEventListener('click', () => changeLogPage(currentLogPage + 1));
        
        // Event listeners per i pulsanti di azione
        document.getElementById('export-logs-btn').addEventListener('click', exportChangeLogs);
    document.getElementById('clear-logs-btn').addEventListener('click', clearChangeLogs);
    

        
        // Carica i log iniziali
        loadAndDisplayLogs();
    }

    // Popola il dropdown degli operatori
    function populateOperatorFilter() {
        const select = document.getElementById('filter-operator');
        const operators = appState.operatori || [];
        
        // Pulisce le opzioni esistenti (tranne "Tutti gli operatori")
        while (select.children.length > 1) {
            select.removeChild(select.lastChild);
        }
        
        // Aggiunge gli operatori attivi
        operators
            .filter(op => op.isActive)
            .sort((a, b) => `${a.cognome} ${a.nome}`.localeCompare(`${b.cognome} ${b.nome}`))
            .forEach(op => {
                const option = document.createElement('option');
                option.value = op.id;
                option.textContent = `${op.cognome} ${op.nome}`;
                select.appendChild(option);
            });
    }

    // Formatta una data per l'input date
    function formatDateForInput(date) {
        return date.toISOString().split('T')[0];
    }
    
    function formatDate(date) {
        return date.toLocaleDateString('it-IT');
    }

    // Carica e visualizza i log
    function loadAndDisplayLogs() {
        allLogs = getChangeLogs() || [];
        applyLogFilters();
    }

    // Applica i filtri ai log
    function applyLogFilters() {
        const startDate = document.getElementById('filter-start-date').value;
        const endDate = document.getElementById('filter-end-date').value;
        const operatorId = document.getElementById('filter-operator').value;
        const changeType = document.getElementById('filter-change-type').value;
        const reasonText = document.getElementById('filter-reason').value.toLowerCase();
        
        filteredLogs = allLogs.filter(log => {
            // Filtro per data
            if (startDate && log.date < startDate) return false;
            if (endDate && log.date > endDate) return false;
            
            // Filtro per operatore
            if (operatorId && log.operatorId !== parseInt(operatorId)) return false;
            
            // Filtro per tipo di cambio
            if (changeType && log.changeType !== changeType) return false;
            
            // Filtro per motivo (ricerca testuale)
            if (reasonText && !log.reason.toLowerCase().includes(reasonText) && 
                !log.subReason.toLowerCase().includes(reasonText) &&
                !log.note.toLowerCase().includes(reasonText)) return false;
            
            return true;
        });
        
        // Ordina per timestamp decrescente (più recenti prima)
        filteredLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        currentLogPage = 1;
        displayLogs();
        updateStatistics();
    }

    // Reset dei filtri
    function resetLogFilters() {
        document.getElementById('filter-start-date').value = '';
        document.getElementById('filter-end-date').value = '';
        document.getElementById('filter-operator').value = '';
        document.getElementById('filter-change-type').value = '';
        document.getElementById('filter-reason').value = '';
        
        applyLogFilters();
    }

    // Visualizza i log nella tabella
    function displayLogs() {
        const tbody = document.getElementById('logs-table-body');
        const noLogsMessage = document.getElementById('no-logs-message');
        const table = tbody.closest('.bg-white.border');
        
        if (filteredLogs.length === 0) {
            table.style.display = 'none';
            noLogsMessage.classList.remove('hidden');
            return;
        }
        
        table.style.display = 'block';
        noLogsMessage.classList.add('hidden');
        
        const startIndex = (currentLogPage - 1) * logsPerPage;
        const endIndex = Math.min(startIndex + logsPerPage, filteredLogs.length);
        const pageData = filteredLogs.slice(startIndex, endIndex);
        
        tbody.innerHTML = '';
        
        pageData.forEach(log => {
            const row = createLogRow(log);
            tbody.appendChild(row);
        });
        
        updatePagination();
    }

    // Crea una riga della tabella per un log
    function createLogRow(log) {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';
        
        const timestamp = new Date(log.timestamp);
        const formattedDate = timestamp.toLocaleDateString('it-IT');
        const formattedTime = timestamp.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        
        const changeTypeLabels = {
            'C': 'Cambio',
            'S': 'Scambio',
            'E': 'Emergenza',
            'M': 'Modifica'
        };
        
        const changeTypeColors = {
            'C': 'bg-blue-100 text-blue-800',
            'S': 'bg-green-100 text-green-800',
            'E': 'bg-yellow-100 text-yellow-800',
            'M': 'bg-purple-100 text-purple-800'
        };
        
        const changeText = log.originalShift && log.newShift ? 
            `${log.originalShift} → ${log.newShift}` : 
            (log.newShift || 'N/A');
        
        row.innerHTML = `
            <td class="px-4 py-3 text-sm text-gray-900">
                <div>${formattedDate}</div>
                <div class="text-xs text-gray-500">${formattedTime}</div>
            </td>
            <td class="px-4 py-3 text-sm text-gray-900">${log.operatorName}</td>
            <td class="px-4 py-3 text-sm">
                <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full ${changeTypeColors[log.changeType] || 'bg-gray-100 text-gray-800'}">
                    ${changeTypeLabels[log.changeType] || log.changeType}
                </span>
            </td>
            <td class="px-4 py-3 text-sm text-gray-900">${changeText}</td>
            <td class="px-4 py-3 text-sm text-gray-900">
                <div>${log.reason}</div>
                ${log.subReason ? `<div class="text-xs text-gray-500">${log.subReason}</div>` : ''}
            </td>
            <td class="px-4 py-3 text-sm text-gray-500">
                ${log.note ? `<div class="max-w-xs truncate" title="${log.note}">${log.note}</div>` : '-'}
            </td>
            <td class="px-4 py-3 text-sm">
                <button onclick="showLogDetails('${log.id}')" class="text-indigo-600 hover:text-indigo-900 text-xs">
                    Dettagli
                </button>
            </td>
        `;
        
        return row;
    }

    // Aggiorna la paginazione
    function updatePagination() {
        const totalPages = Math.ceil(filteredLogs.length / logsPerPage);
        const startIndex = (currentLogPage - 1) * logsPerPage + 1;
        const endIndex = Math.min(currentLogPage * logsPerPage, filteredLogs.length);
        
        // Aggiorna i contatori
        document.getElementById('showing-from').textContent = filteredLogs.length > 0 ? startIndex : 0;
        document.getElementById('showing-to').textContent = endIndex;
        document.getElementById('total-logs').textContent = filteredLogs.length;
        
        // Aggiorna i pulsanti di navigazione
        const prevButtons = [document.getElementById('prev-page'), document.getElementById('prev-page-mobile')];
        const nextButtons = [document.getElementById('next-page'), document.getElementById('next-page-mobile')];
        
        prevButtons.forEach(btn => {
            btn.disabled = currentLogPage <= 1;
            btn.classList.toggle('opacity-50', currentLogPage <= 1);
        });
        
        nextButtons.forEach(btn => {
            btn.disabled = currentLogPage >= totalPages;
            btn.classList.toggle('opacity-50', currentLogPage >= totalPages);
        });
        
        // Aggiorna i numeri di pagina
        const pageNumbers = document.getElementById('page-numbers');
        pageNumbers.innerHTML = '';
        
        if (totalPages <= 7) {
            // Mostra tutte le pagine se sono poche
            for (let i = 1; i <= totalPages; i++) {
                pageNumbers.appendChild(createPageButton(i));
            }
        } else {
            // Mostra pagine con ellipsi
            pageNumbers.appendChild(createPageButton(1));
            
            if (currentLogPage > 3) {
                pageNumbers.appendChild(createEllipsis());
            }
            
            const start = Math.max(2, currentLogPage - 1);
            const end = Math.min(totalPages - 1, currentLogPage + 1);
            
            for (let i = start; i <= end; i++) {
                pageNumbers.appendChild(createPageButton(i));
            }
            
            if (currentLogPage < totalPages - 2) {
                pageNumbers.appendChild(createEllipsis());
            }
            
            pageNumbers.appendChild(createPageButton(totalPages));
        }
    }

    // Crea un pulsante di pagina
    function createPageButton(pageNum) {
        const button = document.createElement('button');
        button.textContent = pageNum;
        button.className = `relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
            pageNum === currentLogPage 
                ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
        }`;
        button.addEventListener('click', () => changeLogPage(pageNum));
        return button;
    }

    // Crea ellipsi per la paginazione
    function createEllipsis() {
        const span = document.createElement('span');
        span.textContent = '...';
        span.className = 'relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700';
        return span;
    }

    // Cambia pagina
    function changeLogPage(newPage) {
        const totalPages = Math.ceil(filteredLogs.length / logsPerPage);
        if (newPage >= 1 && newPage <= totalPages) {
            currentLogPage = newPage;
            displayLogs();
        }
    }

    // Aggiorna le statistiche
    function updateStatistics() {
        const stats = {
            total: filteredLogs.length,
            swaps: filteredLogs.filter(log => log.changeType === 'S').length,
            emergencies: filteredLogs.filter(log => log.changeType === 'E').length,
            modifications: filteredLogs.filter(log => log.changeType === 'M').length
        };
        
        document.getElementById('stat-total-changes').textContent = stats.total;
        document.getElementById('stat-swaps').textContent = stats.swaps;
        document.getElementById('stat-emergencies').textContent = stats.emergencies;
        document.getElementById('stat-modifications').textContent = stats.modifications;
    }

    // Mostra i dettagli di un log
    function showLogDetails(logId) {
        const log = allLogs.find(l => l.id === logId);
        if (!log) return;
        
        const details = `
            <div class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Data/Ora</label>
                        <p class="text-sm text-gray-900">${new Date(log.timestamp).toLocaleString('it-IT')}</p>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Operatore</label>
                        <p class="text-sm text-gray-900">${log.operatorName} (ID: ${log.operatorId})</p>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Tipo Cambio</label>
                        <p class="text-sm text-gray-900">${log.changeType}</p>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Data Turno</label>
                        <p class="text-sm text-gray-900">${log.date}</p>
                    </div>
                </div>
                
                ${log.originalShift ? `
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Turno Originale</label>
                        <p class="text-sm text-gray-900">${log.originalShift}</p>
                    </div>
                ` : ''}
                
                ${log.newShift ? `
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Nuovo Turno</label>
                        <p class="text-sm text-gray-900">${log.newShift}</p>
                    </div>
                ` : ''}
                
                <div>
                    <label class="block text-sm font-medium text-gray-700">Motivo</label>
                    <p class="text-sm text-gray-900">${log.reason}</p>
                </div>
                
                ${log.subReason ? `
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Sotto-motivo</label>
                        <p class="text-sm text-gray-900">${log.subReason}</p>
                    </div>
                ` : ''}
                
                ${log.note ? `
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Note</label>
                        <p class="text-sm text-gray-900">${log.note}</p>
                    </div>
                ` : ''}
                
                ${log.swapPartner ? `
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Partner Scambio</label>
                        <p class="text-sm text-gray-900">${log.swapPartner}</p>
                    </div>
                ` : ''}
                
                ${log.extraInfo && Object.keys(log.extraInfo).length > 0 ? `
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Informazioni Extra</label>
                        <pre class="text-sm text-gray-900 bg-gray-50 p-2 rounded">${JSON.stringify(log.extraInfo, null, 2)}</pre>
                    </div>
                ` : ''}
                
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Mese Planner</label>
                        <p class="text-sm text-gray-900">${log.plannerMonth}</p>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Cella</label>
                        <p class="text-sm text-gray-900">${log.cellKey}</p>
                    </div>
                </div>
            </div>
        `;
        
        alert('Dettagli Cambio:\n\n' + details.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' '));
    }

    // Esporta i log dei cambi
    function exportChangeLogs() {
        if (filteredLogs.length === 0) {
            alert('Nessun dato da esportare. Non ci sono log che corrispondono ai filtri attuali.');
            return;
        }
        
        const csvContent = generateCSVContent(filteredLogs);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `registro_cambi_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    // Genera il contenuto CSV
    function generateCSVContent(logs) {
        const headers = [
            'Data/Ora',
            'Data Turno',
            'Operatore ID',
            'Operatore Nome',
            'Tipo Cambio',
            'Turno Originale',
            'Nuovo Turno',
            'Motivo',
            'Sotto-motivo',
            'Note',
            'Partner Scambio',
            'Mese Planner',
            'Cella'
        ];
        
        const csvRows = [headers.join(',')];
        
        logs.forEach(log => {
            const row = [
                `"${new Date(log.timestamp).toLocaleString('it-IT')}"`,
                `"${log.date}"`,
                log.operatorId,
                `"${log.operatorName}"`,
                `"${log.changeType}"`,
                `"${log.originalShift || ''}"`,
                `"${log.newShift || ''}"`,
                `"${log.reason}"`,
                `"${log.subReason || ''}"`,
                `"${log.note || ''}"`,
                `"${log.swapPartner || ''}"`,
                `"${log.plannerMonth}"`,
                `"${log.cellKey}"`
            ];
            csvRows.push(row.join(','));
        });
        
        return csvRows.join('\n');
    }

    // Pulisce i log dei cambi
    function clearChangeLogs() {
        if (confirm('Sei sicuro di voler cancellare tutti i log dei cambi? Questa operazione non può essere annullata.')) {
            localStorage.removeItem('changeLogs');
            allLogs = [];
            filteredLogs = [];
            displayLogs();
            updateStatistics();
            alert('Tutti i log dei cambi sono stati cancellati.');
        }
    }
    // ===== FINE GESTIONE INTERFACCIA LOG CAMBI =====

    function suggestEmergencySolutions(deficits) {
        const suggestions = [];
        const activeOps = getActiveOperators(appState.currentDate.getFullYear(), appState.currentDate.getMonth());
        const monthKey = getMonthKey(appState.currentDate);
        
        deficits.forEach(deficit => {
            const availableOps = activeOps.filter(op => {
                const cellKey = `${op.id}-${deficit.day}`;
                const currentAssignment = appState.plannerData[monthKey]?.[cellKey]?.turno;
                
                // Verifica che l'operatore non abbia già un incarico (eccetto riposo 'R')
                const hasNoAssignment = !currentAssignment || currentAssignment === 'R';
                
                // Verifica disponibilità per emergenze (esclude malattia, SN, riposo post-notte)
                const isAvailableForEmergency = isOperatorAvailableForEmergency(op.id, deficit.day, monthKey);
                
                return hasNoAssignment && isAvailableForEmergency;
            });
            
            if (availableOps.length > 0) {
                const bestOp = availableOps.sort((a, b) => (b.qualita || 0) - (a.qualita || 0))[0];
                suggestions.push({
                    day: deficit.day,
                    shift: deficit.shift,
                    operator: bestOp,
                    reason: 'Copertura emergenza'
                });
            }
        });
        
        if (suggestions.length > 0) {
            const suggestionText = suggestions.map(s => 
                `Giorno ${s.day}: Assegna ${s.operator.cognome} ${s.operator.nome} al turno ${s.shift}`
            ).join('\n');
            
            showConfirmation(
                `Suggerimenti per risolvere la copertura critica:\n\n${suggestionText}\n\nVuoi applicare automaticamente questi suggerimenti?`,
                'Suggerimenti Emergenza'
            ).then(confirmed => {
                if (confirmed) {
                    saveHistoryState();
                    suggestions.forEach(s => {
                        const cellKey = `${s.operator.id}-${s.day}`;
                        if (!appState.plannerData[monthKey]) appState.plannerData[monthKey] = {};
                        if (!appState.plannerData[monthKey][cellKey]) appState.plannerData[monthKey][cellKey] = {};
                        
                        appState.plannerData[monthKey][cellKey].turno = s.shift;
                        appState.plannerData[monthKey][cellKey].motivoCambio = s.reason;
                        appState.plannerData[monthKey][cellKey].timestampCambio = new Date().toISOString();
                    });
                    
                    renderPlanner();
                    showToast(`${suggestions.length} assegnazioni di emergenza applicate`, 'success');
                    logEmergencyEvent('AUTO_SUGGESTIONS_APPLIED', { suggestions, timestamp: new Date().toISOString() });
                }
            });
        } else {
            showToast('Nessuna soluzione automatica disponibile per la copertura critica', 'error');
        }
    }

    function handleSelectionStart(e) {
        if (e.button !== 0 || appState.isAssignmentMode || swapState.isActive) return;
        const cell = e.target.closest('.planner-cell');
        if (!cell) return;
        closeMiniMenu();
        selectionState.isActive = true;
        selectionState.startCell = cell;
        selectionState.endCell = cell;
        selectionState.selectedCells = []; 
        document.body.classList.add('dragging-active');
        document.querySelectorAll('.cell-selected').forEach(c => c.classList.remove('cell-selected'));
        cell.querySelector('.base-cell').classList.add('cell-selected');
    }

    function handleSelectionMove(e) {
        if (!selectionState.isActive) return;
        const cell = e.target.closest('.planner-cell');
        if (!cell || cell === selectionState.endCell) return;
        
        selectionState.endCell = cell;
        
        const allRows = Array.from(document.getElementById('planner-body').rows);
        const startOpRowIndex = allRows.findIndex(row => row.dataset.opId === selectionState.startCell.dataset.opId);
        const endOpRowIndex = allRows.findIndex(row => row.dataset.opId === selectionState.endCell.dataset.opId);
        const startDay = parseInt(selectionState.startCell.dataset.day);
        const endDay = parseInt(selectionState.endCell.dataset.day);

        const minRow = Math.min(startOpRowIndex, endOpRowIndex);
        const maxRow = Math.max(startOpRowIndex, endOpRowIndex);
        const minDay = Math.min(startDay, endDay);
        const maxDay = Math.max(startDay, endDay);
        
        document.querySelectorAll('.base-cell.cell-selected').forEach(c => c.classList.remove('cell-selected'));
        selectionState.selectedCells = []; 

        for (let i = minRow; i <= maxRow; i++) {
            if (allRows[i] && !allRows[i].classList.contains('inactive-operator')) {
                for (let d = minDay; d <= maxDay; d++) {
                    const cellToSelect = allRows[i].querySelector(`.planner-cell[data-day="${d}"]`);
                    if (cellToSelect && !cellToSelect.classList.contains('cell-unavailability')) {
                        cellToSelect.querySelector('.base-cell').classList.add('cell-selected');
                        selectionState.selectedCells.push(cellToSelect);
                    }
                }
            }
        }
    }

    function handleSelectionEnd() {
        if (!selectionState.isActive) return;
        selectionState.isActive = false;
        document.body.classList.remove('dragging-active');
        
        const selectedCells = selectionState.selectedCells;
        if (selectedCells.length <= 1) {
            document.querySelectorAll('.cell-selected').forEach(c => c.classList.remove('cell-selected'));
            return;
        }

        const summaryContainer = document.getElementById('multi-select-summary');
        const groupedByOp = selectedCells.reduce((acc, cell) => {
            const opId = cell.dataset.opId;
            if (!acc[opId]) {
                const operator = appState.operatori.find(o => o.id == opId);
                acc[opId] = { name: `${operator.cognome} ${operator.nome}`, days: [] };
            }
            acc[opId].days.push(parseInt(cell.dataset.day));
            return acc;
        }, {});

        let summaryHtml = '<p class="font-semibold mb-2">Stai per modificare i turni per:</p><ul>';
        for (const opId in groupedByOp) {
            const data = groupedByOp[opId];
            data.days.sort((a, b) => a - b);
            const firstDay = data.days[0];
            const lastDay = data.days[data.days.length - 1];
            summaryHtml += `<li><strong>${data.name}:</strong> ${data.days.length} giorni (dal ${firstDay} al ${lastDay})</li>`;
        }
        summaryHtml += `</ul><p class="font-bold mt-3 text-right">Totale: ${selectedCells.length} celle selezionate.</p>`;
        summaryContainer.innerHTML = summaryHtml;

        const turniOptions = appState.turni.map(t => ({ value: t.sigla, text: `${t.sigla} (${t.descrizione})` }));
        populateSelect('multi-select-turno', [{value: '', text: 'Seleziona un turno...'}, ...turniOptions], '');
        openModal('modal-multi-select-action');
    }
    
    function saveMultiSelectAction() {
        const selectedTurno = document.getElementById('multi-select-turno').value;
        if (!selectedTurno) {
            showToast("Nessun turno selezionato.", "error", 2000);
            return;
        }
        const selectedCells = selectionState.selectedCells;
        if (selectedCells.length > 0) {
            saveHistoryState(); 
            const monthKey = getMonthKey(appState.currentDate);
            if (!appState.plannerData[monthKey]) appState.plannerData[monthKey] = {};
            selectedCells.forEach(cell => {
                const opId = parseInt(cell.dataset.opId);
                const day = parseInt(cell.dataset.day);
                const key = `${opId}-${day}`;
                if (!appState.plannerData[monthKey][key]) appState.plannerData[monthKey][key] = {};
                const data = appState.plannerData[monthKey][key];
                if (!data.isManuallySet) { data.originalTurno = data.turno; }
                
                // Controlla se è domenica e il turno selezionato è ferie
                const currentDate = new Date(appState.currentDate.getFullYear(), appState.currentDate.getMonth(), day);
                const dayOfWeek = currentDate.getDay(); // 0 = domenica
                const isFerie = selectedTurno === 'F' || selectedTurno === 'FE';
                
                // Se è domenica e si stanno assegnando ferie, assegna riposo invece
                if (dayOfWeek === 0 && isFerie) {
                    data.turno = 'R'; // Riposo
                } else {
                    data.turno = selectedTurno;
                }
                
                data.modType = 'E';
                data.isManuallySet = true;
            });
            renderPlanner();
            renderDashboard();
            showToast(`${selectedCells.length} turni aggiornati a "${selectedTurno}".`, "success");
        }
        closeModal('modal-multi-select-action');
        setTimeout(() => {
           document.querySelectorAll('.cell-selected').forEach(c => c.classList.remove('cell-selected'));
        }, 100);
    }
    
    function handlePlannerBodyDoubleClick(e) {
        clearTimeout(clickTimer);
        const cell = e.target.closest('.planner-cell');
        if (!cell || appState.isAssignmentMode || swapState.isActive || cell.classList.contains('cell-unavailability')) return;

        closeMiniMenu();
        const opId = parseInt(cell.dataset.opId, 10);
        const day = parseInt(cell.dataset.day, 10);
        
        // Determina il tipo di modale da aprire basato sulla modifica esistente
        const cellData = getCellData(opId, day);
        let focusSection = 'change'; // Default
        
        if (cellData) {
            // Se c'è una nota, apri il modale delle note
            if (cellData.nota && cellData.nota.trim() !== '') {
                focusSection = 'note';
            }
            // Se ci sono ore extra, apri il modale delle ore extra
            else if (cellData.oreExtra && cellData.oreExtra > 0) {
                focusSection = 'extra';
            }
            // Se c'è un periodo di assegnazione, apri il modale del periodo
            else if (cellData.periodoInizio || cellData.periodoFine) {
                focusSection = 'period';
            }
            // Altrimenti, mantieni il default 'change'
        }
        
        openCellActionModal(opId, day, focusSection);
    }

    // =================================================================================
    // FUNZIONI DI UTILITÀ E HELPERS
    // =================================================================================

    const showLoader = () => document.getElementById('loader').classList.replace('hidden', 'flex');
    const hideLoader = () => document.getElementById('loader').classList.replace('flex', 'hidden');

    const openModal = (id) => {
        const modal = document.getElementById(id);
        if (!modal) return;
        
        if (id === 'modal-clear-changes') {
            const clearChangesSelect = document.getElementById('clear-changes-operator');
            if (clearChangesSelect) {
                const operators = getActiveOperators(appState.currentDate.getFullYear(), appState.currentDate.getMonth(), true).sort((a,b) => a.ordine - b.ordine);
                const allOperatorsOptions = operators.map(op => ({ value: op.id, text: `${op.cognome} ${op.nome}` }));
                populateSelect('clear-changes-operator', [{ value: 'all', text: 'Tutti gli operatori' }, ...allOperatorsOptions], 'all');
            }
        }
        
        modal.classList.replace('hidden', 'flex');
    };
    window.openModal = openModal;

    const closeModal = (id) => {
        const modal = document.getElementById(id);
        if (modal) {
            modal.classList.replace('flex', 'hidden');
            modal.querySelectorAll('form').forEach(form => form.reset());
        }
    };
    window.closeModal = closeModal;
    
    const showConfirmation = (message, title = "Conferma Azione", isAlert = false) => {
        return new Promise((resolve) => {
            resolveConfirm = resolve;
            document.getElementById('confirm-modal-title').textContent = title;
            document.getElementById('confirm-modal-message').innerHTML = message;
            document.getElementById('confirm-modal-cancel').style.display = isAlert ? 'none' : 'inline-flex';
            document.getElementById('confirm-modal-ok').textContent = isAlert ? 'OK' : 'Conferma';
            openModal('modal-confirm');
        });
    };

    function updateSelectColor(selectElement) {
        if (!selectElement) return;
        const selectedOption = selectElement.options[selectElement.selectedIndex];
        const bgColor = selectedOption.dataset.color || '#f9fafb';
        const textColor = selectedOption.dataset.textColor || '#000000';
        selectElement.style.backgroundColor = bgColor;
        selectElement.style.color = textColor;
        selectElement.style.borderColor = lightenColor(bgColor, -0.2);
    }

    function getTurnoBySigla(sigla) { 
        // Controllo che sigla sia una stringa valida
        if (!sigla || typeof sigla !== 'string') return null;
        return appState.turni.find(t => t.sigla.toUpperCase() === sigla.toUpperCase()) || null;
    }
    
    function getShiftType(sigla) {
        // Controllo che sigla sia una stringa valida
        if (!sigla || typeof sigla !== 'string') return 'Altro';
        const upperSigla = sigla.toUpperCase();
        if (upperSigla.startsWith('M') || upperSigla.startsWith('DM')) return 'M';
        if (upperSigla.startsWith('P') || upperSigla.startsWith('DP')) return 'P';
        if (upperSigla === 'N') return 'N';
        if (upperSigla === 'SN') return 'SN';
        const turno = getTurnoBySigla(upperSigla);
        if (turno?.descrizione.toLowerCase().includes('mattino')) return 'M';
        if (turno?.descrizione.toLowerCase().includes('pomeriggio')) return 'P';
        return 'Altro';
    }

    // Funzioni di utilità ora dichiarate globalmente

    function getContrastingTextColor(hexcolor){
        if (!hexcolor || typeof hexcolor !== 'string') return '#000000';
        hexcolor = hexcolor.replace("#", "");
        if (hexcolor.length === 3) hexcolor = hexcolor.split('').map(char => char + char).join('');
        const r = parseInt(hexcolor.substr(0,2),16), g = parseInt(hexcolor.substr(2,2),16), b = parseInt(hexcolor.substr(4,2),16);
        return ((r*299)+(g*587)+(b*114))/1000 >= 128 ? 'black' : 'white';
    }

    function lightenColor(hex, percent) {
        if (!hex) return '#FFFFFF';
        let r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
        let t = percent < 0 ? 0 : 255, p = percent < 0 ? percent * -1 : percent;
        r = Math.round((t - r) * p) + r; g = Math.round((t - g) * p) + g; b = Math.round((t - b) * p) + b;
        return `#${(0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1)}`;
    }

    function adjustColorBrightness(color, amount) {
        const usePound = color[0] === '#';
        const col = usePound ? color.slice(1) : color;
        const num = parseInt(col, 16);
        let r = (num >> 16) + amount;
        let g = (num >> 8 & 0x00FF) + amount;
        let b = (num & 0x0000FF) + amount;
        r = r > 255 ? 255 : r < 0 ? 0 : r;
        g = g > 255 ? 255 : g < 0 ? 0 : g;
        b = b > 255 ? 255 : b < 0 ? 0 : b;
        return (usePound ? '#' : '') + (r << 16 | g << 8 | b).toString(16).padStart(6, '0');
    }

    function applyAppearance() {
        if (!appState.appearance) return;
        const style = document.documentElement.style;
        style.setProperty('--toggle-active-color', appState.appearance.toggleColor || '#4f46e5');
        style.setProperty('--work-cell-bg-color', appState.appearance.workCellBgColor || '#dbeafe');
        style.setProperty('--work-cell-text-color', appState.appearance.workCellTextColor || '#1e40af');
        style.setProperty('--highlight-bg-color', appState.appearance.highlightBgColor || '#eef2ff');
        
        // Gestione barre domeniche
        const plannerTable = document.getElementById('planner-table');
        if (plannerTable) {
            if (appState.appearance.showSundayBars) {
                plannerTable.classList.remove('hide-sunday-bars');
            } else {
                plannerTable.classList.add('hide-sunday-bars');
            }
        }
    }

    // =================================================================================
    // LOGICA PRINCIPALE DEL PLANNER
    // =================================================================================

    function getTurnoMatrice(operatore, data) {
        if (!operatore || !data) return null;
    
        let operatorePerMatrice = operatore; // L'operatore di cui useremo la matrice
        let operatorePerOffset = operatore;  // L'operatore di cui useremo l'offset/posizione
        const dataStr = data.toISOString().slice(0, 10);
    
        // Controlla se c'è uno scambio attivo per questo operatore in questa data
        if (appState.matriceSwaps && appState.matriceSwaps.length > 0) {
            const scambioAttivo = appState.matriceSwaps.find(swap =>
                (swap.operatoreA_Id === operatore.id || swap.operatoreB_Id === operatore.id) &&
                dataStr >= swap.dataInizio &&
                dataStr <= swap.dataFine
            );
    
            if (scambioAttivo) {
                const altroOperatoreId = (scambioAttivo.operatoreA_Id === operatore.id)
                    ? scambioAttivo.operatoreB_Id
                    : scambioAttivo.operatoreA_Id;
                
                const altroOperatore = appState.operatori.find(op => op.id === altroOperatoreId);
                
                if (altroOperatore) {
                    operatorePerMatrice = altroOperatore;
                    operatorePerOffset = altroOperatore;
                }
            }
        }
    
        const matriceIdDaUsare = operatorePerMatrice.idMatrice;
        if (!matriceIdDaUsare) return null;
        
        const matrice = appState.matrici.find(m => m.id == matriceIdDaUsare);
        if (!matrice?.sequenza?.length || !matrice.dataInizio) return null;
    
        const matrixStartDate = new Date(matrice.dataInizio);
        
        const opMatriceOriginale = appState.operatori.filter(o => o.isActive && o.idMatrice == matriceIdDaUsare).sort((a, b) => a.ordine - b.ordine);
        const opMatriceIndex = opMatriceOriginale.findIndex(o => o.id === operatorePerOffset.id);
        
        const offsetIndex = (opMatriceIndex !== -1) ? opMatriceIndex : 0;
        
        const diffDays = dateDiffInDays(matrixStartDate, data);
        const sequenzaIndex = (diffDays + offsetIndex) % matrice.sequenza.length;
        
        return matrice.sequenza[sequenzaIndex < 0 ? sequenzaIndex + matrice.sequenza.length : sequenzaIndex];
    }
    
    function generatePlannerData() {
        const year = appState.currentDate.getFullYear();
        const month = appState.currentDate.getMonth();
        const monthKey = getMonthKey(appState.currentDate);
        if (!appState.plannerData[monthKey]) appState.plannerData[monthKey] = {};
        const monthData = appState.plannerData[monthKey];
        const activeOperators = getActiveOperators(year, month, true);
        activeOperators.forEach(op => {
            if (op.reperibilita === undefined) { op.reperibilita = true; }
            for (let day = 1; day <= getDaysInMonth(year, month); day++) {
                const currentDate = new Date(year, month, day);
                const key = `${op.id}-${day}`;
                // Modifica: rispetta sempre isManuallySet, indipendentemente da modType
                if (!monthData[key] || (!monthData[key].isManuallySet && !monthData[key].modType)) {
                    const turnoMatrice = getTurnoMatrice(op, currentDate);
                    monthData[key] = { ...monthData[key], turno: turnoMatrice || '', nota: monthData[key]?.nota || '' };
                }
            }
        });
        validatePlanner(activeOperators.map(op => op.id));
    }

    function calculateAllDailyCounts() {
        const year = appState.currentDate.getFullYear();
        const month = appState.currentDate.getMonth();
        const monthKey = getMonthKey(appState.currentDate);
        const daysInMonth = getDaysInMonth(year, month);
        const dailyCounts = {};
        const operators = getActiveOperators(year, month).filter(op => op.isCounted !== false);
        const shifts = appState.plannerData[monthKey] || {};
        for (let day = 1; day <= daysInMonth; day++) {
            dailyCounts[day] = { M: 0, P: 0, N: 0, SN: 0, qualitaSomma: 0, qualitaConteggio: 0, MQualitaSomma: 0, MQualitaConteggio: 0, MQualitaAvg: 0, PQualitaSomma: 0, PQualitaConteggio: 0, PQualitaAvg: 0 };
            operators.forEach(op => {
                const data = shifts[`${op.id}-${day}`];
                if (data && data.turno) {
                    const turnoDef = getTurnoBySigla(data.turno);
                    const shiftType = getShiftType(data.turno);
                    if (shiftType && dailyCounts[day][shiftType] !== undefined) dailyCounts[day][shiftType]++;
                    if (turnoDef && turnoDef.isOperativo) { 
                        dailyCounts[day].qualitaSomma += op.qualita || 100;
                        dailyCounts[day].qualitaConteggio++;
                        if (shiftType === 'M') { dailyCounts[day].MQualitaSomma += op.qualita || 100; dailyCounts[day].MQualitaConteggio++; } 
                        else if (shiftType === 'P') { dailyCounts[day].PQualitaSomma += op.qualita || 100; dailyCounts[day].PQualitaConteggio++; }
                    }
                }
            });
            if (dailyCounts[day].MQualitaConteggio > 0) dailyCounts[day].MQualitaAvg = dailyCounts[day].MQualitaSomma / dailyCounts[day].MQualitaConteggio;
            if (dailyCounts[day].PQualitaConteggio > 0) dailyCounts[day].PQualitaAvg = dailyCounts[day].PQualitaSomma / dailyCounts[day].PQualitaConteggio;
        }
        return dailyCounts;
    }
    
    function getStatusForShift(shiftType, actual, optimal) {
        if (!shiftType || optimal === undefined) return 'status-gray';
        switch (shiftType) {
            case 'M': case 'P': // Mattina e Pomeriggio
                if (actual >= optimal) return 'status-green';        // ✅ Copertura adeguata
                else if (actual === optimal - 1) return 'status-yellow'; // ⚠️ Copertura ridotta (-1)
                else return 'status-red';                            // 🚨 Copertura critica (-2 o più)
            case 'N': // Notte
                return actual === optimal ? 'status-green' : 'status-red'; // Notte: solo verde o rosso
            case 'SN': // Smonto Notte
                 if (actual > optimal) return 'status-red';          // Troppi smonti
                 else if (actual < optimal) return 'status-yellow';  // Pochi smonti
                 else return 'status-green';                         // Smonti corretti
            default: return 'status-gray';
        }
    }

    // getActiveOperators ora dichiarata globalmente

    function getIndicatorClass(modType) {
        const classMap = { 'C': 'mod-indicator-c', 'S': 'mod-indicator-s', 'G': 'mod-indicator-g' };
        return classMap[modType] || '';
    }
function renderOrderingSchemesList() {
    const listContainer = document.getElementById('ordering-schemes-list');
    const schemes = appState.orderingSchemes || [];

    if (schemes.length === 0) {
        listContainer.innerHTML = '<p class="text-sm text-gray-500 text-center py-4">Nessuno schema di ordinamento definito.</p>';
        return;
    }

    listContainer.innerHTML = schemes.sort((a, b) => a.startDate.localeCompare(b.startDate)).map(scheme => {
        // Aggiungiamo il giorno 01 per una visualizzazione corretta
        const displayDate = new Date(scheme.startDate + '-01');
        return `
            <div class="ordinamento-item">
                <div class="ordinamento-item-info">
                    <p><strong>${scheme.name}</strong></p>
                    <p class="periodo">Attivo da: ${displayDate.toLocaleString('it-IT', { month: 'long', year: 'numeric' })}</p>
                </div>
                <div class="ordinamento-item-actions">
                    <button data-action="delete-ordering-scheme" data-id="${scheme.id}" title="Elimina Schema">
                        <svg class="h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clip-rule="evenodd" /></svg>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function getEffectiveOrderingScheme(date) {
    if (!appState.orderingSchemes || appState.orderingSchemes.length === 0) return null;

    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    const activeSchemes = appState.orderingSchemes
        .filter(scheme => scheme.startDate <= dateStr)
        .sort((a, b) => b.startDate.localeCompare(a.startDate));

    return activeSchemes.length > 0 ? activeSchemes[0] : null;
}
    // =================================================================================
    // FUNZIONI DI RENDERIZZAZIONE DELL'INTERFACCIA
    // =================================================================================

    function renderPlanner() {
    try {
        if (swapState.isActive) cancelSwap();
        clearHighlights();
        closeOperatorInfoPanel();
        
        const plannerTable = document.getElementById('planner-table');
        plannerTable.classList.toggle('show-performance-bars', appState.showPerformanceBars);
        plannerTable.classList.toggle('assignment-mode-active', appState.isAssignmentMode);
        plannerTable.classList.toggle('assignment-grid-active', appState.isAssignmentMode);
        plannerTable.classList.toggle('show-assignments', appState.showAssignments);
        plannerTable.classList.toggle('show-coverage-summary', appState.showCoverageInfo);
        plannerTable.classList.toggle('matrix-view-active', appState.showMatrixOnly);

        const showExtraDetails = activeFilters.has('+');
        plannerTable.classList.toggle('show-extra-details', showExtraDetails);

        const year = appState.currentDate.getFullYear(), month = appState.currentDate.getMonth(), monthKey = getMonthKey(appState.currentDate);
        generatePlannerData();
        
        const effectiveScheme = getEffectiveOrderingScheme(appState.currentDate);
        let sortedOperators;

        const allOperators = [...appState.operatori];

        if (effectiveScheme) {
            sortedOperators = allOperators.sort((a, b) => {
                const indexA = effectiveScheme.order.indexOf(a.id);
                const indexB = effectiveScheme.order.indexOf(b.id);
                if (indexA === -1) return 1;
                if (indexB === -1) return -1;
                return indexA - indexB;
            });
        } else {
            sortedOperators = allOperators.sort((a,b) => a.ordine - b.ordine);
        }

        const shifts = appState.plannerData[monthKey] || {};
        const daysInMonth = getDaysInMonth(year, month);
        const allDailyCounts = calculateAllDailyCounts();
        const weekDays = ['D', 'L', 'M', 'M', 'G', 'V', 'S'];

        document.getElementById('current-month-year').textContent = appState.currentDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
        
        let headHTML = '';
        const totalColumns = daysInMonth + 2;
        headHTML += `
            <tr class="matrix-view-notification-row">
                <td colspan="${totalColumns}" class="matrix-view-notification-cell">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 inline-block -mt-0.5 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" /></svg>
                    MODALITÀ VISTA MATRICE ATTIVA (le modifiche manuali sono temporaneamente nascoste)
                </td>
            </tr>
        `;
        let morningCoverageHTML = '<tr class="coverage-summary-row bg-gray-50 text-xs"><td class="sticky left-0 bg-gray-50"></td><td class="sticky-hours text-right px-2 font-bold">M:</td>';
        let afternoonCoverageHTML = '<tr class="coverage-summary-row bg-gray-50 text-xs"><td class="sticky left-0 bg-gray-50"></td><td class="sticky-hours text-right px-2 font-bold">P:</td>';
        
        for (let day = 1; day <= daysInMonth; day++) {
            const dayCounts = allDailyCounts[day];
            const createBarCellContent = (average, count) => {
                if (appState.showPerformanceBars) {
                    let leftBarHTML = '', rightBarHTML = '';
                    const deviation = average - 100, maxBarWidth = 25, barWidth = Math.min(Math.abs(deviation) / 20, 1) * maxBarWidth;
                    if (average > 0 && deviation < 0) leftBarHTML = `<div title="Qualità media: ${average.toFixed(1)}%" style="height: 10px; width: ${barWidth}px; background-color: #ef4444; border-radius: 5px 0 0 5px;"></div>`;
                    else if (average > 0 && deviation > 0) rightBarHTML = `<div title="Qualità media: ${average.toFixed(1)}%" style="height: 10px; width: ${barWidth}px; background-color: #22c55e; border-radius: 0 5px 5px 0;"></div>`;
                    return `<div class="grid items-center mx-auto" style="grid-template-columns: 1fr auto 1fr; height: 10px; min-width:${(maxBarWidth*2)+15}px"><div class="flex justify-end items-center">${leftBarHTML}</div><div>${count}</div><div class="flex justify-start items-center">${rightBarHTML}</div></div>`;
                } else return `<div>${count}</div>`;
            };
            const morningStatus = getStatusForShift('M', dayCounts.M, appState.coverageOptimal.M);
            morningCoverageHTML += `<td class="text-center font-bold ${morningStatus.replace('status-','text-status-')}">${createBarCellContent(dayCounts.MQualitaAvg, dayCounts.M)}</td>`;
            const afternoonStatus = getStatusForShift('P', dayCounts.P, appState.coverageOptimal.P);
            afternoonCoverageHTML += `<td class="text-center font-bold ${afternoonStatus.replace('status-','text-status-')}">${createBarCellContent(dayCounts.PQualitaAvg, dayCounts.P)}</td>`;
        }
        morningCoverageHTML += '</tr>'; afternoonCoverageHTML += '</tr>';
        headHTML += morningCoverageHTML + afternoonCoverageHTML;

        let mainHeaderHTML = '<tr><th class="px-4 py-1 sticky left-0 bg-gray-100 z-20">Operatore</th><th class="sticky-hours px-2 py-1 text-center">Ore</th>';
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(year, month, day);
            const dayOfWeek = currentDate.getDay();
            let dayStatusLevels = { red: 0, yellow: 0, green: 0 };
            Object.keys(appState.coverageOptimal).forEach(shiftType => {
                const status = getStatusForShift(shiftType, allDailyCounts[day][shiftType], appState.coverageOptimal[shiftType]);
                if (status === 'status-red') dayStatusLevels.red++;
                else if (status === 'status-yellow') dayStatusLevels.yellow++;
            });
            let finalDayBgClass = 'status-bg-green';
            if (dayStatusLevels.red > 0) finalDayBgClass = 'status-bg-red';
            else if (dayStatusLevels.yellow > 0) finalDayBgClass = 'status-bg-yellow';
            const headerEffectClass = appState.show3DEffect ? 'header-3d-effect' : '';
            
            // Aggiungi classe per domenica (evidenziazione settimana)
            const sundayClass = dayOfWeek === 0 ? 'sunday-week-separator' : '';
            
            mainHeaderHTML += `<th class="p-1 text-center ${finalDayBgClass} ${sundayClass} day-header-cell" data-day-col="${day}" onclick="toggleDayColumnHighlight(${day})" style="position: relative; cursor: pointer;"><div class="base-cell ${headerEffectClass} ${finalDayBgClass}"><div class="flex items-center justify-center">${day}</div><div class="text-xs">${weekDays[dayOfWeek]}</div></div></th>`;
        }
        mainHeaderHTML += '</tr>';
        headHTML += mainHeaderHTML;
        document.getElementById('planner-head').innerHTML = headHTML;

        let bodyHTML = '';
        sortedOperators.forEach(op => {
            let totalHours = 0, totalStraordinario = 0;
            let rowClasses = 'bg-white border-b hover:bg-gray-50 draggable-row';
            if (!op.isActive) rowClasses += ' inactive-operator';
            if (op.isCounted === false) rowClasses += ' excluded-operator';
            
            const matrice = appState.matrici.find(m => m.id == op.idMatrice);
            const lightOpColor = lightenColor(op.colore || '#FFFFFF', 0.7);
            let orderIndicatorHtml = '';
            if (effectiveScheme) {
                const isMapped = effectiveScheme.scheduleMap[op.id];
                const titleText = isMapped ? `In questo schema, ${op.cognome} usa la matrice di un altro operatore.` : `In questo schema, ${op.cognome} mantiene la propria matrice.`;
                orderIndicatorHtml = `<div class="order-change-indicator" title="${titleText}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M10 3a1 1 0 01.707.293l3 3a1 1 0 01-1.414 1.414L11 6.414V12a1 1 0 11-2 0V6.414L7.707 7.707a1 1 0 01-1.414-1.414l3-3A1 1 0 0110 3zm-3.707 9.293a1 1 0 011.414 0L9 13.586V8a1 1 0 112 0v5.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
                    </svg>
                </div>`;
            }
            // Rileva se siamo su mobile per mostrare solo cognomi
            const isMobile = window.innerWidth <= 480;
            const displayName = isMobile ? op.cognome : `${op.cognome} ${op.nome}`;
            
            let rowHTML = `<td draggable="true" data-op-id="${op.id}" class="px-4 py-1 font-medium whitespace-nowrap sticky left-0 z-10 flex justify-start items-center operator-name-cell" style="background-color: ${lightOpColor}; border-left: 8px solid ${matrice?.colore || 'transparent'}; cursor: pointer; position: relative; min-width: 300px;">
                            ${orderIndicatorHtml}
                            <span style="color: ${getContrastingTextColor(lightOpColor)}; font-weight: 600; padding-left: ${effectiveScheme ? '1.25rem' : '0'};" data-surname="${op.cognome}" title="${op.cognome} ${op.nome}">${displayName}</span>
                            <div class="operator-controls">
                                <button class="focus-mode-btn p-1 rounded-full hover:bg-gray-300" title="Modalità Focus" data-action="focus-operator" data-op-id="${op.id}">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.27 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd" /></svg>
                                </button>
                                <label class="operator-toggle-wrapper flex items-center cursor-pointer"><div class="relative"><input type="checkbox" data-op-id="${op.id}" class="sr-only operator-toggle" ${op.isActive && op.isCounted !== false ? 'checked' : ''}><div class="toggle-bg"></div></div></label>
                            </div>
                           </td>`;
            
            for (let day = 1; day <= daysInMonth; day++) {
                if (appState.showMatrixOnly) {
                    const turnoMatrice = getTurnoMatrice(op, new Date(year, month, day));
                    const turnoDef = getTurnoBySigla(turnoMatrice);
                    if (turnoDef && turnoDef.conteggioOre === 'orario') {
                        totalHours += turnoDef.ore;
                    }
                } else {
                    const data = shifts[`${op.id}-${day}`];
                    if (data) {
                        const turnoDef = getTurnoBySigla(data.turno);
                        if (turnoDef) {
                            if (turnoDef.conteggioOre === 'orario') {
                                totalHours += (data.oreFerie !== undefined) ? data.oreFerie : turnoDef.ore;
                            } else if (turnoDef.conteggioOre === 'sostitutivo') {
                                const originalTurno = getTurnoBySigla(data.originalTurno);
                                if (originalTurno) {
                                    totalHours += originalTurno.ore;
                                }
                            }
                        }
                        if (data.extraInfo && typeof data.extraInfo.hours === 'number') {
                            totalStraordinario += data.extraInfo.hours;
                        }
                    }
                }
            }
            const extraHoursHTML = (totalStraordinario > 0 && !appState.showMatrixOnly) ? `<div class="text-xs text-red-600 font-normal" title="Ore di straordinario">+${totalStraordinario.toFixed(1)}h</div>` : '';
            rowHTML += `<td class="sticky-hours px-2 py-1 text-center"><div class="font-bold text-sm">${totalHours.toFixed(1)}</div>${extraHoursHTML}</td>`;
    
            for (let day = 1; day <= daysInMonth; day++) {
                let data, turnoToShow, turnoDef, indicatorsHTML = '', assignment = null;
                const currentDate = new Date(year, month, day);
                const dayOfWeek = currentDate.getDay();

                if (appState.showMatrixOnly) {
                    turnoToShow = getTurnoMatrice(op, currentDate);
                    turnoDef = getTurnoBySigla(turnoToShow);
                    data = { turno: turnoToShow }; 
                } else {
                    data = shifts[`${op.id}-${day}`] || { turno: '', nota: '' };
                    turnoToShow = data.turno;
                    turnoDef = getTurnoBySigla(turnoToShow);
                    assignment = data.assignmentId ? appState.assignments.find(a => a.id === data.assignmentId) : null;
                    
                    const tooltipData = JSON.stringify(data).replace(/'/g, "&apos;");
                    if (appState.showModSymbols && !appState.isAssignmentMode) {
                        if (data.modType && data.modType !== 'E') indicatorsHTML += `<div class="mod-indicator ${getIndicatorClass(data.modType)}" data-tooltip-info='${tooltipData}'>${data.modType}</div>`;
                        if (data.extraInfo) {
                            const type = data.extraInfo.type;
                            let symbol = '+';
                            if(type === 'prolungamento') symbol = 'P';
                            else if(type === 'rientro') symbol = 'R';
                            if (data.extraInfo.gettone) symbol = 'G';
                            indicatorsHTML += `<div class="extra-indicator extra-indicator-${type}" data-tooltip-info='${tooltipData}'>${symbol}</div>`;
                        } else if (data.gettone) {
                            indicatorsHTML += `<div class="extra-indicator extra-indicator-gettone" data-tooltip-info='${tooltipData}'>G</div>`;
                        }
                        if (data.nota) indicatorsHTML += `<div class="note-indicator" data-tooltip-info='${tooltipData}'>N</div>`;
                    }
                    if (data.violations && data.violations.length > 0) {
                         indicatorsHTML += `<div class="violation-indicator" data-tooltip-info='${tooltipData}'><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" /></svg></div>`;
                    }
                }
                
                const isUnavailable = isOperatorUnavailable(op.id, currentDate);
                let cellClasses = 'planner-cell';
                if (isUnavailable) cellClasses += ' cell-unavailability';
                if (data.violations && data.violations.length > 0 && !appState.showMatrixOnly) cellClasses += ' cell-violation';
                if (dayOfWeek === 0) cellClasses += ' sunday-week-separator';
                
                let style = '', classes = '';
                let shiftTextSpan = `<span class="font-semibold">${turnoToShow || ''}</span>`;
                
                let hoursHTML = '';
                if (appState.showShiftHours && turnoDef) {
                    let hoursToShow = 0;
                    let isSostitutivo = false;
                    if (turnoDef.conteggioOre === 'sostitutivo' && !appState.showMatrixOnly) {
                        const originalTurnoDef = getTurnoBySigla(data.originalTurno);
                        if (originalTurnoDef) {
                            hoursToShow = originalTurnoDef.ore;
                            isSostitutivo = true;
                        }
                    } else {
                        hoursToShow = turnoDef.ore;
                    }
                    if (hoursToShow > 0) {
                        const style = isSostitutivo ? 'opacity: 0.7; font-style: italic;' : '';
                        hoursHTML = `<div class="shift-hours-display" style="${style}" title="Ore del turno originale">${hoursToShow}h</div>`;
                    }
                }

                const assignmentClass = (assignment && !appState.showMatrixOnly) ? 'has-assignment' : '';

                if (appState.isAssignmentMode) {
                    if (assignment) {
                        // Miglioramento del contrasto e della leggibilità
                        const bgColor = assignment.colore;
                        const textColor = getContrastingTextColor(bgColor);
                        const shadowColor = adjustColorBrightness(bgColor, -20);
                        
                        style = `background: linear-gradient(135deg, ${bgColor} 0%, ${adjustColorBrightness(bgColor, -10)} 100%);
                                 color: ${textColor};
                                 text-shadow: 0 1px 2px ${shadowColor};
                                 border: 1px solid ${adjustColorBrightness(bgColor, -15)};`;
                    } else {
                        classes = 'bg-gradient-to-br from-gray-50 to-gray-100 text-gray-400 border border-gray-200';
                    }
                } else {
                    const themeToggle = document.getElementById('theme-toggle');
                    if (themeToggle && themeToggle.checked && turnoDef?.colore) {
                        style = `background-color: ${turnoDef.colore}; color: ${getContrastingTextColor(turnoDef.colore)};`;
                    } else {
                        if (turnoDef && turnoDef.isOperativo) {
                            classes = 'work-cell-default-bg work-cell-default-text';
                        } else {
                            classes = 'rest-cell-default-bg text-gray-600';
                        }
                        if (!turnoToShow) classes = 'empty-cell-default-bg';
                    }
                    if (assignment && !appState.showMatrixOnly) {
                        const assignmentShadow = adjustColorBrightness(assignment.colore, -20);
                        style += ` --assignment-color: ${assignment.colore};
                                   --assignment-shadow: ${assignmentShadow};`;
                    }
                }
                
                let extraBgClass = '';
                if (showExtraDetails && data.extraInfo && !appState.showMatrixOnly) {
                    switch(data.extraInfo.type) {
                        case 'straordinario': extraBgClass = 'extra-bg-straordinario'; break;
                        case 'prolungamento': extraBgClass = 'extra-bg-prolungamento'; break;
                        case 'rientro': extraBgClass = 'extra-bg-rientro'; break;
                    }
                }
                
                const isOperative = turnoDef && turnoDef.isOperativo;
                if (!isOperative) cellClasses += ' non-operative-cell';

                let presenceInfo = '';
                if(appState.showCoverageInfo && !appState.isAssignmentMode) {
                    const shiftType = getShiftType(turnoToShow);
                    if(shiftType && allDailyCounts[day][shiftType] !== undefined) {
                        const statusClass = getStatusForShift(shiftType, allDailyCounts[day][shiftType], appState.coverageOptimal[shiftType]);
                        if(statusClass && statusClass !== 'status-green') presenceInfo = `<div class="flex items-center justify-center h-3 mt-0.5"><div class="status-dot status-dot-sm bg-${statusClass.replace('status-', 'status-')}"></div></div>`;
                    }
                }

                let extraDetailsHTML = '';
                if (data.extraInfo && !appState.showMatrixOnly) {
                    const typeMap = { 'straordinario': 'Straordinario', 'prolungamento': 'Prolungamento', 'rientro': 'Rientro' };
                    const typeText = typeMap[data.extraInfo.type] || 'Extra';
                    
                    // Layout orizzontale - Prima riga: tipo, turno e gettone
                    let detailsContent = `<div class="extra-detail-line horizontal-layout">`;
                    detailsContent += `<span class="extra-type-badge ${data.extraInfo.type}">${data.extraInfo.type.charAt(0).toUpperCase()}</span>`;
                    detailsContent += `<strong>${turnoToShow || typeText}</strong>`;
                    if (data.extraInfo.gettone) detailsContent += ` <span class="gettone-badge">G</span>`;
                    detailsContent += `</div>`;
                    
                    // Seconda riga: orari e ore extra (se disponibili)
                    let secondLineContent = [];
                    if(data.extraInfo.startTime && data.extraInfo.endTime) {
                        secondLineContent.push(`⏰ ${data.extraInfo.startTime}-${data.extraInfo.endTime}`);
                    }
                    if(typeof data.extraInfo.hours === 'number' && data.extraInfo.hours > 0) {
                        secondLineContent.push(`<span class="extra-hours-display">+${data.extraInfo.hours.toFixed(1)}h</span>`);
                    }
                    
                    if(secondLineContent.length > 0) {
                        detailsContent += `<div class="extra-detail-line horizontal-layout">${secondLineContent.join(' • ')}</div>`;
                    }
                    
                    // Terza riga: nota (se presente)
                    if(data.extraInfo.note) {
                        detailsContent += `<div class="extra-detail-line note horizontal-layout">💬 ${data.extraInfo.note}</div>`;
                    }
                    
                    extraDetailsHTML = `<div class="cell-extra-details">${detailsContent}</div>`;
                }

                let printInfoHTML = '';
                if (data.extraInfo?.hours && !appState.showMatrixOnly) {
                    printInfoHTML += `<div>+${data.extraInfo.hours.toFixed(1)}h extra</div>`;
                }
                if (data.nota && !appState.showMatrixOnly) {
                    printInfoHTML += `<div>Nota: ${data.nota}</div>`;
                }

                const cellEffectClass = appState.show3DEffect ? 'cell-3d-effect' : '';
                const hasContent = turnoToShow || data.nota || assignment;
                const cellDataAttributes = `data-operator-id="${op.id}" data-day="${day}" data-has-content="${hasContent ? 'true' : 'false'}"`;
                const rightClickHandler = hasContent ? `oncontextmenu="openQuickEditMenu(${op.id}, ${day}, event); return false;"` : '';
                
                rowHTML += `<td class="text-center p-0.5 has-tooltip relative ${cellClasses} ${showExtraDetails && data.extraInfo ? 'extra-details-visible' : ''}" data-op-id="${op.id}" data-day="${day}" ${cellDataAttributes}>
                    <div class="w-full h-full cursor-pointer flex flex-col justify-center items-center base-cell ${cellEffectClass} ${classes} ${assignmentClass} ${extraBgClass}" style="${style}" ${rightClickHandler}>
                        <div>${shiftTextSpan}</div>
                        ${hoursHTML} 
                        ${presenceInfo}
                        ${indicatorsHTML}
                        ${extraDetailsHTML}
                        <div class="print-only-info">${printInfoHTML}</div>
                    </div>
                </td>`;
            }
            bodyHTML += `<tr class="${rowClasses}" data-op-id="${op.id}">${rowHTML}</tr>`;
        });
        
        const plannerBody = document.getElementById('planner-body');
        plannerBody.innerHTML = bodyHTML; 
        
        plannerBody.removeEventListener('click', handlePlannerBodyClick);
        plannerBody.removeEventListener('dblclick', handlePlannerBodyDoubleClick);
        plannerBody.removeEventListener('mousedown', handleSelectionStart);
        plannerBody.removeEventListener('mouseover', handlePlannerBodyMouseover);
        plannerBody.removeEventListener('mouseout', handlePlannerBodyMouseout);
        plannerBody.removeEventListener('change', handlePlannerBodyChange);
        
        plannerBody.addEventListener('click', handlePlannerBodyClick);
        plannerBody.addEventListener('dblclick', handlePlannerBodyDoubleClick);
        plannerBody.addEventListener('mousedown', handleSelectionStart);
        plannerBody.addEventListener('mouseover', handlePlannerBodyMouseover);
        plannerBody.addEventListener('mouseout', handlePlannerBodyMouseout);
        plannerBody.addEventListener('change', handlePlannerBodyChange);
        
        setupDragAndDrop(plannerBody);
        
        // Inizializza il sistema di drag and drop per la modifica avanzata
        setTimeout(() => {
            initializeDragAndDrop();
        }, 100);
        
        // setTimeout(() => {
        //     checkEmergencyConditions();
        // }, 100);
        
        // Aggiorna layout del planner - DISABILITATO per mantenere zoom fisso
        // updatePlannerLayout();
        
    } catch(error) {
        console.error("Errore irreversibile durante il rendering del planner:", error);
        showConfirmation("Si è verificato un errore critico durante il disegno della griglia. L'applicazione potrebbe essere instabile. Causa probabile: dati corrotti o incompatibili nel file di backup caricato.", "Errore di Rendering", true);
        document.getElementById('planner-body').innerHTML = `<tr><td class="p-8 text-center text-red-600 font-semibold" colspan="33">Errore di rendering. Controlla la console per i dettagli.</td></tr>`;
    }
}
// =================================================================================
// NUOVA SEZIONE: DASHBOARD
// =================================================================================

function renderDashboard() {
    const year = appState.currentDate.getFullYear();
    const month = appState.currentDate.getMonth();
    const monthKey = getMonthKey(appState.currentDate);
    const daysInMonth = getDaysInMonth(year, month);
    const operators = getActiveOperators(year, month, false);
    const monthData = appState.plannerData[monthKey] || {};

    let totalHours = 0;
    let extraHours = 0;
    let violationCount = 0;
    const shiftDistribution = {};
    const equityData = {};

    operators.forEach(op => {
        equityData[op.id] = { name: `${op.cognome} ${op.nome.charAt(0)}.`, notti: 0, weekend: 0 };
        for (let day = 1; day <= daysInMonth; day++) {
            const data = monthData[`${op.id}-${day}`];
            if (!data) continue;

            // Calcolo Ore
            const turnoDef = getTurnoBySigla(data.turno);
            if (turnoDef) {
                if (turnoDef.conteggioOre === 'orario') {
                    totalHours += (data.oreFerie !== undefined) ? data.oreFerie : turnoDef.ore;
                } else if (turnoDef.conteggioOre === 'sostitutivo') {
                    const originalTurno = getTurnoBySigla(data.originalTurno);
                    if (originalTurno) totalHours += originalTurno.ore;
                }
                // Conteggio per grafico distribuzione
                if (shiftDistribution[turnoDef.sigla]) {
                    shiftDistribution[turnoDef.sigla]++;
                } else {
                    shiftDistribution[turnoDef.sigla] = 1;
                }
            }
            if (data.extraInfo?.hours) {
                extraHours += data.extraInfo.hours;
            }

            // Conteggio Violazioni
            if (data.violations && data.violations.length > 0) {
                violationCount++;
            }

            // Conteggio Equità
            if (data.turno && typeof data.turno === 'string' && data.turno.toUpperCase() === 'N') {
                equityData[op.id].notti++;
            }
            const dayOfWeek = new Date(year, month, day).getDay();
            if ((dayOfWeek === 0 || dayOfWeek === 6) && turnoDef?.isOperativo) {
                equityData[op.id].weekend++;
            }
        }
    });

    // Aggiorna Widgets
    document.getElementById('dashboard-widget-ore-lavorate').innerHTML = `
        <div class="widget-icon bg-indigo-500"><svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
        <div><div class="widget-value">${(totalHours + extraHours).toFixed(1)}</div><div class="widget-label">Ore Totali Pianificate</div></div>`;
    
    document.getElementById('dashboard-widget-ore-extra').innerHTML = `
        <div class="widget-icon bg-orange-500"><svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd" /></svg></div>
        <div><div class="widget-value">${extraHours.toFixed(1)}</div><div class="widget-label">Ore Extra Registrate</div></div>`;

    document.getElementById('dashboard-widget-violazioni').innerHTML = `
        <div class="widget-icon ${violationCount > 0 ? 'bg-red-500' : 'bg-green-500'}"><svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" /></svg></div>
        <div><div class="widget-value">${violationCount}</div><div class="widget-label">Violazioni alle Regole</div></div>`;

    document.getElementById('dashboard-widget-costo-extra').innerHTML = `
        <div class="widget-icon bg-blue-500"><svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M8.433 7.418c.158-.103.346-.195.574-.277a6.99 6.99 0 01.566-.144c.642-.143 1.354-.143 1.996 0a6.99 6.99 0 01.566.144c.228.082.416.174.574.277a1 1 0 01.18.92c-.06.223-.17.433-.314.632a5.485 5.485 0 01-.48.61c-.24.27-.534.524-.86.748a5.493 5.493 0 01-1.25.68A5.5 5.5 0 0110 12.5a5.5 5.5 0 01-1.25-.68 5.493 5.493 0 01-1.25-.68c-.326-.224-.62-.478-.86-.748a5.485 5.485 0 01-.48-.61c-.144-.199-.254-.409-.314-.632a1 1 0 01.18-.92zM10 18a8 8 0 100-16 8 8 0 000 16z" /></svg></div>
        <div><div class="widget-value">N/D</div><div class="widget-label">Costo Extra Stimato</div></div>`;


    // Grafico Distribuzione Turni
    const turniLabels = Object.keys(shiftDistribution);
    const turniData = Object.values(shiftDistribution);
    const turniColors = turniLabels.map(sigla => getTurnoBySigla(sigla)?.colore || '#cccccc');
    const ctxTurni = document.getElementById('dashboard-chart-turni').getContext('2d');
    if (dashboardTurniChart) dashboardTurniChart.destroy();
    dashboardTurniChart = new Chart(ctxTurni, {
        type: 'pie',
        data: {
            labels: turniLabels,
            datasets: [{
                label: 'Distribuzione Turni',
                data: turniData,
                backgroundColor: turniColors,
                borderColor: '#ffffff',
                borderWidth: 2
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // Grafico Equità
    const equitaLabels = Object.values(equityData).map(d => d.name);
    const nottiData = Object.values(equityData).map(d => d.notti);
    const weekendData = Object.values(equityData).map(d => d.weekend);
    const ctxEquita = document.getElementById('dashboard-chart-equita').getContext('2d');
    if (dashboardEquitaChart) dashboardEquitaChart.destroy();
    dashboardEquitaChart = new Chart(ctxEquita, {
        type: 'bar',
        data: {
            labels: equitaLabels,
            datasets: [
                { label: 'Turni Notturni', data: nottiData, backgroundColor: 'rgba(54, 162, 235, 0.6)' },
                { label: 'Turni Weekend', data: weekendData, backgroundColor: 'rgba(255, 159, 64, 0.6)' }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
            plugins: { legend: { position: 'top' } }
        }
    });
}
    function renderCoverageControls() {
        const controls = document.getElementById('coverage-controls');
        if (!controls || !appState.coverageOptimal) return;
        controls.innerHTML = Object.keys(appState.coverageOptimal).map(k => `
            <div class="p-4 bg-gray-50 rounded-lg">
                <label for="cov-opt-${k}" class="font-bold text-lg">${k}</label>
                <input type="number" id="cov-opt-${k}" data-key="${k}" value="${appState.coverageOptimal[k]}" class="w-full mt-1 p-1 border rounded-md text-center modal-input">
            </div>
        `).join('');
    }

    function renderSettings() {
        renderElementsMasterDetail();
        renderCoverageControls();
renderScambiPanel();
renderOrderingSchemesList();
        const ruleMinRest = document.getElementById('rule-minRestHours');
        const ruleMaxDays = document.getElementById('rule-maxConsecutiveDays');
        if (ruleMinRest) ruleMinRest.value = appState.validationRules.minRestHours;
        if (ruleMaxDays) ruleMaxDays.value = appState.validationRules.maxConsecutiveDays;
        
        if(appState.appearance) {
            document.getElementById('toggle-color-picker').value = appState.appearance.toggleColor;
            document.getElementById('work-cell-bg-color-picker').value = appState.appearance.workCellBgColor;
            document.getElementById('highlight-color-picker').value = appState.appearance.highlightBgColor;
            document.getElementById('sunday-bars-toggle').checked = appState.appearance.showSundayBars !== false;
        }
    }

    function renderPrintLegend() {
        const legendContent = document.getElementById('print-legend-content');
        if (!legendContent) return;

        const legendItemsHtml = appState.turni
            .filter(t => t.sigla && t.sigla.trim() !== '-' && t.sigla.trim() !== '' && t.colore !== '#ffffff')
            .sort((a, b) => a.sigla.localeCompare(b.sigla))
            .map(t => `
                <div class="legend-item-print">
                    <span class="legend-color-box-print" style="background-color: ${t.colore || '#ccc'};"></span>
                    <strong class="legend-sigla-print">${t.sigla}:</strong>
                    <span class="legend-desc-print">${t.descrizione || 'N/D'}</span>
                    <span class="legend-time-print">(${t.inizio || '..:..'} - ${t.fine || '..:..'})</span>
                </div>
            `).join('');

        legendContent.innerHTML = legendItemsHtml;
    }

    function populateSelect(selectId, options, selectedValue) {
        const select = document.getElementById(selectId);
        if (!select) return;
        select.innerHTML = options.map(opt => `<option value="${opt.value}" ${opt.value == selectedValue ? 'selected' : ''}>${opt.text}</option>`).join('');
    }
    
    function populateAllSelects() {
        if(document.getElementById('operatore-matrice-select')) {
            const matriciOptions = appState.matrici.map(m => ({ value: m.id, text: m.nome }));
            populateSelect('operatore-matrice-select', [{value: '', text: 'Nessuna Matrice'}, ...matriciOptions], '');
        }
        if(document.getElementById('turno-conteggio-ore-select')) {
            const conteggioOptions = [{ value: 'orario', text: 'Orario Normale' }, { value: 'sostitutivo', text: 'Sostitutivo (es. Permesso)' }, { value: 'zero', text: 'Zero Ore (es. Riposo)' }];
            populateSelect('turno-conteggio-ore-select', conteggioOptions, 'orario');
        }
    }

    // =================================================================================
    // MOTORE DI VALIDAZIONE E SUGGERIMENTI
    // =================================================================================

    function validatePlanner(operatorIds = []) {
        if (!appState.validationRules) return;

        const year = appState.currentDate.getFullYear();
        const month = appState.currentDate.getMonth();
        const monthKey = getMonthKey(appState.currentDate);
        if (!appState.plannerData[monthKey]) return;

        const opsToValidate = operatorIds.length > 0 
            ? appState.operatori.filter(op => operatorIds.includes(op.id))
            : getActiveOperators(year, month);

        opsToValidate.forEach(op => {
            let consecutiveWorkDays = 0;
            for (let day = 1; day <= getDaysInMonth(year, month) + 1; day++) {
                const currentDate = new Date(year, month, day);
                const currentMonthKey = getMonthKey(currentDate);
                const data = appState.plannerData[currentMonthKey]?.[`${op.id}-${currentDate.getDate()}`];
                if (data) data.violations = [];

                // Check 1: Consecutive Work Days
                const turnoDef = getTurnoBySigla(data?.turno);
                if (turnoDef && turnoDef.isOperativo) {
                    consecutiveWorkDays++;
                } else {
                    consecutiveWorkDays = 0;
                }

                if (appState.validationRules.maxConsecutiveDays && consecutiveWorkDays > appState.validationRules.maxConsecutiveDays) {
                    for (let i = 0; i < consecutiveWorkDays; i++) {
                        const pastDate = new Date(year, month, day - i);
                        const pastMonthKey = getMonthKey(pastDate);
                        const pastDay = pastDate.getDate();
                        const pastData = appState.plannerData[pastMonthKey]?.[`${op.id}-${pastDay}`];
                        if (pastData) {
                            if (!pastData.violations) pastData.violations = [];
                            const message = `Max ${appState.validationRules.maxConsecutiveDays} giorni di lavoro consecutivi`;
                            if (!pastData.violations.includes(message)) pastData.violations.push(message);
                        }
                    }
                }

                // Check 2: Minimum Rest Hours
                const prevDate = new Date(year, month, day - 1);
                const prevMonthKey = getMonthKey(prevDate);
                const prevDay = prevDate.getDate();
                const prevData = appState.plannerData[prevMonthKey]?.[`${op.id}-${prevDay}`];
                const prevTurnoDef = getTurnoBySigla(prevData?.turno);

                if (turnoDef && prevTurnoDef && turnoDef.isOperativo && prevTurnoDef.isOperativo && appState.validationRules.minRestHours) {
                    if (prevTurnoDef.fine && turnoDef.inizio) {
                        const prevEndTime = prevTurnoDef.fine.split(':');
                        const currentStartTime = turnoDef.inizio.split(':');

                        const prevEnd = new Date(prevDate.getFullYear(), prevDate.getMonth(), prevDate.getDate(), prevEndTime[0], prevEndTime[1]);
                        const currentStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), currentStartTime[0], currentStartTime[1]);
                        
                        if (prevTurnoDef.fine < prevTurnoDef.inizio) {
                            prevEnd.setDate(prevEnd.getDate() + 1);
                        }

                        let restHours = (currentStart - prevEnd) / 3600000;

                        if (restHours < appState.validationRules.minRestHours) {
                            if (!data.violations) data.violations = [];
                            const message = `Riposo insufficiente (${restHours.toFixed(1)}h). Minimo ${appState.validationRules.minRestHours}h.`;
                            if (!data.violations.includes(message)) data.violations.push(message);
                        }
                    }
                }
            }
        });
    }

    function isOperatorUnavailable(opId, date) {
        const operator = appState.operatori.find(op => op.id === opId);
        if (!operator || !operator.unavailabilities) return false;
        
        const checkDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

        return operator.unavailabilities.some(unav => {
            const startDate = new Date(unav.startDate);
            const endDate = new Date(unav.endDate);
            return checkDate >= startDate && checkDate <= endDate;
        });
    }

    function isOperatorAvailableForEmergency(opId, day, monthKey) {
        // Controlla se l'operatore è disponibile per assegnazioni di emergenza
        const operator = appState.operatori.find(op => op.id === opId);
        if (!operator || !operator.isActive || operator.isCounted === false) {
            return false;
        }

        const cellKey = `${opId}-${day}`;
        const currentData = appState.plannerData[monthKey]?.[cellKey];
        const currentTurno = currentData?.turno;
        
        // Escludi operatori assenti per malattia (turno 'A' - Assenza generica)
        if (currentTurno === 'A') {
            return false;
        }
        
        // NUOVA REGOLA: Escludi completamente dalla reperibilità operatori con turno SN
        if (currentTurno === 'SN') {
            return false;
        }
        
        // NUOVA REGOLA: Escludi completamente dalla reperibilità operatori in permesso
        if (currentTurno === 'PER') {
            return false;
        }
        
        // NUOVA REGOLA: Escludi completamente dalla reperibilità operatori in permesso 104
        if (currentTurno === '104') {
            return false;
        }
        
        // Escludi operatori attualmente assegnati al turno di notte
        if (currentTurno === 'N') {
            return false;
        }
        
        // NUOVA REGOLA: Escludi completamente dalla reperibilità operatori in riposo dopo turno N-SN
        const prevDay = day - 1;
        if (prevDay >= 1) {
            const prevCellKey = `${opId}-${prevDay}`;
            const prevData = appState.plannerData[monthKey]?.[prevCellKey];
            
            // Se il giorno precedente aveva turno notturno ('N') seguito da SN, deve riposare
            if (prevData?.turno === 'N') {
                const nextDay = day + 1;
                const nextCellKey = `${opId}-${nextDay}`;
                const nextData = appState.plannerData[monthKey]?.[nextCellKey];
                if (nextData?.turno === 'SN') {
                    return false;
                }
            }
        }
        
        // Verifica indisponibilità programmate
        const currentDate = new Date(appState.currentDate.getFullYear(), appState.currentDate.getMonth(), day);
        if (isOperatorUnavailable(opId, currentDate)) {
            return false;
        }

        // Controlla se ha già troppi turni consecutivi
        let consecutiveWorkDays = 0;
        const maxConsecutive = appState.validationRules?.maxConsecutiveDays || 5;
        
        for (let checkDay = day - maxConsecutive; checkDay <= day + maxConsecutive; checkDay++) {
            if (checkDay < 1) continue;
            
            const data = appState.plannerData[monthKey]?.[`${opId}-${checkDay}`];
            const turnoDef = getTurnoBySigla(data?.turno);
            
            if (turnoDef && turnoDef.isOperativo) {
                consecutiveWorkDays++;
                if (consecutiveWorkDays >= maxConsecutive) {
                    return false;
                }
            } else {
                consecutiveWorkDays = 0;
            }
        }

        // Controlla se ha violazioni critiche di riposo
        if (prevDay >= 1) {
            const prevData = appState.plannerData[monthKey]?.[`${opId}-${prevDay}`];
            if (prevData?.violations?.some(v => v.includes('Riposo insufficiente'))) {
                return false;
            }
        }

        return true;
    }

    function handleSuggestionClick(e) {
        const target = e.target.closest('[data-suggestion-day]');
        if (!target) return;
        
        const day = parseInt(target.dataset.suggestionDay, 10);
        const type = target.dataset.suggestionType;

        getCoverageSuggestions(day, type);
    }
    
    function getCoverageSuggestions(day, shiftType) {
        const suggestions = [];
        const year = appState.currentDate.getFullYear();
        const month = appState.currentDate.getMonth();
        const currentDate = new Date(year, month, day);
        const monthKey = getMonthKey(currentDate);

        const targetShiftSigla = shiftType === 'M' ? 'M8' : (shiftType === 'P' ? 'P' : 'N');
        const targetTurnoDef = getTurnoBySigla(targetShiftSigla);
        if (!targetTurnoDef) {
            showToast(`Definizione del turno ${targetShiftSigla} non trovata.`, "error");
            return;
        }

        const operators = getActiveOperators(year, month).filter(op => op.isCounted && op.reperibilita !== false);
        const allDailyCounts = calculateAllDailyCounts();

        operators.forEach(op => {
            const currentData = appState.plannerData[monthKey]?.[`${op.id}-${day}`] || {};
            const currentTurnoDef = getTurnoBySigla(currentData.turno);
            const currentTurno = currentData.turno;

            // NUOVA REGOLA: Escludi operatori con turni specifici dai suggerimenti di copertura
            if (currentTurno === 'N' || currentTurno === 'SN' || currentTurno === '104' || 
                currentTurno === 'PER' || currentTurno === 'A') {
                return;
            }
            
            // NUOVA REGOLA: Escludi operatori in riposo (R) dopo turno N-SN
            if (currentTurno === 'R') {
                const prevDay = day - 1;
                if (prevDay >= 1) {
                    const prevCellKey = `${op.id}-${prevDay}`;
                    const prevData = appState.plannerData[monthKey]?.[prevCellKey];
                    
                    // Se il giorno precedente aveva turno notturno ('N'), verifica se è seguito da SN
                    if (prevData?.turno === 'N') {
                        const nextDay = day + 1;
                        const nextCellKey = `${op.id}-${nextDay}`;
                        const nextData = appState.plannerData[monthKey]?.[nextCellKey];
                        if (nextData?.turno === 'SN') {
                            return; // Escludi R dopo N-SN
                        }
                    }
                }
            }

            if (currentTurnoDef && (currentTurnoDef.sigla === 'F' || currentTurnoDef.sigla === 'FE')) {
                return; 
            }
            
            if (isOperatorUnavailable(op.id, currentDate) || (currentTurnoDef && getShiftType(currentData.turno) === shiftType)) {
                return;
            }

            // Aggiungi controllo disponibilità per emergenze
            if (!isOperatorAvailableForEmergency(op.id, day, monthKey)) {
                return;
            }

            let score = 100;
            let violations = [];
            let notes = [];

            // NUOVA REGOLA: Punteggio basso per P seguito da M7 o M8
            const nextDay = day + 1;
            const nextDate = new Date(year, month, nextDay);
            const nextMonthKey = getMonthKey(nextDate);
            const nextDayData = appState.plannerData[nextMonthKey]?.[`${op.id}-${nextDay}`];
            
            if (shiftType === 'P' && nextDayData?.turno) {
                if (nextDayData.turno === 'M7') {
                    score -= 200; // Punteggio molto basso
                    violations.push('P→M7 richiede M7-');
                    notes.push('Suggerito M7- per garantire 11h riposo');
                } else if (nextDayData.turno === 'M8') {
                    score -= 200; // Punteggio molto basso
                    violations.push('P→M8 richiede M8-');
                    notes.push('Suggerito M8- per garantire 11h riposo');
                }
            }

            // --- CONTROLLO VIOLAZIONI PREVENTIVE ---
            const prevDate = new Date(year, month, day - 1);
            const prevTurnoDef = getTurnoBySigla(appState.plannerData[getMonthKey(prevDate)]?.[`${op.id}-${prevDate.getDate()}`]?.turno);
            if (prevTurnoDef && prevTurnoDef.isOperativo) {
                const prevEnd = new Date(`${prevDate.toISOString().split('T')[0]}T${prevTurnoDef.fine}`);
                if (prevTurnoDef.fine < prevTurnoDef.inizio) prevEnd.setDate(prevEnd.getDate() + 1);
                
                const currentStart = new Date(`${currentDate.toISOString().split('T')[0]}T${targetTurnoDef.inizio}`);
                const restHours = (currentStart - prevEnd) / 3600000;

                if (restHours < appState.validationRules.minRestHours) {
                    violations.push(`riposo < ${appState.validationRules.minRestHours}h`);
                    score -= 1000;
                }
            }
            
            let consecutive = 1;
            for (let i = 1; i <= appState.validationRules.maxConsecutiveDays; i++) {
                const d = new Date(year, month, day - i);
                const def = getTurnoBySigla(appState.plannerData[getMonthKey(d)]?.[`${op.id}-${d.getDate()}`]?.turno);
                if (def && def.isOperativo) consecutive++; else break;
            }
            if (consecutive > appState.validationRules.maxConsecutiveDays) {
                violations.push(`${consecutive} giorni cons.`);
                score -= 1000;
            }

            // --- FATTORI DI PUNTEGGIO POSITIVI ---
            score += (op.qualita - 100) / 2;
            if (currentData.turno === 'R' || !currentData.turno) {
                score += 50;
                notes.push("Attualmente Libero/Riposo");
            }

            if (currentTurnoDef && currentTurnoDef.isOperativo) {
                const currentShiftType = getShiftType(currentData.turno);
                const optimalCoverage = appState.coverageOptimal[currentShiftType] || 0;
                const actualCoverage = allDailyCounts[day][currentShiftType] || 0;
                if (actualCoverage > optimalCoverage) {
                    score += 150;
                    notes.push(`Spostabile da ${currentData.turno} (in surplus)`);
                }
            }
            
            const prevDayShift = appState.plannerData[getMonthKey(new Date(year, month, day - 1))]?.[`${op.id}-${day - 1}`]?.turno;
            const nextDayShift = appState.plannerData[getMonthKey(new Date(year, month, day + 1))]?.[`${op.id}-${day + 1}`]?.turno;
            if (prevDayShift === 'R' || nextDayShift === 'R') {
                score += 40;
                notes.push("Adiacente a riposo");
            }

            const surroundingShifts = {};
            for (let i = -5; i <= 5; i++) {
                if (i === 0) continue;
                const d = new Date(year, month, day + i);
                surroundingShifts[i] = appState.plannerData[getMonthKey(d)]?.[`${op.id}-${d.getDate()}`]?.turno || '-';
            }

            suggestions.push({
                opId: op.id,
                name: `${op.cognome} ${op.nome.charAt(0)}.`,
                currentShift: currentData.turno || 'Libero',
                score: Math.round(Math.max(0, score)),
                violations,
                notes,
                surroundingShifts,
                day: day,
                newShift: targetShiftSigla
            });
        });
        
        suggestions.sort((a, b) => b.score - a.score);
        currentSuggestions = suggestions;

        const modal = document.getElementById('modal-suggestion');
        const modalContent = modal.querySelector('.modal-content');
        const modalTitle = document.getElementById('suggestion-modal-title');
        
        modalTitle.textContent = `Suggerimenti Copertura - Giorno ${day} (${shiftType})`;
        
        const listContainer = document.getElementById('suggestion-list');
        if (suggestions.length === 0) {
            listContainer.innerHTML = '<p class="text-center text-gray-500 p-4">Nessun operatore idoneo trovato.</p>';
        } else {
            listContainer.innerHTML = suggestions.map((s, index) => {
                const scoreColor = s.score > 120 ? 'bg-green-100 text-green-800' : s.score > 80 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800';
                
                let timelineHtml = '<div class="suggestion-timeline">';
                for (let i = -3; i < 0; i++) { timelineHtml += `<span>${s.surroundingShifts[i]}</span>`; }
                timelineHtml += `<strong class="target-day">${s.currentShift || '-'}</strong>`;
                for (let i = 1; i <= 3; i++) { timelineHtml += `<span>${s.surroundingShifts[i]}</span>`; }
                timelineHtml += '</div>';

                let detailsHtml = '';
                if (s.notes.length > 0) { detailsHtml += `<div class="suggestion-note">${s.notes.join(', ')}</div>`; }
                if (s.violations.length > 0) { detailsHtml += `<div class="suggestion-violation">Criticità: ${s.violations.join(', ')}</div>`; }

                return `
                    <div class="suggestion-item grid grid-cols-[1fr_auto] gap-4 items-center odd:bg-gray-50 p-2 rounded">
                        <div class="flex-grow">
                            <div class="flex items-baseline gap-2">
                                <p class="suggestion-name">${s.name}</p>
                                <div class="suggestion-score ${scoreColor}">${s.score}</div>
                            </div>
                            ${timelineHtml}
                            ${detailsHtml}
                        </div>
                        <button data-action="apply-suggestion" data-suggestion-index="${index}" class="btn-3d btn-indigo text-xs py-1 px-3">Assegna</button>
                    </div>
                `;
            }).join('');
        }
        
        modalContent.style.width = 'auto';
        modalContent.style.height = 'auto';
        modal.style.transform = '';
        modal.style.top = '50%';
        modal.style.left = '50%';
        modal.style.transform = 'translate(-50%, -50%)';

        openModal('modal-suggestion');
    }

    function confirmAndApplySuggestion(suggestion) {
        closeModal('modal-suggestion');
        const { opId, day, newShift } = suggestion;
        openCellActionModal(opId, day, 'change', newShift);
    }
        function toggleFocusMode(opIdToFocus) {
        const plannerBody = document.getElementById('planner-body');
        const allRows = plannerBody.querySelectorAll('tr.draggable-row');
        const isFocusActive = plannerBody.classList.contains('focus-mode-active');

        if (isFocusActive) {
            allRows.forEach(row => {
                row.style.display = '';
            });
            plannerBody.classList.remove('focus-mode-active');
        } else {
            allRows.forEach(row => {
                const currentRowOpId = parseInt(row.dataset.opId, 10);
                if (currentRowOpId !== opIdToFocus) {
                    row.style.display = 'none';
                } else {
                    row.style.display = '';
                }
            });
            plannerBody.classList.add('focus-mode-active');
        }
    }
    // =================================================================================
    // NUOVA INTERFACCIA IMPOSTAZIONI: MASTER-DETAIL RIVISITATA
    // =================================================================================
    
    function handleSettingsMasterDetailClick(e) {
        const button = e.target.closest('button, a');
        const listItem = e.target.closest('.master-list-item');

        if(button?.closest('.category-button')) {
            settingsMasterDetail.currentCategory = button.dataset.category;
            settingsMasterDetail.selectedId = null;
            renderElementsMasterDetail();
        } else if (listItem) {
            settingsMasterDetail.selectedId = isNaN(listItem.dataset.id) ? listItem.dataset.id : parseInt(listItem.dataset.id);
            renderMasterList();
            renderDetailForm();
        } else if (button?.id === 'elements-add-btn') {
            settingsMasterDetail.selectedId = 'new';
            renderDetailForm();
        } else if (button?.dataset.action === 'save-element-detail') {
            saveElementDetail();
        } else if (button?.dataset.action === 'delete-element-detail') {
            deleteElementDetail();
        } else if (button?.dataset.action === 'open-unavailability-modal') {
            const opId = parseInt(button.dataset.opId);
            openUnavailabilityModal(opId);
        }
    }
    
    function handleSettingsMasterDetailInput(e) {
        if(e.target.closest('#matrice-sequenza-input')) {
            currentSequenza = e.target.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
            renderSequenza('matrice-sequenza-container', currentSequenza);
        }
    }
    
    function renderElementsMasterDetail() {
        const navContainer = document.getElementById('elements-category-nav');
        const categories = {
            operatori: { name: 'Operatori', icon: '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" /></svg>' },
            turni: { name: 'Turni', icon: '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.414-1.414L11 9.586V6z" clip-rule="evenodd" /></svg>' },
            matrici: { name: 'Matrici', icon: '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a1 1 0 011-1h14a1 1 0 110 2H3a1 1 0 01-1-1z" /></svg>' },
            assignments: { name: 'Incarichi', icon: '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd" /></svg>' },
            reasons: { name: 'Motivi', icon: '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" /></svg>' }
        };
        
        navContainer.innerHTML = Object.entries(categories).map(([key, value]) => `
            <button class="category-button ${settingsMasterDetail.currentCategory === key ? 'active' : ''}" data-category="${key}">
                ${value.icon}<span>${value.name}</span>
            </button>
        `).join('');
        
        renderMasterList();
        renderDetailForm();
    }
    
       function renderMasterList() {
        const listContainer = document.getElementById('elements-master-list');
        const searchTerm = document.getElementById('elements-search-input').value.toLowerCase();
        let items = appState[settingsMasterDetail.currentCategory] || [];
        
        let filteredItems = items.filter(item => {
            if (!searchTerm) return true;
            const name = item.nome || item.cognome || item.sigla || item.text || '';
            const desc = item.descrizione || '';
            return name.toLowerCase().includes(searchTerm) || desc.toLowerCase().includes(searchTerm);
        });

        if (settingsMasterDetail.currentCategory === 'operatori') {
            filteredItems.sort((a,b) => a.ordine - b.ordine);
        }

        if(filteredItems.length === 0) {
            listContainer.innerHTML = '<p class="p-4 text-center text-sm text-gray-500 col-span-full">Nessun elemento trovato.</p>';
            return;
        }

        listContainer.innerHTML = filteredItems.map(item => {
            let title = '', subtitle = '', color = '#e5e7eb';
            let badgeHtml = '';

            switch(settingsMasterDetail.currentCategory) {
                case 'operatori':
                    const matrice = appState.matrici.find(m => m.id === item.idMatrice);
                    title = `${item.cognome} ${item.nome}`;
                    
                    // Informazioni complete per visione globale
                    let statusInfo = [];
                    if (!item.isActive) statusInfo.push('Inattivo');
                    if (item.isCounted === false) statusInfo.push('Non conteggiato');
                    if (item.reperibilita === false) statusInfo.push('Non reperibile');
                    
                    let dateInfo = '';
                    if (item.dataInizio || item.dataFine) {
                        const inizio = item.dataInizio ? new Date(item.dataInizio).toLocaleDateString('it-IT') : '';
                        const fine = item.dataFine ? new Date(item.dataFine).toLocaleDateString('it-IT') : '';
                        dateInfo = `${inizio}${inizio && fine ? ' - ' : ''}${fine}`;
                    }
                    
                    subtitle = `
                        <div class="space-y-1">
                            <div><strong>Matrice:</strong> ${matrice ? matrice.nome : 'N/D'}</div>
                            <div><strong>Ordine:</strong> ${item.ordine || 'N/D'} | <strong>Qualità:</strong> ${item.qualita || 100}%</div>
                            ${dateInfo ? `<div><strong>Periodo:</strong> ${dateInfo}</div>` : ''}
                            ${statusInfo.length > 0 ? `<div class="text-orange-600"><strong>Note:</strong> ${statusInfo.join(', ')}</div>` : ''}
                        </div>
                    `;
                    
                    color = item.colore || color;
                    badgeHtml = `<span class="master-item-badge" style="background-color: ${color}; color:${getContrastingTextColor(color)}">${item.qualita || 100}%</span>`;
                    break;
                case 'turni':
                    title = `${item.sigla} - ${item.descrizione}`;
                    subtitle = `${item.ore} ore (${item.inizio} - ${item.fine})`;
                    color = item.colore || color;
                    badgeHtml = `<span class="master-item-badge" style="background-color: ${color}; color:${getContrastingTextColor(color)}">${item.sigla}</span>`;
                    break;
                case 'matrici':
                    title = item.nome;
                    subtitle = `${item.sequenza.length} turni in sequenza`;
                    color = item.colore || color;
                    break;
                case 'assignments':
                    title = item.nome;
                    color = item.colore || color;
                    break;
                case 'reasons':
                    title = item.text;
                    break;
            }
            
            return `
                <a href="#" class="master-list-item ${item.id == settingsMasterDetail.selectedId ? 'active' : ''}" data-id="${item.id}" style="--item-color: ${color};">
                    <div class="master-item-content">
                        <div class="master-item-title">${title}</div>
                        ${subtitle ? `<div class="master-item-subtitle">${subtitle}</div>` : ''}
                    </div>
                    ${badgeHtml}
                </a>`;
        }).join('');
    }

    function renderDetailForm() {
        const detailContainer = document.getElementById('elements-detail-panel');
        const id = settingsMasterDetail.selectedId;
        const isNew = id === 'new';
        let item = isNew ? {} : appState[settingsMasterDetail.currentCategory]?.find(i => i.id == id);
        
        if (!item) {
            detailContainer.innerHTML = '<div class="flex flex-col items-center justify-center h-full text-center text-gray-500"><svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1"><path stroke-linecap="round" stroke-linejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12" /></svg><p>Seleziona un elemento dalla lista per vederne i dettagli o clicca su "Aggiungi Nuovo".</p></div>';
            return;
        }
        
        let formHtml = '';
        switch (settingsMasterDetail.currentCategory) {
            case 'operatori': formHtml = getOperatorFormHtml(item, isNew); break;
            case 'turni': formHtml = getTurnoFormHtml(item, isNew); break;
            case 'matrici': formHtml = getMatriceFormHtml(item, isNew); break;
            case 'assignments': formHtml = getAssignmentFormHtml(item, isNew); break;
            case 'reasons': formHtml = getReasonFormHtml(item, isNew); break;
        }
        
        detailContainer.innerHTML = `<div class="detail-form-wrapper">${formHtml}</div>`;
        
        populateAllSelects();
        
        if (!isNew && settingsMasterDetail.currentCategory === 'operatori') {
            document.getElementById('operatore-matrice-select').value = item.idMatrice || '';
        }
        if (!isNew && settingsMasterDetail.currentCategory === 'turni') {
            document.getElementById('turno-conteggio-ore-select').value = item.conteggioOre || 'orario';
        }
    }

    // =================================================================================
    // HTML FORM GENERATORS FOR MASTER-DETAIL
    // =================================================================================

      function getOperatorFormHtml(op, isNew) {
        const headerBgColor = op.colore || '#4b5563';
        const headerTextColor = getContrastingTextColor(headerBgColor);

        return `
            <div class="detail-header" style="background-color: ${headerBgColor}; color: ${headerTextColor};">
                 <div class="detail-title-icon" style="background-color: rgba(255,255,255,0.2);">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" /></svg>
                 </div>
                 <span class="detail-title-text">${isNew ? 'Nuovo Operatore' : `Modifica: ${op.cognome} ${op.nome}`}</span>
            </div>
            <div class="detail-form-grid">
                <div><label class="form-field-label">Cognome</label><input type="text" id="operatore-cognome" class="modal-input" value="${op.cognome || ''}"></div>
                <div><label class="form-field-label">Nome</label><input type="text" id="operatore-nome" class="modal-input" value="${op.nome || ''}"></div>
                <div><label class="form-field-label">Matrice Assegnata</label><select id="operatore-matrice-select" class="modal-input"></select></div>
                <div><label class="form-field-label">Qualità (%)</label><input type="number" id="operatore-qualita" class="modal-input" value="${op.qualita || 100}"></div>
                <div><label class="form-field-label">Colore</label><input type="color" id="operatore-colore" class="w-full h-10" value="${op.colore || '#cccccc'}"></div>
                <div><label class="form-field-label">Ordine Visualizzazione</label><input type="number" id="operatore-ordine" class="modal-input" value="${op.ordine || ''}"></div>
                <div><label class="form-field-label">Data Inizio</label><input type="date" id="operatore-data-inizio" class="modal-input" value="${op.dataInizio || ''}"></div>
                <div><label class="form-field-label">Data Fine</label><input type="date" id="operatore-data-fine" class="modal-input" value="${op.dataFine || ''}"></div>
                <div class="md:col-span-2 grid grid-cols-2 gap-4 border-t pt-2 mt-2">
                    <div><label class="form-field-label">Ferie Annuali (ore)</label><input type="number" id="operatore-ferie" class="modal-input" value="${op.ferieAnnuali || 0}"></div>
                    <div><label class="form-field-label">Permessi Annuali (ore)</label><input type="number" id="operatore-permessi" class="modal-input" value="${op.permessiAnnuali || 0}"></div>
                </div>
                <div class="flex items-center gap-4"><input type="checkbox" id="operatore-is-active" class="h-4 w-4" ${op.isActive || isNew ? 'checked' : ''}><label for="operatore-is-active" class="text-sm">Attivo</label></div>
                <div class="flex items-center gap-4"><input type="checkbox" id="operatore-is-counted" class="h-4 w-4" ${op.isCounted !== false ? 'checked' : ''}><label for="operatore-is-counted" class="text-sm">Incluso nei conteggi</label></div>
                <div class="flex items-center gap-4"><input type="checkbox" id="operatore-reperibilita" class="h-4 w-4" ${op.reperibilita !== false ? 'checked' : ''}><label for="operatore-reperibilita" class="text-sm">Reperibile</label></div>
                ${!isNew ? `<div class="md:col-span-2">
                    <button class="w-full btn-3d btn-orange text-sm mt-2" data-action="open-unavailability-modal" data-op-id="${op.id}">Gestisci Indisponibilità</button>
                </div>` : ''}
            </div>
            <div class="form-actions">
                ${!isNew ? `<button data-action="delete-element-detail" class="btn-3d btn-red text-sm">Elimina</button>` : ''}
                <button data-action="save-element-detail" class="btn-3d btn-indigo text-sm">Salva Modifiche</button>
            </div>
        `;
    }

    function getTurnoFormHtml(turno, isNew) {
         return `
            <div class="detail-header" style="background-color: ${turno.colore || '#e5e7eb'}; color: ${getContrastingTextColor(turno.colore || '#e5e7eb')};">
                 <div class="detail-title-icon" style="background-color: rgba(255,255,255,0.2);"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.414-1.414L11 9.586V6z" clip-rule="evenodd" /></svg></div>
                 <span class="detail-title-text">${isNew ? 'Nuovo Turno' : `Modifica: ${turno.sigla}`}</span>
            </div>
            <div class="detail-form-grid">
                <div><label class="form-field-label">Sigla</label><input type="text" id="turno-sigla" class="modal-input" value="${turno.sigla || ''}"></div>
                <div><label class="form-field-label">Descrizione</label><input type="text" id="turno-descrizione" class="modal-input" value="${turno.descrizione || ''}"></div>
                <div><label class="form-field-label">Ora Inizio</label><input type="time" id="turno-inizio" class="modal-input" value="${turno.inizio || ''}"></div>
                <div><label class="form-field-label">Ora Fine</label><input type="time" id="turno-fine" class="modal-input" value="${turno.fine || ''}"></div>
                <div><label class="form-field-label">Ore Lavorate</label><input type="number" step="0.5" id="turno-ore" class="modal-input" value="${turno.ore || 0}"></div>
                <div><label class="form-field-label">Conteggio Ore</label><select id="turno-conteggio-ore-select" class="modal-input"></select></div>
                <div><label class="form-field-label">Colore</label><input type="color" id="turno-colore" class="w-full h-10" value="${turno.colore || '#cccccc'}"></div>
                <div class="flex items-center gap-4"><input type="checkbox" id="turno-is-operativo" class="h-4 w-4" ${turno.isOperativo ? 'checked' : ''}><label for="turno-is-operativo" class="text-sm">È un turno operativo?</label></div>
            </div>
            <div class="form-actions">
                ${!isNew ? `<button data-action="delete-element-detail" class="btn-3d btn-red text-sm">Elimina</button>` : ''}
                <button data-action="save-element-detail" class="btn-3d btn-indigo text-sm">Salva Modifiche</button>
            </div>
        `;
    }
    
    function getMatriceFormHtml(matrice, isNew) {
        currentSequenza = matrice.sequenza || [];
        setTimeout(() => renderSequenza('matrice-sequenza-container', currentSequenza), 0);
        return `
            <div class="detail-header" style="background-color: ${matrice.colore || '#4b5563'}; color: ${getContrastingTextColor(matrice.colore || '#4b5563')};">
                 <div class="detail-title-icon" style="background-color: rgba(255,255,255,0.2);"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a1 1 0 011-1h14a1 1 0 110 2H3a1 1 0 01-1-1z" /></svg></div>
                 <span class="detail-title-text">${isNew ? 'Nuova Matrice' : `Modifica: ${matrice.nome}`}</span>
            </div>
            <div class="detail-form-grid">
                <div class="md:col-span-2"><label class="form-field-label">Nome Matrice</label><input type="text" id="matrice-nome" class="modal-input" value="${matrice.nome || ''}"></div>
                <div><label class="form-field-label">Data Inizio Validità</label><input type="date" id="matrice-data-inizio" class="modal-input" value="${matrice.dataInizio || ''}"></div>
                <div><label class="form-field-label">Data Fine Validità</label><input type="date" id="matrice-data-fine" class="modal-input" value="${matrice.dataFine || ''}"></div>
                <div class="md:col-span-2"><label class="form-field-label">Colore Identificativo</label><input type="color" id="matrice-colore" class="w-full h-10" value="${matrice.colore || '#4f46e5'}"></div>
                <div class="md:col-span-2">
                    <label class="form-field-label">Sequenza Turni (separati da virgola)</label>
                    <input type="text" id="matrice-sequenza-input" class="modal-input" value="${(matrice.sequenza || []).join(', ')}">
                    <div id="matrice-sequenza-container" class="mt-2 flex flex-wrap gap-1 p-2 bg-gray-50 rounded-md border min-h-[40px]"></div>
                </div>
            </div>
            <div class="form-actions">
                ${!isNew ? `<button data-action="delete-element-detail" class="btn-3d btn-red text-sm">Elimina</button>` : ''}
                <button data-action="save-element-detail" class="btn-3d btn-indigo text-sm">Salva Modifiche</button>
            </div>
        `;
    }

    function getAssignmentFormHtml(item, isNew) {
        return `
            <div class="detail-header" style="background-color: ${item.colore || '#4b5563'}; color: ${getContrastingTextColor(item.colore || '#4b5563')};">
                 <div class="detail-title-icon" style="background-color: rgba(255,255,255,0.2);"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd" /></svg></div>
                 <span class="detail-title-text">${isNew ? 'Nuovo Incarico' : `Modifica: ${item.nome}`}</span>
            </div>
            <div class="detail-form-grid">
                <div class="md:col-span-2"><label class="form-field-label">Nome Incarico</label><input type="text" id="assignment-nome" class="modal-input" value="${item.nome || ''}"></div>
                <div class="md:col-span-2"><label class="form-field-label">Colore</label><input type="color" id="assignment-colore" class="w-full h-10" value="${item.colore || '#e11d48'}"></div>
            </div>
            <div class="form-actions">
                ${!isNew ? `<button data-action="delete-element-detail" class="btn-3d btn-red text-sm">Elimina</button>` : ''}
                <button data-action="save-element-detail" class="btn-3d btn-indigo text-sm">Salva Modifiche</button>
            </div>
        `;
    }
    
    function getReasonFormHtml(item, isNew) {
         return `
            <div class="detail-header" style="background-color: #e5e7eb; color: #1f2937;">
                 <div class="detail-title-icon" style="background-color: rgba(0,0,0,0.1);"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" /></svg></div>
                 <span class="detail-title-text">${isNew ? 'Nuovo Motivo' : `Modifica Motivo`}</span>
            </div>
            <div class="detail-form-grid">
                <div class="md:col-span-2"><label class="form-field-label">Testo del Motivo</label><input type="text" id="reason-text" class="modal-input" value="${item.text || ''}"></div>
                <div class="md:col-span-2 flex items-center gap-4"><input type="checkbox" id="reason-hasSubReasons" class="h-4 w-4" ${item.hasSubReasons ? 'checked' : ''}><label for="reason-hasSubReasons" class="text-sm">Ha sotto-motivi (Esigenza di servizio)?</label></div>
            </div>
            <div class="form-actions">
                ${!isNew ? `<button data-action="delete-element-detail" class="btn-3d btn-red text-sm">Elimina</button>` : ''}
                <button data-action="save-element-detail" class="btn-3d btn-indigo text-sm">Salva Modifiche</button>
            </div>
        `;
    }
// =================================================================================
// SEZIONE GESTIONE SCAMBIO MATRICI
// =================================================================================

function renderScambiPanel() {
    // Popola i select del form
    const opSelectA = document.getElementById('scambio-operatore-a');
    const opSelectB = document.getElementById('scambio-operatore-b');
    
    const optionsHtml = appState.operatori
        .filter(o => o.isActive)
        .sort((a,b) => a.ordine - b.ordine)
        .map(op => `<option value="${op.id}">${op.cognome} ${op.nome}</option>`)
        .join('');
    
    opSelectA.innerHTML = optionsHtml;
    opSelectB.innerHTML = optionsHtml;

    renderScambiList();
    resetScambioForm();
}

function renderScambiList() {
    const listContainer = document.getElementById('scambi-list');
    const swaps = appState.matriceSwaps || [];

    if (swaps.length === 0) {
        listContainer.innerHTML = '<p class="text-sm text-gray-500 text-center py-4">Nessuno scambio di matrice definito.</p>';
        return;
    }

    listContainer.innerHTML = swaps.map(swap => {
        const opA = appState.operatori.find(o => o.id === swap.operatoreA_Id);
        const opB = appState.operatori.find(o => o.id === swap.operatoreB_Id);
        if (!opA || !opB) return ''; // Salta regole con dati non validi

        return `
            <div class="scambio-item">
                <div class="scambio-item-info">
                    <p><strong>${opA.cognome}</strong> si scambia con <strong>${opB.cognome}</strong></p>
                    <p class="periodo">Dal ${new Date(swap.dataInizio).toLocaleDateString()} al ${new Date(swap.dataFine).toLocaleDateString()}</p>
                    ${swap.note ? `<p class="note">${swap.note}</p>` : ''}
                </div>
                <div class="scambio-item-actions flex gap-2">
                    <button data-action="edit-scambio" data-id="${swap.id}" title="Modifica">
                        <svg class="h-5 w-5 text-gray-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fill-rule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clip-rule="evenodd" /></svg>
                    </button>
                    <button data-action="delete-scambio" data-id="${swap.id}" title="Elimina">
                        <svg class="h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clip-rule="evenodd" /></svg>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function resetScambioForm() {
    document.getElementById('form-scambio-matrice').reset();
    document.getElementById('scambio-id').value = '';
    document.getElementById('scambio-form-title').textContent = 'Aggiungi Nuovo Scambio';
    document.getElementById('btn-cancel-scambio-edit').classList.add('hidden');
 document.getElementById('settings-panel-scambi').addEventListener('click', handleScambiPanelClick);
}

function handleScambiPanelClick(e) {
    const actionBtn = e.target.closest('button[data-action]');
    if (!actionBtn) return;

    const id = actionBtn.dataset.id;
    const action = actionBtn.dataset.action;

    if (action === 'edit-scambio') {
        const swap = appState.matriceSwaps.find(s => s.id == id);
        if (swap) {
            document.getElementById('scambio-id').value = swap.id;
            document.getElementById('scambio-operatore-a').value = swap.operatoreA_Id;
            document.getElementById('scambio-operatore-b').value = swap.operatoreB_Id;
            document.getElementById('scambio-start-date').value = swap.dataInizio;
            document.getElementById('scambio-end-date').value = swap.dataFine;
            document.getElementById('scambio-note').value = swap.note || '';
            document.getElementById('scambio-form-title').textContent = 'Modifica Scambio';
            document.getElementById('btn-cancel-scambio-edit').classList.remove('hidden');
            window.scrollTo(0, 0);
        }
    } else if (action === 'delete-scambio') {
        appState.matriceSwaps = appState.matriceSwaps.filter(s => s.id != id);
        renderScambiList();
        renderPlanner();
        showToast('Regola di scambio eliminata.', 'success');
    }
}
    // =================================================================================
    // SAVE/DELETE LOGIC & UNAVAILABILITY
    // =================================================================================
    
    function saveElementDetail() {
        const id = settingsMasterDetail.selectedId;
        const isNew = id === 'new';
        const category = settingsMasterDetail.currentCategory;
        let item = isNew ? { id: Date.now() } : appState[category].find(i => i.id == id);
        
        switch (category) {
            case 'operatori':
                item.cognome = document.getElementById('operatore-cognome').value;
                item.nome = document.getElementById('operatore-nome').value;
                item.idMatrice = parseInt(document.getElementById('operatore-matrice-select').value) || null;
                item.qualita = parseInt(document.getElementById('operatore-qualita').value);
                item.colore = document.getElementById('operatore-colore').value;
                item.ordine = parseInt(document.getElementById('operatore-ordine').value);
                item.dataInizio = document.getElementById('operatore-data-inizio').value;
                item.dataFine = document.getElementById('operatore-data-fine').value;
                item.isActive = document.getElementById('operatore-is-active').checked;
                item.isCounted = document.getElementById('operatore-is-counted').checked;
                item.reperibilita = document.getElementById('operatore-reperibilita').checked;
                item.ferieAnnuali = parseInt(document.getElementById('operatore-ferie').value) || 0;
                item.permessiAnnuali = parseInt(document.getElementById('operatore-permessi').value) || 0;
                if (!item.unavailabilities) item.unavailabilities = [];
                break;
            case 'turni':
                item.sigla = document.getElementById('turno-sigla').value.toUpperCase();
                item.descrizione = document.getElementById('turno-descrizione').value;
                item.inizio = document.getElementById('turno-inizio').value;
                item.fine = document.getElementById('turno-fine').value;
                item.ore = parseFloat(document.getElementById('turno-ore').value);
                item.conteggioOre = document.getElementById('turno-conteggio-ore-select').value;
                item.colore = document.getElementById('turno-colore').value;
                item.isOperativo = document.getElementById('turno-is-operativo').checked;
                break;
            case 'matrici':
                item.nome = document.getElementById('matrice-nome').value;
                item.dataInizio = document.getElementById('matrice-data-inizio').value;
                item.dataFine = document.getElementById('matrice-data-fine').value;
                item.colore = document.getElementById('matrice-colore').value;
                item.sequenza = currentSequenza;
                break;
            case 'assignments':
                item.nome = document.getElementById('assignment-nome').value;
                item.colore = document.getElementById('assignment-colore').value;
                break;
            case 'reasons':
                item.text = document.getElementById('reason-text').value;
                item.hasSubReasons = document.getElementById('reason-hasSubReasons').checked;
                break;
        }

        if (isNew) {
            appState[category].push(item);
        } else {
            const index = appState[category].findIndex(i => i.id == id);
            appState[category][index] = item;
        }

        settingsMasterDetail.selectedId = item.id;
        showToast("Salvataggio completato.", "success");
        renderMasterList();
        renderDetailForm();
        renderPlanner();
    }

    function deleteElementDetail() {
        const id = settingsMasterDetail.selectedId;
        const category = settingsMasterDetail.currentCategory;
        if (!id || id === 'new') return;
        
        const item = appState[category].find(i => i.id == id);
        showConfirmation(`Sei sicuro di voler eliminare definitivamente "${item.nome || item.cognome || item.sigla || item.text}"?`, "Conferma Eliminazione")
            .then(confirmed => {
                if (confirmed) {
                    appState[category] = appState[category].filter(i => i.id != id);
                    settingsMasterDetail.selectedId = null;
                    showToast("Elemento eliminato.", "success");
                    renderMasterList();
                    renderDetailForm();
                    renderPlanner();
                }
            });
    }

    function openUnavailabilityModal(opId) {
        currentUnavailabilityOpId = opId;
        const op = appState.operatori.find(o => o.id === opId);
        document.getElementById('unavailability-modal-title').textContent = `Gestisci Indisponibilità per ${op.cognome} ${op.nome}`;
        document.getElementById('form-unavailability').reset();
        document.getElementById('unavailability-op-id').value = opId;
        renderUnavailabilityList(opId);
        openModal('modal-unavailability');
    }

    function renderUnavailabilityList(opId) {
        const op = appState.operatori.find(o => o.id === opId);
        const listContainer = document.getElementById('unavailability-list');
        if (!op || !op.unavailabilities || op.unavailabilities.length === 0) {
            listContainer.innerHTML = '<p class="text-center text-sm text-gray-500">Nessun periodo registrato.</p>';
            return;
        }
        listContainer.innerHTML = op.unavailabilities.map(unav => `
            <div class="p-2 border-b flex justify-between items-center text-sm">
                <div>
                    <p class="font-semibold">${unav.reason}</p>
                    <p class="text-xs text-gray-600">${new Date(unav.startDate).toLocaleDateString()} - ${new Date(unav.endDate).toLocaleDateString()}</p>
                </div>
                <button data-action="delete-unavailability" data-id="${unav.id}" class="text-red-500 hover:text-red-700">&times;</button>
            </div>
        `).join('');
    }

    function saveUnavailability(e) {
        e.preventDefault();
        const opId = parseInt(document.getElementById('unavailability-op-id').value);
        const operator = appState.operatori.find(op => op.id === opId);
        
        const newUnavailability = {
            id: Date.now(),
            startDate: document.getElementById('unavailability-start-date').value,
            endDate: document.getElementById('unavailability-end-date').value,
            reason: document.getElementById('unavailability-reason').value
        };
        
        if (!operator.unavailabilities) operator.unavailabilities = [];
        operator.unavailabilities.push(newUnavailability);
        
        showToast("Indisponibilità salvata", "success");
        renderUnavailabilityList(opId);
        document.getElementById('form-unavailability').reset();
        renderPlanner();
    }

    function deleteUnavailability(unavId) {
        const op = appState.operatori.find(o => o.id === currentUnavailabilityOpId);
        if (op) {
            op.unavailabilities = op.unavailabilities.filter(u => u.id != unavId);
            showToast("Indisponibilità rimossa", "success");
            renderUnavailabilityList(currentUnavailabilityOpId);
            renderPlanner();
        }
    }
    
    // =================================================================================
    // MODALI E LOGICA ASSOCIATA
    // =================================================================================

    function showExtraHoursSummary() {
        const monthKey = getMonthKey(appState.currentDate);
        const monthData = appState.plannerData[monthKey] || {};
        const contentDiv = document.getElementById('extra-hours-content');
        
        let extraShifts = [];

        for (const key in monthData) {
            const cellData = monthData[key];
            if (cellData.extraInfo) {
                const [opId, day] = key.split('-').map(Number);
                const operator = appState.operatori.find(op => op.id === opId);
                if (operator) {
                    extraShifts.push({
                        day,
                        operatorName: `${operator.cognome} ${operator.nome}`,
                        ...cellData.extraInfo
                    });
                }
            }
        }
        
        extraShifts.sort((a, b) => {
            if (a.day !== b.day) return a.day - b.day;
            return a.operatorName.localeCompare(b.operatorName);
        });

        if (extraShifts.length === 0) {
            contentDiv.innerHTML = `<p class="text-center text-gray-500 p-4">Nessun'ora extra registrata per il mese corrente.</p>`;
        } else {
            const typeMap = {
                'straordinario': 'Straordinario',
                'prolungamento': 'Prolungamento',
                'rientro': 'Rientro',
            };

            let tableHTML = `
                <table class="w-full text-sm text-left text-gray-600">
                    <thead class="text-xs text-gray-700 uppercase bg-gray-100">
                        <tr>
                            <th class="p-2">Giorno</th>
                            <th class="p-2">Operatore</th>
                            <th class="p-2">Tipo</th>
                            <th class="p-2">Dalle</th>
                            <th class="p-2">Alle</th>
                            <th class="p-2">Ore Totali</th>
                            <th class="p-2">Note</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            extraShifts.forEach(shift => {
                let typeText = typeMap[shift.type] || shift.type || '';
                if(shift.gettone) {
                    typeText += ' (Gettone)';
                }
                tableHTML += `
                    <tr class="bg-white border-b hover:bg-gray-50">
                        <td class="p-2 font-semibold">${shift.day}</td>
                        <td class="p-2">${shift.operatorName}</td>
                        <td class="p-2">${typeText}</td>
                        <td class="p-2">${shift.startTime || '-'}</td>
                        <td class="p-2">${shift.endTime || '-'}</td>
                        <td class="p-2 font-bold">${typeof shift.hours === 'number' ? shift.hours.toFixed(1) : '-'}</td>
                        <td class="p-2 italic">${shift.note || '-'}</td>
                    </tr>
                `;
            });

            tableHTML += `</tbody></table>`;
            contentDiv.innerHTML = tableHTML;
        }

        openModal('modal-extra-hours');
    }

    function openCellActionModal(opId, day, focusSection = null, preselectedTurno = null) {
        currentModalOpId = opId;
        const op = appState.operatori.find(o => o.id === opId);
        const monthKey = getMonthKey(appState.currentDate);
        const currentData = appState.plannerData[monthKey]?.[`${opId}-${day}`] || {};
        document.getElementById('modal-cell-title').textContent = `Modifica Turno per ${op.cognome} ${op.nome} - Giorno ${day}`;
        
        const changeTurnoSelect = document.getElementById('change-turno');
        const turniOptionsHTML = [{ sigla: '', descrizione: 'Nessun Turno', colore: '#f9fafb' }, ...appState.turni]
            .map(t => {
                const bgColor = t.colore || '#f9fafb';
                const textColor = getContrastingTextColor(bgColor);
                return `<option value="${t.sigla}" 
                                data-color="${bgColor}" 
                                data-text-color="${textColor}"
                                ${t.sigla === (preselectedTurno ?? currentData.turno) ? 'selected' : ''}>
                            ${t.sigla} (${t.descrizione})
                        </option>`;
            }).join('');
        changeTurnoSelect.innerHTML = turniOptionsHTML;

        const turniOptionsPeriod = appState.turni.map(t => ({ value: t.sigla, text: `${t.sigla} (${t.descrizione})` }));
        populateSelect('period-turno', [{value: '', text: 'Seleziona Turno'}, ...turniOptionsPeriod], '');

        const originalTurno = currentData.turno || '';
        const summaryDiv = document.getElementById('change-summary');

        const updateSummary = () => {
            const nuovoTurno = changeTurnoSelect.value;
            if (nuovoTurno !== originalTurno) {
                summaryDiv.innerHTML = `
                    <span class="text-gray-600">Turno Originale:</span> <strong class="text-red-600">${originalTurno || 'VUOTO'}</strong>
                    <span class="mx-2 font-bold text-indigo-600">&rarr;</span>
                    <span class="text-gray-600">Nuovo Turno:</span> <strong class="text-green-600">${nuovoTurno || 'VUOTO'}</strong>`;
                summaryDiv.classList.remove('hidden');
            } else {
                summaryDiv.classList.add('hidden');
            }
        };
        
        changeTurnoSelect.removeEventListener('change', updateSummary);
        changeTurnoSelect.addEventListener('change', updateSummary);
        changeTurnoSelect.removeEventListener('change', () => updateSelectColor(changeTurnoSelect));
        changeTurnoSelect.addEventListener('change', () => updateSelectColor(changeTurnoSelect));
        updateSelectColor(changeTurnoSelect);
        updateSummary();

        populateChangeReasons();
        
        if (currentData.changeReason) {
             const [mainReasonId, subReason] = currentData.changeReason.split(':');
             const mainReasonRadio = document.querySelector(`input[name="main-reason"][value="${mainReasonId}"]`);
             if(mainReasonRadio) {
                mainReasonRadio.checked = true;
                const mainReason = appState.reasons.find(r => r.id == mainReasonId);
                const hasSubReasons = mainReason?.hasSubReasons;
                document.getElementById('sub-reason-container').classList.toggle('hidden', !hasSubReasons);
                document.getElementById('change-gettone-container').classList.toggle('hidden', !hasSubReasons);
                if (subReason) {
                    const subReasonRadio = document.querySelector(`input[name="sub-reason"][value="${subReason}"]`);
                    if(subReasonRadio) subReasonRadio.checked = true;
                }
             }
        } else {
             document.getElementById('sub-reason-container').classList.add('hidden');
             document.getElementById('change-gettone-container').classList.add('hidden');
        }

        document.getElementById('change-gettone-checkbox').checked = currentData.gettone || false;
        document.getElementById('change-note').value = currentData.nota || '';
        
        const extraTypeRadios = document.querySelectorAll('input[name="extra-type"]');
        const extraHoursInput = document.getElementById('extra-hours-manual');
        const extraRientroStart = document.getElementById('extra-start-time');
        const extraRientroEnd = document.getElementById('extra-end-time');
        const extraNote = document.getElementById('extra-note');
        const extraDetailsContainer = document.getElementById('extra-details-container');
        
        extraTypeRadios.forEach(radio => radio.checked = false);
        extraHoursInput.value = ''; 
        extraRientroStart.value = ''; 
        extraRientroEnd.value = ''; 
        extraNote.value = '';
        extraHoursInput.classList.remove('bg-indigo-100');
        document.getElementById('extra-gettone-checkbox').checked = false;
        extraDetailsContainer.classList.add('hidden');

        if (currentData.extraInfo) {
            const { type, hours, startTime, endTime, note, gettone } = currentData.extraInfo;
            const radio = document.querySelector(`input[name="extra-type"][value="${type}"]`);
            if (radio) {
                radio.checked = true;
                extraDetailsContainer.classList.remove('hidden');
            }
            extraHoursInput.value = (typeof hours === 'number' && hours > 0) ? hours.toFixed(2) : ''; 
            extraRientroStart.value = startTime || '';
            extraRientroEnd.value = endTime || ''; 
            extraNote.value = note || '';
            document.getElementById('extra-gettone-checkbox').checked = gettone || false;
        }

        document.getElementById('add-note').value = currentData.nota || '';

        if (focusSection === 'period') {
            const year = appState.currentDate.getFullYear(), month = appState.currentDate.getMonth() + 1;
            const aaaa_mm_gg = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            document.getElementById('period-start-date').value = aaaa_mm_gg;
            document.getElementById('period-end-date').value = aaaa_mm_gg;
        }

        ['change', 'extra', 'period', 'note'].forEach(s => {
            const section = document.getElementById(`modal-section-${s}`);
            if (section) {
                 if (focusSection) {
                    section.style.display = (s === focusSection) ? 'block' : 'none';
                } else {
                    section.style.display = (s === 'period') ? 'none' : 'block';
                }
            }
        });
        
        openModal('modal-cell-action');
    }

    function updateCalculatedExtraHours() {
        if (currentModalOpId === null) return;

        const title = document.getElementById('modal-cell-title').textContent;
        const dayMatch = title.match(/Giorno (\d+)/);
        if (!dayMatch) return;
        const day = parseInt(dayMatch[1], 10);
        const monthKey = getMonthKey(appState.currentDate);
        const data = appState.plannerData[monthKey]?.[`${currentModalOpId}-${day}`] || {};
        const turnoDef = getTurnoBySigla(data.turno);

        const extraTypeRadio = document.querySelector('input[name="extra-type"]:checked');
        const extraType = extraTypeRadio ? extraTypeRadio.value : null;
        const startTimeValue = document.getElementById('extra-start-time').value;
        const endTimeValue = document.getElementById('extra-end-time').value;
        const manualHoursInput = document.getElementById('extra-hours-manual');

        let calculatedHours = 0;
        let start, end;

        if (startTimeValue && endTimeValue) {
            start = new Date(`1970-01-01T${startTimeValue}`);
            end = new Date(`1970-01-01T${endTimeValue}`);
        } else if (extraType) {
            switch (extraType) {
                case 'prolungamento':
                    if (endTimeValue && turnoDef?.fine) {
                        start = new Date(`1970-01-01T${turnoDef.fine}`);
                        end = new Date(`1970-01-01T${endTimeValue}`);
                    }
                    break;
                case 'rientro':
                    if (startTimeValue && turnoDef?.inizio) {
                        start = new Date(`1970-01-01T${startTimeValue}`);
                        end = new Date(`1970-01-01T${turnoDef.inizio}`);
                    }
                    break;
            }
        }

        if (start && end) {
            if (end < start) {
                end.setDate(end.getDate() + 1);
            }
            calculatedHours = (end - start) / 3600000;
        }

        if (calculatedHours > 0) {
            manualHoursInput.value = calculatedHours.toFixed(2);
            manualHoursInput.classList.add('bg-indigo-100');
        } else {
            if (!manualHoursInput.value) {
                manualHoursInput.classList.remove('bg-indigo-100');
            }
        }
    }

    function renderSequenza(containerId, sequenza) {
        const container = document.getElementById(containerId);
        if(!container) return;
        container.innerHTML = sequenza.map((s, index) =>
            `<span class="turno-badge inline-flex items-center gap-x-1.5 py-1 px-2 rounded-md text-xs font-medium bg-gray-100 text-gray-800">
                ${s}
                <button type="button" data-action="remove-from-seq" data-index="${index}" class="text-gray-500 hover:text-gray-800">&times;</button>
            </span>`
        ).join('');
    }

   function openDaySummaryModal(day) {
        activeDaySummary = day;
        const year = appState.currentDate.getFullYear(), month = appState.currentDate.getMonth(), daysInMonth = getDaysInMonth(year, month);
        const date = new Date(year, month, day);
        const weekDayName = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'][date.getDay()];
        const daySummaryModal = document.getElementById('modal-day-summary');
        
        document.getElementById('day-summary-nav-title').innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" id="day-summary-prev" class="h-6 w-6 day-nav-arrow ${day <= 1 ? 'disabled' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" /></svg>
            <span class="font-bold text-lg">Riepilogo Giorno ${day} (${weekDayName})</span>
            <svg xmlns="http://www.w3.org/2000/svg" id="day-summary-next" class="h-6 w-6 day-nav-arrow ${day >= daysInMonth ? 'disabled' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
        `;
        document.getElementById('day-summary-prev')?.addEventListener('click', () => { if (activeDaySummary > 1) { openDaySummaryModal(activeDaySummary - 1); selectCrosshair(null, activeDaySummary); } });
        document.getElementById('day-summary-next')?.addEventListener('click', () => { if (activeDaySummary < daysInMonth) { openDaySummaryModal(activeDaySummary + 1); selectCrosshair(null, activeDaySummary); } });

        const monthKey = getMonthKey(appState.currentDate);
        const dailyData = appState.plannerData[monthKey] || {};
        const activeOps = getActiveOperators(year, month);
        
        const groupedByShift = {};
        activeOps.forEach(op => {
            const turnoData = dailyData[`${op.id}-${day}`];
            if (turnoData?.turno && typeof turnoData.turno === 'string' && op.isCounted) {
                const sigla = turnoData.turno.toUpperCase();
                if (!groupedByShift[sigla]) groupedByShift[sigla] = [];
                groupedByShift[sigla].push(op);
            }
        });
        Object.values(groupedByShift).forEach(ops => ops.sort((a, b) => (b.qualita || 100) - (a.qualita || 100)));

        const shiftOrder = ['M7', 'M8', 'DM', 'P', 'P-', 'DP', 'N', 'SN', 'R', 'FE', 'F'];
        const morningShifts = ['M7', 'M8', 'M6', 'DM'], afternoonShifts = ['P', 'P-', 'DP'];
        const nonWorkingShifts = ['R', 'FE', 'F'];

        const countShifts = (arr) => arr.reduce((acc, sigla) => acc + (groupedByShift[sigla]?.length || 0), 0);
        const calculateAverageQuality = (arr) => {
            let totalQuality = 0, totalPeople = 0;
            arr.forEach(sigla => {
                if (groupedByShift[sigla]) {
                    groupedByShift[sigla].forEach(op => totalQuality += op.qualita || 100);
                    totalPeople += groupedByShift[sigla].length;
                }
            });
            return totalPeople > 0 ? (totalQuality / totalPeople) : 0;
        };
        
        const totalMattina = countShifts(morningShifts), deficitMattina = appState.coverageOptimal.M - totalMattina, avgQualitaMattina = calculateAverageQuality(morningShifts);
        const totalPomeriggio = countShifts(afternoonShifts), deficitPomeriggio = appState.coverageOptimal.P - totalPomeriggio, avgQualitaPomeriggio = calculateAverageQuality(afternoonShifts);
        let alertMessages = [];
        if (deficitMattina > 0) alertMessages.push({ text: `Mattino: Manca ${deficitMattina}`, type: 'M' });
        if (deficitPomeriggio > 0) alertMessages.push({ text: `Pomeriggio: Manca ${deficitPomeriggio}`, type: 'P'});
        
        const suggestionIcon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 suggestion-icon" viewBox="0 0 20 20" fill="currentColor"><path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 14.95a1 1 0 001.414 1.414l.707-.707a1 1 0 00-1.414-1.414l-.707.707zM4 10a1 1 0 01-1 1H2a1 1 0 110-2h1a1 1 0 011 1zM10 18a1 1 0 01-1-1v-1a1 1 0 112 0v1a1 1 0 01-1 1zM8.94 6.06a1 1 0 00-1.88 0l-1.587 4.762a1 1 0 00.94 1.348h5.173a1 1 0 00.94-1.348L8.94 6.06z" /></svg>`;
        const alertHtml = alertMessages.map(msg => `<span data-suggestion-day="${day}" data-suggestion-type="${msg.type}" class="flex items-center gap-2 cursor-pointer hover:underline">${msg.text} ${suggestionIcon}</span>`).join(' | ');
        document.getElementById('day-summary-alert').innerHTML = alertMessages.length > 0 ? `<div class="summary-alert-warning">${alertHtml}</div>` : '';

        const createShiftColumnHtml = (sigla) => {
            const operators = groupedByShift[sigla] || [];
            if (operators.length === 0) return '';
            const turnoDef = getTurnoBySigla(sigla);
            const bgColor = turnoDef?.colore || '#e5e7eb';
            const textColor = getContrastingTextColor(bgColor);
            const isNonWorking = nonWorkingShifts.includes(sigla);
            
            const operatorListHtml = operators.map(op => {
                const reperibileIcon = (isNonWorking && op.reperibilita) 
                    ? `<svg class="reperibile-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C6.84 18 2 13.16 2 8V6H1a1 1 0 01-1-1V3z" /></svg>` 
                    : '';
                return `<li><span class="operator-name-badge" style="background-color: ${op.colore}; color: ${getContrastingTextColor(op.colore)}">${reperibileIcon}${op.cognome}</span> <span class="operator-quality">${op.qualita || 100}%</span></li>`;
            }).join('');

            return `<div class="shift-column">
                        <h4 style="background-color: ${bgColor}; color: ${textColor};">${sigla}</h4>
                        <ul>${operatorListHtml}</ul>
                    </div>`;
        };
        
        const presentMorningShifts = morningShifts.filter(s => groupedByShift[s]);
        const presentAfternoonShifts = afternoonShifts.filter(s => groupedByShift[s]);
        const presentOtherShifts = shiftOrder.filter(s => !morningShifts.includes(s) && !afternoonShifts.includes(s) && groupedByShift[s]);

        const afternoonStartColumn = presentMorningShifts.length + 1;
        
        const coloreM7 = getTurnoBySigla('M7')?.colore || '#eef2ff';
        const textColorM7 = getContrastingTextColor(coloreM7);
        const coloreP = getTurnoBySigla('P')?.colore || '#fff7ed';
        const textColorP = getContrastingTextColor(coloreP);

        const morningBoxHtml = presentMorningShifts.length > 0 ? `<div class="summary-coverage-box-integrated" style="background-color: ${coloreM7}; color: ${textColorM7}; grid-column: 1 / span ${presentMorningShifts.length};">
            <div><div class="coverage-box-title">TOTALE MATTINO: ${totalMattina}</div></div>
            <div class="coverage-box-details"><span class="coverage-box-quality">${avgQualitaMattina.toFixed(0)}%</span><div class="coverage-status-indicator ${deficitMattina > 0 ? 'indicator-warn' : 'indicator-ok'}"></div></div>
        </div>` : '';
        const afternoonBoxHtml = presentAfternoonShifts.length > 0 ? `<div class="summary-coverage-box-integrated" style="background-color: ${coloreP}; color: ${textColorP}; grid-column: ${afternoonStartColumn} / span ${presentAfternoonShifts.length};">
             <div><div class="coverage-box-title">TOTALE POMERIGGIO: ${totalPomeriggio}</div></div>
             <div class="coverage-box-details"><span class="coverage-box-quality">${avgQualitaPomeriggio.toFixed(0)}%</span><div class="coverage-status-indicator ${deficitPomeriggio > 0 ? 'indicator-warn' : 'indicator-ok'}"></div></div>
        </div>` : '';
        
        const allColumnsInOrderHtml = [...presentMorningShifts, ...presentAfternoonShifts, ...presentOtherShifts]
            .map(createShiftColumnHtml)
            .join('');

        document.getElementById('day-summary-content').innerHTML = morningBoxHtml + afternoonBoxHtml + allColumnsInOrderHtml;

        const { top, left } = appState.daySummaryModalPosition;
        if (top !== null && left !== null) {
            daySummaryModal.style.transform = 'none';
            daySummaryModal.style.top = top;
            daySummaryModal.style.left = left;
        } else {
            daySummaryModal.style.top = '50%';
            daySummaryModal.style.left = '50%';
            daySummaryModal.style.transform = 'translate(-50%, -50%)';
        }

        daySummaryModal.classList.remove('hidden');
        daySummaryModal.classList.add('visible');
    }
    
    function populateChangeReasons() {
        const container = document.getElementById('change-reason-container');
        if (!container || !appState.reasons) return;

        container.innerHTML = appState.reasons.map(reason => `
            <label class="flex items-center text-sm cursor-pointer">
                <input type="radio" name="main-reason" value="${reason.id}" class="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500" ${reason.hasSubReasons ? 'data-has-subreasons="true"' : ''}>
                <span class="ml-2">${reason.text}</span>
            </label>
        `).join('');
    }

    // =================================================================================
    // IMPORT / EXPORT / SALVATAGGI
    // =================================================================================
    
    function saveFullState() {
        try {
            const stateString = JSON.stringify(appState, null, 2);
            const blob = new Blob([stateString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const dateStr = new Date().toISOString().slice(0, 10);
            a.download = `gestione_turni_backup_${dateStr}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast('Stato completo salvato con successo!', 'success');
        } catch (error) {
            console.error('Errore durante il salvataggio dello stato:', error);
            showConfirmation('Si è verificato un errore durante il salvataggio del file.', 'Errore Salvataggio', true);
        }
    }

    function loadFullState(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Backup preventivo se abilitato
        if (backupState.backupBeforeCritical) {
            performIncrementalBackup('emergency', 'Backup automatico prima del caricamento stato');
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const loadedState = JSON.parse(e.target.result);
                
                if (!loadedState.operatori || !loadedState.turni || !loadedState.plannerData) {
                    throw new Error("Il file non sembra essere un backup valido.");
                }

                appState = loadedState;
                appState.currentDate = new Date(appState.currentDate);

                localStorage.setItem('appState', JSON.stringify(appState));
                showToast('Stato completo caricato. Riavvio in corso...', 'success');
                
                setTimeout(() => {
                    applyAppearance();
                    syncUiWithState();
                    renderPlanner();
                    renderDashboard();
                    renderSettings();
                    renderPrintLegend();
                    saveHistoryState();
                    // Assicurati che il planner sia visibile all'avvio
                    setTimeout(() => {
                        const plannerTab = document.querySelector('.header-nav-link[data-tab="planner"]');
                        if (plannerTab) {
                            plannerTab.click();
                            // Doppio controllo per assicurarsi che il planner sia visibile
                            const plannerDiv = document.getElementById('planner');
                            if (plannerDiv) {
                                plannerDiv.classList.remove('hidden');
                                plannerDiv.style.display = '';
                            }
                        }
                    }, 200);
                }, 500);

            } catch (error) {
                console.error('Errore durante il caricamento dello stato:', error);
                showConfirmation(`Errore nel caricamento del file di backup: ${error.message}`, 'Errore Caricamento', true);
            } finally {
                event.target.value = '';
            }
        };
        reader.readAsText(file);
    }

    function handleFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        const fileName = file.name.toLowerCase();

        try {
            if (fileName.endsWith('.xlsx')) {
                reader.onload = (e) => {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, {type: 'array'});
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const csvText = XLSX.utils.sheet_to_csv(worksheet, { FS: ';' });
                    processImportData(csvText);
                };
                reader.readAsArrayBuffer(file);
            } else if (fileName.endsWith('.csv')) {
                reader.onload = (e) => processImportData(e.target.result);
                reader.readAsText(file, 'ISO-8859-1');
            } else {
                showConfirmation("Formato file non supportato. Selezionare un file .csv o .xlsx.", "Errore", true);
            }
        } catch (error) {
             showConfirmation(`Si è verificato un errore durante la lettura del file. Dettagli: ${error.message}`, "Errore Importazione", true);
        } finally {
            event.target.value = '';
        }
    }
    
    async function importaDaGoogleSheet() {
        const url = document.getElementById('import-gsheet-url').value.trim();
        if (!url) {
            return showConfirmation("Per favore, incolla un URL prima di importare.", "URL Mancante", true);
        }
        
        const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
        showLoader();

        try {
            const response = await fetch(proxyUrl + url);
            if (!response.ok) throw new Error(`Errore di rete: ${response.status} ${response.statusText}`);
            const csvText = await response.text();
            processImportData(csvText);
        } catch (error) {
            showConfirmation(`Impossibile caricare i dati dall'URL. Assicurati che il link sia corretto e che il foglio sia "Pubblicato sul web" come CSV. Dettagli: ${error.message}`, "Errore di Caricamento", true);
        } finally {
            hideLoader();
        }
    }

    function processImportData(csvText) {
        saveHistoryState(); 
        const righe = csvText.split('\n').map(r => r.trim().replace(/\r$/, '')).filter(r => r);
        if (righe.length < 2) return showConfirmation("File non valido o vuoto.", "Errore Formato File", true);

        const delimiter = righe[0].includes(';') ? ';' : ',';
        const primaRigaCols = righe[0].split(delimiter).map(c => c.replace(/"/g, ''));
        let dataRows, header;
        const monthMap = { 'gen': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'mag': 4, 'giu': 5, 'lug': 6, 'ago': 7, 'set': 8, 'ott': 9, 'nov': 10, 'dic': 11, 'gennaio':0, 'febbraio':1, 'marzo':2, 'aprile':3, 'maggio':4, 'giugno':5, 'luglio':6, 'agosto':7, 'settembre':8, 'ottobre':9, 'novembre':10, 'dicembre':11 };

        const parseDate = (dateString) => {
            if (typeof dateString !== 'string' || dateString.trim() === '') {
                return null;
            }
            const parts = dateString.trim().toLowerCase().split(/[\s-]+/);
            if (parts.length < 2) {
                console.error("Formato data non valido nell'importazione, atteso 'Mese Anno':", dateString);
                return null;
            }
            const meseStr = parts[0].substring(0, 3);
            const annoStr = parts[1];
            if (!annoStr) {
                 console.error("Anno mancante nella stringa data dell'importazione:", dateString);
                return null;
            }
            const mese = monthMap[meseStr];
            const anno = parseInt(annoStr.length === 2 ? '20' + annoStr : annoStr, 10);
            if (isNaN(anno) || mese === undefined) {
                console.error("Mese o anno non riconosciuti:", meseStr, annoStr);
                return null;
            }
            return new Date(anno, mese, 1);
        };

        if (primaRigaCols[0].trim().toUpperCase() === 'PT-DATI-MESE') {
            const newDate = parseDate(primaRigaCols[1]);
            if (!newDate) return showConfirmation(`Data non valida nel file standard: ${primaRigaCols[1]}`, "Errore", true);
            appState.currentDate = newDate;
            header = righe[1].split(delimiter).map(h => h.trim().toUpperCase().replace(/"/g, ''));
            dataRows = righe.slice(2);
        } else {
            const newDate = parseDate(primaRigaCols[1]);
            if (!newDate) return showConfirmation(`Impossibile determinare mese e anno da "${primaRigaCols[1]}".`, "Errore Formato Data", true);
            appState.currentDate = newDate;
            header = []; 
            dataRows = righe.slice(3);
        }

        const cognomeIndex = header.indexOf('COGNOME');
        const nomeIndex = header.indexOf('NOME');
        let turniImportati = 0, nuoviOperatoriAggiunti = [], nuoviTurniAggiunti = [];
        const anno = appState.currentDate.getFullYear(), mese = appState.currentDate.getMonth();
        const monthKey = getMonthKey(appState.currentDate);
        if (!appState.plannerData[monthKey]) appState.plannerData[monthKey] = {};

        dataRows.forEach(rigaOp => {
            const colonne = rigaOp.split(delimiter).map(c => c.replace(/"/g, ''));
            const isStandardFormat = header.length > 0;
            const cognome = (colonne[isStandardFormat ? cognomeIndex : 1] || '').trim().toUpperCase();
            const nome = (colonne[isStandardFormat ? nomeIndex : 2] || '').trim().toUpperCase();
            if (!cognome) return;

            let operatore = appState.operatori.find(op => op.cognome.toUpperCase() === cognome && op.nome.toUpperCase() === nome);
            if (!operatore) {
                const newId = appState.operatori.length > 0 ? Math.max(...appState.operatori.map(o => o.id)) + 1 : 1;
                const maxOrdine = appState.operatori.length > 0 ? Math.max(...appState.operatori.map(o => o.ordine)) : 0;
                const newOp = { id: newId, cognome: (colonne[isStandardFormat ? cognomeIndex : 1] || '').trim(), nome: (colonne[isStandardFormat ? nomeIndex : 2] || '').trim(), idMatrice: 1, dataInizio: `${anno}-01-01`, dataFine: "2050-12-31", isActive: true, colore: `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`, ordine: maxOrdine + 1, qualita: 100, reperibilita: true, unavailabilities: [] };
                appState.operatori.push(newOp);
                nuoviOperatoriAggiunti.push(`${newOp.cognome} ${newOp.nome}`);
                operatore = newOp;
            }

            const giorniNelMese = getDaysInMonth(anno, mese);
            for (let giorno = 1; giorno <= giorniNelMese; giorno++) {
                const turnoCsv = (colonne[isStandardFormat ? header.indexOf(giorno.toString()) : giorno + 2] || '').trim().toUpperCase();
                if (turnoCsv) {
                    if (!getTurnoBySigla(turnoCsv)) {
                        const newTurno = { id: Date.now() + nuoviTurniAggiunti.length, sigla: turnoCsv, descrizione: `Nuovo turno: ${turnoCsv}`, inizio: "00:00", fine: "00:00", ore: 0, conteggioOre: "zero", colore: "#cccccc" };
                        appState.turni.push(newTurno);
                        if (!nuoviTurniAggiunti.includes(turnoCsv)) nuoviTurniAggiunti.push(turnoCsv);
                    }
                    const turnoMatrice = getTurnoMatrice(operatore, new Date(anno, mese, giorno));
                    if (turnoCsv !== turnoMatrice) {
                        const key = `${operatore.id}-${giorno}`;
                        if (!appState.plannerData[monthKey][key]) appState.plannerData[monthKey][key] = {};
                        const data = appState.plannerData[monthKey][key];
                        
                        if (!data.isManuallySet) {
                           data.originalTurno = data.turno || turnoMatrice;
                        }
                        
                        data.turno = turnoCsv;
                        data.isManuallySet = true;
                        turniImportati++;
                        if (!['FE', 'F', 'FERIE'].includes(turnoCsv.toUpperCase())) data.modType = 'C'; else data.modType = null;
                    }
                }
            }
        });

        let summaryMessage = (turniImportati > 0) ? `Importazione completata! Aggiornati ${turniImportati} turni.<br>` : "Nessun turno diverso dalla matrice trovato.<br>";
        if (nuoviOperatoriAggiunti.length > 0) summaryMessage += `Aggiunti ${nuoviOperatoriAggiunti.length} nuovi operatori: ${nuoviOperatoriAggiunti.join(', ')}.<br>`;
        if (nuoviTurniAggiunti.length > 0) summaryMessage += `Aggiunti ${nuoviTurniAggiunti.length} nuovi turni: ${nuoviTurniAggiunti.join(', ')}. Vai in Impostazioni per configurarli.`;
        
        showConfirmation(summaryMessage, "Riepilogo Importazione", true);
        renderPlanner();
        renderSettings();
    }
    
    function exportaGrigliaXlsx() {
        try {
            const year = appState.currentDate.getFullYear();
            const month = appState.currentDate.getMonth();
            const monthKey = getMonthKey(appState.currentDate);
            const monthLong = appState.currentDate.toLocaleDateString('it-IT', { month: 'long' });
            const monthShort = appState.currentDate.toLocaleDateString('it-IT', { month: 'short' }).replace('.', '');
            const yearShort = String(year).slice(-2);
            const daysInMonth = getDaysInMonth(year, month);
            const operators = getActiveOperators(year, month, true).sort((a,b) => a.ordine - b.ordine);
            const shifts = appState.plannerData[monthKey] || {};
            const data_to_export = [[`PT-DATI-MESE`, `${monthShort}-${yearShort}`]];
            const header = ['COGNOME', 'NOME', ...Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString())];
            data_to_export.push(header);

            operators.forEach(op => {
                const row = [op.cognome, op.nome];
                for (let day = 1; day <= daysInMonth; day++) {
                    row.push(shifts[`${op.id}-${day}`]?.turno || '');
                }
                data_to_export.push(row);
            });
            
            const worksheet = XLSX.utils.aoa_to_sheet(data_to_export);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, monthLong);
            XLSX.writeFile(workbook, `Griglia_Turni_${monthLong}_${year}.xlsx`);
        } catch (error) {
            console.error("Errore durante l'esportazione Excel:", error);
            showConfirmation("Si è verificato un errore durante la creazione del file Excel. Assicurati che la libreria XLSX sia caricata correttamente.", "Errore Esportazione", true);
        }
    }

    function exportShareableHtml() {
        const year = appState.currentDate.getFullYear();
        const month = appState.currentDate.getMonth();
        const monthKey = getMonthKey(appState.currentDate);
        const monthLong = appState.currentDate.toLocaleDateString('it-IT', { month: 'long' });
        const monthTitle = `${monthLong.charAt(0).toUpperCase() + monthLong.slice(1)} ${year}`;

        const daysInMonth = getDaysInMonth(year, month);
        const operators = getActiveOperators(year, month, true).sort((a, b) => a.ordine - b.ordine);
        const shifts = appState.plannerData[monthKey] || {};

        const dayNames = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
        const dynamicWeekDays = Array.from({ length: daysInMonth }, (_, i) => {
            const dayOfWeek = new Date(year, month, i + 1).getDay();
            return dayNames[dayOfWeek];
        });

        const headerDays = Array.from({ length: daysInMonth }, (_, i) => `<th>${i + 1}</th>`).join('');
        const headerDayNames = dynamicWeekDays.map(dayName => `<th class="day-name">${dayName}</th>`).join('');
        const headerHtml = `<thead>
                <tr><th class="main-title" colspan="${3 + daysInMonth}">${monthTitle.toUpperCase()}</th></tr>
                <tr>
                    <th class="subtitle" colspan="2">SECONDO PIANO</th>
                    ${headerDays}
                    <th>TOT. ORE</th>
                </tr>
                <tr>
                    <th colspan="2"></th>
                    ${headerDayNames}
                    <th></th>
                </tr>
            </thead>`;
        
        let bodyRowsHtml = '';
        operators.forEach((op) => {
            if (!op.isActive) return;

            let totalHours = 0;
            let rowShiftsHtml = '';
            
            for (let day = 1; day <= daysInMonth; day++) {
                const data = shifts[`${op.id}-${day}`];
                const turnoSigla = data?.turno?.trim() || '';
                const turnoDef = getTurnoBySigla(turnoSigla);
                
                if (turnoDef) {
                    if (turnoDef.conteggioOre === 'orario') {
                        totalHours += (data.oreFerie !== undefined) ? data.oreFerie : turnoDef.ore;
                    } else if (turnoDef.conteggioOre === 'sostitutivo') {
                        const originalTurno = getTurnoBySigla(data.originalTurno);
                        if (originalTurno) {
                            totalHours += originalTurno.ore;
                        }
                    }
                }
                if (data?.extraInfo?.hours) {
                    totalHours += data.extraInfo.hours;
                }

                const turnoClass = turnoSigla ? `turno-${turnoSigla.toLowerCase().replace(/[.\s]/g, '').replace('-', '_')}` : '';
                const dayOfWeek = new Date(year, month, day).getDay();
                const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
                const weekendClass = isWeekend ? 'weekend' : '';

                rowShiftsHtml += `<td class="${turnoClass} ${weekendClass}">${turnoSigla}</td>`;
            }
            bodyRowsHtml += `<tr>
                    <td class="operator-name">${op.cognome}</td>
                    <td class="operator-name">${op.nome || ''}</td>
                    ${rowShiftsHtml}
                    <td class="total-hours">${totalHours.toFixed(1).replace('.', ',')}</td>
                </tr>`;
        });
        const bodyHtml = `<tbody>${bodyRowsHtml}</tbody>`;
        
        const turniCss = appState.turni.map(t => {
            if (!t.sigla || !t.colore) return '';
            const className = `.turno-${t.sigla.toLowerCase().replace(/[.\s]/g, '').replace('-', '_')}`;
            const textColor = getContrastingTextColor(t.colore);
            return `${className} { background-color: ${t.colore}; color: ${textColor}; }`;
        }).join('\n');

        const legendItemsHtml = appState.turni
            .filter(t => t.sigla && t.sigla.trim() !== '-' && t.sigla.trim() !== '' && t.colore !== '#ffffff')
            .sort((a, b) => a.sigla.localeCompare(b.sigla))
            .map(t => `
                <div class="legend-item">
                    <span class="legend-color-box" style="background-color: ${t.colore || '#ccc'};"></span>
                    <strong class="legend-sigla">${t.sigla}:</strong>
                    <span class="legend-desc">${t.descrizione || 'N/D'}</span>
                    <span class="legend-time">(${t.inizio || '..:..'} - ${t.fine || '..:..'})</span>
                </div>
            `).join('');

        const legendHtml = `
            <div class="legend-wrapper">
                <h4>Legenda Turni</h4>
                <div class="legend-content">
                    ${legendItemsHtml}
                </div>
            </div>
        `;
        
        const staticCss = `
            @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');
            body { font-family: 'Roboto', sans-serif; background-color: #f0f2f5; color: #333; padding: 20px; }
            .page-wrapper { max-width: 100%; }
            .container { overflow-x: auto; background-color: #fff; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
            table { width: 100%; border-collapse: collapse; font-size: 14px; }
            th, td { border: 1px solid #d9d9d9; padding: 8px 10px; text-align: center; white-space: nowrap; }
            thead th { background-color: #f2f2f2; font-weight: 700; color: #555; position: sticky; top: 0; z-index: 2; }
            thead tr:first-child th { z-index: 3; }
            .main-title { font-size: 24px; font-weight: bold; padding: 16px; background-color: #e8eaf6; color: #3f51b5; }
            .subtitle { font-size: 16px; font-weight: bold; text-align: left; background-color: #f2f2f2; }
            .day-name { font-weight: 500; color: #777; }
            td.operator-name { 
                text-align: left; 
                font-weight: 500; 
                background-color: #fff; 
                position: sticky;
                z-index: 1;
            }
            td:nth-child(3).operator-name { left: 150px; }
            td:nth-child(2).operator-name { left: 50px; }
            td:nth-child(1) { position: sticky; left: 0px; background-color: #fff; }
            .weekend { background-color: #fafafa; }
            .total-hours { font-weight: bold; background-color: #f2f2f2; }
            .legend-wrapper { margin-top: 1.5rem; padding: 1rem; background-color: #fff; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); border-top: 3px solid #3f51b5; }
            .legend-wrapper h4 { margin: 0 0 0.75rem 0; text-align: center; font-size: 1rem; color: #333; font-weight: 700; }
            .legend-content { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.5rem 1.5rem; }
            .legend-item { display: flex; align-items: center; font-size: 9px; white-space: nowrap; }
            .legend-color-box { width: 10px; height: 10px; margin-right: 5px; border: 1px solid #b0b0b0; flex-shrink: 0; }
            .legend-sigla { margin-right: 3px; }
            .legend-desc { color: #555; margin-right: 3px; }
            .legend-time { color: #777; }
        `;

        const finalHtml = [
            '<!DOCTYPE html>',
            '<html lang="it">',
            '<head>',
            '    <meta charset="UTF-8">',
            '    <meta name="viewport" content="width=device-width, initial-scale=1.0">',
            `    <title>Calendario Turni - ${monthTitle}</title>`,
            '    <style>',
            staticCss,
            turniCss,
            '    </style>',
            '</head>',
            '<body>',
            '    <div class="page-wrapper">',
            '        <div class="container">',
            '            <table>',
            headerHtml,
            bodyHtml,
            '            </table>',
            '        </div>',
            legendHtml,
            '    </div>',
            '</body>',
            '</html>'
        ].join('\n');
        
        const blob = new Blob([finalHtml], { type: 'text/html' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `calendario_turni_${monthLong.toLowerCase()}_${year}.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    }

    function exportPlannerToPdf(exportType = 'shifts') {
    showLoader();
    try {
        const { jsPDF } = window.jspdf;
        // Configurazione PDF A3 con sfondo blu scuro
        const doc = new jsPDF({ 
            orientation: 'landscape', 
            unit: 'pt', 
            format: 'a3' 
        });

        const pageHeight = doc.internal.pageSize.getHeight();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 30;
        
        // Sfondo blu scuro per tutto il foglio
        doc.setFillColor(25, 55, 109); // Blu scuro come nell'immagine
        doc.rect(0, 0, pageWidth, pageHeight, 'F');
        
        // Rimuovi la cornice esterna spessa

        const year = appState.currentDate.getFullYear();
        const month = appState.currentDate.getMonth();
        const monthLong = appState.currentDate.toLocaleDateString('it-IT', { month: 'long' });
        const monthTitle = `${monthLong.charAt(0).toUpperCase() + monthLong.slice(1)} ${year}`;
        
        const daysInMonth = getDaysInMonth(year, month);
        const operators = getActiveOperators(year, month, true).filter(op => op.isActive).sort((a, b) => a.ordine - b.ordine);
        const shifts = appState.plannerData[getMonthKey(appState.currentDate)] || {};
        
        // Creazione array dei giorni della settimana con evidenziazione delle domeniche
        const dayNames = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
        const weekDays = Array.from({ length: daysInMonth }, (_, i) => {
            const dayOfWeek = new Date(year, month, i + 1).getDay();
            const dayName = dayNames[dayOfWeek];
            // Evidenzia le domeniche mostrando sia numero che giorno
            if (dayOfWeek === 0) {
                return `${dayName}`;
            }
            return dayName;
        });
        
        // Titolo e "SECONDO PIANO" sulla stessa riga
        doc.setFontSize(22);
        doc.setTextColor(255, 255, 255);
        doc.text(monthTitle, pageWidth / 2, margin + 40, { align: 'center' });
        doc.text('SECONDO PIANO', pageWidth - margin - 200, margin + 40, { align: 'left' });

        // Header riorganizzato: Operatore, Ore, poi giorni
        const dayNumbers = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());
        const head = [
            ['Operatore', 'Ore', ...dayNumbers],
            ['', '', ...weekDays]
        ];
        const body = [];
        const cellStyles = {};

        const startY = 80; // Posizione abbassata per maggiore spazio sotto il titolo
        const availableTableHeight = (pageHeight - startY - 80) * 1.41 + 20; // Aumentato del 10% e aggiunto 60 pixel di altezza
        
        const minRowHeight = 57; // Aumentato di 4px per estendere le righe verso il basso
        const calculatedRowHeight = operators.length > 0 ? 
            Math.max(minRowHeight, (availableTableHeight - (2 * 40)) / operators.length) : minRowHeight;
        const rowHeight = calculatedRowHeight;

        operators.forEach((op, rowIndex) => {
            let totalHours = 0;
            const rowData = [
                { content: `${op.cognome} ${op.nome}`, styles: { halign: 'left', fontStyle: 'bold', fontSize: 14 } }
            ];
            
            // Calcolo ore totali
            for (let day = 1; day <= daysInMonth; day++) {
                const currentDate = new Date(year, month, day);
                const dayOfWeek = currentDate.getDay();
                const data = shifts[`${op.id}-${day}`] || {};
                const turnoSigla = data.turno || '';
                
                if (turnoSigla) {
                    if (data.extraInfo?.hours) {
                        totalHours += data.extraInfo.hours;
                    }
                    const turnoDef = getTurnoBySigla(turnoSigla);
                    if (turnoDef) {
                        if (turnoDef.conteggioOre === 'orario') {
                            if (dayOfWeek === 0 && (turnoSigla === 'F' || turnoSigla === 'FE')) {
                                totalHours += 0;
                            } else {
                                totalHours += (data.oreFerie ?? turnoDef.ore);
                            }
                        } else if (turnoDef.conteggioOre === 'sostitutivo') {
                            const originalTurno = getTurnoBySigla(data.originalTurno);
                            if (originalTurno) totalHours += originalTurno.ore;
                        }
                    }
                }
            }
            
            // Colonna Ore con font ridotto del 15%
            rowData.push({ content: totalHours.toFixed(1), styles: { fontStyle: 'bold', fontSize: 8.5, halign: 'center' } });
            
            // Celle dei giorni
            for (let day = 1; day <= daysInMonth; day++) {
                const data = shifts[`${op.id}-${day}`] || {};
                const turnoSigla = data.turno || '';
                let cellContent = turnoSigla;
                
                let fillColor = [255, 255, 255];
                let hexColorForTextCalc = '#ffffff';

                if (exportType === 'shifts') {
                    const turnoDef = getTurnoBySigla(turnoSigla);
                    if (turnoDef && turnoDef.colore && turnoDef.colore !== '#ffffff') {
                        fillColor = turnoDef.colore;
                        hexColorForTextCalc = turnoDef.colore;
                    }
                } else if (exportType === 'assignments') {
                    const assignment = data.assignmentId ? appState.assignments.find(a => a.id === data.assignmentId) : null;
                    if (assignment && assignment.colore) {
                        const baseColor = assignment.colore;
                        const adjustedColor = adjustColorBrightness(baseColor, 10);
                        fillColor = adjustedColor;
                        hexColorForTextCalc = baseColor;
                        
                        cellStyles[`${rowIndex}-${day + 1}`] = {
                            fillColor: fillColor,
                            textColor: getContrastingTextColor(hexColorForTextCalc) === 'white' ? [255, 255, 255] : [0, 0, 0],
                            lineColor: adjustColorBrightness(baseColor, -30),
                            lineWidth: 0.5
                        };
                    } else if (turnoSigla) {
                        fillColor = [248, 250, 252];
                        cellStyles[`${rowIndex}-${day + 1}`] = {
                            fillColor: fillColor,
                            textColor: [75, 85, 99],
                            lineColor: [203, 213, 225],
                            lineWidth: 0.3
                        };
                    }
                }
                
                if (!cellStyles[`${rowIndex}-${day + 1}`]) {
                    cellStyles[`${rowIndex}-${day + 1}`] = { 
                        fillColor: fillColor, 
                        textColor: getContrastingTextColor(hexColorForTextCalc) === 'white' ? [255, 255, 255] : [0, 0, 0] 
                    };
                }
                rowData.push(cellContent);
            }
            
            body.push(rowData);
        });

        doc.autoTable({
            head: head,
            body: body,
            startY: startY,
            theme: 'grid',
            styles: { 
                cellPadding: 5, // Ottimizzato per il layout ridotto
                fontSize: 11, // Ridotto per adattarsi alla griglia più compatta
                halign: 'center', 
                valign: 'middle', 
                cellHeight: 56, // Aumentato di 4 pixel per migliore spaziatura
                lineWidth: 0.5, // Linee ottimizzate
                lineColor: [140, 140, 140]
            },
            headStyles: { 
                fillColor: [71, 85, 105],
                textColor: [255, 255, 255], 
                fontStyle: 'bold', 
                cellHeight: 35, // Ridotto proporzionalmente
                fontSize: 11 // Ridotto per coerenza
            },
            columnStyles: { 
                0: { cellWidth: 184, fillColor: [248, 250, 252] }, // Ridotto del 20% come richiesto (230 -> 184)
                1: { cellWidth: 45, fillColor: [240, 245, 251], fontStyle: 'bold', fontSize: 14 } // Font aumentato di 2px per le ore
            },
            didParseCell: function(data) {
                // Evidenziazione delle domeniche nell'header
                if (data.section === 'head' && data.row.index === 1) {
                    data.cell.styles.fillColor = [100, 116, 139];
                    data.cell.styles.fontSize = 6; // Ridotto ulteriormente per migliore leggibilità complessiva
                    data.cell.styles.cellHeight = 25;
                    
                    // Evidenzia le domeniche con sfondo diverso
                    const dayIndex = data.column.index - 2; // -2 per Operatore e Ore
                    if (dayIndex >= 0) {
                        const dayOfWeek = new Date(year, month, dayIndex + 1).getDay();
                        if (dayOfWeek === 0) { // Domenica
                            data.cell.styles.fillColor = [220, 220, 220];
                            data.cell.styles.textColor = [0, 0, 0];
                            data.cell.styles.fontStyle = 'bold';
                        }
                    }
                }
                
                if (data.section === 'body' && data.column.index === 0) {
                    data.cell.styles.fontSize = 12; // Ridotto di 2 pixel per migliore leggibilità
                }
                
                if (data.section === 'body' && data.column.index > 1 && data.column.index < head[0].length) {
                    const style = cellStyles[`${data.row.index}-${data.column.index}`];
                    if (style) {
                        data.cell.styles.fillColor = style.fillColor;
                        data.cell.styles.textColor = style.textColor;
                        if (style.lineColor) {
                            data.cell.styles.lineColor = style.lineColor;
                            data.cell.styles.lineWidth = style.lineWidth;
                        }
                    }
                }
            }
        });

        const tableEndY = doc.lastAutoTable.finalY;
        
        // Posiziona la legenda direttamente sotto la griglia del planner
        const legendsWidth = 400;
        const legendsX = (pageWidth - legendsWidth) / 2;
        const legendsY = tableEndY + 15; // Spazio di 15px sotto la tabella
        
        // Sezione inferiore per data e responsabile (in basso alla pagina)
        const bottomY = pageHeight - margin - 85;
        
        // Data di aggiornamento (in basso a sinistra)
        const updateDate = new Date().toLocaleDateString('it-IT');
        const updateBoxX = margin + 20;
        const updateBoxY = bottomY;
        const updateBoxWidth = 180;
        const updateBoxHeight = 70;
        
        doc.setFillColor(255, 255, 255);
        doc.rect(updateBoxX, updateBoxY, updateBoxWidth, updateBoxHeight, 'F');
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(1);
        doc.rect(updateBoxX, updateBoxY, updateBoxWidth, updateBoxHeight, 'S');
        
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text(`Aggiornamento del:`, updateBoxX + updateBoxWidth/2, updateBoxY + 25, { align: 'center' });
        doc.text(updateDate, updateBoxX + updateBoxWidth/2, updateBoxY + 45, { align: 'center' });
        
        let currentLegendY = legendsY;
        
        // Legenda turni con riquadro ben definito
        const shiftLegendItems = appState.turni.filter(turno => 
            (turno.sigla || turno.nome) && turno.colore !== '#ffffff' && turno.colore !== '#f5f5f5'
        );
        
        if (shiftLegendItems.length > 0) {
            const itemsPerColumn = Math.ceil(shiftLegendItems.length / 3);
            const shiftLegendBoxHeight = 130; // Aumentato per migliore contenimento
            
            // Riquadro principale per l'intera legenda con bordo più spesso
            doc.setFillColor(248, 250, 252); // Sfondo leggermente grigio
            doc.rect(legendsX, currentLegendY, legendsWidth, shiftLegendBoxHeight, 'F');
            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(1.5); // Bordo più spesso per definizione migliore
            doc.rect(legendsX, currentLegendY, legendsWidth, shiftLegendBoxHeight, 'S');
            
            // Titolo legenda turni
            doc.setFontSize(11); // Leggermente più grande per migliore visibilità
            doc.setTextColor(0, 0, 0);
            doc.text('LEGENDA TURNI', legendsX + legendsWidth/2, currentLegendY + 20, { align: 'center' });
            
            shiftLegendItems.forEach((turno, index) => {
                const col = Math.floor(index / itemsPerColumn);
                const row = index % itemsPerColumn;
                const x = legendsX + 25 + (col * 120); // Spacing ottimizzato per centratura
                const y = currentLegendY + 40 + (row * 16); // Adattato al nuovo layout con titolo più grande
                
                // Quadratino colorato - allineato verticalmente con il testo
                doc.setFillColor(turno.colore);
                doc.rect(x, y - 5, 9, 9, 'F'); // Dimensione ottimizzata per visibilità
                doc.setDrawColor(0, 0, 0);
                doc.setLineWidth(0.3);
                doc.rect(x, y - 5, 9, 9, 'S');
                
                // Sigla e descrizione - allineate perfettamente con il quadratino
                doc.setFontSize(7); // Ridotto per migliore leggibilità e contenimento
                doc.setTextColor(0, 0, 0);
                const text = `${turno.sigla || turno.nome}: ${turno.descrizione || ''}`;
                const maxWidth = 85; // Ulteriormente ridotto per evitare fuoriuscite
                const lines = doc.splitTextToSize(text, maxWidth);
                // Verifica che il testo non superi i bordi del riquadro
                const textToShow = lines[0] || text;
                if (x + 13 + doc.getTextWidth(textToShow) <= legendsX + legendsWidth - 10) {
                    doc.text(textToShow, x + 13, y); // Allineamento orizzontale perfetto
                } else {
                    // Tronca il testo se troppo lungo
                    const truncatedText = textToShow.substring(0, Math.floor(textToShow.length * 0.8)) + '...';
                    doc.text(truncatedText, x + 13, y);
                }
            });
            
            currentLegendY += shiftLegendBoxHeight + 3; // Spazio ridotto a 3 pixel
        }
        
        // NOTA: Legenda incarichi rimossa dal layout PDF come richiesto
        
        // Firma responsabile sanitario (in basso a destra, allineata)
        const signatureBoxWidth = 180;
        const signatureBoxHeight = 70;
        const signatureBoxX = pageWidth - margin - signatureBoxWidth - 20;
        const signatureBoxY = bottomY; // Allineata con data e legenda
        
        doc.setFillColor(255, 255, 255);
        doc.rect(signatureBoxX, signatureBoxY, signatureBoxWidth, signatureBoxHeight, 'F');
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(1);
        doc.rect(signatureBoxX, signatureBoxY, signatureBoxWidth, signatureBoxHeight, 'S');
        
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text('RESPONSABILE SANITARIO', signatureBoxX + signatureBoxWidth/2, signatureBoxY + 25, { align: 'center' });
        
        doc.setLineWidth(0.5);
        doc.line(signatureBoxX + 20, signatureBoxY + 55, signatureBoxX + signatureBoxWidth - 20, signatureBoxY + 55);
        
        const fileName = exportType === 'shifts' 
            ? `Planner_Turni_${monthLong}_${year}.pdf` 
            : `Planner_Incarichi_${monthLong}_${year}.pdf`;
            
        doc.save(fileName);
    } catch (error) {
        console.error("Errore durante la creazione del PDF:", error);
        showConfirmation("Si è verificato un errore durante la generazione del PDF.", "Errore Esportazione", true);
    } finally {
        hideLoader();
    }
}
    
    /**
     * Funzione per esportare gli extra in formato PDF
     * Utilizza la nuova implementazione di stampa dedicata
     */
    function exportExtrasToPdf() {
        generateExtraPrintReport();
    }


    // =================================================================================
    // LOGICA DI SALVATAGGIO E CANCELLAZIONE
    // =================================================================================

    function saveCellAction() {
        try {
            if (currentModalOpId === null) return;
            
            const opId = currentModalOpId;
            const title = document.getElementById('modal-cell-title').textContent;
            const dayMatch = title.match(/Giorno (\d+)/);
            if (!dayMatch) return;
            const day = parseInt(dayMatch[1], 10);

            const monthKey = getMonthKey(appState.currentDate);
            if (!appState.plannerData[monthKey]) appState.plannerData[monthKey] = {};
            const key = `${opId}-${day}`;
            if (!appState.plannerData[monthKey][key]) appState.plannerData[monthKey][key] = {};
            const data = appState.plannerData[monthKey][key];
            
            let hasChanged = false;

            // Logica contestuale: salva solo la sezione visibile
            if (document.getElementById('modal-section-change').style.display !== 'none') {
                const nuovoTurno = document.getElementById('change-turno').value;
                const isGettoneChange = document.getElementById('change-gettone-checkbox').checked;
                let changeReason = '';
                const mainReasonChecked = document.querySelector('input[name="main-reason"]:checked');
                if (mainReasonChecked) {
                    changeReason = mainReasonChecked.value;
                    const reasonDef = appState.reasons.find(r => r.id == changeReason);
                    if (reasonDef && reasonDef.hasSubReasons) {
                        const subReasonChecked = document.querySelector('input[name="sub-reason"]:checked');
                        if (subReasonChecked) changeReason += `:${subReasonChecked.value}`;
                    }
                }

                if (nuovoTurno !== (data.turno || '') || isGettoneChange !== (data.gettone || false) || changeReason !== (data.changeReason || '')) {
                    hasChanged = true;
                    if (nuovoTurno !== (data.turno || '')) {
                        if (!data.isManuallySet) {
                            data.originalTurno = data.turno;
                        }
                        data.turno = nuovoTurno;
                        data.modType = 'C';
                        data.isManuallySet = true;
                    }
                    data.changeReason = changeReason;
                    data.gettone = isGettoneChange;
                }
            }
            
            if (document.getElementById('modal-section-extra').style.display !== 'none') {
                const extraTypeRadio = document.querySelector('input[name="extra-type"]:checked');
                const isGettone = document.getElementById('extra-gettone-checkbox').checked;
                const finalHours = parseFloat(document.getElementById('extra-hours-manual').value.replace(',', '.')) || 0;
                
                if (finalHours > 0 || extraTypeRadio || isGettone) {
                    hasChanged = true;
                    const extraType = extraTypeRadio ? extraTypeRadio.value : null;
                    const extraNote = document.getElementById('extra-note').value;
                    const startTimeValue = document.getElementById('extra-start-time').value;
                    const endTimeValue = document.getElementById('extra-end-time').value;

                    data.extraInfo = { 
                        type: extraType, 
                        note: extraNote, 
                        hours: finalHours,
                        gettone: isGettone,
                        startTime: startTimeValue,
                        endTime: endTimeValue
                    };
                    if (!data.modType) data.modType = 'M';
                } else if (data.extraInfo) {
                    hasChanged = true;
                    delete data.extraInfo;
                }
            }

            if (document.getElementById('modal-section-note').style.display !== 'none') {
                 const notaGenerale = document.getElementById('add-note').value;
                 if (notaGenerale !== (data.nota || '')) {
                    hasChanged = true;
                    data.nota = notaGenerale;
                 }
            }
            
            if (hasChanged) {
                saveHistoryState();
                
                // Registra il cambio nel sistema di logging avanzato
                const operator = appState.operatori.find(op => op.id === opId);
                const currentDate = new Date(appState.currentDate);
                currentDate.setDate(day);
                
                const changeData = {
                    date: currentDate.toISOString().split('T')[0],
                    operatorId: opId,
                    operatorName: operator ? `${operator.cognome} ${operator.nome}` : 'Sconosciuto',
                    changeType: data.modType || 'M',
                    originalShift: data.originalTurno || '',
                    newShift: data.turno || '',
                    reason: data.changeReason || '',
                    subReason: data.changeReason && data.changeReason.includes(':') ? data.changeReason.split(':')[1] : '',
                    note: data.nota || '',
                    extraInfo: data.extraInfo || null,
                    swapPartner: data.swapPartner || null,
                    plannerMonth: monthKey,
                    cellKey: key,
                    violations: data.violations || []
                };
                
                logChangeEvent(changeData);
            }

            closeModal('modal-cell-action');
            renderPlanner();
            // Aggiorna il riepilogo giorno se era aperto per quel giorno
            if (activeDaySummary === day) {
                openDaySummaryModal(day);
            }
        } catch (error) { 
            console.error("Errore durante il salvataggio:", error);
            showConfirmation("Si è verificato un errore imprevisto durante il salvataggio.", "Errore Salvataggio", true); 
        }
    }

    async function saveAssignPeriod() {
        saveHistoryState();
        if (currentModalOpId === null) return;
        const opId = currentModalOpId;
        const turnoDaAssegnare = document.getElementById('period-turno').value;
        const startDateStr = document.getElementById('period-start-date').value;
        const endDateStr = document.getElementById('period-end-date').value;
        if (!opId || !turnoDaAssegnare || !startDateStr || !endDateStr) {
            return showConfirmation('Per favore, compila tutti i campi del periodo.', 'Dati Mancanti', true);
        }
        
        const startDate = new Date(startDateStr);
        const endDate = new Date(endDateStr);
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const monthKey = getMonthKey(d);
            if (!appState.plannerData[monthKey]) appState.plannerData[monthKey] = {};
            const day = d.getDate();
            const key = `${opId}-${day}`;
            if (!appState.plannerData[monthKey][key]) appState.plannerData[monthKey][key] = {};
            const data = appState.plannerData[monthKey][key];

            if (!data.isManuallySet) {
                data.originalTurno = data.turno;
            }
            
            data.turno = turnoDaAssegnare;
            data.modType = 'E';
            data.isManuallySet = true;
        }
        
        closeModal('modal-cell-action');
        renderPlanner();
    }
    
    async function clearAllChangesForPeriod() {
        const opId = document.getElementById('clear-changes-operator').value;
        const startDateStr = document.getElementById('clear-changes-start-date').value;
        const endDateStr = document.getElementById('clear-changes-end-date').value;

        if (!startDateStr || !endDateStr) {
            return showConfirmation("Inserisci un periodo valido.", "Errore", true);
        }

        const startDate = new Date(startDateStr);
        const endDate = new Date(endDateStr);

        let operatorsToClear = [];
        if (opId === 'all') {
            operatorsToClear = getActiveOperators(startDate.getFullYear(), startDate.getMonth(), true);
        } else {
            const op = appState.operatori.find(o => o.id === parseInt(opId));
            if (op) {
                operatorsToClear.push(op);
            }
        }

        const confirmed = await showConfirmation(
            `Sei sicuro di voler cancellare TUTTE le modifiche manuali per ${opId === 'all' ? 'tutti gli operatori' : operatorsToClear[0].cognome} nel periodo dal ${startDate.toLocaleDateString()} al ${endDate.toLocaleDateString()}?`,
            "Conferma Cancellazione Modifiche"
        );

        if (confirmed) {
            // Backup preventivo se abilitato
            if (backupState.backupBeforeCritical) {
                performIncrementalBackup('emergency', 'Backup automatico prima della cancellazione modifiche');
            }
            
            saveHistoryState(); 
            operatorsToClear.forEach(op => {
                for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                    const monthKey = getMonthKey(d);
                    const day = d.getDate();
                    const key = `${op.id}-${day}`;
                    if (appState.plannerData[monthKey] && appState.plannerData[monthKey][key]) {
                        delete appState.plannerData[monthKey][key];
                    }
                }
            });
            closeModal('modal-clear-changes');
            generatePlannerData();
            renderPlanner();
            renderDashboard();
        }
    }


// =================================================================================
// GESTIONE EVENTI E INTERAZIONI UI
// =================================================================================

function setupEventListeners() {
    document.getElementById('prev-month').addEventListener('click', () => {
        appState.currentDate.setMonth(appState.currentDate.getMonth() - 1);
        renderPlanner();
        renderDashboard();
    });
    document.getElementById('next-month').addEventListener('click', () => {
        appState.currentDate.setMonth(appState.currentDate.getMonth() + 1);
        renderPlanner();
        renderDashboard();
    });
    document.getElementById('today-btn').addEventListener('click', () => {
        appState.currentDate = new Date();
        renderPlanner();
        const today = new Date().getDate();
        openDaySummaryModal(today);
        selectCrosshair(null, today);
    });

    document.getElementById('theme-toggle').addEventListener('change', (e) => {
        appState.currentTheme = e.target.checked ? 'color' : 'standard';
        renderPlanner();
    });
    document.getElementById('performance-bars-toggle').addEventListener('change', (e) => {
        appState.showPerformanceBars = e.target.checked;
        renderPlanner();
    });
    document.getElementById('mod-symbols-toggle').addEventListener('change', (e) => {
        appState.showModSymbols = e.target.checked;
        renderPlanner();
    });
    document.getElementById('assignments-toggle').addEventListener('change', e => {
        appState.showAssignments = e.target.checked;
        renderPlanner();
    });
    document.getElementById('coverage-toggle').addEventListener('change', e => {
        appState.showCoverageInfo = e.target.checked;
        
        const performanceToggleWrapper = document.getElementById('performance-toggle-wrapper');
        if (performanceToggleWrapper) {
            performanceToggleWrapper.style.display = appState.showCoverageInfo ? 'flex' : 'none';
        }
        if (!appState.showCoverageInfo) {
            appState.showPerformanceBars = false;
            document.getElementById('performance-bars-toggle').checked = false;
        }
    
        renderPlanner();
    });
    document.getElementById('show-hours-toggle').addEventListener('change', e => {
        appState.showShiftHours = e.target.checked;
        renderPlanner();
    });
    document.getElementById('threed-effect-toggle').addEventListener('change', e => {
        appState.show3DEffect = e.target.checked;
        renderPlanner();
    });
    document.getElementById('matrix-view-toggle').addEventListener('change', e => {
        appState.showMatrixOnly = e.target.checked;
        renderPlanner();
    });

    const sidebar = document.getElementById('sidebar');
    const appDiv = document.getElementById('app');
    const sidebarTab = document.getElementById('sidebar-tab');

    sidebarTab.addEventListener('click', () => {
        sidebar.classList.add('sidebar-open');
        appDiv.classList.add('sidebar-open');
        sidebarTab.classList.add('sidebar-open');
    });
    const emergencyDismissBtn = document.getElementById('emergency-dismiss-btn');
    if (emergencyDismissBtn) emergencyDismissBtn.addEventListener('click', () => {
        document.getElementById('emergency-alert-container').classList.add('hidden');
    });
    
    const emergencyResolveBtn = document.getElementById('emergency-resolve-btn');
    if (emergencyResolveBtn) emergencyResolveBtn.addEventListener('click', () => {
        document.getElementById('emergency-alert-container').classList.add('hidden');
        showEmergencyDashboard();
    });
    
    const dismissCoverageAlertBtn = document.getElementById('dismiss-coverage-alert');
    if (dismissCoverageAlertBtn) dismissCoverageAlertBtn.addEventListener('click', () => {
        document.getElementById('critical-coverage-alert').classList.add('hidden');
    });

    const suggestCoverageBtn = document.getElementById('suggest-coverage-btn');
    if (suggestCoverageBtn) suggestCoverageBtn.addEventListener('click', () => {
        document.getElementById('critical-coverage-alert').classList.add('hidden');
        const metrics = calculateEmergencyMetrics();
        if (metrics.criticalDays && metrics.criticalDays.length > 0) {
             const firstCriticalDay = metrics.criticalDays[0];
             const firstDeficit = Object.entries(firstCriticalDay.deficits).find(([shift, count]) => count > 0);
             if (firstDeficit) {
                 getCoverageSuggestions(firstCriticalDay.day, firstDeficit[0]);
             }
        }
    });
    document.getElementById('sidebar-close-btn').addEventListener('click', () => {
        sidebar.classList.remove('sidebar-open');
        appDiv.classList.remove('sidebar-open');
        sidebarTab.classList.remove('sidebar-open');
    });

    document.getElementById('main-nav').addEventListener('click', e => {
        e.preventDefault();
        const link = e.target.closest('.header-nav-link');
        const dropdownItem = e.target.closest('.dropdown-item');
        
        // Gestione click su elementi dropdown
        if (dropdownItem) {
            const tabId = dropdownItem.dataset.tab;
            const action = dropdownItem.dataset.action;
            
            if (tabId) {
                // Navigazione normale per tab
                document.querySelectorAll('.tab-content').forEach(c => {
                    c.classList.add('hidden');
                    c.style.display = 'none';
                });
                
                const selectedTab = document.getElementById(tabId);
                if (selectedTab) {
                    selectedTab.classList.remove('hidden');
                    selectedTab.style.display = '';
                }
                
                document.querySelectorAll('.header-nav-link').forEach(l => l.classList.remove('active'));
                document.querySelector('.header-nav-link[data-tab="impostazioni"]').classList.add('active');
                
                if (tabId === 'config-paths' || tabId === 'config-security') {
                    renderSettings(tabId);
                }
            }
            return;
        }
        
        // Gestione click su link principali
        if (!link) return;
        const tabId = link.dataset.tab;
        
        // Skip se è un dropdown toggle
        if (link.classList.contains('dropdown-toggle')) {
            return;
        }

        // Nascondi tutti i tab con display none
        document.querySelectorAll('.tab-content').forEach(c => {
            c.classList.add('hidden');
            c.style.display = 'none';
        });
        
        // Mostra il tab selezionato
        const selectedTab = document.getElementById(tabId);
        if (selectedTab) {
            selectedTab.classList.remove('hidden');
            selectedTab.style.display = '';
        }

        document.querySelectorAll('.header-nav-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
       
        if (tabId === 'impostazioni') {
            renderSettings();
        } else if (tabId === 'dashboard') {
            renderDashboard();
        } else if (tabId === 'report') {
            // Inizializza le date del report con il mese corrente
            const currentDate = new Date(appState.currentDate);
            const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
            
            document.getElementById('report-start-date').value = firstDay.toISOString().split('T')[0];
            document.getElementById('report-end-date').value = lastDay.toISOString().split('T')[0];
        } else if (tabId === 'planner') {
            const oggi = new Date();
            if (oggi.getFullYear() === appState.currentDate.getFullYear() && oggi.getMonth() === appState.currentDate.getMonth()) {
                selectCrosshair(null, oggi.getDate());
            } else {
                clearHighlights();
            }
        } else if (tabId === 'log-cambi') {
            initializeChangeLogsInterface();
        }
    });
    
    document.getElementById('settings-nav').addEventListener('click', e => {
        e.preventDefault();
        const link = e.target.closest('.settings-nav-link');
        if (!link) return;

        const tabId = link.dataset.settingsTab;

        document.querySelectorAll('.settings-nav-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        document.querySelectorAll('.settings-content-panel').forEach(p => p.classList.add('hidden'));
        document.getElementById(`settings-panel-${tabId}`).classList.remove('hidden');
        

    });

    document.getElementById('assign-mode-btn').addEventListener('click', e => {
        appState.isAssignmentMode = !appState.isAssignmentMode;
        syncUiWithState();
        renderPlanner();
        if (!appState.isAssignmentMode) closeAssignmentPalette();
    });
    document.getElementById('export-pdf-extra-btn').addEventListener('click', exportExtrasToPdf);
    document.getElementById('export-pdf-btn').addEventListener('click', () => exportPlannerToPdf('shifts'));
    document.getElementById('export-pdf-assignments-btn').addEventListener('click', () => exportPlannerToPdf('assignments'));
    document.getElementById('print-btn').addEventListener('click', () => window.print());
    document.getElementById('help-btn').addEventListener('click', () => openModal('modal-help'));

    document.getElementById('planner-head').addEventListener('click', (e) => {
        const headerCell = e.target.closest('th[data-day-col]');
        if (headerCell) {
            const day = parseInt(headerCell.dataset.dayCol, 10);
            if (activeDaySummary === day) {
                closeDaySummaryModal();
            } else {
                selectCrosshair(null, day);
                openDaySummaryModal(day);
            }
        }
    });

    setupSettingsEventListeners();
    setupDraggableDaySummary();
    const tableContainer = document.querySelector('.table-container');
    let isPanning = false;
    let startX;
    let scrollLeft;

    tableContainer.addEventListener('mousedown', (e) => {
        if (e.button !== 2) return; // Only right-click
        isPanning = true;
        tableContainer.classList.add('grabbing');
        startX = e.pageX - tableContainer.offsetLeft;
        scrollLeft = tableContainer.scrollLeft;
        e.preventDefault();
    });

    tableContainer.addEventListener('mouseleave', () => {
        isPanning = false;
        tableContainer.classList.remove('grabbing');
    });

    tableContainer.addEventListener('mouseup', (e) => {
        if (e.button !== 2) return;
        isPanning = false;
        tableContainer.classList.remove('grabbing');
    });

    tableContainer.addEventListener('mousemove', (e) => {
        if (!isPanning) return;
        e.preventDefault();
        const x = e.pageX - tableContainer.offsetLeft;
        const walk = (x - startX) * 2;
        tableContainer.scrollLeft = scrollLeft - walk;
    });

    tableContainer.addEventListener('contextmenu', e => e.preventDefault());


    const modalCellAction = document.getElementById('modal-cell-action');

    modalCellAction.addEventListener('change', (e) => {
        if (e.target.matches('input[name="main-reason"]')) {
            const hasSubReasons = e.target.dataset.hasSubreasons === 'true';
            document.getElementById('sub-reason-container').classList.toggle('hidden', !hasSubReasons);
            document.getElementById('change-gettone-container').classList.toggle('hidden', !hasSubReasons);
        } else if (e.target.matches('input[name="extra-type"]')) {
            const anyChecked = document.querySelector('input[name="extra-type"]:checked');
            document.getElementById('extra-details-container').classList.toggle('hidden', !anyChecked);

            const extraRientroStart = document.getElementById('extra-start-time');
            const extraRientroEnd = document.getElementById('extra-end-time');

            const title = document.getElementById('modal-cell-title').textContent;
            const dayMatch = title.match(/Giorno (\d+)/);
            if (!dayMatch) return;
            const day = parseInt(dayMatch[1], 10);
            const monthKey = getMonthKey(appState.currentDate);
            const data = appState.plannerData[monthKey]?.[`${currentModalOpId}-${day}`] || {};
            const turnoDef = getTurnoBySigla(data.turno);

            if (anyChecked && turnoDef) {
                switch (anyChecked.value) {
                    case 'prolungamento':
                        if (turnoDef.fine) {
                            extraRientroStart.value = turnoDef.fine;
                            extraRientroEnd.value = '';
                        }
                        break;
                    case 'rientro':
                        if (turnoDef.inizio) {
                            extraRientroEnd.value = turnoDef.inizio;
                            extraRientroStart.value = '';
                        }
                        break;
                }
            }
            updateCalculatedExtraHours();
        }
    });

    modalCellAction.addEventListener('click', e => {
        if (e.target.id === 'btn-add-new-reason-inline') {
            const newReasonText = prompt("Inserisci il testo per il nuovo motivo:");
            if (newReasonText && newReasonText.trim() !== '') {
                appState.reasons.push({
                    id: Date.now(),
                    text: newReasonText.trim()
                });
                populateChangeReasons();
                renderSettings();
            }
        }
    });

    modalCellAction.addEventListener('input', (e) => {
        if (e.target.matches('#extra-start-time, #extra-end-time')) {
            updateCalculatedExtraHours();
        } else if (e.target.matches('#extra-hours-manual')) {
            e.target.classList.remove('bg-indigo-100');
        }
    });

    document.getElementById('save-cell-action').addEventListener('click', saveCellAction);
    document.getElementById('save-assign-period').addEventListener('click', saveAssignPeriod);

    document.getElementById('confirm-modal-ok').addEventListener('click', () => {
        closeModal('modal-confirm');
        if (resolveConfirm) resolveConfirm(true);
    });
    document.getElementById('confirm-modal-cancel').addEventListener('click', () => {
        closeModal('modal-confirm');
        if (resolveConfirm) resolveConfirm(false);
    });

    document.getElementById('cancel-cell-action').addEventListener('click', () => closeModal('modal-cell-action'));
    document.getElementById('close-day-summary').addEventListener('click', closeDaySummaryModal);

    document.getElementById('mini-menu').addEventListener('click', handleMiniMenuClick);
    document.getElementById('assignment-palette').addEventListener('click', handleAssignmentPaletteClick);
    document.getElementById('legend-container').addEventListener('click', handleLegendFilterClick);

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#mini-menu') && !e.target.closest('.planner-cell')) closeMiniMenu();
        if (!e.target.closest('#assignment-palette') && !e.target.closest('.planner-cell')) closeAssignmentPalette();
        if (!e.target.closest('#operator-info-panel') && !e.target.closest('.operator-name-cell')) closeOperatorInfoPanel();
        if (e.target.closest('[data-suggestion-day]')) handleSuggestionClick(e);
    });

    document.getElementById('print-extra-hours-btn').addEventListener('click', () => {
        document.body.classList.add('printing-modal');
        window.print();
        setTimeout(() => document.body.classList.remove('printing-modal'), 100);
    });
    window.addEventListener('afterprint', () => {
        document.body.classList.remove('printing-modal');
    });

    document.getElementById('confirm-swap-btn').addEventListener('click', confirmSwap);
    document.getElementById('cancel-swap-btn').addEventListener('click', cancelSwap);
    document.getElementById('operator-info-close-btn').addEventListener('click', closeOperatorInfoPanel);

    document.addEventListener('mousemove', handleSelectionMove);
    document.addEventListener('mouseup', handleSelectionEnd);
    document.addEventListener('keydown', handleUndoRedo);
    
    document.getElementById('save-multi-select-action').addEventListener('click', saveMultiSelectAction);
    
    const viewPresetsContainer = document.getElementById('view-presets');
    if (viewPresetsContainer) {
        viewPresetsContainer.addEventListener('click', (e) => {
            const presetBtn = e.target.closest('button[data-preset]');
            if (!presetBtn) return;
            const presetName = presetBtn.dataset.preset;
            const presetConfig = viewPresets[presetName];
            if (presetConfig) {
                Object.assign(appState, presetConfig);
                syncUiWithState();
                renderPlanner();
            }
        });
    }
    
    document.getElementById('generate-report-btn').addEventListener('click', generateActiveReport);
    document.getElementById('print-report-btn').addEventListener('click', printReport);
    document.querySelectorAll('.report-tab-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.report-tab-link').forEach(l => l.classList.remove('active'));
            e.target.classList.add('active');
            generateActiveReport();
        });
    });
    
    const updateOnlineBtn = document.getElementById('update-online-sheet-btn');
    if (updateOnlineBtn) {
        updateOnlineBtn.addEventListener('click', aggiornaFileOnline);
    }
    
    // Inizializza l'interfaccia dei log di cambi all'avvio per registrare gli event listeners
    initializeChangeLogsInterface();
}

function setupSettingsEventListeners() {
    // Pannello Gestione Dati
    document.getElementById('import-gsheet-btn').addEventListener('click', importaDaGoogleSheet);
    document.getElementById('export-xlsx-schedule-btn').addEventListener('click', exportaGrigliaXlsx);
    document.getElementById('import-file-schedule-btn').addEventListener('click', () => document.getElementById('import-file-schedule-input').click());
    document.getElementById('import-file-schedule-input').addEventListener('change', handleFileImport);
    document.getElementById('export-html-share-btn').addEventListener('click', exportShareableHtml);

    document.getElementById('btn-save-full-state').addEventListener('click', saveFullState);
    document.getElementById('btn-load-full-state').addEventListener('click', () => document.getElementById('input-load-full-state').click());
    document.getElementById('input-load-full-state').addEventListener('change', loadFullState);
    
    // Pannello Configurazione
    document.getElementById('coverage-controls').addEventListener('change', e => {
        const input = e.target.closest('input[data-key]');
        if (input) {
            appState.coverageOptimal[input.dataset.key] = parseInt(input.value, 10);
            renderPlanner();
        }
    });
    document.getElementById('validation-rules-container').addEventListener('change', e => {
        const input = e.target.closest('input');
        if(input && appState.validationRules.hasOwnProperty(input.id.replace('rule-', ''))) {
            appState.validationRules[input.id.replace('rule-', '')] = parseInt(input.value, 10);
            validatePlanner(getActiveOperators(appState.currentDate.getFullYear(), appState.currentDate.getMonth()).map(op => op.id));
            renderPlanner();
        }
    });

    // Pannello Aspetto e Stile
    document.getElementById('toggle-color-picker').addEventListener('change', (e) => {
        appState.appearance.toggleColor = e.target.value;
        applyAppearance();
    });
    document.getElementById('work-cell-bg-color-picker').addEventListener('change', (e) => {
        appState.appearance.workCellBgColor = e.target.value;
        appState.appearance.workCellTextColor = getContrastingTextColor(e.target.value);
        applyAppearance();
    });
    
    document.getElementById('highlight-color-picker').addEventListener('change', (e) => {
        appState.appearance.highlightBgColor = e.target.value;
        applyAppearance();
    });
    
    document.getElementById('sunday-bars-toggle').addEventListener('change', (e) => {
        appState.appearance.showSundayBars = e.target.checked;
        applyAppearance();
        saveAppState();
    });
    document.getElementById('clear-changes-btn').addEventListener('click', () => openModal('modal-clear-changes'));
    document.getElementById('confirm-clear-changes-btn').addEventListener('click', clearAllChangesForPeriod);

    document.getElementById('theme-btn-dark').addEventListener('click', () => applyTheme('dark'));
    document.getElementById('theme-btn-contrast').addEventListener('click', () => applyTheme('contrast'));

    // Pannello Elementi di Base (Master-Detail)
    const elementsPanel = document.getElementById('settings-panel-elements');
    elementsPanel.addEventListener('click', handleSettingsMasterDetailClick);
    elementsPanel.addEventListener('input', handleSettingsMasterDetailInput);
    document.getElementById('elements-search-input').addEventListener('input', () => renderMasterList());
    
    // Form Indisponibilità
    document.getElementById('form-unavailability').addEventListener('submit', saveUnavailability);
    document.getElementById('unavailability-list').addEventListener('click', (e) => {
        if (e.target.closest('[data-action="delete-unavailability"]')) {
            const id = e.target.closest('[data-id]').dataset.id;
            deleteUnavailability(id);
        }
    });

    // Modale Suggerimenti
    document.getElementById('suggestion-list').addEventListener('click', (e) => {
        const button = e.target.closest('button[data-action="apply-suggestion"]');
        if (button) {
            const suggestionIndex = parseInt(button.dataset.suggestionIndex, 10);
            if (!isNaN(suggestionIndex) && currentSuggestions[suggestionIndex]) {
                confirmAndApplySuggestion(currentSuggestions[suggestionIndex]);
            }
        }
    });

    // Pannello Scambi Matrici
    document.getElementById('form-scambio-matrice').addEventListener('submit', (e) => {
        e.preventDefault();
        const opA = parseInt(document.getElementById('scambio-operatore-a').value);
        const opB = parseInt(document.getElementById('scambio-operatore-b').value);

        if (opA === opB) {
            showToast("Gli operatori devono essere diversi.", "error");
            return;
        }

        const id = document.getElementById('scambio-id').value;
        const newSwap = {
            id: id ? parseInt(id) : Date.now(),
            operatoreA_Id: opA,
            operatoreB_Id: opB,
            dataInizio: document.getElementById('scambio-start-date').value,
            dataFine: document.getElementById('scambio-end-date').value,
            note: document.getElementById('scambio-note').value
        };

        if (id) { // Modifica
            const index = appState.matriceSwaps.findIndex(s => s.id == id);
            appState.matriceSwaps[index] = newSwap;
        } else { // Aggiunta
            if (!appState.matriceSwaps) appState.matriceSwaps = [];
            appState.matriceSwaps.push(newSwap);
        }
        
        renderScambiList();
        resetScambioForm();
        renderPlanner();
        showToast('Regola di scambio salvata.', 'success');
    });

    document.getElementById('btn-cancel-scambio-edit').addEventListener('click', resetScambioForm);
    document.getElementById('settings-panel-scambi').addEventListener('click', handleScambiPanelClick);

    // Pannello e Modale Schemi di Ordinamento
    document.getElementById('confirm-order-change').addEventListener('click', function() {
            saveOrderChange();
        });
    document.getElementById('cancel-order-change').addEventListener('click', () => closeModal('modal-order-change'));

    const ordinamentiPanel = document.getElementById('settings-panel-ordinamenti');
    if (ordinamentiPanel) {
        ordinamentiPanel.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('button[data-action="delete-ordering-scheme"]');
            if (deleteBtn) {
                const schemeId = parseInt(deleteBtn.dataset.id);
                appState.orderingSchemes = appState.orderingSchemes.filter(s => s.id !== schemeId);
                renderOrderingSchemesList();
                renderPlanner();
                showToast("Schema di ordinamento eliminato.", "success");
            }
        });
    }
}

    function setupDragAndDrop(container) {
        let draggedRow = null;

        container.addEventListener('dragstart', (e) => {
            const target = e.target.closest('.draggable-row');
            if (!target) {
                e.preventDefault();
                return;
            }
            draggedRow = target;
            setTimeout(() => {
                draggedRow.classList.add('dragging');
            }, 0);
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', target.dataset.opId);
        });

        container.addEventListener('dragend', () => {
            if (draggedRow) {
                draggedRow.classList.remove('dragging');
                draggedRow = null;
            }
            document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        });

        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            const targetRow = e.target.closest('.draggable-row');
            if (targetRow && targetRow !== draggedRow) {
                document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
                targetRow.classList.add('drag-over');
            }
        });

        container.addEventListener('dragleave', e => {
            const targetRow = e.target.closest('.draggable-row');
            if (targetRow) {
                targetRow.classList.remove('drag-over');
            }
        });
let currentOrderChange = {
    draggedOpId: null,
    targetOpId: null,
};

function saveOrderChange() {
    const { draggedOpId, targetOpId } = currentOrderChange;
    const changeType = document.querySelector('input[name="order-change-type"]:checked').value;
    const startDate = document.getElementById('order-change-start-date').value; // YYYY-MM
    const name = document.getElementById('order-change-name').value;

    if (!name || !startDate) {
        showToast("Nome dello schema e data di inizio sono obbligatori.", "error");
        return;
    }

    // Calcola l'ordine corrente prima della modifica
    const currentScheme = getEffectiveOrderingScheme(new Date(startDate + '-01'));
    let currentOrderIds;
    if (currentScheme) {
        currentOrderIds = [...currentScheme.order];
    } else {
        currentOrderIds = getActiveOperators(appState.currentDate.getFullYear(), appState.currentDate.getMonth())
            .sort((a, b) => a.ordine - b.ordine)
            .map(op => op.id);
    }

    // Esegui lo spostamento nell'array
    const draggedIndex = currentOrderIds.indexOf(draggedOpId);
    const targetIndex = currentOrderIds.indexOf(targetOpId);

    if (draggedIndex === -1 || targetIndex === -1) {
        showToast("Errore nel calcolo dell'ordine. Operazione annullata.", "error");
        return;
    }

    const [draggedItem] = currentOrderIds.splice(draggedIndex, 1);
    currentOrderIds.splice(targetIndex, 0, draggedItem);
    
    // Crea la mappa degli scambi di turno
    let scheduleMap = {};
    if (changeType === 'swap_schedule') {
        const draggedOpOriginal = appState.operatori.find(op => op.id === draggedOpId);
        const targetOpOriginal = appState.operatori.find(op => op.id === targetOpId);
        scheduleMap[draggedOpId] = targetOpOriginal.id;
        scheduleMap[targetOpId] = draggedOpOriginal.id;
    }

    const newScheme = {
        id: Date.now(),
        name: name,
        startDate: startDate, // Salva solo YYYY-MM
        order: currentOrderIds,
        scheduleMap: scheduleMap,
    };

    appState.orderingSchemes.push(newScheme);
    showToast(`Nuovo schema di ordinamento "${name}" creato.`, "success");
    closeModal('modal-order-change');
    renderPlanner();
    renderOrderingSchemesList(); // Aggiorna la lista nelle impostazioni
}



function openOrderChangeModal(draggedOpId, targetOpId) {
    currentOrderChange = { draggedOpId, targetOpId };
    
    const draggedOp = appState.operatori.find(op => op.id === draggedOpId);
    const targetOp = appState.operatori.find(op => op.id === targetOpId);

    document.getElementById('order-change-summary').innerHTML = `Stai spostando <strong>${draggedOp.cognome}</strong> nella posizione di <strong>${targetOp.cognome}</strong>.`;
    
    const nextMonth = new Date(appState.currentDate);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const year = nextMonth.getFullYear();
    const month = String(nextMonth.getMonth() + 1).padStart(2, '0');
    
    document.getElementById('order-change-start-date').value = `${year}-${month}`;
    document.getElementById('order-change-name').value = `Rotazione ${nextMonth.toLocaleString('it-IT', { month: 'long' })} ${year}`;
    document.querySelector('input[name="order-change-type"][value="swap_schedule"]').checked = true;

    openModal('modal-order-change');
}

        container.addEventListener('drop', (e) => {
            e.preventDefault();
            const targetRow = e.target.closest('.draggable-row');
            if (targetRow) {
                targetRow.classList.remove('drag-over');
            }

            if (!targetRow || !draggedRow || targetRow === draggedRow) {
                return;
            }

            const draggedOpId = parseInt(e.dataTransfer.getData('text/plain'), 10);
            const targetOpId = parseInt(targetRow.dataset.opId, 10);

            // Apri il modal per la scelta del tipo di ordinamento
            openOrderChangeModal(draggedOpId, targetOpId);
        });
    }

    // =================================================================================
    // HANDLER E FUNZIONI DI INTERAZIONE UI
    // =================================================================================

    function handlePlannerBodyClick(e) {
        const cell = e.target.closest('.planner-cell');
        const operatorNameCell = e.target.closest('.operator-name-cell');
        const focusBtn = e.target.closest('[data-action="focus-operator"]');
        const dayHeaderCell = e.target.closest('[data-day-col]');
        const modIndicator = e.target.closest('.mod-indicator, .extra-indicator');

        // Gestione click su indicatori di modifica
        if (modIndicator && cell) {
            const opId = parseInt(cell.dataset.opId, 10);
            const day = parseInt(cell.dataset.day, 10);
            openMiniMenu(e, opId, day);
            return;
        }

        // Gestione click su intestazione giorno
        if (dayHeaderCell) {
            const day = parseInt(dayHeaderCell.dataset.dayCol, 10);
            toggleDayColumnHighlight(day);
            return;
        }

        if (focusBtn) {
            const opId = parseInt(focusBtn.dataset.opId, 10);
            toggleFocusMode(opId);
            return;
        }

        if (operatorNameCell && !e.target.closest('.operator-toggle-wrapper')) {
            const opId = parseInt(operatorNameCell.dataset.opId, 10);
            openOperatorInfoPanel(opId);
            return;
        }
        
        if (selectionState.isActive || (e.target.tagName === 'SELECT')) return;
        if (!cell || cell.classList.contains('cell-unavailability')) return;
        
        clearTimeout(clickTimer);

        const opId = parseInt(cell.dataset.opId, 10);
        const day = parseInt(cell.dataset.day, 10);

        if (appState.isAssignmentMode) {
            if (!cell.classList.contains('non-operative-cell')) {
                openAssignmentPalette(e, opId, day);
            }
        } else if (swapState.isActive && swapState.step === 1) {
            if (swapState.firstCell.opId === opId && swapState.firstCell.day === day) return;
            swapState.secondCell = { opId, day, element: cell };
            cell.classList.add('swap-selection-active');
            openSwapModal();
        } else if (opId && day) {
            clickTimer = setTimeout(() => {
                selectCrosshair(opId, day);
                openMiniMenu(e, opId, day);
            }, 200);
        }
    }

    function handlePlannerBodyChange(e) {
        if (e.target.classList.contains('operator-toggle')) handleOperatorToggle(e);
    }

    function handlePlannerBodyMouseover(e) {
        const indicator = e.target.closest('.mod-indicator, .extra-indicator, .note-indicator, .violation-indicator');
        if (indicator) showModTooltip(indicator);
    }

    function handlePlannerBodyMouseout(e) {
        const indicator = e.target.closest('.mod-indicator, .extra-indicator, .note-indicator, .violation-indicator');
        if (indicator) hideModTooltip();
    }

    // =================================================================================
    // GESTIONE MODAL MODIFICA NOTIFICHE
    // =================================================================================
    
    function removeNotificationData(opId, day, modType) {
        let cellData = getCellData(opId, day);
        if (!cellData) return;
        
        // Rimuovi i dati basati sul tipo di modifica
        switch(modType) {
            case 'C':
                delete cellData.cambio;
                break;
            case 'S':
                delete cellData.scambio;
                break;
            case 'G':
                delete cellData.gettone;
                break;
            case '+':
                delete cellData.extra;
                break;
        }
        
        // Salva i dati aggiornati della cella
        setCellData(opId, day, cellData);
    }

    // =================================================================================
    // GESTIONE RIGHE GIORNALIERE E RIEPILOGHI
    // =================================================================================



    function toggleDayColumnHighlight(day) {
        const plannerTable = document.getElementById('planner-table');
        const isHighlighted = plannerTable.classList.contains(`day-${day}-highlighted`);
        
        // Rimuovi tutte le evidenziazioni precedenti
        for (let i = 1; i <= 31; i++) {
            plannerTable.classList.remove(`day-${i}-highlighted`);
        }
        
        if (!isHighlighted) {
            plannerTable.classList.add(`day-${day}-highlighted`);
            showToast(`Colonna del giorno ${day} evidenziata`, 'info');
        } else {
            showToast('Evidenziazione rimossa', 'info');
        }
    }







    // =================================================================================
    // SISTEMA AVANZATO PER MODIFICARE ATTIVITÀ ESISTENTI
    // =================================================================================

    // Stato per il drag and drop
    let dragState = {
        isActive: false,
        sourceOperatorId: null,
        sourceDay: null,
        draggedData: null,
        dragElement: null
    };

    function initializeDragAndDrop() {
        // Questa funzione verrà chiamata dopo il rendering del planner
        // per inizializzare gli eventi di drag and drop
        const plannerCells = document.querySelectorAll('.planner-cell');
        
        plannerCells.forEach(cell => {
            // Aggiungi attributi draggable alle celle con contenuto
            const cellData = getCellData(cell);
            if (cellData && (cellData.turno || cellData.nota || cellData.assignmentId)) {
                cell.setAttribute('draggable', 'true');
                cell.classList.add('draggable-cell');
            }
            
            // Event listeners per drag and drop
            cell.addEventListener('dragstart', handleDragStart);
            cell.addEventListener('dragover', handleDragOver);
            cell.addEventListener('dragenter', handleDragEnter);
            cell.addEventListener('dragleave', handleDragLeave);
            cell.addEventListener('drop', handleDrop);
            cell.addEventListener('dragend', handleDragEnd);
            
            // Event listeners per touch mobile
            if (isMobileDevice()) {
                let touchStartTime = 0;
                let longPressTimer = null;
                
                cell.addEventListener('touchstart', (e) => {
                    touchStartTime = Date.now();
                    longPressTimer = setTimeout(() => {
                        handleMobileTurnMerge(cell);
                    }, 800);
                }, { passive: true });
                
                cell.addEventListener('touchend', (e) => {
                    if (longPressTimer) {
                        clearTimeout(longPressTimer);
                    }
                    
                    const touchDuration = Date.now() - touchStartTime;
                    if (touchDuration < 800) {
                        // Tap normale - comportamento standard
                        e.preventDefault();
                        cell.click();
                    }
                }, { passive: false });
                
                cell.addEventListener('touchmove', () => {
                    if (longPressTimer) {
                        clearTimeout(longPressTimer);
                    }
                }, { passive: true });
            }
        });
    }

    function getCellData(cell) {
        if (!cell || !cell.dataset) return null;
        
        const operatorId = cell.dataset.opId;
        const day = cell.dataset.day;
        
        if (!operatorId || !day) return null;
        
        const year = appState.currentDate.getFullYear();
        const month = appState.currentDate.getMonth();
        const monthKey = getMonthKey(appState.currentDate);
        const shifts = appState.plannerData[monthKey] || {};
        
        return shifts[`${operatorId}-${day}`] || null;
    }

    function handleDragStart(event) {
        const cell = event.target.closest('.planner-cell');
        if (!cell) return;
        
        const operatorId = cell.dataset.operatorId;
        const day = cell.dataset.day;
        const cellData = getCellData(cell);
        
        if (!cellData || (!cellData.turno && !cellData.nota && !cellData.assignmentId)) {
            event.preventDefault();
            return;
        }
        
        dragState.isActive = true;
        dragState.sourceOperatorId = operatorId;
        dragState.sourceDay = day;
        dragState.draggedData = { ...cellData };
        dragState.dragElement = cell;
        
        // Stile visivo per il drag
        cell.classList.add('dragging');
        cell.style.opacity = '0.5';
        
        // Imposta i dati del trasferimento
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', JSON.stringify({
            operatorId,
            day,
            data: cellData
        }));
        
        showToast('Trascina per spostare l\'attività', 'info');
    }

    function handleDragOver(event) {
        if (!dragState.isActive) return;
        
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }

    function handleDragEnter(event) {
        if (!dragState.isActive) return;
        
        const cell = event.target.closest('.planner-cell');
        if (cell && cell !== dragState.dragElement) {
            cell.classList.add('drag-over');
        }
    }

    function handleDragLeave(event) {
        if (!dragState.isActive) return;
        
        const cell = event.target.closest('.planner-cell');
        if (cell) {
            cell.classList.remove('drag-over');
        }
    }

    function handleDrop(event) {
        if (!dragState.isActive) return;
        
        event.preventDefault();
        
        const targetCell = event.target.closest('.planner-cell');
        if (!targetCell || targetCell === dragState.dragElement) {
            return;
        }
        
        const targetOperatorId = targetCell.dataset.operatorId;
        const targetDay = targetCell.dataset.day;
        
        if (!targetOperatorId || !targetDay) return;
        
        // Verifica se la cella di destinazione ha già dei dati
        const targetData = getCellData(targetCell);
        const hasTargetData = targetData && (targetData.turno || targetData.nota || targetData.assignmentId);
        
        if (hasTargetData) {
            // Chiedi conferma per sovrascrivere
            const operator = appState.operatori.find(op => op.id == targetOperatorId);
            const confirmMessage = `La cella di destinazione (${operator.cognome} - Giorno ${targetDay}) contiene già dei dati. Vuoi sostituirli?`;
            
            if (!confirm(confirmMessage)) {
                return;
            }
        }
        
        // Esegui lo spostamento
        moveActivityData(dragState.sourceOperatorId, dragState.sourceDay, targetOperatorId, targetDay, dragState.draggedData);
        
        targetCell.classList.remove('drag-over');
        showToast('Attività spostata con successo', 'success');
    }

    function handleDragEnd(event) {
        if (!dragState.isActive) return;
        
        // Ripristina lo stile dell'elemento trascinato
        if (dragState.dragElement) {
            dragState.dragElement.classList.remove('dragging');
            dragState.dragElement.style.opacity = '';
        }
        
        // Rimuovi le classi di drag-over da tutte le celle
        document.querySelectorAll('.drag-over').forEach(cell => {
            cell.classList.remove('drag-over');
        });
        
        // Reset dello stato
        dragState = {
            isActive: false,
            sourceOperatorId: null,
            sourceDay: null,
            draggedData: null,
            dragElement: null
        };
    }

    function moveActivityData(sourceOperatorId, sourceDay, targetOperatorId, targetDay, data) {
        const year = appState.currentDate.getFullYear();
        const month = appState.currentDate.getMonth();
        const monthKey = getMonthKey(appState.currentDate);
        
        if (!appState.plannerData[monthKey]) {
            appState.plannerData[monthKey] = {};
        }
        
        const sourceKey = `${sourceOperatorId}-${sourceDay}`;
        const targetKey = `${targetOperatorId}-${targetDay}`;
        
        // Copia i dati nella destinazione
        appState.plannerData[monthKey][targetKey] = {
            ...data,
            lastModified: new Date().toISOString(),
            isModified: true
        };
        
        // Rimuovi i dati dalla sorgente
        delete appState.plannerData[monthKey][sourceKey];
        
        // Aggiorna il planner
        renderPlanner();
        
        // Reinizializza il drag and drop
        setTimeout(() => {
            initializeDragAndDrop();
        }, 100);
    }

    function openQuickEditMenu(operatorId, day, event) {
        event.preventDefault();
        event.stopPropagation();
        
        const cellData = getCellData(event.target.closest('.planner-cell'));
        const operator = appState.operatori.find(op => op.id == operatorId);
        
        // Rimuovi menu esistenti
        document.querySelectorAll('.quick-edit-menu').forEach(menu => menu.remove());
        
        const menuHtml = `
            <div class="quick-edit-menu fixed bg-white border border-gray-300 rounded-lg shadow-lg p-2 z-50" style="left: ${event.pageX}px; top: ${event.pageY}px;">
                <div class="text-xs font-semibold text-gray-700 mb-2 border-b pb-1">${operator.cognome} - Giorno ${day}</div>
                <button onclick="editOperatorDayData(${operatorId}, ${day}); closeQuickEditMenu()" class="block w-full text-left px-2 py-1 text-xs hover:bg-blue-50 rounded">✏️ Modifica Completa</button>
                <button onclick="quickChangeShift(${operatorId}, ${day}); closeQuickEditMenu()" class="block w-full text-left px-2 py-1 text-xs hover:bg-green-50 rounded">🔄 Cambia Turno</button>
                <button onclick="quickToggleNote(${operatorId}, ${day}); closeQuickEditMenu()" class="block w-full text-left px-2 py-1 text-xs hover:bg-yellow-50 rounded">📝 ${cellData?.nota ? 'Modifica' : 'Aggiungi'} Nota</button>
                <button onclick="quickClearCell(${operatorId}, ${day}); closeQuickEditMenu()" class="block w-full text-left px-2 py-1 text-xs hover:bg-red-50 rounded text-red-600">🗑️ Cancella Tutto</button>
                <div class="border-t mt-1 pt-1">
                    <button onclick="closeQuickEditMenu()" class="block w-full text-left px-2 py-1 text-xs hover:bg-gray-50 rounded text-gray-500">Chiudi</button>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', menuHtml);
        
        // Chiudi il menu cliccando altrove
        setTimeout(() => {
            document.addEventListener('click', closeQuickEditMenu, { once: true });
        }, 10);
    }

    function closeQuickEditMenu() {
        document.querySelectorAll('.quick-edit-menu').forEach(menu => menu.remove());
    }

    function quickChangeShift(operatorId, day) {
        const year = appState.currentDate.getFullYear();
        const month = appState.currentDate.getMonth();
        const monthKey = getMonthKey(appState.currentDate);
        const shifts = appState.plannerData[monthKey] || {};
        const currentData = shifts[`${operatorId}-${day}`] || { turno: '', nota: '' };
        
        const shiftsOptions = ['', ...appState.turni.map(t => t.sigla)];
        const currentIndex = shiftsOptions.indexOf(currentData.turno);
        const nextIndex = (currentIndex + 1) % shiftsOptions.length;
        const newShift = shiftsOptions[nextIndex];
        
        if (!appState.plannerData[monthKey]) {
            appState.plannerData[monthKey] = {};
        }
        
        const key = `${operatorId}-${day}`;
        if (!appState.plannerData[monthKey][key]) {
            appState.plannerData[monthKey][key] = { turno: '', nota: '' };
        }
        
        appState.plannerData[monthKey][key].turno = newShift;
        appState.plannerData[monthKey][key].lastModified = new Date().toISOString();
        appState.plannerData[monthKey][key].isModified = true;
        
        renderPlanner();
        setTimeout(() => initializeDragAndDrop(), 100);
        
        const operator = appState.operatori.find(op => op.id == operatorId);
        showToast(`Turno cambiato per ${operator.cognome}: ${newShift || 'Nessun turno'}`, 'success');
    }

    function quickToggleNote(operatorId, day) {
        const year = appState.currentDate.getFullYear();
        const month = appState.currentDate.getMonth();
        const monthKey = getMonthKey(appState.currentDate);
        const shifts = appState.plannerData[monthKey] || {};
        const currentData = shifts[`${operatorId}-${day}`] || { turno: '', nota: '' };
        const operator = appState.operatori.find(op => op.id == operatorId);
        
        const newNote = prompt(`Nota per ${operator.cognome} (giorno ${day}):`, currentData.nota || '');
        
        if (newNote !== null) {
            if (!appState.plannerData[monthKey]) {
                appState.plannerData[monthKey] = {};
            }
            
            const key = `${operatorId}-${day}`;
            if (!appState.plannerData[monthKey][key]) {
                appState.plannerData[monthKey][key] = { turno: '', nota: '' };
            }
            
            appState.plannerData[monthKey][key].nota = newNote.trim();
            appState.plannerData[monthKey][key].lastModified = new Date().toISOString();
            appState.plannerData[monthKey][key].isModified = true;
            
            renderPlanner();
            setTimeout(() => initializeDragAndDrop(), 100);
            
            showToast(`Nota ${newNote.trim() ? 'aggiornata' : 'rimossa'} per ${operator.cognome}`, 'success');
        }
    }

    function quickClearCell(operatorId, day) {
        const operator = appState.operatori.find(op => op.id == operatorId);
        
        if (confirm(`Sei sicuro di voler cancellare tutti i dati per ${operator.cognome} nel giorno ${day}?`)) {
            const year = appState.currentDate.getFullYear();
            const month = appState.currentDate.getMonth();
            const monthKey = getMonthKey(appState.currentDate);
            const key = `${operatorId}-${day}`;
            
            if (appState.plannerData[monthKey] && appState.plannerData[monthKey][key]) {
                delete appState.plannerData[monthKey][key];
            }
            
            renderPlanner();
            setTimeout(() => initializeDragAndDrop(), 100);
            
            showToast(`Dati cancellati per ${operator.cognome}`, 'success');
        }
    }

    // =================================================================================
    // SISTEMA DI ORGANIZZAZIONE E RIORDINAMENTO ATTIVITÀ
    // =================================================================================

    // Stato per filtri e ordinamenti
    let organizationState = {
        activeFilters: {
            shifts: [],
            operators: [],
            days: [],
            hasNotes: false,
            hasAssignments: false,
            hasExtraHours: false
        },
        sortBy: 'default', // default, alphabetical, workload, violations
        sortDirection: 'asc',
        viewMode: 'standard', // standard, compact, detailed, matrix
        highlightMode: 'none' // none, conflicts, violations, workload
    };

    function openOrganizationPanel() {
        const modalHtml = `
            <div id="modal-organization" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div class="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-90vh overflow-hidden">
                    <div class="flex items-center justify-between p-4 border-b">
                        <h3 class="text-lg font-semibold text-gray-900">Organizzazione e Filtri Planner</h3>
                        <button onclick="closeOrganizationPanel()" class="text-gray-400 hover:text-gray-600">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>
                    
                    <div class="p-6 overflow-y-auto max-h-80vh">
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            
                            <!-- Filtri per Turni -->
                            <div class="space-y-3">
                                <h4 class="font-medium text-gray-900 border-b pb-2">Filtri Turni</h4>
                                <div class="space-y-2 max-h-40 overflow-y-auto">
                                    ${appState.turni.map(turno => `
                                        <label class="flex items-center space-x-2 text-sm">
                                            <input type="checkbox" class="filter-shift" value="${turno.sigla}" 
                                                   ${organizationState.activeFilters.shifts.includes(turno.sigla) ? 'checked' : ''}>
                                            <span class="px-2 py-1 rounded text-xs" style="background-color: ${turno.colore}; color: ${getContrastingTextColor(turno.colore)}">
                                                ${turno.sigla}
                                            </span>
                                            <span>${turno.nome}</span>
                                        </label>
                                    `).join('')}
                                </div>
                                <button onclick="toggleAllShiftFilters()" class="text-xs text-blue-600 hover:text-blue-800">Seleziona/Deseleziona Tutti</button>
                            </div>
                            
                            <!-- Filtri per Operatori -->
                            <div class="space-y-3">
                                <h4 class="font-medium text-gray-900 border-b pb-2">Filtri Operatori</h4>
                                <div class="space-y-2 max-h-40 overflow-y-auto">
                                    ${appState.operatori.map(op => `
                                        <label class="flex items-center space-x-2 text-sm">
                                            <input type="checkbox" class="filter-operator" value="${op.id}" 
                                                   ${organizationState.activeFilters.operators.includes(op.id.toString()) ? 'checked' : ''}>
                                            <span>${op.cognome} ${op.nome}</span>
                                        </label>
                                    `).join('')}
                                </div>
                                <button onclick="toggleAllOperatorFilters()" class="text-xs text-blue-600 hover:text-blue-800">Seleziona/Deseleziona Tutti</button>
                            </div>
                            
                            <!-- Filtri Speciali -->
                            <div class="space-y-3">
                                <h4 class="font-medium text-gray-900 border-b pb-2">Filtri Speciali</h4>
                                <div class="space-y-2">
                                    <label class="flex items-center space-x-2 text-sm">
                                        <input type="checkbox" class="filter-special" value="hasNotes" 
                                               ${organizationState.activeFilters.hasNotes ? 'checked' : ''}>
                                        <span>📝 Con Note</span>
                                    </label>
                                    <label class="flex items-center space-x-2 text-sm">
                                        <input type="checkbox" class="filter-special" value="hasAssignments" 
                                               ${organizationState.activeFilters.hasAssignments ? 'checked' : ''}>
                                        <span>📋 Con Incarichi</span>
                                    </label>
                                    <label class="flex items-center space-x-2 text-sm">
                                        <input type="checkbox" class="filter-special" value="hasExtraHours" 
                                               ${organizationState.activeFilters.hasExtraHours ? 'checked' : ''}>
                                        <span>⏰ Con Ore Extra</span>
                                    </label>
                                </div>
                            </div>
                            
                            <!-- Ordinamento -->
                            <div class="space-y-3">
                                <h4 class="font-medium text-gray-900 border-b pb-2">Ordinamento</h4>
                                <div class="space-y-2">
                                    <select id="sort-by" class="w-full p-2 border rounded text-sm">
                                        <option value="default" ${organizationState.sortBy === 'default' ? 'selected' : ''}>Ordine Predefinito</option>
                                        <option value="alphabetical" ${organizationState.sortBy === 'alphabetical' ? 'selected' : ''}>Alfabetico</option>
                                        <option value="workload" ${organizationState.sortBy === 'workload' ? 'selected' : ''}>Carico di Lavoro</option>
                                        <option value="violations" ${organizationState.sortBy === 'violations' ? 'selected' : ''}>Violazioni</option>
                                    </select>
                                    <select id="sort-direction" class="w-full p-2 border rounded text-sm">
                                        <option value="asc" ${organizationState.sortDirection === 'asc' ? 'selected' : ''}>Crescente</option>
                                        <option value="desc" ${organizationState.sortDirection === 'desc' ? 'selected' : ''}>Decrescente</option>
                                    </select>
                                </div>
                            </div>
                            
                            <!-- Modalità Visualizzazione -->
                            <div class="space-y-3">
                                <h4 class="font-medium text-gray-900 border-b pb-2">Modalità Vista</h4>
                                <div class="space-y-2">
                                    <label class="flex items-center space-x-2 text-sm">
                                        <input type="radio" name="viewMode" value="standard" 
                                               ${organizationState.viewMode === 'standard' ? 'checked' : ''}>
                                        <span>📋 Standard</span>
                                    </label>
                                    <label class="flex items-center space-x-2 text-sm">
                                        <input type="radio" name="viewMode" value="compact" 
                                               ${organizationState.viewMode === 'compact' ? 'checked' : ''}>
                                        <span>📦 Compatta</span>
                                    </label>
                                    <label class="flex items-center space-x-2 text-sm">
                                        <input type="radio" name="viewMode" value="detailed" 
                                               ${organizationState.viewMode === 'detailed' ? 'checked' : ''}>
                                        <span>📊 Dettagliata</span>
                                    </label>
                                </div>
                            </div>
                            
                            <!-- Evidenziazione -->
                            <div class="space-y-3">
                                <h4 class="font-medium text-gray-900 border-b pb-2">Evidenziazione</h4>
                                <div class="space-y-2">
                                    <label class="flex items-center space-x-2 text-sm">
                                        <input type="radio" name="highlightMode" value="none" 
                                               ${organizationState.highlightMode === 'none' ? 'checked' : ''}>
                                        <span>Nessuna</span>
                                    </label>
                                    <label class="flex items-center space-x-2 text-sm">
                                        <input type="radio" name="highlightMode" value="conflicts" 
                                               ${organizationState.highlightMode === 'conflicts' ? 'checked' : ''}>
                                        <span>⚠️ Conflitti</span>
                                    </label>
                                    <label class="flex items-center space-x-2 text-sm">
                                        <input type="radio" name="highlightMode" value="violations" 
                                               ${organizationState.highlightMode === 'violations' ? 'checked' : ''}>
                                        <span>🚫 Violazioni</span>
                                    </label>
                                    <label class="flex items-center space-x-2 text-sm">
                                        <input type="radio" name="highlightMode" value="workload" 
                                               ${organizationState.highlightMode === 'workload' ? 'checked' : ''}>
                                        <span>📈 Carico Lavoro</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Azioni Rapide -->
                        <div class="mt-6 pt-4 border-t">
                            <h4 class="font-medium text-gray-900 mb-3">Azioni Rapide</h4>
                            <div class="flex flex-wrap gap-2">
                                <button onclick="resetAllFilters()" class="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600">Reset Filtri</button>
                                <button onclick="saveCurrentView()" class="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600">Salva Vista</button>
                                <button onclick="loadSavedView()" class="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600">Carica Vista</button>
                                <button onclick="exportFilteredData()" class="px-3 py-1 bg-purple-500 text-white rounded text-sm hover:bg-purple-600">Esporta Filtrati</button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex justify-end gap-3 p-4 border-t bg-gray-50">
                        <button onclick="closeOrganizationPanel()" class="px-4 py-2 text-gray-600 hover:text-gray-800">Annulla</button>
                        <button onclick="applyOrganizationSettings()" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Applica</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Aggiungi event listeners
        document.querySelectorAll('.filter-shift, .filter-operator, .filter-special').forEach(checkbox => {
            checkbox.addEventListener('change', updateFilterPreview);
        });
        
        document.querySelectorAll('input[name="viewMode"], input[name="highlightMode"]').forEach(radio => {
            radio.addEventListener('change', updateFilterPreview);
        });
        
        document.getElementById('sort-by').addEventListener('change', updateFilterPreview);
        document.getElementById('sort-direction').addEventListener('change', updateFilterPreview);
    }

    function closeOrganizationPanel() {
        const modal = document.getElementById('modal-organization');
        if (modal) {
            modal.remove();
        }
    }

    function updateFilterPreview() {
        // Aggiorna l'anteprima dei filtri in tempo reale
        // Questa funzione può essere implementata per mostrare un'anteprima
        console.log('Aggiornamento anteprima filtri...');
    }

    function toggleAllShiftFilters() {
        const checkboxes = document.querySelectorAll('.filter-shift');
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
        
        checkboxes.forEach(cb => {
            cb.checked = !allChecked;
        });
        
        updateFilterPreview();
    }

    function toggleAllOperatorFilters() {
        const checkboxes = document.querySelectorAll('.filter-operator');
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
        
        checkboxes.forEach(cb => {
            cb.checked = !allChecked;
        });
        
        updateFilterPreview();
    }

    function resetAllFilters() {
        organizationState.activeFilters = {
            shifts: [],
            operators: [],
            days: [],
            hasNotes: false,
            hasAssignments: false,
            hasExtraHours: false
        };
        organizationState.sortBy = 'default';
        organizationState.sortDirection = 'asc';
        organizationState.viewMode = 'standard';
        organizationState.highlightMode = 'none';
        
        // Aggiorna i controlli nel modal
        document.querySelectorAll('.filter-shift, .filter-operator, .filter-special').forEach(cb => cb.checked = false);
        document.getElementById('sort-by').value = 'default';
        document.getElementById('sort-direction').value = 'asc';
        document.querySelector('input[name="viewMode"][value="standard"]').checked = true;
        document.querySelector('input[name="highlightMode"][value="none"]').checked = true;
        
        showToast('Filtri resettati', 'success');
    }

    function applyOrganizationSettings() {
        // Raccogli i filtri selezionati
        organizationState.activeFilters.shifts = Array.from(document.querySelectorAll('.filter-shift:checked')).map(cb => cb.value);
        organizationState.activeFilters.operators = Array.from(document.querySelectorAll('.filter-operator:checked')).map(cb => cb.value);
        
        const specialFilters = Array.from(document.querySelectorAll('.filter-special:checked')).map(cb => cb.value);
        organizationState.activeFilters.hasNotes = specialFilters.includes('hasNotes');
        organizationState.activeFilters.hasAssignments = specialFilters.includes('hasAssignments');
        organizationState.activeFilters.hasExtraHours = specialFilters.includes('hasExtraHours');
        
        organizationState.sortBy = document.getElementById('sort-by').value;
        organizationState.sortDirection = document.getElementById('sort-direction').value;
        organizationState.viewMode = document.querySelector('input[name="viewMode"]:checked').value;
        organizationState.highlightMode = document.querySelector('input[name="highlightMode"]:checked').value;
        
        // Applica le impostazioni
        applyFiltersAndSorting();
        applyViewMode();
        applyHighlightMode();
        
        closeOrganizationPanel();
        showToast('Impostazioni applicate con successo', 'success');
    }

    function applyFiltersAndSorting() {
        // Implementa la logica di filtro e ordinamento
        const plannerTable = document.getElementById('planner-table');
        const rows = plannerTable.querySelectorAll('tbody tr');
        
        rows.forEach(row => {
            const operatorId = row.dataset.opId;
            const shouldShow = shouldShowOperator(operatorId);
            row.style.display = shouldShow ? '' : 'none';
        });
        
        // Applica l'ordinamento se necessario
        if (organizationState.sortBy !== 'default') {
            sortOperatorRows();
        }
    }

    function shouldShowOperator(operatorId) {
        const filters = organizationState.activeFilters;
        
        // Filtro operatori
        if (filters.operators.length > 0 && !filters.operators.includes(operatorId)) {
            return false;
        }
        
        // Filtri speciali
        if (filters.hasNotes || filters.hasAssignments || filters.hasExtraHours || filters.shifts.length > 0) {
            const monthKey = getMonthKey(appState.currentDate);
            const operatorData = appState.plannerData[monthKey] || {};
            
            let hasMatchingData = false;
            
            for (let day = 1; day <= 31; day++) {
                const key = `${operatorId}-${day}`;
                const dayData = operatorData[key];
                
                if (dayData) {
                    // Controlla filtri turni
                    if (filters.shifts.length > 0 && dayData.turno && filters.shifts.includes(dayData.turno)) {
                        hasMatchingData = true;
                        break;
                    }
                    
                    // Controlla filtri speciali
                    if (filters.hasNotes && dayData.nota) {
                        hasMatchingData = true;
                        break;
                    }
                    
                    if (filters.hasAssignments && dayData.assignmentId) {
                        hasMatchingData = true;
                        break;
                    }
                    
                    if (filters.hasExtraHours && dayData.extraInfo && dayData.extraInfo.hours > 0) {
                        hasMatchingData = true;
                        break;
                    }
                }
            }
            
            return hasMatchingData;
        }
        
        return true;
    }

    function sortOperatorRows() {
        const tbody = document.querySelector('#planner-table tbody');
        const rows = Array.from(tbody.querySelectorAll('tr'));
        
        rows.sort((a, b) => {
            const aId = a.dataset.opId;
            const bId = b.dataset.opId;
            const aOperator = appState.operatori.find(op => op.id == aId);
            const bOperator = appState.operatori.find(op => op.id == bId);
            
            let comparison = 0;
            
            switch (organizationState.sortBy) {
                case 'alphabetical':
                    comparison = aOperator.cognome.localeCompare(bOperator.cognome);
                    break;
                case 'workload':
                    comparison = calculateWorkload(aId) - calculateWorkload(bId);
                    break;
                case 'violations':
                    comparison = calculateViolations(aId) - calculateViolations(bId);
                    break;
                default:
                    comparison = aOperator.order - bOperator.order;
            }
            
            return organizationState.sortDirection === 'desc' ? -comparison : comparison;
        });
        
        // Riordina le righe nel DOM
        rows.forEach(row => tbody.appendChild(row));
    }

    function calculateWorkload(operatorId) {
        const monthKey = getMonthKey(appState.currentDate);
        const operatorData = appState.plannerData[monthKey] || {};
        let totalHours = 0;
        
        for (let day = 1; day <= 31; day++) {
            const key = `${operatorId}-${day}`;
            const dayData = operatorData[key];
            
            if (dayData && dayData.turno) {
                const turno = getTurnoBySigla(dayData.turno);
                if (turno) {
                    totalHours += turno.ore || 0;
                }
                
                if (dayData.extraInfo && dayData.extraInfo.hours) {
                    totalHours += dayData.extraInfo.hours;
                }
            }
        }
        
        return totalHours;
    }

    function calculateViolations(operatorId) {
        // Implementa il calcolo delle violazioni per operatore
        // Questa è una versione semplificata
        return 0;
    }

    function applyViewMode() {
        const plannerTable = document.getElementById('planner-table');
        
        // Rimuovi classi di modalità precedenti
        plannerTable.classList.remove('view-standard', 'view-compact', 'view-detailed');
        
        // Aggiungi la nuova classe di modalità
        plannerTable.classList.add(`view-${organizationState.viewMode}`);
    }

    function applyHighlightMode() {
        const plannerTable = document.getElementById('planner-table');
        
        // Rimuovi classi di evidenziazione precedenti
        plannerTable.classList.remove('highlight-none', 'highlight-conflicts', 'highlight-violations', 'highlight-workload');
        
        // Aggiungi la nuova classe di evidenziazione
        plannerTable.classList.add(`highlight-${organizationState.highlightMode}`);
    }

    function saveCurrentView() {
        const viewData = {
            filters: { ...organizationState.activeFilters },
            sortBy: organizationState.sortBy,
            sortDirection: organizationState.sortDirection,
            viewMode: organizationState.viewMode,
            highlightMode: organizationState.highlightMode,
            timestamp: new Date().toISOString()
        };
        
        localStorage.setItem('plannerSavedView', JSON.stringify(viewData));
        showToast('Vista salvata con successo', 'success');
    }

    function loadSavedView() {
        const savedView = localStorage.getItem('plannerSavedView');
        
        if (savedView) {
            const viewData = JSON.parse(savedView);
            organizationState = { ...organizationState, ...viewData };
            
            applyFiltersAndSorting();
            applyViewMode();
            applyHighlightMode();
            
            showToast('Vista caricata con successo', 'success');
        } else {
            showToast('Nessuna vista salvata trovata', 'warning');
        }
    }

    function exportFilteredData() {
        const visibleRows = document.querySelectorAll('#planner-table tbody tr:not([style*="display: none"])');
        const csvData = [];
        
        // Header
        csvData.push(['Operatore', 'Giorno', 'Turno', 'Note', 'Incarico', 'Ore Extra']);
        
        visibleRows.forEach(row => {
            const operatorId = row.dataset.opId;
            const operator = appState.operatori.find(op => op.id == operatorId);
            const monthKey = getMonthKey(appState.currentDate);
            const operatorData = appState.plannerData[monthKey] || {};
            
            for (let day = 1; day <= 31; day++) {
                const key = `${operatorId}-${day}`;
                const dayData = operatorData[key];
                
                if (dayData && (dayData.turno || dayData.nota || dayData.assignmentId)) {
                    const assignment = dayData.assignmentId ? appState.incarichi.find(inc => inc.id == dayData.assignmentId) : null;
                    const extraHours = dayData.extraInfo ? dayData.extraInfo.hours || 0 : 0;
                    
                    csvData.push([
                        `${operator.cognome} ${operator.nome}`,
                        day,
                        dayData.turno || '',
                        dayData.nota || '',
                        assignment ? assignment.nome : '',
                        extraHours
                    ]);
                }
            }
        });
        
        const csvContent = csvData.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `planner_filtrato_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
        
        showToast('Dati filtrati esportati con successo', 'success');
    }

    async function handleOperatorToggle(event) {
        const checkbox = event.target;
        const opId = parseInt(checkbox.dataset.opId, 10);
        const op = appState.operatori.find(o => o.id === opId);
        if (!op) return;

        if (checkbox.checked) {
            op.isActive = true;
            op.isCounted = true;
            renderPlanner();
        } else {
            event.preventDefault();
            currentModalOpId = opId;
            operatorToggleTarget = checkbox;
            document.getElementById('deactivate-choice-title').textContent = `Disattiva ${op.cognome} ${op.nome}`;
            openModal('modal-deactivate-choice');
        }
    }

    function setupDeactivationChoiceListeners() {
        document.getElementById('deactivate-choice-exclude').addEventListener('click', () => {
            if (currentModalOpId === null) return;
            const op = appState.operatori.find(o => o.id === currentModalOpId);
            if (op) {
                op.isCounted = false;
                op.isActive = true;
            }
            closeModal('modal-deactivate-choice');
            renderPlanner();
            resetDeactivationState();
        });

        document.getElementById('deactivate-choice-inactive').addEventListener('click', () => {
            if (currentModalOpId === null) return;
            const op = appState.operatori.find(o => o.id === currentModalOpId);
            if (op) {
                op.isActive = false;
                op.isCounted = false;
            }
            closeModal('modal-deactivate-choice');
            renderPlanner();
            resetDeactivationState();
        });

        document.getElementById('deactivate-choice-cancel').addEventListener('click', () => {
            if (operatorToggleTarget) {
                operatorToggleTarget.checked = true;
            }
            closeModal('modal-deactivate-choice');
            resetDeactivationState();
        });
    }

    function resetDeactivationState() {
        currentModalOpId = null;
        operatorToggleTarget = null;
    }

    function handleMiniMenuClick(e) {
        e.preventDefault();
        const actionLink = e.target.closest('a[data-action]');
        if (!actionLink) return;

        const {
            opId,
            day,
            element
        } = currentMiniMenuContext;
        const action = actionLink.dataset.action;
        closeMiniMenu();

        switch (action) {
            case 'change':
                openCellActionModal(opId, day, 'change');
                break;
            case 'swap':
                startSwapProcess(opId, day, element);
                break;
            case 'period':
                openCellActionModal(opId, day, 'period');
                break;
            case 'extra':
                openCellActionModal(opId, day, 'extra');
                break;
            case 'note':
                openCellActionModal(opId, day, 'note');
                break;
            case 'revert':
            revertCell(opId, day);
            break;
        case 'call-substitute':
                handleCallSubstitute(opId, day);
                break;
            case 'respond-call':
                handleRespondCall(opId, day);
                break;
            case 'manage-calls':
                showCallManagementPanel();
                break;
        }
    }

    function handleAssignmentPaletteClick(e) {
        e.preventDefault();
        const actionLink = e.target.closest('.assignment-palette-action');
        if (!actionLink) return;

        const {
            opId,
            day
        } = currentAssignmentContext;
        if (!opId || !day) return;

        const monthKey = getMonthKey(appState.currentDate);
        if (!appState.plannerData[monthKey]) appState.plannerData[monthKey] = {};
        const key = `${opId}-${day}`;
        if (!appState.plannerData[monthKey][key]) appState.plannerData[monthKey][key] = {};
        const data = appState.plannerData[monthKey][key];

        switch (actionLink.dataset.action) {
            case 'assign':
                data.assignmentId = parseInt(actionLink.dataset.assignmentId, 10);
                break;
            case 'clear':
                delete data.assignmentId;
                break;
            case 'exit':
                break;
        }
        closeAssignmentPalette();
        renderPlanner();
    }

    function handleLegendFilterClick(e) {
        const legendItem = e.target.closest('.legend-item');
        if (!legendItem) return;

        const filter = legendItem.dataset.filter;

        legendItem.classList.toggle('active');
        if (activeFilters.has(filter)) {
            activeFilters.delete(filter);
        } else {
            activeFilters.add(filter);
        }

        applyFiltersAndRender();
    }

    function applyFiltersAndRender() {
        renderPlanner();
        
        // Ottimizza larghezza colonne per filtro extra
        optimizeExtraDetailsLayout();

        if (activeFilters.size > 0) {
            document.querySelectorAll('.planner-cell').forEach(cell => {
                const opId = parseInt(cell.dataset.opId);
                const day = parseInt(cell.dataset.day);
                const data = appState.plannerData[getMonthKey(appState.currentDate)]?.[`${opId}-${day}`];

                let matches = true;
                for (const f of activeFilters) {
                    let filterMatch = false;
                    if (data) {
                        if ((f === 'C' && data.modType === 'C') ||
                            (f === 'S' && data.modType === 'S') ||
                            (f === 'E' && data.modType === 'E') ||
                            (f === '+' && data.extraInfo) ||
                            (f === 'G' && (data.extraInfo?.gettone || data.gettone)) ||
                            (f === 'N' && data.nota)) {
                            filterMatch = true;
                        }
                    }
                    if (!filterMatch) {
                        matches = false;
                        break;
                    }
                }
                cell.classList.toggle('cell-masked', !matches);
            });
        }
    }


    function optimizeExtraDetailsLayout() {
        const plannerTable = document.getElementById('planner-table');
        const showExtraDetails = activeFilters.has('+');
        
        if (showExtraDetails) {
            // Identifica le colonne (giorni) che contengono celle con dettagli extra
            const extraCells = document.querySelectorAll('.planner-cell.extra-details-visible');
            const columnsWithExtra = new Set();
            let maxContentWidth = 140; // Larghezza minima aumentata
            
            extraCells.forEach(cell => {
                const day = parseInt(cell.dataset.day);
                if (day) {
                    columnsWithExtra.add(day);
                }
                
                const extraDetails = cell.querySelector('.cell-extra-details');
                if (extraDetails) {
                    // Crea elemento temporaneo per misurare il contenuto
                    const tempDiv = document.createElement('div');
                    tempDiv.style.cssText = 'position: absolute; visibility: hidden; white-space: nowrap; font-size: 0.75rem;';
                    tempDiv.textContent = extraDetails.textContent;
                    document.body.appendChild(tempDiv);
                    
                    const contentWidth = Math.min(tempDiv.offsetWidth + 30, 220); // +30 per padding, max 220px
                    maxContentWidth = Math.max(maxContentWidth, contentWidth);
                    
                    document.body.removeChild(tempDiv);
                }
            });
            
            // Applica riduzione del 40% della larghezza quando filtro extra è attivo
            const reducedWidth = Math.max(maxContentWidth * 0.6, 84); // Riduzione 40%, minimo 84px
            
            // Estendi l'intera colonna per ogni giorno che contiene extra
            let columnStyles = '';
            columnsWithExtra.forEach(day => {
                const columnIndex = day + 2; // +2 perché le prime due colonne sono operatori e ore
                columnStyles += `
                    table.show-extra-details .planner-cell:nth-child(${columnIndex}) {
                        width: ${reducedWidth}px !important;
                        min-width: ${reducedWidth}px !important;
                        max-width: ${reducedWidth}px !important;
                    }
                    table.show-extra-details th:nth-child(${columnIndex}) {
                        width: ${reducedWidth}px !important;
                        min-width: ${reducedWidth}px !important;
                        max-width: ${reducedWidth}px !important;
                    }`;
            });
            
            // Applica stili per uniformare l'altezza delle righe
            const style = document.getElementById('dynamic-extra-style') || document.createElement('style');
            style.id = 'dynamic-extra-style';
            style.textContent = `
                ${columnStyles}
                
                /* Uniforma altezza righe quando filtro extra è attivo */
                table.show-extra-details tbody tr {
                    height: auto !important;
                }
                
                table.show-extra-details .planner-cell {
                    vertical-align: top !important;
                    height: auto !important;
                }
                
                table.show-extra-details .base-cell {
                    min-height: 60px !important;
                    height: auto !important;
                    align-items: flex-start !important;
                    justify-content: flex-start !important;
                }
                
                /* Assicura che tutte le celle della riga abbiano la stessa altezza */
                table.show-extra-details tbody tr {
                    display: table-row;
                }
                
                table.show-extra-details .planner-cell:not(.extra-details-visible) .base-cell {
                    min-height: 60px !important;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
            `;
            
            if (!document.getElementById('dynamic-extra-style')) {
                document.head.appendChild(style);
            }
            
            // Forza il ricalcolo del layout dopo un breve delay
            setTimeout(() => {
                plannerTable.style.tableLayout = 'auto';
                requestAnimationFrame(() => {
                    plannerTable.style.tableLayout = 'fixed';
                });
            }, 50);
            
        } else {
            // Rimuovi stili dinamici quando il filtro non è attivo
            const dynamicStyle = document.getElementById('dynamic-extra-style');
            if (dynamicStyle) {
                dynamicStyle.remove();
            }
        }
    }

    function closeDaySummaryModal() {
        const daySummaryModal = document.getElementById('modal-day-summary');
        if (daySummaryModal.classList.contains('visible')) {
            daySummaryModal.classList.remove('visible');
            daySummaryModal.classList.add('hidden');
            clearHighlights();
            activeDaySummary = null;
        }
    }

    function revertCellToMatrix(opId, day) {
        const monthKey = getMonthKey(appState.currentDate);
        if (appState.plannerData[monthKey]?.[`${opId}-${day}`]) {
            delete appState.plannerData[monthKey][`${opId}-${day}`];
        }
        generatePlannerData();
    }

    async function revertCell(opId, day) {
        saveHistoryState(); 
        const monthKey = getMonthKey(appState.currentDate);
        const data = appState.plannerData[monthKey]?.[`${opId}-${day}`];
        if (data?.modType === 'S' && data.swapPartner) {
            const partnerOp = appState.operatori.find(o => o.id === data.swapPartner.opId);
            const confirmed = await showConfirmation(`Questo è uno scambio con ${partnerOp.cognome}. Ripristinare entrambi i turni?`, "Conferma Ripristino");
            if (confirmed) {
                revertCellToMatrix(opId, day);
                revertCellToMatrix(data.swapPartner.opId, data.swapPartner.day);
                renderPlanner();
            }
        } else {
            revertCellToMatrix(opId, day);
            renderPlanner();
        }
    }

    function openMiniMenu(event, opId, day) {
        const miniMenu = document.getElementById('mini-menu');
        const cellElement = event.target.closest('.planner-cell');
        if (!cellElement) return;
        currentMiniMenuContext = {
            opId,
            day,
            element: cellElement
        };
        const {
            clientX: x,
            clientY: y
        } = event;
        miniMenu.style.top = `${y}px`;
        miniMenu.style.left = `${x}px`;
        miniMenu.classList.remove('hidden');
        const menuRect = miniMenu.getBoundingClientRect();
        if (menuRect.right > window.innerWidth) miniMenu.style.left = `${window.innerWidth - menuRect.width - 5}px`;
        if (menuRect.bottom > window.innerHeight) miniMenu.style.top = `${window.innerHeight - menuRect.height - 5}px`;
    }

    function closeMiniMenu() {
        document.getElementById('mini-menu').classList.add('hidden');
    }

    function startSwapProcess(opId, day, element) {
        if (swapState.isActive) return;
        swapState = {
            isActive: true,
            step: 1,
            firstCell: {
                opId,
                day,
                element
            },
            secondCell: null
        };
        element.classList.add('swap-selection-active');
        updateSwapNotificationBar();
    }

    function cancelSwap() {
        if (swapState.firstCell?.element) swapState.firstCell.element.classList.remove('swap-selection-active');
        if (swapState.secondCell?.element) swapState.secondCell.element.classList.remove('swap-selection-active');
        swapState = {
            isActive: false,
            step: 0,
            firstCell: null,
            secondCell: null
        };
        updateSwapNotificationBar();
        closeModal('modal-swap');
    }

    function openSwapModal() {
        if (!swapState.firstCell || !swapState.secondCell) return;
        const monthKey = getMonthKey(appState.currentDate);
        const op1 = appState.operatori.find(o => o.id === swapState.firstCell.opId);
        const data1 = appState.plannerData[monthKey]?.[`${swapState.firstCell.opId}-${swapState.firstCell.day}`] || {
            turno: 'N/A'
        };
        const op2 = appState.operatori.find(o => o.id === swapState.secondCell.opId);
        const data2 = appState.plannerData[monthKey]?.[`${swapState.secondCell.opId}-${swapState.secondCell.day}`] || {
            turno: 'N/A'
        };
        document.getElementById('swap-from-details').innerHTML = `<p class="font-bold text-gray-800">${op1.cognome}</p><p class="text-sm text-gray-600">Giorno: ${swapState.firstCell.day}</p><p class="mt-2 text-lg font-semibold text-indigo-600">${data1.turno}</p>`;
        document.getElementById('swap-to-details').innerHTML = `<p class="font-bold text-gray-800">${op2.cognome}</p><p class="text-sm text-gray-600">Giorno: ${swapState.secondCell.day}</p><p class="mt-2 text-lg font-semibold text-indigo-600">${data2.turno}</p>`;
        document.getElementById('swap-note').value = '';
        openModal('modal-swap');
    }

    function confirmSwap() {
        saveHistoryState(); 
        if (!swapState.firstCell || !swapState.secondCell) return;

        const monthKey = getMonthKey(appState.currentDate);
        if (!appState.plannerData[monthKey]) appState.plannerData[monthKey] = {};

        const key1 = `${swapState.firstCell.opId}-${swapState.firstCell.day}`;
        const key2 = `${swapState.secondCell.opId}-${swapState.secondCell.day}`;

        if (!appState.plannerData[monthKey][key1]) appState.plannerData[monthKey][key1] = {};
        if (!appState.plannerData[monthKey][key2]) appState.plannerData[monthKey][key2] = {};

        const data1 = appState.plannerData[monthKey][key1];
        const data2 = appState.plannerData[monthKey][key2];

        if (!data1.isManuallySet) data1.originalTurno = data1.turno;
        if (!data2.isManuallySet) data2.originalTurno = data2.turno;

        const tempTurno = data1.turno;
        data1.turno = data2.turno;
        data2.turno = tempTurno;

        data1.nota = document.getElementById('swap-note').value;
        data1.modType = 'S';
        data1.isManuallySet = true;
        data1.swapPartner = {
            opId: swapState.secondCell.opId,
            day: swapState.secondCell.day
        };

               data2.nota = document.getElementById('swap-note').value;
        data2.modType = 'S';
        data2.isManuallySet = true;
        data2.swapPartner = {
            opId: swapState.firstCell.opId,
            day: swapState.firstCell.day
        };

        cancelSwap();
        renderPlanner();
    }

    function updateSwapNotificationBar() {
        const bar = document.getElementById('swap-notification-bar');
        if (swapState.isActive) {
            document.getElementById('swap-message').textContent = "Modalità Scambio Attiva: Seleziona la seconda cella con cui effettuare lo scambio.";
            bar.classList.remove('hidden');
        } else {
            bar.classList.add('hidden');
        }
    }

    function clearHighlights() {
        document.querySelectorAll('.row-highlighted, .col-highlighted, .cell-highlighted').forEach(el => el.classList.remove('row-highlighted', 'col-highlighted', 'cell-highlighted'));
    }

    function selectCrosshair(opId, day) {
        clearHighlights();
        if (opId) document.querySelector(`#planner-body tr[data-op-id="${opId}"]`)?.classList.add('row-highlighted');
        if (day) document.querySelectorAll(`td[data-day="${day}"], th[data-day-col="${day}"]`).forEach(c => c.classList.add('col-highlighted'));
        if (opId && day) document.querySelector(`#planner-body td[data-op-id="${opId}"][data-day="${day}"]`)?.classList.add('cell-highlighted');
    }

    function showModTooltip(indicator) {
        clearTimeout(modTooltipTimer);
        const modTooltip = document.getElementById('mod-tooltip');
        const infoStr = indicator.dataset.tooltipInfo;
        if (!infoStr) return;
        const info = JSON.parse(infoStr.replace(/&apos;/g, "'"));
        let content = '';
        const parts = [];

        // Violazioni (se presenti)
        if (info.violations && info.violations.length > 0) {
            parts.push(`<div class="tooltip-section"><strong>⚠️ Violazioni Regole:</strong><br>• ${info.violations.join('<br>• ')}</div>`);
        }

        // Informazioni sulla modifica
        if (info.modType && info.modType !== 'E' && info.modType !== '+') {
            let modSection = '<div class="tooltip-section">';
            
            if (info.modType === 'C') {
                // Cambio turno
                const [mainReasonId, subReason] = (info.changeReason || '').split(':');
                const reasonObj = appState.reasons.find(r => r.id == mainReasonId);
                const reasonText = reasonObj ? reasonObj.text : 'Non specificato';
                
                modSection += `<strong>🔄 Tipo di Modifica:</strong> Cambio Turno<br>`;
                modSection += `<strong>📋 Matrice Originale:</strong> ${info.originalTurno || 'Vuoto'}<br>`;
                modSection += `<strong>🎯 Turno Modificato:</strong> ${info.turno}<br>`;
                modSection += `<strong>💭 Motivazione:</strong> ${reasonText}`;
                if (subReason) {
                    modSection += ` (${subReason.replace(/_/g, ' ')})`;
                }
            } else if (info.modType === 'S') {
                // Scambio
                const partner = appState.operatori.find(op => op.id === info.swapPartner.opId);
                const partnerName = partner ? partner.cognome : 'Sconosciuto';
                
                modSection += `<strong>🔀 Tipo di Modifica:</strong> Scambio Turni<br>`;
                modSection += `<strong>👥 Scambio con:</strong> ${partnerName}<br>`;
                modSection += `<strong>📅 Giorno di scambio:</strong> ${info.swapPartner.day}<br>`;
                modSection += `<strong>📋 Matrice Originale:</strong> ${info.originalTurno || 'Vuoto'}<br>`;
                modSection += `<strong>🎯 Turno Modificato:</strong> ${info.turno}`;
            } else if (info.modType === 'G') {
                // Gettone
                modSection += `<strong>🎫 Tipo di Modifica:</strong> Gettone<br>`;
                modSection += `<strong>🎯 Turno:</strong> ${info.turno}`;
            }
            
            modSection += '</div>';
            parts.push(modSection);
        }

        // Informazioni extra (rientri, prolungamenti, straordinari)
        if (info.extraInfo) {
            let extraSection = '<div class="tooltip-section">';
            
            const typeMap = {
                'straordinario': 'Straordinario',
                'prolungamento': 'Prolungamento', 
                'rientro': 'Rientro',
                'anticipato': 'Anticipato'
            };
            
            let typeText = info.extraInfo.type ? typeMap[info.extraInfo.type] : 'Extra';
            if (info.extraInfo.gettone) typeText += ' + Gettone';
            
            extraSection += `<strong>⏰ Tipo di Rientro/Prolungamento:</strong> ${typeText}<br>`;
            
            // Dettagli specifici per tipo
            if (info.extraInfo.type === 'straordinario' && info.extraInfo.startTime && info.extraInfo.endTime) {
                extraSection += `<strong>📝 Dettaglio:</strong> Rientro prolungamento straordinario dalle ore ${info.extraInfo.startTime} fino alle ore ${info.extraInfo.endTime}<br>`;
            } else if (info.extraInfo.type === 'anticipato' && info.extraInfo.startTime) {
                extraSection += `<strong>📝 Dettaglio:</strong> Rientro anticipato dalle ore ${info.extraInfo.startTime}<br>`;
            } else if (info.extraInfo.type === 'prolungamento' && info.extraInfo.endTime) {
                extraSection += `<strong>📝 Dettaglio:</strong> Prolungato fino alle ore ${info.extraInfo.endTime}<br>`;
            } else if (info.extraInfo.startTime || info.extraInfo.endTime) {
                extraSection += `<strong>🕐 Orario:</strong> ${info.extraInfo.startTime || '...'} - ${info.extraInfo.endTime || '...'}<br>`;
            }
            
            // Ore totali di straordinario
            if (typeof info.extraInfo.hours === 'number') {
                extraSection += `<strong>⏱️ Totale Ore Straordinario:</strong> ${info.extraInfo.hours.toFixed(1)} ore<br>`;
            }
            
            // Note specifiche per l'extra
            if (info.extraInfo.note) {
                extraSection += `<strong>📝 Note Extra:</strong> ${info.extraInfo.note}<br>`;
            }
            
            extraSection += '</div>';
            parts.push(extraSection);
        }

        // Note generali
        if (info.nota) {
            parts.push(`<div class="tooltip-section"><strong>📝 Note Generali:</strong><br>${info.nota}</div>`);
        }

        // Se non ci sono informazioni specifiche, mostra un messaggio base
        if (parts.length === 0) {
            parts.push(`<div class="tooltip-section"><strong>ℹ️ Informazioni:</strong><br>Nessun dettaglio disponibile</div>`);
        }

        content = parts.join('<div class="tooltip-divider"></div>');
        modTooltip.innerHTML = content;
        modTooltip.style.display = 'block';
        
        // Posizionamento intelligente della tooltip
        const rect = indicator.getBoundingClientRect();
        const tooltipRect = modTooltip.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        let left = rect.left + window.scrollX;
        let top = rect.bottom + window.scrollY + 5;
        
        // Aggiusta posizione se esce dal viewport
        if (left + tooltipRect.width > viewportWidth) {
            left = viewportWidth - tooltipRect.width - 10;
        }
        if (top + tooltipRect.height > viewportHeight + window.scrollY) {
            top = rect.top + window.scrollY - tooltipRect.height - 5;
        }
        
        modTooltip.style.left = `${left}px`;
        modTooltip.style.top = `${top}px`;
    }

    function hideModTooltip() {
        modTooltipTimer = setTimeout(() => {
            document.getElementById('mod-tooltip').style.display ='none';
        }, 200);
    }
    
    function openAssignmentPalette(event, opId, day) {
        const assignmentPalette = document.getElementById('assignment-palette');
        currentAssignmentContext = {
            opId,
            day
        };
        const monthKey = getMonthKey(appState.currentDate);
        const currentData = appState.plannerData[monthKey]?.[`${opId}-${day}`];
        const currentAssignmentId = currentData?.assignmentId;
        const usedAssignmentIds = new Set(getActiveOperators(appState.currentDate.getFullYear(), appState.currentDate.getMonth()).map(op => appState.plannerData[monthKey]?.[`${op.id}-${day}`]?.assignmentId).filter(Boolean));
        const availableAssignments = appState.assignments.filter(a => !usedAssignmentIds.has(a.id) || a.id === currentAssignmentId);
        document.getElementById('assignment-palette-content').innerHTML = availableAssignments.map(a => `
            <a href="#" class="assignment-palette-action" data-action="assign" data-assignment-id="${a.id}">
                <span class="color-swatch" style="background-color: ${a.colore};"></span>
                <span class="assignment-item-name">${a.nome}</span>
            </a>
        `).join('');
        const {
            clientX: x,
            clientY: y
        } = event;
        assignmentPalette.style.top = `${y}px`;
        assignmentPalette.style.left = `${x}px`;
        assignmentPalette.classList.remove('hidden');
        const paletteRect = assignmentPalette.getBoundingClientRect();
        if (paletteRect.right > window.innerWidth) assignmentPalette.style.left = `${window.innerWidth - paletteRect.width - 5}px`;
        if (paletteRect.bottom > window.innerHeight) assignmentPalette.style.top = `${window.innerHeight - paletteRect.height - 5}px`;
    }

    function closeAssignmentPalette() {
        document.getElementById('assignment-palette').classList.add('hidden');
    }

    function openOperatorInfoPanel(opId) {
        const sidebar = document.getElementById('sidebar');
        const sidebarTab = document.getElementById('sidebar-tab');
        const appDiv = document.getElementById('app');

        if (sidebar.classList.contains('sidebar-open')) {
            sidebar.classList.remove('sidebar-open');
            appDiv.classList.remove('sidebar-open');
            sidebarTab.classList.remove('sidebar-open');
        }

        const op = appState.operatori.find(o => o.id === opId);
        if (!op) return;

        const panel = document.getElementById('operator-info-panel');
        const title = document.getElementById('operator-info-title');
        const content = document.getElementById('operator-info-content');

        title.textContent = `${op.cognome} ${op.nome}`;

        const monthKey = getMonthKey(appState.currentDate);
        const monthData = appState.plannerData[monthKey] || {};
        const daysInMonth = getDaysInMonth(appState.currentDate.getFullYear(), appState.currentDate.getMonth());

        let giorniLavorati = 0;
        let oreTotali = 0;
        let turniConteggio = {};
        let cambiTurno = 0;
        let scambiTurno = 0;
        let straordinari = {
            count: 0,
            hours: 0
        };
        let oreFerieUsate = 0;
        let orePermessiUsate = 0;

        for (let day = 1; day <= daysInMonth; day++) {
            const data = monthData[`${op.id}-${day}`];
            if (data && data.turno) {
                const turnoDef = getTurnoBySigla(data.turno);
                if (turnoDef) {
                    if (turnoDef.isOperativo) giorniLavorati++;
                    if (turnoDef.conteggioOre === 'orario') {
                        oreTotali += turnoDef.ore;
                        if (turnoDef.sigla === 'F' || turnoDef.sigla === 'FE') oreFerieUsate += turnoDef.ore;
                    } else if (turnoDef.conteggioOre === 'sostitutivo') {
                        orePermessiUsate += getTurnoBySigla(data.originalTurno)?.ore || 0;
                        const originalTurno = getTurnoBySigla(data.originalTurno);
                        if (originalTurno) {
                            oreTotali += originalTurno.ore;
                        }
                    }
                    turniConteggio[data.turno] = (turniConteggio[data.turno] || 0) + 1;
                }
                if (data.modType === 'C') cambiTurno++;
                if (data.modType === 'S') scambiTurno++;
                if (data.extraInfo) {
                    straordinari.count++;
                    straordinari.hours += (data.extraInfo.hours || 0);
                }
            }
        }
        oreTotali += straordinari.hours;
        const oreFerieResidue = (op.ferieAnnuali || 0) - oreFerieUsate;
        const orePermessiResidui = (op.permessiAnnuali || 0) - orePermessiUsate;

        const turniListHtml = Object.entries(turniConteggio)
            .sort((a, b) => b[1] - a[1])
            .map(([sigla, count]) => `<li><span>${sigla}</span><span class="font-semibold">${count}</span></li>`)
            .join('');

        content.innerHTML = `
            <div class="info-section">
                <h4 class="info-section-title">Statistiche Mensili</h4>
                <div class="info-grid">
                    <div class="info-item"><span class="info-item-label">Giorni Lavorati</span><span class="info-item-value">${giorniLavorati}</span></div>
                    <div class="info-item"><span class="info-item-label">Ore Totali</span><span class="info-item-value">${oreTotali.toFixed(1)}</span></div>
                    <div class="info-item"><span class="info-item-label">Interventi Extra</span><span class="info-item-value">${straordinari.count}</span></div>
                    <div class="info-item"><span class="info-item-label">Ore Extra</span><span class="info-item-value">+${straordinari.hours.toFixed(1)}</span></div>
                </div>
            </div>
             <div class="info-section">
                <h4 class="info-section-title">Monte Ore Residuo</h4>
                <div class="info-grid">
                     <div class="info-item"><span class="info-item-label">Ferie</span><span class="info-item-value">${oreFerieResidue.toFixed(1)} / ${op.ferieAnnuali || 0}</span></div>
                     <div class="info-item"><span class="info-item-label">Permessi</span><span class="info-item-value">${orePermessiResidui.toFixed(1)} / ${op.permessiAnnuali || 0}</span></div>
                </div>
            </div>
             <div class="info-section">
                <h4 class="info-section-title">Riepilogo Turni</h4>
                <ul class="info-list">${turniListHtml || '<li>Nessun turno assegnato</li>'}</ul>
            </div>
        `;

        appDiv.classList.add('info-panel-open');
        panel.classList.add('is-open');
        activeOperatorInfoPanel = opId;
    }

    function closeOperatorInfoPanel() {
        const panel = document.getElementById('operator-info-panel');
        const appElement = document.getElementById('app');
        appElement.classList.remove('info-panel-open');
        panel.classList.remove('is-open');
        activeOperatorInfoPanel = null;
    }

    function setupDraggableDaySummary() {
        const modal = document.getElementById('modal-day-summary');
        const title = document.getElementById('day-summary-nav-title');
        let isDragging = false;
        let offset = {
            x: 0,
            y: 0
        };

        title.addEventListener('mousedown', (e) => {
            isDragging = true;
            modal.style.transform = 'none';
            offset = {
                x: e.clientX - modal.offsetLeft,
                y: e.clientY - modal.offsetTop
            };
            title.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            e.preventDefault();
            modal.style.left = `${e.clientX - offset.x}px`;
            modal.style.top = `${e.clientY - offset.y}px`;
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                appState.daySummaryModalPosition = {
                    top: modal.style.top,
                    left: modal.style.left
                };
            }
            isDragging = false;
            title.style.cursor = 'grab';
        });
    }

    function makeModalDraggableAndResizable(modalId) {
        const modal = document.getElementById(modalId);
        const header = modal.querySelector('.modal-header-draggable');
        if (!header) return;

        let isDragging = false;
        let isResizing = false;
        let currentX, currentY, initialX, initialY, xOffset = 0, yOffset = 0;
        
        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('.no-drag')) return;
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
            if (e.target === header || e.target.parentElement === header) {
                isDragging = true;
                modal.classList.add('is-dragging');
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                e.preventDefault();
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
                xOffset = currentX;
                yOffset = currentY;
                modal.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
            }
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            modal.classList.remove('is-dragging');
        });

        const resizer = document.createElement('div');
        resizer.className = 'modal-resizer';
        modal.appendChild(resizer);

        resizer.addEventListener('mousedown', (e) => {
            e.preventDefault();
            isResizing = true;
            initialX = e.clientX;
            initialY = e.clientY;
            const initialWidth = modal.offsetWidth;
            const initialHeight = modal.offsetHeight;

            const resizeMouseMove = (moveEvent) => {
                if(isResizing) {
                    const dx = moveEvent.clientX - initialX;
                    const dy = moveEvent.clientY - initialY;
                    modal.style.width = `${initialWidth + dx}px`;
                    modal.style.height = `${initialHeight + dy}px`;
                }
            };
            
            const resizeMouseUp = () => {
                isResizing = false;
                document.removeEventListener('mousemove', resizeMouseMove);
                document.removeEventListener('mouseup', resizeMouseUp);
            };

            document.addEventListener('mousemove', resizeMouseMove);
            document.addEventListener('mouseup', resizeMouseUp);
        });
    }

    function syncUiWithState() {
        document.getElementById('theme-toggle').checked = appState.currentTheme === 'color';
        document.getElementById('performance-bars-toggle').checked = appState.showPerformanceBars;
        document.getElementById('mod-symbols-toggle').checked = appState.showModSymbols;
        document.getElementById('assignments-toggle').checked = appState.showAssignments;
        document.getElementById('coverage-toggle').checked = appState.showCoverageInfo;
        document.getElementById('performance-toggle-wrapper').style.display = appState.showCoverageInfo ? 'flex' : 'none';
        document.getElementById('show-hours-toggle').checked = appState.showShiftHours;
        document.getElementById('threed-effect-toggle').checked = appState.show3DEffect;
        document.getElementById('matrix-view-toggle').checked = appState.showMatrixOnly;
        document.getElementById('assign-mode-btn').classList.toggle('active', appState.isAssignmentMode);
    }

    // =================================================================================
    // NUOVA SEZIONE: REPORTING E ANALISI
    // =================================================================================

    function generateActiveReport() {
        const activeTab = document.querySelector('.report-tab-link.active');
        if (!activeTab) return;

        const reportType = activeTab.dataset.reportType;
        const startDate = document.getElementById('report-start-date').value;
        const endDate = document.getElementById('report-end-date').value;
        if (!startDate || !endDate) {
            showToast("Per favore, seleziona un intervallo di date valido.", "error");
            return;
        }

        document.getElementById('report-placeholder').classList.add('hidden');
        document.getElementById('report-container').classList.remove('hidden');

        if (reportType === 'payroll') {
            generatePayrollReport(new Date(startDate), new Date(endDate));
        } else if (reportType === 'equity') {
            generateEquityReport(new Date(startDate), new Date(endDate));
        }
    }

    function generatePayrollReport(startDate, endDate) {
        const reportData = {};
        appState.operatori.forEach(op => {
            reportData[op.id] = { name: `${op.cognome} ${op.nome}`, oreOrdinarie: 0, oreFeriePermessi: 0, oreExtra: 0, gettoni: 0 };
        });

        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const monthKey = getMonthKey(d);
            const day = d.getDate();
            const monthData = appState.plannerData[monthKey] || {};

            for (const op of appState.operatori) {
                const data = monthData[`${op.id}-${day}`];
                if (!data) continue;

                const turnoDef = getTurnoBySigla(data.turno);
                if (turnoDef) {
                    if (turnoDef.conteggioOre === 'sostitutivo') {
                        const originalTurno = getTurnoBySigla(data.originalTurno);
                        if(originalTurno) reportData[op.id].oreFeriePermessi += originalTurno.ore;
                    } else if (turnoDef.conteggioOre === 'orario') {
                        if (turnoDef.isOperativo) {
                           reportData[op.id].oreOrdinarie += turnoDef.ore;
                        } else {
                           reportData[op.id].oreFeriePermessi += turnoDef.ore;
                        }
                    }
                }
                
                if (data.extraInfo) {
                    reportData[op.id].oreExtra += data.extraInfo.hours || 0;
                    if (data.extraInfo.gettone) reportData[op.id].gettoni++;
                } else if (data.gettone) {
                    reportData[op.id].gettoni++;
                }
            }
        }
        
        let tableHTML = `
            <h3 class="text-xl font-semibold mb-4">Riconciliazione Ore dal ${startDate.toLocaleDateString()} al ${endDate.toLocaleDateString()}</h3>
            <table class="report-table">
                <thead>
                    <tr>
                        <th>Operatore</th>
                        <th>Ore Ordinarie</th>
                        <th>Ore Ferie/Permessi</th>
                        <th>Ore Extra</th>
                        <th>Gettoni</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        Object.values(reportData).filter(r => r.oreOrdinarie > 0 || r.oreFeriePermessi > 0 || r.oreExtra > 0 || r.gettoni > 0).forEach(data => {
            tableHTML += `
                <tr>
                    <td>${data.name}</td>
                    <td>${data.oreOrdinarie.toFixed(1)}</td>
                    <td>${data.oreFeriePermessi.toFixed(1)}</td>
                    <td>${data.oreExtra.toFixed(1)}</td>
                    <td>${data.gettoni}</td>
                </tr>
            `;
        });
        
        tableHTML += '</tbody></table>';
        document.getElementById('report-container').innerHTML = tableHTML;
    }

    function generateEquityReport(startDate, endDate) {
        const reportData = {};
        appState.operatori.forEach(op => {
            reportData[op.id] = { name: `${op.cognome} ${op.nome}`, notti: 0, weekend: 0, isActive: false };
        });

        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const monthKey = getMonthKey(d);
            const day = d.getDate();
            const dayOfWeek = d.getDay();
            const monthData = appState.plannerData[monthKey] || {};

            for (const op of appState.operatori) {
                const data = monthData[`${op.id}-${day}`];
                if (!data || !data.turno) continue;

                reportData[op.id].isActive = true;
                const turnoDef = getTurnoBySigla(data.turno);
                if (turnoDef && turnoDef.isOperativo) {
                    if (data.turno && typeof data.turno === 'string' && data.turno.toUpperCase() === 'N') {
                        reportData[op.id].notti++;
                    }
                    if (dayOfWeek === 0 || dayOfWeek === 6) { // Domenica o Sabato
                        reportData[op.id].weekend++;
                    }
                }
            }
        }

        const filteredData = Object.values(reportData).filter(r => r.isActive);
        const labels = filteredData.map(d => d.name);
        const nottiData = filteredData.map(d => d.notti);
        const weekendData = filteredData.map(d => d.weekend);
        
        const reportContainer = document.getElementById('report-container');
        reportContainer.innerHTML = `
            <h3 class="text-xl font-semibold mb-4">Analisi Equità Turni dal ${startDate.toLocaleDateString()} al ${endDate.toLocaleDateString()}</h3>
            <div class="mb-8" style="height: 400px;"><canvas id="equity-chart"></canvas></div>
            <table class="report-table">
                <thead><tr><th>Operatore</th><th>Turni Notturni</th><th>Turni Weekend</th></tr></thead>
                <tbody>
                    ${filteredData.map(d => `<tr><td>${d.name}</td><td>${d.notti}</td><td>${d.weekend}</td></tr>`).join('')}
                </tbody>
            </table>`;
        
        if (equityChart) equityChart.destroy();
        
        const ctx = document.getElementById('equity-chart').getContext('2d');
        equityChart = new Chart(ctx, {
  type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Turni Notturni', data: nottiData, backgroundColor: 'rgba(54, 162, 235, 0.6)', borderColor: 'rgba(54, 162, 235, 1)', borderWidth: 1 },
                    { label: 'Turni Weekend', data: weekendData, backgroundColor: 'rgba(255, 159, 64, 0.6)', borderColor: 'rgba(255, 159, 64, 1)', borderWidth: 1 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, ticks: { stepSize: 1 } }
                }
            }
        });
    }

    function printReport() {
        document.body.classList.add('printing-report');
        window.print();
        setTimeout(() => document.body.classList.remove('printing-report'), 100);
    }

    // =================================================================================
    // DASHBOARD DI MONITORAGGIO EMERGENZE E BACKUP
    // =================================================================================

    let emergencyDashboardState = {
        isVisible: false,
        lastUpdate: null,
        updateInterval: null
    };

    let backupState = {
        intervalId: null,
        intervalMinutes: 30,
        lastBackup: null,
        maxBackups: 10,
        isEnabled: true,
        emergencyBackupEnabled: true
    };

    function initializeEmergencyDashboard() {
        const openBtn = document.getElementById('open-emergency-dashboard');
        const toggleBtn = document.getElementById('toggle-emergency-dashboard');
        const autoResolveBtn = document.getElementById('auto-resolve-coverage');
        const emergencyBackupBtn = document.getElementById('emergency-backup');
        const resetViolationsBtn = document.getElementById('reset-violations');

        if (openBtn) openBtn.addEventListener('click', showEmergencyDashboard);
        if (toggleBtn) toggleBtn.addEventListener('click', hideEmergencyDashboard);
        if (autoResolveBtn) autoResolveBtn.addEventListener('click', autoResolveCoverage);
        if (emergencyBackupBtn) emergencyBackupBtn.addEventListener('click', performEmergencyBackup);
        if (resetViolationsBtn) resetViolationsBtn.addEventListener('click', resetAllViolations);

        // Aggiungi event listeners per evidenziare celle critiche
        setupCriticalCellHighlighting();
        
        startEmergencyMonitoring();
    }

    function showEmergencyDashboard() {
        document.getElementById('emergency-dashboard').classList.remove('hidden');
        document.getElementById('open-emergency-dashboard').style.display = 'none';
        emergencyDashboardState.isVisible = true;
        updateEmergencyDashboard();
    }

    function hideEmergencyDashboard() {
        document.getElementById('emergency-dashboard').classList.add('hidden');
        document.getElementById('open-emergency-dashboard').style.display = 'flex';
        emergencyDashboardState.isVisible = false;
    }

    function startEmergencyMonitoring() {
        updateEmergencyDashboard();
        if (emergencyDashboardState.updateInterval) clearInterval(emergencyDashboardState.updateInterval);
        emergencyDashboardState.updateInterval = setInterval(updateEmergencyDashboard, 10000);
    }

    function updateEmergencyDashboard() {
        try {
            const metrics = calculateEmergencyMetrics();
            updateDashboardUI(metrics);
            updateSystemStatus(metrics);
            emergencyDashboardState.lastUpdate = new Date();
        } catch (error) {
            console.error('Errore aggiornamento dashboard emergenze:', error);
        }
    }

    function calculateEmergencyMetrics() {
        const year = appState.currentDate.getFullYear();
        const month = appState.currentDate.getMonth();
        const monthKey = getMonthKey(appState.currentDate);
        const daysInMonth = getDaysInMonth(year, month);
        const operators = getActiveOperators(year, month, false);
        const monthData = appState.plannerData[monthKey] || {};
        
        let metrics = {
            coverageDeficits: { morning: 0, afternoon: 0, night: 0 },
            violations: { rest: 0, consecutive: 0, total: 0 },
            criticalDays: [], 
            systemStatus: 'normal'
        };

        for (let day = 1; day <= daysInMonth; day++) {
            const daySummary = getDaySummary(day);
            const morningDeficit = Math.max(0, (appState.coverageOptimal.M || 0) - (daySummary.coverage.M || 0));
            const afternoonDeficit = Math.max(0, (appState.coverageOptimal.P || 0) - (daySummary.coverage.P || 0));
            const nightDeficit = Math.max(0, (appState.coverageOptimal.N || 0) - (daySummary.coverage.N || 0));

            metrics.coverageDeficits.morning += morningDeficit;
            metrics.coverageDeficits.afternoon += afternoonDeficit;
            metrics.coverageDeficits.night += nightDeficit;
            
            if (morningDeficit > 0 || afternoonDeficit > 0 || nightDeficit > 0) {
                metrics.criticalDays.push({ day, deficits: { M: morningDeficit, P: afternoonDeficit, N: nightDeficit } });
            }
        }

        operators.forEach(op => {
            for (let day = 1; day <= daysInMonth; day++) {
                const data = monthData[`${op.id}-${day}`];
                if (data?.violations?.length) {
                    metrics.violations.total += data.violations.length;
                    if (data.violations.some(v => v.includes('Riposo'))) metrics.violations.rest++;
                    if (data.violations.some(v => v.includes('consecutivi'))) metrics.violations.consecutive++;
                }
            }
        });

        const totalDeficits = metrics.coverageDeficits.morning + metrics.coverageDeficits.afternoon + metrics.coverageDeficits.night;
        if (metrics.violations.total > 5 || totalDeficits > 10) metrics.systemStatus = 'critical';
        else if (metrics.violations.total > 2 || totalDeficits > 5) metrics.systemStatus = 'warning';

        return metrics;
    }

    function updateDashboardUI(metrics) {
        const statusIndicator = document.getElementById('status-indicator');
        const statusText = document.getElementById('status-text');
        
        if (statusIndicator && statusText) {
            statusIndicator.className = 'w-3 h-3 rounded-full';
            if (metrics.systemStatus === 'critical') {
                statusIndicator.classList.add('bg-red-500');
                statusText.textContent = 'Critico';
            } else if (metrics.systemStatus === 'warning') {
                statusIndicator.classList.add('bg-yellow-500');
                statusText.textContent = 'Attenzione';
            } else {
                statusIndicator.classList.add('bg-green-500');
                statusText.textContent = 'Normale';
            }
        }

        updateElementText('morning-deficit', metrics.coverageDeficits.morning);
        updateElementText('afternoon-deficit', metrics.coverageDeficits.afternoon);
        updateElementText('night-deficit', metrics.coverageDeficits.night);
        updateElementText('rest-violations', metrics.violations.rest);
        updateElementText('consecutive-violations', metrics.violations.consecutive);
        
        // Aggiungi pulsante per cancellare evidenziazioni se non esiste già
        let clearHighlightsBtn = document.getElementById('clear-critical-highlights');
        if (!clearHighlightsBtn) {
            const actionsContainer = document.querySelector('#emergency-dashboard .space-y-2');
            if (actionsContainer) {
                clearHighlightsBtn = document.createElement('button');
                clearHighlightsBtn.id = 'clear-critical-highlights';
                clearHighlightsBtn.className = 'w-full bg-gray-400 hover:bg-gray-500 text-white text-xs font-medium py-2 px-3 rounded transition-colors';
                clearHighlightsBtn.innerHTML = '🔍 Rimuovi Evidenziazioni';
                clearHighlightsBtn.addEventListener('click', clearCriticalHighlights);
                actionsContainer.appendChild(clearHighlightsBtn);
            }
        }
    }

    function updateElementText(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
            element.classList.toggle('text-red-600', value > 0);
            element.classList.toggle('font-bold', value > 0);
        }
    }

    // Nuove funzioni per evidenziare celle critiche
    function setupCriticalCellHighlighting() {
        // Event listeners per le metriche di copertura critica
        const morningDeficit = document.getElementById('morning-deficit');
        const afternoonDeficit = document.getElementById('afternoon-deficit');
        const nightDeficit = document.getElementById('night-deficit');
        
        // Event listeners per le violazioni
        const restViolations = document.getElementById('rest-violations');
        const consecutiveViolations = document.getElementById('consecutive-violations');
        const hoursViolations = document.getElementById('hours-violations');
        
        if (morningDeficit) {
            morningDeficit.style.cursor = 'pointer';
            morningDeficit.addEventListener('click', () => highlightCriticalCells('coverage', 'M'));
        }
        
        if (afternoonDeficit) {
            afternoonDeficit.style.cursor = 'pointer';
            afternoonDeficit.addEventListener('click', () => highlightCriticalCells('coverage', 'P'));
        }
        
        if (nightDeficit) {
            nightDeficit.style.cursor = 'pointer';
            nightDeficit.addEventListener('click', () => highlightCriticalCells('coverage', 'N'));
        }
        
        if (restViolations) {
            restViolations.style.cursor = 'pointer';
            restViolations.addEventListener('click', () => highlightCriticalCells('violations', 'rest'));
        }
        
        if (consecutiveViolations) {
            consecutiveViolations.style.cursor = 'pointer';
            consecutiveViolations.addEventListener('click', () => highlightCriticalCells('violations', 'consecutive'));
        }
        
        if (hoursViolations) {
            hoursViolations.style.cursor = 'pointer';
            hoursViolations.addEventListener('click', () => highlightCriticalCells('violations', 'hours'));
        }
    }

    function highlightCriticalCells(type, subtype) {
        // Rimuovi evidenziazioni precedenti
        clearCriticalHighlights();
        
        const year = appState.currentDate.getFullYear();
        const month = appState.currentDate.getMonth();
        const monthKey = getMonthKey(appState.currentDate);
        const daysInMonth = getDaysInMonth(year, month);
        const operators = getActiveOperators(year, month, false);
        
        let criticalCells = [];
        
        if (type === 'coverage') {
            // Trova celle con deficit di copertura per il turno specificato
            for (let day = 1; day <= daysInMonth; day++) {
                const daySummary = getDaySummary(day);
                const optimal = appState.coverageOptimal[subtype] || 0;
                const actual = daySummary.coverage[subtype] || 0;
                const deficit = optimal - actual;
                
                if (deficit > 0) {
                    // Trova operatori che potrebbero coprire questo turno
                    operators.forEach(op => {
                        const cellKey = `${op.id}-${day}`;
                        const data = appState.plannerData[monthKey]?.[cellKey];
                        
                        // Evidenzia celle vuote o con riposo che potrebbero essere assegnate
                        if (!data || !data.turno || data.turno === 'R') {
                            criticalCells.push({ opId: op.id, day: day, reason: `Deficit ${subtype}: -${deficit}` });
                        }
                    });
                }
            }
        } else if (type === 'violations') {
            // Trova celle con violazioni del tipo specificato
            operators.forEach(op => {
                for (let day = 1; day <= daysInMonth; day++) {
                    const cellKey = `${op.id}-${day}`;
                    const data = appState.plannerData[monthKey]?.[cellKey];
                    
                    if (data?.violations && data.violations.length > 0) {
                        let hasTargetViolation = false;
                        let violationReason = '';
                        
                        data.violations.forEach(violation => {
                            if (subtype === 'rest' && violation.includes('Riposo insufficiente')) {
                                hasTargetViolation = true;
                                violationReason = violation;
                            } else if (subtype === 'consecutive' && violation.includes('consecutivi')) {
                                hasTargetViolation = true;
                                violationReason = violation;
                            } else if (subtype === 'hours' && (violation.includes('ore') || violation.includes('settimanali'))) {
                                hasTargetViolation = true;
                                violationReason = violation;
                            }
                        });
                        
                        if (hasTargetViolation) {
                            criticalCells.push({ opId: op.id, day: day, reason: violationReason });
                        }
                    }
                }
            });
        }
        
        // Applica evidenziazione alle celle critiche
        criticalCells.forEach(cell => {
            const cellElement = document.querySelector(`td[data-op-id="${cell.opId}"][data-day="${cell.day}"]`);
            if (cellElement) {
                cellElement.classList.add('critical-highlighted');
                cellElement.title = cell.reason;
                
                // Evidenzia anche la riga e la colonna per maggiore visibilità
                const row = cellElement.closest('tr');
                if (row) row.classList.add('critical-row-highlighted');
                
                const dayHeaders = document.querySelectorAll(`th[data-day-col="${cell.day}"]`);
                dayHeaders.forEach(header => header.classList.add('critical-col-highlighted'));
            }
        });
        
        // Mostra messaggio informativo
        if (criticalCells.length > 0) {
            showToast(`Evidenziate ${criticalCells.length} celle critiche per ${type === 'coverage' ? 'copertura' : 'violazioni'} ${subtype}`, 'info');
            
            // Scorri automaticamente alla prima cella critica
            const firstCell = document.querySelector('.critical-highlighted');
            if (firstCell) {
                firstCell.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            }
        } else {
            showToast(`Nessuna cella critica trovata per ${type === 'coverage' ? 'copertura' : 'violazioni'} ${subtype}`, 'info');
        }
    }

    function clearCriticalHighlights() {
        // Rimuovi tutte le evidenziazioni critiche
        document.querySelectorAll('.critical-highlighted').forEach(el => {
            el.classList.remove('critical-highlighted');
            el.removeAttribute('title');
        });
        
        document.querySelectorAll('.critical-row-highlighted').forEach(el => {
            el.classList.remove('critical-row-highlighted');
        });
        
        document.querySelectorAll('.critical-col-highlighted').forEach(el => {
            el.classList.remove('critical-col-highlighted');
        });
    }

    function updateSystemStatus(metrics) {
        const openBtn = document.getElementById('open-emergency-dashboard');
        if (openBtn) {
            openBtn.className = openBtn.className.replace(/bg-(red|orange|blue)-500/, '').replace(/hover:bg-(red|orange|blue)-600/, '');
            openBtn.style.animation = 'none';
            if (metrics.systemStatus === 'critical') {
                openBtn.classList.add('bg-red-500', 'hover:bg-red-600');
                openBtn.style.animation = 'pulse 1s infinite';
            } else if (metrics.systemStatus === 'warning') {
                openBtn.classList.add('bg-orange-500', 'hover:bg-orange-600');
            } else {
                openBtn.classList.add('bg-blue-500', 'hover:bg-blue-600');
            }
        }
    }

    async function autoResolveCoverage() {
        const confirmed = await showConfirmation('Risolvere automaticamente i deficit di copertura?', 'Risoluzione Automatica');
        if (!confirmed) return;

        const metrics = calculateEmergencyMetrics();
        
        if (metrics.criticalDays && metrics.criticalDays.length > 0) {
            const deficitsToSolve = metrics.criticalDays.flatMap(dayInfo => 
                Object.entries(dayInfo.deficits)
                    .filter(([shift, count]) => count > 0)
                    .map(([shift, count]) => ({ day: dayInfo.day, shift: shift.toUpperCase(), missing: count }))
            );

            if (deficitsToSolve.length > 0) {
                suggestEmergencySolutions(deficitsToSolve);
            } else {
                showToast('Nessun deficit specifico trovato nei giorni critici.', 'info');
            }
        } else {
            showToast('Nessun deficit di copertura critico da risolvere.', 'info');
        }
    }

    function performEmergencyBackup() {
        performIncrementalBackup('emergency', 'Backup manuale di emergenza');
    }

    async function resetAllViolations() {
        const confirmed = await showConfirmation('Resettare e ricalcolare tutte le violazioni?', 'Reset Violazioni');
        if (!confirmed) return;
        validatePlanner();
        renderPlanner();
        updateEmergencyDashboard();
        showToast('Violazioni ricalcolate.', 'success');
    }

    function startAutoBackup() {
        if (backupState.intervalId) clearInterval(backupState.intervalId);
        backupState.intervalId = setInterval(() => performIncrementalBackup('scheduled'), backupState.intervalMinutes * 60 * 1000);
    }

    function stopAutoBackup() {
        clearInterval(backupState.intervalId);
        backupState.intervalId = null;
    }

    function performIncrementalBackup(type = 'manual', reason = '') {
        try {
            const timestamp = new Date().toISOString();
            const backupId = `backup_${timestamp.replace(/[:.]/g, '-')}`;
            
            const backupData = {
                id: backupId,
                timestamp,
                type,
                reason,
                data: { appState: JSON.parse(JSON.stringify(appState)) }
            };
            
            localStorage.setItem(backupId, JSON.stringify(backupData));
            
            let backupIndex = JSON.parse(localStorage.getItem('backup_index') || '[]');
            backupIndex.push({ id: backupId, timestamp, type, reason });
            if (backupIndex.length > backupState.maxBackups) {
                const oldBackup = backupIndex.shift();
                localStorage.removeItem(oldBackup.id);
            }
            localStorage.setItem('backup_index', JSON.stringify(backupIndex));
            
            backupState.lastBackup = timestamp;
            saveBackupSettings();
            updateBackupUI();
            
            // Download automatico se abilitato
            if (backupState.autoDownload && type !== 'emergency') {
                downloadBackup(backupId);
            }

            const message = type === 'manual' ? 'Backup manuale completato' : `Backup automatico creato: ${backupId}`;
            showToast(message, 'success');
            return backupId;
        } catch (error) {
            console.error('Errore durante il backup:', error);
            showToast('Errore durante il backup', 'error');
            return false;
        }
    }

    function saveBackupSettings() {
        localStorage.setItem('backup_settings', JSON.stringify(backupState));
    }

    // Nuove funzioni per gestione avanzata backup
    function downloadBackup(backupId) {
        try {
            const backupData = localStorage.getItem(backupId);
            if (!backupData) {
                showToast('Backup non trovato', 'error');
                return;
            }

            const backup = JSON.parse(backupData);
            const filename = `gestione_turni_backup_${backup.timestamp.split('T')[0]}_${backup.type}.json`;
            
            const blob = new Blob([JSON.stringify(backup.data.appState, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showToast(`Backup scaricato: ${filename}`, 'success');
        } catch (error) {
            console.error('Errore download backup:', error);
            showToast('Errore durante il download', 'error');
        }
    }

    function downloadAllBackups() {
        const backupIndex = JSON.parse(localStorage.getItem('backup_index') || '[]');
        if (backupIndex.length === 0) {
            showToast('Nessun backup disponibile', 'info');
            return;
        }

        backupIndex.forEach(backup => {
            setTimeout(() => downloadBackup(backup.id), 100);
        });
        
        showToast(`Download di ${backupIndex.length} backup avviato`, 'success');
    }

    function restoreFromBackup(backupId) {
        try {
            const backupData = localStorage.getItem(backupId);
            if (!backupData) {
                showToast('Backup non trovato', 'error');
                return;
            }

            const backup = JSON.parse(backupData);
            const confirmed = confirm(`Ripristinare il backup del ${new Date(backup.timestamp).toLocaleString()}?\n\nTipo: ${backup.type}\nMotivo: ${backup.reason || 'N/A'}\n\nATTENZIONE: Tutti i dati correnti verranno sostituiti!`);
            
            if (!confirmed) return;

            // Backup di emergenza prima del ripristino
            performIncrementalBackup('emergency', 'Backup automatico prima del ripristino');
            
            // Ripristina i dati
            Object.assign(appState, backup.data.appState);
            localStorage.setItem('appState', JSON.stringify(appState));
            
            // Ricarica l'interfaccia
            location.reload();
            
        } catch (error) {
            console.error('Errore ripristino backup:', error);
            showToast('Errore durante il ripristino', 'error');
        }
    }

    function deleteBackup(backupId) {
        const confirmed = confirm('Eliminare definitivamente questo backup?');
        if (!confirmed) return;

        try {
            localStorage.removeItem(backupId);
            
            let backupIndex = JSON.parse(localStorage.getItem('backup_index') || '[]');
            backupIndex = backupIndex.filter(backup => backup.id !== backupId);
            localStorage.setItem('backup_index', JSON.stringify(backupIndex));
            
            updateBackupUI();
            showToast('Backup eliminato', 'success');
        } catch (error) {
            console.error('Errore eliminazione backup:', error);
            showToast('Errore durante l\'eliminazione', 'error');
        }
    }

    function clearOldBackups() {
        const confirmed = confirm('Eliminare tutti i backup tranne gli ultimi 3?');
        if (!confirmed) return;

        try {
            let backupIndex = JSON.parse(localStorage.getItem('backup_index') || '[]');
            const toKeep = backupIndex.slice(-3);
            const toDelete = backupIndex.slice(0, -3);
            
            toDelete.forEach(backup => {
                localStorage.removeItem(backup.id);
            });
            
            localStorage.setItem('backup_index', JSON.stringify(toKeep));
            updateBackupUI();
            
            showToast(`${toDelete.length} backup vecchi eliminati`, 'success');
        } catch (error) {
            console.error('Errore pulizia backup:', error);
            showToast('Errore durante la pulizia', 'error');
        }
    }

    function renderBackupList() {
        const backupList = document.getElementById('backup-list');
        const backupIndex = JSON.parse(localStorage.getItem('backup_index') || '[]');
        
        if (backupIndex.length === 0) {
            backupList.innerHTML = '<div class="text-gray-500 text-xs text-center py-2">Nessun backup disponibile</div>';
            return;
        }

        backupList.innerHTML = backupIndex.slice(-10).reverse().map(backup => {
            const date = new Date(backup.timestamp);
            const timeStr = date.toLocaleString('it-IT', { 
                day: '2-digit', 
                month: '2-digit', 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            return `
                <div class="backup-item">
                    <div class="backup-item-info">
                        <div class="backup-item-time">${timeStr}</div>
                        <div class="backup-item-type">${backup.type} ${backup.reason ? '- ' + backup.reason : ''}</div>
                    </div>
                    <div class="backup-item-actions">
                        <button class="backup-item-btn download" onclick="downloadBackup('${backup.id}')" title="Scarica">📥</button>
                        <button class="backup-item-btn restore" onclick="restoreFromBackup('${backup.id}')" title="Ripristina">🔄</button>
                        <button class="backup-item-btn delete" onclick="deleteBackup('${backup.id}')" title="Elimina">🗑️</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    function showBackupPanel() {
        console.log('showBackupPanel chiamata');
        const backupPanel = document.getElementById('backup-panel');
        if (backupPanel) {
            backupPanel.classList.remove('hidden');
            backupPanel.style.display = 'block';
            console.log('Pannello backup mostrato');
            updateBackupUI();
        } else {
            console.error('Elemento backup-panel non trovato!');
        }
    }

    function hideBackupPanel() {
        const backupPanel = document.getElementById('backup-panel');
        if (backupPanel) {
            backupPanel.classList.add('hidden');
            backupPanel.style.display = 'none';
        }
    }

    function showBackupSettings() {
        document.getElementById('backup-interval').value = backupState.intervalMinutes;
        document.getElementById('backup-max-count').value = backupState.maxBackups;
        document.getElementById('backup-emergency-enabled').checked = backupState.emergencyBackupEnabled;
        document.getElementById('backup-auto-enabled').checked = backupState.isEnabled;
        document.getElementById('backup-auto-download').checked = backupState.autoDownload || false;
        document.getElementById('backup-pre-operation').checked = backupState.backupBeforeCritical || false;
        document.getElementById('backup-settings-modal').style.display = 'flex';
    }

    function hideBackupSettings() {
        document.getElementById('backup-settings-modal').style.display = 'none';
    }

    function saveBackupSettingsFromUI() {
        backupState.intervalMinutes = parseInt(document.getElementById('backup-interval').value);
        backupState.maxBackups = parseInt(document.getElementById('backup-max-count').value);
        backupState.emergencyBackupEnabled = document.getElementById('backup-emergency-enabled').checked;
        backupState.isEnabled = document.getElementById('backup-auto-enabled').checked;
        backupState.autoDownload = document.getElementById('backup-auto-download').checked;
        backupState.backupBeforeCritical = document.getElementById('backup-pre-operation').checked;
        
        if (backupState.isEnabled) startAutoBackup(); else stopAutoBackup();
        
        saveBackupSettings();
        updateBackupUI();
        hideBackupSettings();
        showToast('Impostazioni backup salvate', 'success');
    }

    function toggleAutoBackup() {
        backupState.isEnabled = !backupState.isEnabled;
        if (backupState.isEnabled) {
            startAutoBackup();
            showToast('Backup automatico avviato', 'success');
        } else {
            stopAutoBackup();
            showToast('Backup automatico fermato', 'info');
        }
        saveBackupSettings();
        updateBackupUI();
    }

    function updateBackupUI() {
        const stats = {
            count: JSON.parse(localStorage.getItem('backup_index') || '[]').length,
            lastBackup: backupState.lastBackup,
            isEnabled: backupState.isEnabled,
            intervalMinutes: backupState.intervalMinutes
        };
        
        const statusText = document.getElementById('backup-status-text');
        if (statusText) statusText.textContent = stats.isEnabled ? 'Attivo' : 'Inattivo';

        const lastTimeEl = document.getElementById('backup-last-time');
        if (lastTimeEl) lastTimeEl.textContent = stats.lastBackup ? new Date(stats.lastBackup).toLocaleTimeString() : 'Mai';
        
        const nextTimeEl = document.getElementById('backup-next-time');
        if (nextTimeEl && stats.isEnabled && stats.lastBackup) {
            const next = new Date(new Date(stats.lastBackup).getTime() + stats.intervalMinutes * 60000);
            nextTimeEl.textContent = next.toLocaleTimeString();
        } else if (nextTimeEl) {
            nextTimeEl.textContent = stats.isEnabled ? 'Presto' : '--';
        }
        
        const countEl = document.getElementById('backup-count');
        if (countEl) countEl.textContent = stats.count;

        const toggleBtn = document.getElementById('btn-toggle-auto-backup');
        if (toggleBtn) {
            toggleBtn.textContent = stats.isEnabled ? 'Pausa' : 'Avvia';
        }
        
        // Aggiorna la lista dei backup
        renderBackupList();
    }

    function initializeAutoBackup() {
        const savedSettings = localStorage.getItem('backup_settings');
        if (savedSettings) {
            try {
                Object.assign(backupState, JSON.parse(savedSettings));
            } catch (error) {
                console.warn('Errore caricamento impostazioni backup:', error);
            }
        }
        if (backupState.isEnabled) startAutoBackup();
        console.log('Sistema di backup automatico inizializzato.');
    }

    function initializeBackupUI() {
        // Controlli di sicurezza per verificare l'esistenza degli elementi
        const openBackupPanel = document.getElementById('open-backup-panel');
        const closeBackupPanel = document.getElementById('close-backup-panel');
        const btnManualBackup = document.getElementById('btn-manual-backup');
        const btnToggleAutoBackup = document.getElementById('btn-toggle-auto-backup');
        const btnBackupSettings = document.getElementById('btn-backup-settings');
        const closeBackupSettings = document.getElementById('close-backup-settings');
        const btnCancelBackupSettings = document.getElementById('btn-cancel-backup-settings');
        const btnSaveBackupSettings = document.getElementById('btn-save-backup-settings');
        const btnDownloadAllBackups = document.getElementById('btn-download-all-backups');
        const btnClearOldBackups = document.getElementById('btn-clear-old-backups');

        // Aggiungi event listener solo se gli elementi esistono
        if (openBackupPanel) {
            openBackupPanel.addEventListener('click', showBackupPanel);
        } else {
            console.error('Elemento open-backup-panel non trovato!');
        }
        
        if (closeBackupPanel) {
            closeBackupPanel.addEventListener('click', hideBackupPanel);
        }
        
        if (btnManualBackup) {
            btnManualBackup.addEventListener('click', () => performIncrementalBackup('manual'));
        }
        
        if (btnToggleAutoBackup) {
            btnToggleAutoBackup.addEventListener('click', toggleAutoBackup);
        }
        
        if (btnBackupSettings) {
            btnBackupSettings.addEventListener('click', showBackupSettings);
        }
        
        if (closeBackupSettings) {
            closeBackupSettings.addEventListener('click', hideBackupSettings);
        }
        
        if (btnCancelBackupSettings) {
            btnCancelBackupSettings.addEventListener('click', hideBackupSettings);
        }
        
        if (btnSaveBackupSettings) {
            btnSaveBackupSettings.addEventListener('click', saveBackupSettingsFromUI);
        }
        
        // Nuovi event listener per funzionalità avanzate
        if (btnDownloadAllBackups) {
            btnDownloadAllBackups.addEventListener('click', downloadAllBackups);
        }
        
        if (btnClearOldBackups) {
            btnClearOldBackups.addEventListener('click', clearOldBackups);
        }
    }

    // =================================================================================
    // PERSONALIZZAZIONE GRIGLIA
    // =================================================================================

    // Configurazione predefinita della griglia
    const gridPresets = {
        'ultra-compact': {
            density: 0.7,
            textScale: 0.8,
            tableGap: 0.5,
            borderRadius: 2
        },
        'normal': {
            density: 1.0,
            textScale: 1.4,
            tableGap: 1,
            borderRadius: 4
        },
        'spacious': {
            density: 1.3,
            textScale: 1.1,
            tableGap: 2,
            borderRadius: 6
        }
    };

    // Funzione per applicare le impostazioni della griglia
    function applyGridSettings(settings) {
        const root = document.documentElement;
        root.style.setProperty('--grid-density', settings.density);
        root.style.setProperty('--text-scale', settings.textScale);
        root.style.setProperty('--table-gap', settings.tableGap + 'px');
        root.style.setProperty('--border-radius', (settings.borderRadius / 16) + 'rem');
        
        // Aggiorna i valori degli slider
        const densitySlider = document.getElementById('grid-density-slider');
        const textScaleSlider = document.getElementById('text-scale-slider');
        const tableGapSlider = document.getElementById('table-gap-slider');
        const borderRadiusSlider = document.getElementById('border-radius-slider');
        
        if (densitySlider) densitySlider.value = settings.density;
        if (textScaleSlider) textScaleSlider.value = settings.textScale;
        if (tableGapSlider) tableGapSlider.value = settings.tableGap;
        if (borderRadiusSlider) borderRadiusSlider.value = settings.borderRadius;
        
        // Aggiorna i display dei valori
        updateGridControlValues();
        
        // Salva le impostazioni
        saveGridSettings(settings);
    }

    // Funzione per aggiornare i valori visualizzati
    function updateGridControlValues() {
        const densityValue = document.getElementById('grid-density-value');
        const textScaleValue = document.getElementById('text-scale-value');
        const tableGapValue = document.getElementById('table-gap-value');
        const borderRadiusValue = document.getElementById('border-radius-value');
        
        const densitySlider = document.getElementById('grid-density-slider');
        const textScaleSlider = document.getElementById('text-scale-slider');
        const tableGapSlider = document.getElementById('table-gap-slider');
        const borderRadiusSlider = document.getElementById('border-radius-slider');
        
        if (densityValue && densitySlider) {
            densityValue.textContent = parseFloat(densitySlider.value).toFixed(1);
        }
        if (textScaleValue && textScaleSlider) {
            textScaleValue.textContent = parseFloat(textScaleSlider.value).toFixed(1);
        }
        if (tableGapValue && tableGapSlider) {
            tableGapValue.textContent = tableGapSlider.value + 'px';
        }
        if (borderRadiusValue && borderRadiusSlider) {
            borderRadiusValue.textContent = borderRadiusSlider.value + 'px';
        }
    }

    // Funzione per salvare le impostazioni
    function saveGridSettings(settings) {
        localStorage.setItem('gridCustomization', JSON.stringify(settings));
    }

    // Funzione per caricare le impostazioni salvate
    function loadGridSettings() {
        const saved = localStorage.getItem('gridCustomization');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.warn('Errore nel caricamento delle impostazioni griglia:', e);
            }
        }
        return gridPresets.normal;
    }

    // Funzione per inizializzare i controlli della griglia
    function initializeGridCustomization() {
        const panel = document.getElementById('grid-customization-panel');
        const toggle = document.getElementById('grid-customization-toggle');
        
        if (!panel || !toggle) return;
        
        // Toggle del pannello
        toggle.addEventListener('click', () => {
            const isVisible = panel.style.display !== 'none';
            panel.style.display = isVisible ? 'none' : 'block';
            toggle.classList.toggle('active', !isVisible);
        });
        
        // Event listeners per gli slider
        ['grid-density', 'text-scale', 'table-gap', 'border-radius'].forEach(control => {
            const slider = document.getElementById(control + '-slider');
            if (slider) {
                slider.addEventListener('input', () => {
                    const densitySlider = document.getElementById('grid-density-slider');
                    const textScaleSlider = document.getElementById('text-scale-slider');
                    const tableGapSlider = document.getElementById('table-gap-slider');
                    const borderRadiusSlider = document.getElementById('border-radius-slider');
                    
                    const settings = {
                        density: densitySlider ? parseFloat(densitySlider.value) : 1.0,
                        textScale: textScaleSlider ? parseFloat(textScaleSlider.value) : 1.0,
                        tableGap: tableGapSlider ? parseFloat(tableGapSlider.value) : 1,
                        borderRadius: borderRadiusSlider ? parseInt(borderRadiusSlider.value) : 4
                    };
                    applyGridSettings(settings);
                    
                    // Attiva il preset "custom"
                    document.querySelectorAll('.grid-preset-btn').forEach(btn => 
                        btn.classList.remove('active'));
                    const customBtn = document.querySelector('[data-preset="custom"]');
                    if (customBtn) customBtn.classList.add('active');
                });
            }
        });
        
        // Event listeners per i preset
        document.querySelectorAll('.grid-preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const preset = btn.dataset.preset;
                if (preset !== 'custom' && gridPresets[preset]) {
                    applyGridSettings(gridPresets[preset]);
                    
                    // Aggiorna UI
                    document.querySelectorAll('.grid-preset-btn').forEach(b => 
                        b.classList.remove('active'));
                    btn.classList.add('active');
                }
            });
        });
        
        // Reset button
        const resetBtn = document.getElementById('grid-reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                applyGridSettings(gridPresets.normal);
                document.querySelectorAll('.grid-preset-btn').forEach(btn => 
                    btn.classList.remove('active'));
                const normalBtn = document.querySelector('[data-preset="normal"]');
                if (normalBtn) normalBtn.classList.add('active');
            });
        }
        
        // Carica impostazioni salvate
        const savedSettings = loadGridSettings();
        applyGridSettings(savedSettings);
    }

    // =================================================================================
    // SISTEMA DI ADATTAMENTO AUTOMATICO DEL PLANNER
    // =================================================================================

    class PlannerAutoFit {
        constructor() {
            this.isEnabled = true; // Abilitato per garantire visibilità iniziale
            this.currentScale = 1;
            this.minScale = 0.5;
            this.maxScale = 2;
            this.scaleStep = 0.1;
            this.resizeTimeout = null;
            this.indicator = null;
            
            this.init();
        }
        
        init() {
            this.createIndicator();
            this.createZoomControls();
            this.bindEvents();
            this.calculateOptimalScale();
            
            // Osserva quando il planner diventa visibile
            this.observePlannerVisibility();
        }
        
        observePlannerVisibility() {
            const plannerDiv = document.getElementById('planner');
            if (!plannerDiv) return;
            
            // Usa MutationObserver per rilevare quando il planner diventa visibile
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && 
                        (mutation.attributeName === 'class' || mutation.attributeName === 'style')) {
                        const isHidden = plannerDiv.classList.contains('hidden') || 
                                       plannerDiv.style.display === 'none';
                        if (!isHidden && this.isEnabled) {
                            // Il planner è diventato visibile, ricalcola le dimensioni
                            setTimeout(() => this.calculateOptimalScale(), 100);
                        }
                    }
                });
            });
            
            observer.observe(plannerDiv, {
                attributes: true,
                attributeFilter: ['class', 'style']
            });
        }
        
        createIndicator() {
            this.indicator = document.createElement('div');
            this.indicator.className = 'viewport-indicator';
            this.indicator.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 12px;
                z-index: 1000;
                opacity: 0;
                transition: opacity 0.3s ease;
                pointer-events: none;
            `;
            document.body.appendChild(this.indicator);
        }
        
        createZoomControls() {
            const toolbar = document.getElementById('planner-toolbar');
            if (!toolbar) return;
            
            const controlsContainer = toolbar.querySelector('.flex-grow') || toolbar;
            
            const zoomControls = document.createElement('div');
            zoomControls.className = 'zoom-controls flex items-center gap-2 ml-4';
            zoomControls.innerHTML = `
                <button class="zoom-btn p-1 rounded hover:bg-gray-200" id="zoom-out" title="Riduci zoom">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 13H5v-2h14v2z"/>
                    </svg>
                </button>
                <span class="zoom-level text-sm font-medium min-w-[40px] text-center" id="zoom-level">100%</span>
                <button class="zoom-btn p-1 rounded hover:bg-gray-200" id="zoom-in" title="Aumenta zoom">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                    </svg>
                </button>
                <button class="zoom-btn p-1 rounded hover:bg-gray-200" id="zoom-fit" title="Adatta alla finestra">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M4 4h6v2H6v4H4V4zm10 0h6v6h-2V6h-4V4zM4 14h2v4h4v2H4v-6zm16 4h-4v2h6v-6h-2v4z"/>
                    </svg>
                </button>
            `;
            
            controlsContainer.appendChild(zoomControls);
            
            // Event listeners per i controlli zoom
            document.getElementById('zoom-out').addEventListener('click', () => this.zoomOut());
            document.getElementById('zoom-in').addEventListener('click', () => this.zoomIn());
            document.getElementById('zoom-fit').addEventListener('click', () => this.fitToWindow());
        }
        
        bindEvents() {
            // Resize della finestra
            window.addEventListener('resize', () => {
                clearTimeout(this.resizeTimeout);
                this.resizeTimeout = setTimeout(() => {
                    if (this.isEnabled) {
                        this.calculateOptimalScale();
                    }
                }, 150);
            });
            
            // Zoom con rotella del mouse
            const tableContainer = document.querySelector('.table-container');
            if (tableContainer) {
                tableContainer.addEventListener('wheel', (e) => {
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        const delta = e.deltaY > 0 ? -this.scaleStep : this.scaleStep;
                        this.setScale(this.currentScale + delta);
                    }
                });
                
                // Panning con mouse
                this.setupPanning(tableContainer);
            }
        }
        
        setupPanning(container) {
            let isPanning = false;
            let startX, startY, scrollLeft, scrollTop;
            
            container.addEventListener('mousedown', (e) => {
                if (e.button === 1 || (e.button === 0 && e.ctrlKey)) { // Middle click o Ctrl+click
                    isPanning = true;
                    container.classList.add('panning');
                    startX = e.pageX - container.offsetLeft;
                    startY = e.pageY - container.offsetTop;
                    scrollLeft = container.scrollLeft;
                    scrollTop = container.scrollTop;
                    e.preventDefault();
                }
            });
            
            container.addEventListener('mousemove', (e) => {
                if (!isPanning) {
                    container.classList.toggle('grab-cursor', e.ctrlKey);
                    return;
                }
                
                e.preventDefault();
                const x = e.pageX - container.offsetLeft;
                const y = e.pageY - container.offsetTop;
                const walkX = (x - startX) * 2;
                const walkY = (y - startY) * 2;
                container.scrollLeft = scrollLeft - walkX;
                container.scrollTop = scrollTop - walkY;
            });
            
            container.addEventListener('mouseup', () => {
                isPanning = false;
                container.classList.remove('panning');
            });
            
            container.addEventListener('mouseleave', () => {
                isPanning = false;
                container.classList.remove('panning', 'grab-cursor');
            });
        }
        
        calculateOptimalScale() {
            const container = document.querySelector('.table-container');
            const table = document.getElementById('planner-table');
            
            if (!container || !table) return;
            
            // Assicurati che il planner sia visibile
            const plannerDiv = document.getElementById('planner');
            if (plannerDiv && plannerDiv.classList.contains('hidden')) {
                // Se il planner è nascosto, riprova dopo un breve ritardo
                setTimeout(() => this.calculateOptimalScale(), 100);
                return;
            }
            
            // Ottieni dimensioni disponibili
            const containerRect = container.getBoundingClientRect();
            const tableRect = table.getBoundingClientRect();
            
            if (tableRect.width === 0 || tableRect.height === 0) {
                // Se le dimensioni sono ancora 0, riprova dopo un breve ritardo
                setTimeout(() => this.calculateOptimalScale(), 100);
                return;
            }
            
            // Calcola scale per adattare larghezza e altezza con margini
            const marginX = 20; // Margine orizzontale
            const marginY = 20; // Margine verticale
            const scaleX = (containerRect.width - marginX) / tableRect.width;
            const scaleY = (containerRect.height - marginY) / tableRect.height;
            
            // Usa la scala minore per garantire che tutto sia visibile
            // Limita la scala massima iniziale a 0.95 per evitare che sia troppo grande
            const optimalScale = Math.min(scaleX, scaleY, 0.95);
            
            // Applica solo se significativamente diverso
            if (Math.abs(optimalScale - this.currentScale) > 0.05) {
                this.setScale(Math.max(optimalScale, this.minScale));
            }
        }
        
        setScale(scale) {
            scale = Math.max(this.minScale, Math.min(this.maxScale, scale));
            this.currentScale = scale;
            
            // Applica la scala
            const table = document.getElementById('planner-table');
            if (table) {
                table.style.transform = `scale(${scale})`;
                table.style.transformOrigin = 'top left';
            }
            
            // Aggiorna indicatore
            this.updateZoomLevel();
            this.showIndicator(`Zoom: ${Math.round(scale * 100)}%`);
            
            // Salva preferenza
            localStorage.setItem('plannerScale', scale.toString());
        }
        
        updateZoomLevel() {
            const zoomLevel = document.getElementById('zoom-level');
            if (zoomLevel) {
                zoomLevel.textContent = `${Math.round(this.currentScale * 100)}%`;
            }
        }
        
        zoomIn() {
            this.setScale(this.currentScale + this.scaleStep);
        }
        
        zoomOut() {
            this.setScale(this.currentScale - this.scaleStep);
        }
        
        fitToWindow() {
            this.calculateOptimalScale();
            this.showIndicator('Adattato alla finestra');
        }
        
        showIndicator(message) {
            if (!this.indicator) return;
            
            this.indicator.textContent = message;
            this.indicator.style.opacity = '1';
            
            setTimeout(() => {
                this.indicator.style.opacity = '0';
            }, 2000);
        }
        
        loadSavedScale() {
            const saved = localStorage.getItem('plannerScale');
            if (saved) {
                this.setScale(parseFloat(saved));
            }
        }
        
        toggle() {
            this.isEnabled = !this.isEnabled;
            if (this.isEnabled) {
                this.calculateOptimalScale();
                this.showIndicator('Adattamento automatico attivato');
            } else {
                this.showIndicator('Adattamento automatico disattivato');
            }
        }
    }

    function initializePlannerAutoFit() {
        // Aspetta che il DOM sia pronto
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                window.plannerAutoFit = new PlannerAutoFit();
            });
        } else {
            window.plannerAutoFit = new PlannerAutoFit();
        }
    }

    function updatePlannerLayout() {
        if (window.plannerAutoFit) {
            // Ritarda leggermente per permettere al DOM di aggiornarsi
            setTimeout(() => {
                window.plannerAutoFit.calculateOptimalScale();
            }, 100);
        }
    }



    // =================================================================================
    // FUNZIONE PER ATTIVARE SCHERMO INTERO ORIZZONTALE
    // =================================================================================

    function enableFullscreenLandscape() {
        // Funzione per richiedere il fullscreen
        function requestFullscreen() {
            const element = document.documentElement;
            
            if (element.requestFullscreen) {
                element.requestFullscreen();
            } else if (element.webkitRequestFullscreen) {
                element.webkitRequestFullscreen();
            } else if (element.mozRequestFullScreen) {
                element.mozRequestFullScreen();
            } else if (element.msRequestFullscreen) {
                element.msRequestFullscreen();
            }
        }
        
        // Funzione per impostare l'orientamento orizzontale
        function setLandscapeOrientation() {
            if (screen.orientation && screen.orientation.lock) {
                screen.orientation.lock('landscape').catch(err => {
                    console.log('Impossibile bloccare l\'orientamento:', err);
                });
            } else if (screen.lockOrientation) {
                screen.lockOrientation('landscape');
            } else if (screen.webkitLockOrientation) {
                screen.webkitLockOrientation('landscape');
            } else if (screen.mozLockOrientation) {
                screen.mozLockOrientation('landscape');
            }
        }
        
        // Attiva fullscreen e orientamento orizzontale dopo un breve ritardo
        setTimeout(() => {
            // Prima imposta l'orientamento
            setLandscapeOrientation();
            
            // Poi richiedi il fullscreen
            setTimeout(() => {
                requestFullscreen();
            }, 500);
            
            // Mostra un messaggio informativo
            showToast('Modalità schermo intero orizzontale attivata', 'success', 3000);
        }, 1000);
        
        // Aggiungi listener per gestire l'uscita dal fullscreen
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('mozfullscreenchange', handleFullscreenChange);
        document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    }

    // Gestisce i cambiamenti dello stato fullscreen
    function handleFullscreenChange() {
        const isFullscreen = !!(document.fullscreenElement || 
                               document.webkitFullscreenElement || 
                               document.mozFullScreenElement || 
                               document.msFullscreenElement);
        
        if (isFullscreen) {
            console.log('Entrato in modalità schermo intero');
            // Applica stili specifici per il fullscreen se necessario
            document.body.classList.add('fullscreen-mode');
        } else {
            console.log('Uscito dalla modalità schermo intero');
            document.body.classList.remove('fullscreen-mode');
        }
    }

    // Funzione per uscire dalla modalità schermo intero
    function exitFullscreen() {
        try {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
            
            // Sblocca l'orientamento se possibile
            if (screen.orientation && screen.orientation.unlock) {
                screen.orientation.unlock();
            }
        } catch (error) {
            console.error('Errore nell\'uscita dallo schermo intero:', error);
        }
    }

    // Aggiungi listener per il tasto ESC per uscire dallo schermo intero
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.fullscreenElement) {
            exitFullscreen();
        }
    });

    // Esponi le funzioni globalmente per uso nei controlli UI
    window.enableFullscreenLandscape = enableFullscreenLandscape;
    window.exitFullscreen = exitFullscreen;

    // =================================================================================
    // INIZIALIZZAZIONE
    // =================================================================================

    function initApp() {
        document.getElementById('splash-version').textContent = APP_VERSION;

        setTimeout(() => {
            document.getElementById('splash-screen').classList.add('hidden');
            const appElement = document.getElementById('app');
            appElement.classList.remove('hidden');
            appElement.classList.add('flex');

            const savedState = localStorage.getItem('appState');
            if (savedState) {
                try {
                    const parsedState = JSON.parse(savedState);
                    appState = { ...appState, ...parsedState };
                    if (typeof appState.plannerData !== 'object' || appState.plannerData === null) appState.plannerData = {};
                    if (!appState.daySummaryModalPosition) appState.daySummaryModalPosition = { top: null, left: null };
                    if (!appState.reasons) appState.reasons = defaultSettings.reasons;
                    if (!appState.validationRules) appState.validationRules = defaultSettings.validationRules;
                    if (!appState.matriceSwaps) appState.matriceSwaps = [];
                    if (!appState.orderingSchemes) appState.orderingSchemes = [];

                    appState.currentDate = new Date(appState.currentDate);
                    console.log("Stato caricato con successo dal localStorage.");
                } catch (e) {
                    console.error("Errore nel parsing dello stato salvato, carico le impostazioni predefinite.", e);
                    appState = { ...appState, ...defaultSettings, plannerData: {} };
                    showConfirmation(`Errore nel caricamento dei dati salvati. Caricate le impostazioni predefinite.`, "Errore Caricamento", true);
                }
            } else {
                appState = { ...appState, ...defaultSettings, plannerData: {} };
                showConfirmation(`Applicato il template e caricate le impostazioni predefinite.`, "Template Caricato", true);
            }
            appState.operatori.forEach(op => {
                if (!op.unavailabilities) op.unavailabilities = [];
            });
            finishInitialization();
        }, 1500);
    }

    function finishInitialization() {
        if (!appState.operatori || !Array.isArray(appState.operatori)) {
            appState.operatori = [];
        }
        if (appState.operatori.some(op => op.ordine === undefined)) {
            appState.operatori.sort((a, b) => a.id - b.id).forEach((op, index) => op.ordine = index + 1);
        }

        setupEventListeners();
        setupDeactivationChoiceListeners();
        
        initializeEmergencyDashboard();
        initializeAutoBackup();
        initializeBackupUI();
        initializeGridCustomization();
        initializePlannerAutoFit();
        initializeMobileInterface();
        
        // Aggiungi event listeners per il sistema di chiamate
        document.getElementById('view-call-history')?.addEventListener('click', () => {
            substituteCallSystem.showCallHistory();
        });

        document.getElementById('toggle-call-system')?.addEventListener('click', () => {
            substituteCallSystem.toggleSystem();
        });
        
        // NUOVA FUNZIONALITÀ: Attiva schermo intero orizzontale all'avvio
        enableFullscreenLandscape();
        
        window.initializeCommunicationSystem = () => console.log("Comm System Init Placeholder");
        window.initializeCommunicationUI = () => console.log("Comm UI Init Placeholder");

        applyAppearance();
        syncUiWithState();
        renderPlanner();
        renderDashboard();
        renderSettings();
        renderPrintLegend();
        
        saveHistoryState();

        setInterval(() => {
            localStorage.setItem('appState', JSON.stringify(appState));
        }, 300000); // Salva ogni 5 minuti

        // Forza la visualizzazione del planner all'avvio
        setTimeout(() => {
            const plannerTab = document.querySelector('.header-nav-link[data-tab="planner"]');
            if (plannerTab) {
                plannerTab.click();
                // Assicurati che il planner sia visibile
                const plannerDiv = document.getElementById('planner');
                if (plannerDiv) {
                    plannerDiv.classList.remove('hidden');
                    plannerDiv.style.display = '';
                    
                    // Forza il ricalcolo delle dimensioni dopo che il planner è visibile
                    setTimeout(() => {
                        if (window.plannerAutoFit) {
                            window.plannerAutoFit.calculateOptimalScale();
                        }
                    }, 200);
                }
            }
        }, 100);
        
        makeModalDraggableAndResizable('modal-suggestion');
        makeModalDraggableAndResizable('modal-day-summary');
    }

    initApp();

    // =================================================================================
    // SISTEMA DI CHIAMATE DI SOSTITUZIONE INTEGRATO
    // =================================================================================

    const substituteCallSystem = {
        calls: [],
        
        init() {
            // Carica lo stato di abilitazione
            const enabled = localStorage.getItem('substituteCallSystemEnabled');
            this.isEnabled = enabled !== 'false'; // Default: abilitato
            
            this.loadCalls();
            this.updateCallIndicators();
            
            // Aggiorna gli indicatori ogni 30 secondi
            setInterval(() => {
                this.updateCallIndicators();
            }, 30000);
        },
        
        createCall(opId, day, reason = '') {
            const callId = Date.now().toString();
            const call = {
                id: callId,
                opId: opId,
                day: day,
                reason: reason,
                timestamp: new Date().toISOString(),
                status: 'active',
                responses: []
            };
            
            this.calls.push(call);
            this.saveCalls();
            this.updateCallIndicators();
            
            return callId;
        },
        
        respondToCall(callId, responderOpId, message = '') {
            const call = this.calls.find(c => c.id === callId);
            if (!call || call.status !== 'active') return false;
            
            // Verifica se l'operatore ha già risposto
            const existingResponse = call.responses.find(r => r.opId === responderOpId);
            if (existingResponse) return false;
            
            const response = {
                opId: responderOpId,
                message: message,
                timestamp: new Date().toISOString()
            };
            
            call.responses.push(response);
            this.saveCalls();
            this.updateCallIndicators();
            
            return true;
        },
        
        closeCall(callId) {
            const callIndex = this.calls.findIndex(c => c.id === callId);
            if (callIndex === -1) return false;
            
            this.calls[callIndex].status = 'closed';
            this.saveCalls();
            this.updateCallIndicators();
            
            return true;
        },
        
        getActiveCalls() {
            return this.calls.filter(call => call.status === 'active');
        },
        
        getCallsForCell(opId, day) {
            return this.calls.filter(call => 
                call.opId === opId && 
                call.day === day && 
                call.status === 'active'
            );
        },
        
        updateCallIndicators() {
            // Non aggiornare se il sistema è disabilitato
            if (!this.isEnabled) return;
            
            // Rimuovi tutti gli indicatori esistenti
            document.querySelectorAll('.call-indicator, .call-active-indicator, .response-available-indicator').forEach(el => el.remove());
            document.querySelectorAll('.cell-has-call, .cell-can-respond').forEach(el => {
                el.classList.remove('cell-has-call', 'cell-can-respond');
            });
            
            const activeCalls = this.getActiveCalls();
            
            activeCalls.forEach(call => {
                const cell = document.querySelector(`[data-op-id="${call.opId}"][data-day="${call.day}"]`);
                if (cell) {
                    // Aggiungi indicatore di chiamata attiva
                    cell.classList.add('cell-has-call');
                    
                    const indicator = document.createElement('div');
                    indicator.className = 'call-active-indicator';
                    indicator.textContent = '📞';
                    indicator.title = `Chiamata attiva: ${call.reason || 'Richiesta sostituzione'}`;
                    cell.appendChild(indicator);
                    
                    // Badge con numero di risposte - QUESTO È IL BADGE NUMERICO
                    if (call.responses.length > 0) {
                        const badge = document.createElement('div');
                        badge.className = 'call-indicator';
                        badge.textContent = call.responses.length;
                        badge.title = `${call.responses.length} risposta/e ricevute`;
                        cell.appendChild(badge);
                    }
                }
            });
            
            // Mostra indicatori per celle che possono rispondere
            const activeOperators = getActiveOperators(appState.currentDate.getFullYear(), appState.currentDate.getMonth());
            const monthKey = getMonthKey(appState.currentDate);
            
            activeCalls.forEach(call => {
                activeOperators.forEach(op => {
                    if (op.id === call.opId) return; // Non può rispondere a se stesso
                    
                    const cell = document.querySelector(`[data-op-id="${op.id}"][data-day="${call.day}"]`);
                    if (cell) {
                        const cellData = appState.plannerData[monthKey]?.[`${op.id}-${call.day}`];
                        const isAvailable = !cellData?.turno || cellData.turno === 'R';
                        
                        if (isAvailable) {
                            cell.classList.add('cell-can-respond');
                            
                            const responseIndicator = document.createElement('div');
                            responseIndicator.className = 'response-available-indicator';
                            responseIndicator.textContent = '✋';
                            responseIndicator.title = 'Può rispondere alla chiamata';
                            cell.appendChild(responseIndicator);
                        }
                    }
                });
            });
        },
        
        saveCalls() {
            localStorage.setItem('substituteCalls', JSON.stringify(this.calls));
        },
        
        loadCalls() {
            const saved = localStorage.getItem('substituteCalls');
            if (saved) {
                this.calls = JSON.parse(saved);
                // Rimuovi chiamate più vecchie di 24 ore
                const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
                this.calls = this.calls.filter(call => new Date(call.timestamp) > oneDayAgo);
                this.saveCalls();
            }
        }
    };

    function handleCallSubstitute(opId, day) {
        if (!substituteCallSystem.isEnabled) {
            showConfirmation('Il sistema di chiamate di sostituzione è disattivato.', 'Sistema Disattivato', true);
            return;
        }
        showCallSelectionModal('create', opId, day);
        closeMiniMenu();
    }

    function handleRespondCall(responderOpId, responderDay) {
        if (!substituteCallSystem.isEnabled) {
            showConfirmation('Il sistema di chiamate di sostituzione è disattivato.', 'Sistema Disattivato', true);
            return;
        }
        
        const activeCalls = substituteCallSystem.getActiveCalls().filter(call => 
            call.day === responderDay && call.opId !== responderOpId
        );
        
        if (activeCalls.length === 0) {
            showConfirmation('Nessuna chiamata attiva per questo giorno.', 'Info', true);
            return;
        }
        
        showCallSelectionModal('respond', responderOpId, responderDay, activeCalls);
        closeMiniMenu();
    }

    function showCallSelectionModal(mode, opId, day, calls = null) {
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        `;
        
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: white;
            padding: 2rem;
            border-radius: 0.5rem;
            max-width: 500px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
        `;
        
        if (mode === 'create') {
            modalContent.innerHTML = `
                <h3 style="margin-bottom: 1rem; font-size: 1.25rem; font-weight: 600;">Chiama Sostituto</h3>
                <p style="margin-bottom: 1rem; color: #6b7280;">Operatore: <strong>${getOperatorName(opId)}</strong> - Giorno: <strong>${day}</strong></p>
                <div style="margin-bottom: 1rem;">
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Motivo della richiesta:</label>
                    <textarea id="call-reason" style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.25rem; resize: vertical;" rows="3" placeholder="Descrivi il motivo della richiesta di sostituzione..."></textarea>
                </div>
                <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                    <button id="cancel-call" style="padding: 0.5rem 1rem; border: 1px solid #d1d5db; background: white; border-radius: 0.25rem; cursor: pointer;">Annulla</button>
                    <button id="create-call" style="padding: 0.5rem 1rem; background: #ef4444; color: white; border: none; border-radius: 0.25rem; cursor: pointer;">Crea Chiamata</button>
                </div>
            `;
            
            modalContent.querySelector('#create-call').addEventListener('click', () => {
                const reason = modalContent.querySelector('#call-reason').value;
                substituteCallSystem.createCall(opId, day, reason);
                document.body.removeChild(modal);
                showConfirmation('Chiamata di sostituzione creata con successo!', 'Successo', true);
            });
        } else if (mode === 'respond') {
            const callsList = calls.map(call => `
                <div style="border: 1px solid #e5e7eb; padding: 1rem; border-radius: 0.25rem; margin-bottom: 0.5rem; cursor: pointer;" data-call-id="${call.id}">
                    <div style="font-weight: 600; margin-bottom: 0.5rem;">Operatore: ${getOperatorName(call.opId)}</div>
                    <div style="color: #6b7280; font-size: 0.875rem; margin-bottom: 0.5rem;">${call.reason || 'Richiesta sostituzione'}</div>
                    <div style="color: #9ca3af; font-size: 0.75rem;">${new Date(call.timestamp).toLocaleString('it-IT')}</div>
                    <div style="color: #10b981; font-size: 0.75rem; margin-top: 0.25rem;">${call.responses.length} risposta/e ricevute</div>
                </div>
            `).join('');
            
            modalContent.innerHTML = `
                <h3 style="margin-bottom: 1rem; font-size: 1.25rem; font-weight: 600;">Rispondi a Chiamata</h3>
                <p style="margin-bottom: 1rem; color: #6b7280;">Seleziona una chiamata a cui rispondere:</p>
                <div style="margin-bottom: 1rem; max-height: 300px; overflow-y: auto;">
                    ${callsList}
                </div>
                <div style="margin-bottom: 1rem;">
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Messaggio di risposta (opzionale):</label>
                    <textarea id="response-message" style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.25rem; resize: vertical;" rows="2" placeholder="Aggiungi un messaggio alla tua risposta..."></textarea>
                </div>
                <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                    <button id="cancel-response" style="padding: 0.5rem 1rem; border: 1px solid #d1d5db; background: white; border-radius: 0.25rem; cursor: pointer;">Annulla</button>
                    <button id="send-response" style="padding: 0.5rem 1rem; background: #10b981; color: white; border: none; border-radius: 0.25rem; cursor: pointer;" disabled>Invia Risposta</button>
                </div>
            `;
            
            let selectedCallId = null;
            
            modalContent.querySelectorAll('[data-call-id]').forEach(callEl => {
                callEl.addEventListener('click', () => {
                    modalContent.querySelectorAll('[data-call-id]').forEach(el => el.style.background = 'white');
                    callEl.style.background = '#f0f9ff';
                    selectedCallId = callEl.dataset.callId;
                    modalContent.querySelector('#send-response').disabled = false;
                });
            });
            
            modalContent.querySelector('#send-response').addEventListener('click', () => {
                if (!selectedCallId) return;
                
                const message = modalContent.querySelector('#response-message').value;
                const success = substituteCallSystem.respondToCall(selectedCallId, opId, message);
                
                if (success) {
                    document.body.removeChild(modal);
                    showConfirmation('Risposta inviata con successo!', 'Successo', true);
                } else {
                    showConfirmation('Errore nell\'invio della risposta. Potresti aver già risposto a questa chiamata.', 'Errore', true);
                }
            });
        }
        
        const cancelBtn = modalContent.querySelector('#cancel-call') || modalContent.querySelector('#cancel-response');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                document.body.removeChild(modal);
            });
        }
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
        
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
    }

    function getOperatorName(opId) {
        const operators = getActiveOperators(appState.currentDate.getFullYear(), appState.currentDate.getMonth());
        const operator = operators.find(op => op.id === opId);
        return operator ? `${operator.cognome} ${operator.nome}` : `Operatore ${opId}`;
    }

    // Inizializza il sistema quando il planner viene renderizzato
    const originalRenderPlanner = renderPlanner;
    renderPlanner = function() {
        originalRenderPlanner.apply(this, arguments);
        // Aggiorna gli indicatori dopo il rendering
        setTimeout(() => {
            if (substituteCallSystem) {
                substituteCallSystem.updateCallIndicators();
            }
        }, 100);
    };

    // Inizializza il sistema all'avvio
    setTimeout(() => {
        substituteCallSystem.init();
    }, 1000);

    // Aggiungi funzione per mostrare il pannello di gestione chiamate
    function showCallManagementPanel() {
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        `;
        
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: white;
            padding: 2rem;
            border-radius: 0.5rem;
            max-width: 500px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
        `;
        
        const activeCalls = substituteCallSystem.getActiveCalls();
        const systemStatus = substituteCallSystem.isEnabled ? 'Attivo' : 'Disattivato';
        const statusColor = substituteCallSystem.isEnabled ? '#10b981' : '#ef4444';
        
        modalContent.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="margin: 0; font-size: 1.5rem; font-weight: 600;">Gestione Chiamate di Sostituzione</h3>
                <button id="close-call-panel" style="font-size: 1.5rem; border: none; background: none; cursor: pointer; color: #9ca3af;">×</button>
            </div>
            
            <div style="margin-bottom: 1.5rem; padding: 1rem; background: #f9fafb; border-radius: 0.5rem; border: 1px solid #e5e7eb;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <div>
                        <div style="font-weight: 600; color: #374151;">Stato Sistema</div>
                        <div style="color: ${statusColor}; font-weight: 500;">${systemStatus}</div>
                    </div>
                    <div>
                        <div style="font-weight: 600; color: #374151;">Chiamate Attive</div>
                        <div style="font-size: 1.5rem; font-weight: 700; color: #ef4444; text-align: center;">${activeCalls.length}</div>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                    <button id="toggle-system-btn" style="padding: 0.5rem 1rem; background: ${substituteCallSystem.isEnabled ? '#ef4444' : '#10b981'}; color: white; border: none; border-radius: 0.25rem; cursor: pointer; font-size: 0.875rem;">
                        ${substituteCallSystem.isEnabled ? 'Disattiva Sistema' : 'Attiva Sistema'}
                    </button>
                    <button id="view-history-btn" style="padding: 0.5rem 1rem; background: #6b7280; color: white; border: none; border-radius: 0.25rem; cursor: pointer; font-size: 0.875rem;">
                        Visualizza Storico
                    </button>
                </div>
            </div>
            
            ${activeCalls.length > 0 ? `
                <div style="margin-bottom: 1.5rem;">
                    <h4 style="margin-bottom: 1rem; font-weight: 600; color: #374151;">Chiamate Attive (${activeCalls.length})</h4>
                    <div style="max-height: 300px; overflow-y: auto;">
                        ${activeCalls.map(call => `
                            <div style="border: 1px solid #e5e7eb; padding: 1rem; border-radius: 0.25rem; margin-bottom: 0.5rem;">
                                <div style="display: flex; justify-content: space-between; align-items: start;">
                                    <div>
                                        <div style="font-weight: 600;">${getOperatorName(call.opId)} - Giorno ${call.day}</div>
                                        <div style="color: #6b7280; font-size: 0.875rem; margin-top: 0.25rem;">${call.reason || 'Richiesta sostituzione'}</div>
                                        <div style="color: #10b981; font-size: 0.75rem; margin-top: 0.25rem;">${call.responses.length} risposta/e ricevute</div>
                                    </div>
                                    <button onclick="substituteCallSystem.closeCall('${call.id}'); this.closest('.modal-backdrop').remove(); showCallManagementPanel();" style="padding: 0.25rem 0.5rem; background: #ef4444; color: white; border: none; border-radius: 0.25rem; font-size: 0.75rem; cursor: pointer;">Chiudi</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                <button id="close-panel" style="padding: 0.5rem 1rem; background: #6b7280; color: white; border: none; border-radius: 0.25rem; cursor: pointer;">Chiudi</button>
            </div>
        `;
        
        modalContent.querySelector('#close-call-panel').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        modalContent.querySelector('#close-panel').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        modalContent.querySelector('#toggle-system-btn').addEventListener('click', () => {
            substituteCallSystem.toggleSystem();
            document.body.removeChild(modal);
        });
        
        modalContent.querySelector('#view-history-btn').addEventListener('click', () => {
            document.body.removeChild(modal);
            substituteCallSystem.showCallHistory();
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
        
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
    }
    
    // Esponi la funzione globalmente
    window.showCallManagementPanel = showCallManagementPanel;

    // Aggiungi funzioni per storico e gestione sistema
    substituteCallSystem.showCallHistory = function() {
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        `;
        
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: white;
            padding: 2rem;
            border-radius: 0.5rem;
            max-width: 800px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
        `;
        
        const allCalls = this.calls.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        const callsHTML = allCalls.map(call => {
            const responsesHTML = call.responses.map(response => `
                <div style="margin-left: 2rem; padding: 0.5rem; background: #f0f9ff; border-left: 3px solid #10b981; margin-top: 0.5rem;">
                    <div style="font-weight: 500; color: #10b981;">📩 Risposta da: ${getOperatorName(response.opId)}</div>
                    <div style="font-size: 0.875rem; color: #6b7280; margin-top: 0.25rem;">${response.message || 'Nessun messaggio'}</div>
                    <div style="font-size: 0.75rem; color: #9ca3af; margin-top: 0.25rem;">${new Date(response.timestamp).toLocaleString('it-IT')}</div>
                </div>
            `).join('');
            
            const statusColor = call.status === 'active' ? '#ef4444' : '#6b7280';
            const statusText = call.status === 'active' ? 'Attiva' : 'Chiusa';
            
            return `
                <div style="border: 1px solid #e5e7eb; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem;">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                        <div>
                            <div style="font-weight: 600; font-size: 1.1rem;">📞 ${getOperatorName(call.opId)} - Giorno ${call.day}</div>
                            <div style="color: #6b7280; font-size: 0.875rem; margin-top: 0.25rem;">${call.reason || 'Richiesta sostituzione'}</div>
                            <div style="color: #9ca3af; font-size: 0.75rem; margin-top: 0.25rem;">${new Date(call.timestamp).toLocaleString('it-IT')}</div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span style="color: ${statusColor}; font-weight: 500; font-size: 0.875rem;">${statusText}</span>
                            ${call.status === 'active' ? `<button onclick="substituteCallSystem.closeCall('${call.id}'); this.closest('.modal-backdrop').remove(); substituteCallSystem.showCallHistory();" style="padding: 0.25rem 0.5rem; background: #ef4444; color: white; border: none; border-radius: 0.25rem; font-size: 0.75rem; cursor: pointer;">Chiudi</button>` : ''}
                        </div>
                    </div>
                    <div style="margin-top: 0.5rem;">
                        <div style="font-weight: 500; color: #374151;">Risposte ricevute (${call.responses.length}):</div>
                        ${call.responses.length > 0 ? responsesHTML : '<div style="color: #9ca3af; font-style: italic; margin-top: 0.5rem;">Nessuna risposta ricevuta</div>'}
                    </div>
                </div>
            `;
        }).join('');
        
        modalContent.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="margin: 0; font-size: 1.5rem; font-weight: 600;">Storico Chiamate di Sostituzione</h3>
                <button id="close-history" style="font-size: 1.5rem; border: none; background: none; cursor: pointer; color: #9ca3af;">×</button>
            </div>
            <div style="margin-bottom: 1rem; padding: 1rem; background: #f9fafb; border-radius: 0.5rem; border: 1px solid #e5e7eb;">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; text-align: center;">
                    <div>
                        <div style="font-size: 1.5rem; font-weight: 700; color: #ef4444;">${allCalls.filter(c => c.status === 'active').length}</div>
                        <div style="font-size: 0.875rem; color: #6b7280;">Chiamate Attive</div>
                    </div>
                    <div>
                        <div style="font-size: 1.5rem; font-weight: 700; color: #10b981;">${allCalls.reduce((sum, c) => sum + c.responses.length, 0)}</div>
                        <div style="font-size: 0.875rem; color: #6b7280;">Risposte Totali</div>
                    </div>
                    <div>
                        <div style="font-size: 1.5rem; font-weight: 700; color: #6b7280;">${allCalls.filter(c => c.status === 'closed').length}</div>
                        <div style="font-size: 0.875rem; color: #6b7280;">Chiamate Chiuse</div>
                    </div>
                </div>
            </div>
            <div style="max-height: 400px; overflow-y: auto;">
                ${allCalls.length > 0 ? callsHTML : '<div style="text-align: center; color: #9ca3af; padding: 2rem;">Nessuna chiamata trovata</div>'}
            </div>
            <div style="margin-top: 1rem; display: flex; gap: 0.5rem; justify-content: flex-end;">
                <button id="clear-history" style="padding: 0.5rem 1rem; border: 1px solid #ef4444; color: #ef4444; background: white; border-radius: 0.25rem; cursor: pointer;">Cancella Storico</button>
                <button id="close-modal" style="padding: 0.5rem 1rem; background: #6b7280; color: white; border: none; border-radius: 0.25rem; cursor: pointer;">Chiudi</button>
            </div>
        `;
        
        modalContent.querySelector('#close-history').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        modalContent.querySelector('#close-modal').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        modalContent.querySelector('#clear-history').addEventListener('click', () => {
            if (confirm('Sei sicuro di voler cancellare tutto lo storico delle chiamate?')) {
                this.calls = [];
                this.saveCalls();
                this.updateCallIndicators();
                document.body.removeChild(modal);
                showConfirmation('Storico chiamate cancellato con successo!', 'Successo', true);
            }
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
        
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
    };

    // Aggiungi funzione per disabilitare il sistema
    substituteCallSystem.isEnabled = true;

    substituteCallSystem.toggleSystem = function() {
        this.isEnabled = !this.isEnabled;
        localStorage.setItem('substituteCallSystemEnabled', this.isEnabled.toString());
        
        if (!this.isEnabled) {
            // Rimuovi tutti gli indicatori quando disabilitato
            document.querySelectorAll('.call-indicator, .call-active-indicator, .response-available-indicator').forEach(el => el.remove());
            document.querySelectorAll('.cell-has-call, .cell-can-respond').forEach(el => {
                el.classList.remove('cell-has-call', 'cell-can-respond');
            });
        } else {
            // Riattiva gli indicatori
            this.updateCallIndicators();
        }
        
        showConfirmation(
            this.isEnabled ? 'Sistema di chiamate di sostituzione attivato!' : 'Sistema di chiamate di sostituzione disattivato!',
            'Sistema Chiamate',
            true
        );
    };

    // Esponi il sistema globalmente per debug
    window.substituteCallSystem = substituteCallSystem;
    
    // Aggiungi pulsante di gestione chiamate alla toolbar se non esiste
    function addCallManagementButton() {
        const toolbar = document.getElementById('planner-toolbar');
        if (!toolbar || document.getElementById('call-management-btn')) return;
        
        const button = document.createElement('button');
        button.id = 'call-management-btn';
        button.className = 'btn-3d btn-gray text-sm';
        button.innerHTML = '📞 Gestisci Chiamate';
        button.title = 'Gestione Sistema Chiamate di Sostituzione';
        button.addEventListener('click', showCallManagementPanel);
        
        const controlsContainer = toolbar.querySelector('.flex-grow') || toolbar;
        controlsContainer.appendChild(button);
    }
    
    // Aggiungi il pulsante dopo l'inizializzazione
    setTimeout(() => {
        addCallManagementButton();
    }, 2000);



    // =================================================================================
    // SINCRONIZZAZIONE GOOGLE SHEETS
    // =================================================================================

    async function aggiornaFileOnline() {
        const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxWoJWdP7otKk4ZDc_7Q5lnE-uhLXAMNYDIz-CTJkDVTYzvbGjB0UIAZ20lh_LkDXOi/exec";

        const confirmed = await showConfirmation("Stai per sovrascrivere i dati sul Foglio Google condiviso. Continuare?", "Conferma Aggiornamento Online");
        if (!confirmed) return;

        showLoader();

        try {
            const year = appState.currentDate.getFullYear();
            const month = appState.currentDate.getMonth();
            const monthKey = getMonthKey(appState.currentDate);
            const daysInMonth = getDaysInMonth(year, month);
            const operators = getActiveOperators(year, month, false).sort((a, b) => a.ordine - b.ordine);
            const shifts = appState.plannerData[monthKey] || {};
            
            const monthName = appState.currentDate.toLocaleDateString('it-IT', { month: 'long' });
            const monthTitle = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`;
            
            const headerRow1_days = Array.from({ length: daysInMonth }, (_, i) => `'${i + 1}`);
            const headerRow1 = [monthTitle, '', ...headerRow1_days];
            
            const weekDayLetters = ['D', 'L', 'M', 'M', 'G', 'V', 'S'];
            const headerRow2_weekdays = Array.from({ length: daysInMonth }, (_, i) => weekDayLetters[new Date(year, month, i + 1).getDay()]);
            const headerRow2 = ['Operatore', 'Ore Totali', ...headerRow2_weekdays];

            const dataForSheet = [headerRow1, headerRow2];

            operators.forEach(op => {
                let totalHours = 0;
                const row = [`${op.cognome} ${op.nome}`];
                const turniRow = [];
                for (let day = 1; day <= daysInMonth; day++) {
                    const data = shifts[`${op.id}-${day}`];
                    turniRow.push(data?.turno || '');
                    if (data) {
                        const turnoDef = getTurnoBySigla(data.turno);
                        if (turnoDef) {
                            if (turnoDef.conteggioOre === 'orario') totalHours += (data.oreFerie ?? turnoDef.ore);
                            else if (turnoDef.conteggioOre === 'sostitutivo') {
                                const originalTurno = getTurnoBySigla(data.originalTurno);
                                if (originalTurno) totalHours += originalTurno.ore;
                            }
                        }
                        if (data.extraInfo?.hours) totalHours += data.extraInfo.hours;
                    }
                }
                row.push(totalHours.toFixed(1).replace('.', ','));
                dataForSheet.push([...row, ...turniRow]);
            });

            const response = await fetch(WEB_APP_URL, {
                method: 'POST', mode: 'cors', cache: 'no-cache',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(dataForSheet)
            });
            const result = await response.json();

            if (result.status === "success") {
                showToast(`Foglio Google aggiornato! (${result.rows} righe scritte)`, "success");
            } else {
                throw new Error(result.message || "Errore sconosciuto.");
            }

        } catch (error) {
            console.error("Errore aggiornamento Foglio Google:", error);
            showConfirmation(`Errore di comunicazione con Google. <br><small>Dettagli: ${error.message}</small>`, "Errore di Rete", true);
        } finally {
            hideLoader();
        }
    }
});

// ===== FUNZIONI PER STAMPA PDF EXTRA =====

/**
 * Genera e visualizza il report di stampa per gli extra
 */
function generateExtraPrintReport() {
    const year = appState.currentDate.getFullYear();
    const month = appState.currentDate.getMonth();
    const monthKey = getMonthKey(appState.currentDate);
    const monthName = appState.currentDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
    
    // Raccoglie tutti gli extra del mese
    const extraData = collectExtraData(year, month, monthKey);
    
    if (extraData.length === 0) {
        showToast('Nessun extra trovato per il mese selezionato', 'warning');
        return;
    }
    
    // Genera HTML del report in stile planner
    const reportHTML = generatePlannerStyleReportHTML(monthName, extraData);
    
    // Crea finestra di stampa
    createPrintWindow(reportHTML);
}

/**
 * Raccoglie tutti i dati degli extra per il mese specificato
 */
function collectExtraData(year, month, monthKey) {
    const extraData = [];
    const plannerData = appState.plannerData[monthKey] || {};
    const operators = getActiveOperators(year, month, false);
    const operatorMap = new Map(operators.map(op => [op.id, op]));
    
    // Itera attraverso tutti i dati del planner
    Object.entries(plannerData).forEach(([key, data]) => {
        if (data && data.extraInfo && typeof data.extraInfo.hours === 'number' && data.extraInfo.hours > 0) {
            const [opId, day] = key.split('-').map(Number);
            const operator = operatorMap.get(opId);
            
            if (operator) {
                const extra = data.extraInfo;
                
                // Determina il tipo di extra
                let type = 'Extra';
                if (extra.type === 'straordinario') type = 'Straordinario';
                else if (extra.type === 'anticipato') type = 'Rientro';
                else if (extra.type === 'prolungamento') type = 'Prolungamento';
                
                extraData.push({
                    operator: `${operator.cognome} ${operator.nome}`,
                    operatorId: opId,
                    day: day,
                    date: new Date(year, month, day),
                    type: type,
                    shift: data.turnoId ? appState.turni.find(t => t.id === data.turnoId)?.descrizione || '' : '',
                    gettone: extra.gettone || false,
                    startTime: extra.startTime || '',
                    endTime: extra.endTime || '',
                    hours: extra.hours || 0,
                    amount: calculateExtraAmount(extra),
                    notes: extra.notes || ''
                });
            }
        }
    });
    
    // Ordina per operatore e data
    return extraData.sort((a, b) => {
        if (a.operator !== b.operator) {
            return a.operator.localeCompare(b.operator);
        }
        return a.date - b.date;
    });
}

/**
 * Calcola l'importo dell'extra (placeholder - da implementare logica specifica)
 */
function calculateExtraAmount(extra) {
    // Logica di calcolo da implementare in base alle regole aziendali
    const baseRate = 15; // Euro per ora base
    const hours = parseFloat(extra.hours) || 0;
    
    let multiplier = 1;
    switch (extra.type) {
        case 'Straordinario':
            multiplier = 1.25;
            break;
        case 'Prolungamento':
            multiplier = 1.15;
            break;
        case 'Rientro':
            multiplier = 1.5;
            break;
        default:
            multiplier = 1;
    }
    
    let amount = hours * baseRate * multiplier;
    
    // Aggiungi gettone se presente
    if (extra.gettone) {
        amount += 25; // Importo fisso gettone
    }
    
    return amount;
}

/**
 * Genera l'HTML del report di stampa in stile planner
 */
function generatePlannerStyleReportHTML(monthName, extraData) {
    const totals = calculateExtraTotals(extraData);
    
    return `
        <!DOCTYPE html>
        <html lang="it">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Report Extra - ${monthName}</title>
            <style>
                ${getExtraPrintStyles()}
                ${getPlannerPrintStyles()}
            </style>
        </head>
        <body>
            <div class="extra-print-report">
                ${generateReportHeader(monthName)}
                ${generateSymbolsSummary(extraData)}
                ${generatePlannerStyleTable(extraData)}
                ${generateHoursSummary(extraData)}
                ${generateReportLegend()}
                ${generateReportFooter()}
            </div>
        </body>
        </html>
    `;
}

/**
 * Genera l'header del report
 */
function generateReportHeader(monthName) {
    return `
        <div class="extra-print-header">
            <h1 class="extra-print-title">REPORT EXTRA PERSONALE</h1>
            <p class="extra-print-period">Periodo: ${monthName}</p>
        </div>
    `;
}

/**
 * Genera il riassunto dei simboli
 */
function generateSymbolsSummary(extraData) {
    const symbolCounts = {
        'P': 0, // Prolungamento
        'G': 0, // Gettone
        '+': 0, // Straordinario
        'R': 0  // Rientro
    };
    
    extraData.forEach(extra => {
        if (extra.type === 'Prolungamento') symbolCounts['P']++;
        else if (extra.type === 'Straordinario') symbolCounts['+']++;
        else if (extra.type === 'Rientro') symbolCounts['R']++;
        if (extra.gettone) symbolCounts['G']++;
    });
    
    const summaryItems = Object.entries(symbolCounts)
        .filter(([symbol, count]) => count > 0)
        .map(([symbol, count]) => `${symbol}: ${count}`)
        .join(' | ');
    
    return summaryItems ? `
        <div class="symbols-summary">
            <p><strong>Riassunto simboli:</strong> ${summaryItems}</p>
        </div>
    ` : '';
}

/**
 * Genera la tabella principale del report
 */
function generateReportTable(extraData) {
    const tableRows = extraData.map(extra => {
        const typeClass = getExtraTypeClass(extra.type);
        const formattedDate = extra.date.toLocaleDateString('it-IT');
        const formattedAmount = extra.amount.toFixed(2);
        const gettoneIcon = extra.gettone ? '<span class="gettone-icon">🔔</span>' : '';
        const gettoneClass = extra.gettone ? 'has-gettone' : '';
        
        return `
            <tr class="${typeClass} ${gettoneClass}">
                <td class="extra-print-operator">${extra.operator}</td>
                <td class="extra-print-date">${formattedDate}</td>
                <td class="extra-print-type">${extra.type}</td>
                <td class="extra-print-shift">${extra.shift}</td>
                <td class="extra-print-hours">${extra.hours}h</td>
                <td class="extra-print-gettone">${gettoneIcon}</td>
                <td class="extra-print-amount">€ ${formattedAmount}</td>
                <td class="extra-print-notes">${extra.notes}</td>
            </tr>
        `;
    }).join('');
    
    return `
        <table class="extra-print-table">
            <thead>
                <tr>
                    <th class="extra-print-operator">Operatore</th>
                    <th class="extra-print-date">Data</th>
                    <th class="extra-print-type">Tipologia</th>
                    <th class="extra-print-shift">Turno</th>
                    <th class="extra-print-hours">Ore</th>
                    <th class="extra-print-gettone">Gettone</th>
                    <th class="extra-print-amount">Importo</th>
                    <th class="extra-print-notes">Note</th>
                </tr>
            </thead>
            <tbody>
                ${tableRows}
            </tbody>
        </table>
    `;
}

/**
 * Calcola i totali per tipologia
 */
function calculateExtraTotals(extraData) {
    const totals = {
        Straordinario: { count: 0, hours: 0, amount: 0 },
        Prolungamento: { count: 0, hours: 0, amount: 0 },
        Rientro: { count: 0, hours: 0, amount: 0 },
        Gettone: { count: 0, hours: 0, amount: 0 },
        Total: { count: 0, hours: 0, amount: 0 }
    };
    
    extraData.forEach(extra => {
        const type = extra.type || 'Altro';
        if (!totals[type]) {
            totals[type] = { count: 0, hours: 0, amount: 0 };
        }
        
        totals[type].count++;
        totals[type].hours += parseFloat(extra.hours) || 0;
        totals[type].amount += extra.amount;
        
        totals.Total.count++;
        totals.Total.hours += parseFloat(extra.hours) || 0;
        totals.Total.amount += extra.amount;
        
        if (extra.gettone) {
            totals.Gettone.count++;
        }
    });
    
    return totals;
}

/**
 * Genera il riassunto delle ore extra
 */
function generateHoursSummary(extraData) {
    const totals = calculateExtraTotals(extraData);
    
    const summaryRows = Object.entries(totals)
        .filter(([key]) => key !== 'Total' && totals[key].count > 0)
        .map(([type, data]) => {
            const typeClass = getExtraTypeClass(type);
            return `
                <tr class="${typeClass}">
                    <td class="extra-print-type">${type}</td>
                    <td class="extra-print-hours">${data.count}</td>
                    <td class="extra-print-hours">${data.hours.toFixed(1)}h</td>
                </tr>
            `;
        }).join('');
    
    return `
        <div class="hours-summary">
            <h3>Conteggio Ore Extra</h3>
            <table class="extra-print-table">
                <thead>
                    <tr>
                        <th class="extra-print-type">Tipologia</th>
                        <th class="extra-print-hours">Quantità</th>
                        <th class="extra-print-hours">Ore Totali</th>
                    </tr>
                </thead>
                <tbody>
                    ${summaryRows}
                    <tr class="extra-print-total-row">
                        <td class="extra-print-type"><strong>TOTALE GENERALE</strong></td>
                        <td class="extra-print-hours"><strong>${totals.Total.count}</strong></td>
                        <td class="extra-print-hours"><strong>${totals.Total.hours.toFixed(1)}h</strong></td>
                    </tr>
                </tbody>
            </table>
            <div class="total-hours-summary">
                <p><strong>Totale complessivo ore extra: ${totals.Total.hours.toFixed(1)}h</strong></p>
            </div>
        </div>
    `;
}

/**
 * Genera una tabella in stile planner per il PDF degli extra
 */
function generatePlannerStyleTable(extraData) {
    if (!extraData || extraData.length === 0) {
        return '<p class="text-center text-gray-500 py-4">Nessun dato extra trovato per il periodo selezionato.</p>';
    }

    // Raggruppa i dati per operatore e giorno
    const groupedData = {};
    const allDays = new Set();
    const operators = new Set();

    extraData.forEach(extra => {
        const dateKey = extra.date.toLocaleDateString('it-IT');
        const key = `${extra.operator}-${dateKey}`;
        
        if (!groupedData[key]) {
            groupedData[key] = {
                operator: extra.operator,
                date: dateKey,
                shift: extra.shift,
                extras: []
            };
        }
        
        groupedData[key].extras.push(extra);
        allDays.add(dateKey);
        operators.add(extra.operator);
    });

    // Ordina giorni e operatori
    const sortedDays = Array.from(allDays).sort((a, b) => {
        const dateA = new Date(a.split('/').reverse().join('-'));
        const dateB = new Date(b.split('/').reverse().join('-'));
        return dateA - dateB;
    });
    const sortedOperators = Array.from(operators).sort();

    // Genera header della tabella
    let tableHTML = `
        <table class="planner-style-table">
            <thead>
                <tr>
                    <th class="operator-header">Operatore</th>`;
    
    // Aggiungi header per ogni giorno
    sortedDays.forEach(day => {
        const dayNumber = day.split('/')[0];
        const dayOfWeek = new Date(day.split('/').reverse().join('-')).toLocaleDateString('it-IT', { weekday: 'short' });
        tableHTML += `<th class="day-header">${dayNumber}<br><small>${dayOfWeek}</small></th>`;
    });
    
    tableHTML += `
                </tr>
            </thead>
            <tbody>`;
    
    // Calcola riassunti per ogni operatore
    const operatorSummaries = {};
    sortedOperators.forEach(operator => {
        operatorSummaries[operator] = {
            straordinario: 0,
            prolungamento: 0,
            rientro: 0,
            gettone: 0,
            totalExtraHours: 0  // Aggiunto calcolo totale ore straordinarie
        };
    });
    
    extraData.forEach(extra => {
        const summary = operatorSummaries[extra.operator];
        if (summary) {
            if (extra.type === 'Straordinario') summary.straordinario++;
            else if (extra.type === 'Prolungamento') summary.prolungamento++;
            else if (extra.type === 'Rientro') summary.rientro++;
            if (extra.gettone) summary.gettone++;
            
            // Accumula le ore straordinarie totali
            if (extra.hours && extra.hours > 0) {
                summary.totalExtraHours += extra.hours;
            }
        }
    });
    
    // Genera righe per ogni operatore
    sortedOperators.forEach(operator => {
        const summary = operatorSummaries[operator];
        let summaryBadges = '';
        
        if (summary.straordinario > 0) {
            summaryBadges += `<span class="summary-badge straordinario">+ ${summary.straordinario}</span>`;
        }
        if (summary.prolungamento > 0) {
            summaryBadges += `<span class="summary-badge prolungamento">P ${summary.prolungamento}</span>`;
        }
        if (summary.rientro > 0) {
            summaryBadges += `<span class="summary-badge rientro">R ${summary.rientro}</span>`;
        }
        if (summary.gettone > 0) {
            summaryBadges += `<span class="summary-badge gettone">G ${summary.gettone}</span>`;
        }
        
        // Aggiungi totale ore straordinarie se presente
        let totalHoursDisplay = '';
        if (summary.totalExtraHours > 0) {
            totalHoursDisplay = `<div class="operator-total-hours">Totale: ${summary.totalExtraHours.toFixed(1)}h</div>`;
        }
        
        const operatorContent = summaryBadges ? 
            `${operator}<div class="operator-summary">${summaryBadges}</div>${totalHoursDisplay}` : 
            `${operator}${totalHoursDisplay}`;
        
        tableHTML += `
                <tr>
                    <td class="operator-cell">${operatorContent}</td>`;
        
        // Genera celle per ogni giorno
        sortedDays.forEach(day => {
            const key = `${operator}-${day}`;
            const cellData = groupedData[key];
            
            if (cellData && cellData.extras.length > 0) {
                let cellContent = '';
                let cellClasses = 'planner-cell has-extra';
                
                // Aggiungi turno se presente
                if (cellData.shift) {
                    cellContent += `<div class="shift-name">${cellData.shift}</div>`;
                }
                
                // Aggiungi indicatori extra
                let indicators = '';
                cellData.extras.forEach(extra => {
                    // Indicatori simbolici come nel planner originale
                    if (extra.type === 'Straordinario') {
                        indicators += '<span class="extra-indicator straordinario">+</span>';
                        cellClasses += ' has-straordinario';
                    } else if (extra.type === 'Prolungamento') {
                        indicators += '<span class="extra-indicator prolungamento">P</span>';
                        cellClasses += ' has-prolungamento';
                    } else if (extra.type === 'Rientro') {
                        indicators += '<span class="extra-indicator rientro">R</span>';
                        cellClasses += ' has-rientro';
                    }
                    
                    if (extra.gettone) {
                        indicators += '<span class="extra-indicator gettone">G</span>';
                        cellClasses += ' has-gettone';
                    }
                });
                
                if (indicators) {
                    cellContent += `<div class="extra-indicators">${indicators}</div>`;
                }
                
                // Aggiungi dettagli extra - posizionati sotto agli orari
                let extraDetails = '';
                cellData.extras.forEach(extra => {
                    if (extra.hours > 0) {
                        extraDetails += `<div class="extra-details-block">`;
                        if (extra.startTime && extra.endTime) {
                            extraDetails += `<div class="extra-time-line">${extra.startTime}-${extra.endTime}</div>`;
                        }
                        extraDetails += `<div class="extra-hours-line">Straordinario: ${extra.hours}h</div>`;
                        extraDetails += `</div>`;
                    }
                });
                
                if (extraDetails) {
                    cellContent += extraDetails;
                }
                
                tableHTML += `<td class="${cellClasses}">${cellContent}</td>`;
            } else {
                tableHTML += `<td class="planner-cell empty"></td>`;
            }
        });
        
        tableHTML += `</tr>`;
    });
    
    tableHTML += `
            </tbody>
        </table>`;
    
    return tableHTML;
}

/**
 * Genera la legenda del report
 */
function generateReportLegend() {
    return `
        <div class="extra-print-legend">
            <h3>Legenda Tipologie Extra</h3>
            <div class="legend-grid">
                <div class="legend-item legend-straordinario">
                    <div class="legend-color"></div>
                    <span class="legend-text">Straordinario - Ore aggiuntive oltre l'orario normale</span>
                </div>
                <div class="legend-item legend-prolungamento">
                    <div class="legend-color"></div>
                    <span class="legend-text">Prolungamento - Estensione del turno esistente</span>
                </div>
                <div class="legend-item legend-rientro">
                    <div class="legend-color"></div>
                    <span class="legend-text">Rientro - Turno anticipato o aggiuntivo</span>
                </div>
                <div class="legend-item legend-gettone">
                    <div class="legend-color"></div>
                    <span class="legend-text">🔔 Gettone di chiamata - Compenso per reperibilità</span>
                </div>
            </div>
            <div style="margin-top: 15px; padding: 10px; background-color: #f9f9f9; border: 1px solid #ddd;">
                <strong>Note:</strong> Le righe con bordo blu a sinistra indicano turni con gettone di chiamata.
                L'icona 🔔 nella colonna "Gettone" conferma la presenza del compenso per reperibilità.
            </div>
        </div>
    `;
}

/**
 * Genera il footer del report
 */
function generateReportFooter() {
    const now = new Date();
    const timestamp = now.toLocaleDateString('it-IT') + ' ' + now.toLocaleTimeString('it-IT');
    
    return `
        <div class="extra-print-footer">
            <p>Report generato il ${timestamp}</p>
            <p>Sistema di Gestione Turni - Casa di Riposo</p>
        </div>
    `;
}

/**
 * Restituisce la classe CSS per il tipo di extra
 */
function getExtraTypeClass(type) {
    switch (type) {
        case 'Straordinario':
            return 'extra-type-straordinario';
        case 'Prolungamento':
            return 'extra-type-prolungamento';
        case 'Rientro':
            return 'extra-type-rientro';
        case 'Gettone':
            return 'extra-type-gettone';
        default:
            return '';
    }
}

/**
 * Restituisce gli stili CSS per la stampa
 */
function getExtraPrintStyles() {
    // Restituisce una versione semplificata degli stili CSS per la stampa
    return `
        body { font-family: Arial, sans-serif; font-size: 12pt; line-height: 1.4; color: #000; background: #fff; margin: 0; padding: 20px; }
        .extra-print-report { width: 100%; max-width: none; margin: 0; padding: 0; }
        .extra-print-header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 15px; }
        .extra-print-title { font-size: 18pt; font-weight: bold; margin: 0 0 10px 0; color: #333; }
        .extra-print-period { font-size: 14pt; color: #666; margin: 0; }
        .extra-print-table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 10pt; }
        .extra-print-table th, .extra-print-table td { border: 1px solid #333; padding: 6px 4px; text-align: left; vertical-align: top; }
        .extra-print-table th { background-color: #f0f0f0; font-weight: bold; text-align: center; }
        .extra-type-straordinario { background-color: #ffebee; }
        .extra-type-prolungamento { background-color: #e8f5e8; }
        .extra-type-rientro { background-color: #fff3e0; }
        .has-gettone { border-left: 4px solid #2196F3 !important; }
        .extra-print-operator { font-weight: bold; width: 18%; }
        .extra-print-date { width: 12%; text-align: center; }
        .extra-print-type { width: 15%; text-align: center; font-weight: bold; }
        .extra-print-shift { width: 12%; text-align: center; font-size: 9pt; }
        .extra-print-hours { width: 10%; text-align: center; }
        .extra-print-gettone { width: 8%; text-align: center; }
        .extra-print-amount { width: 12%; text-align: right; font-weight: bold; }
        .extra-print-notes { width: 13%; font-size: 9pt; }
        .gettone-icon { font-size: 14pt; color: #2196F3; }
        .extra-print-totals { margin-top: 20px; border-top: 2px solid #333; padding-top: 15px; }
        .extra-print-total-row { background-color: #f5f5f5; font-weight: bold; }
        .extra-print-legend { margin-top: 30px; border-top: 1px solid #ccc; padding-top: 20px; }
        .extra-print-legend h3 { font-size: 14pt; margin: 0 0 15px 0; color: #333; }
        .legend-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 20px; }
        .legend-item { display: flex; align-items: center; padding: 8px; border: 1px solid #ddd; }
        .legend-color { width: 20px; height: 20px; margin-right: 10px; border: 1px solid #333; }
        .legend-straordinario .legend-color { background-color: #ffebee; }
        .legend-prolungamento .legend-color { background-color: #e8f5e8; }
        .legend-rientro .legend-color { background-color: #fff3e0; }
        .legend-gettone .legend-color { background-color: #2196F3; }
        .legend-text { font-weight: bold; font-size: 11pt; }
        .extra-print-footer { margin-top: 30px; text-align: center; font-size: 10pt; color: #666; border-top: 1px solid #ccc; padding-top: 15px; }
        @media print {
            body { margin: 0; padding: 15px; }
            .extra-print-table { font-size: 9pt; }
            .extra-print-table th, .extra-print-table td { padding: 4px 3px; }
        }
    `;
}

/**
 * Restituisce gli stili CSS specifici per il layout planner nel PDF
 */
function getPlannerPrintStyles() {
    return `
        .planner-style-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 1px;
            margin: 20px 0;
            font-size: 9pt;
            table-layout: fixed;
        }
        
        .planner-style-table th,
        .planner-style-table td {
            border: 1px solid #333;
            padding: 4px 2px;
            vertical-align: top;
            text-align: center;
            min-height: 40px;
            height: 40px;
            position: relative;
        }
        
        .operator-header {
            background-color: #f0f0f0;
            font-weight: bold;
            width: 120px;
            text-align: left;
            padding-left: 8px;
        }
        
        .day-header {
            background-color: #f0f0f0;
            font-weight: bold;
            width: 36px;
            font-size: 8pt;
        }
        
        .day-header small {
            font-size: 7pt;
            color: #666;
            display: block;
        }
        
        .operator-cell {
            background-color: #f9f9f9;
            font-weight: bold;
            text-align: left;
            padding-left: 8px;
            font-size: 8pt;
        }
        
        .operator-summary {
            margin-top: 4px;
            display: flex;
            flex-wrap: wrap;
            gap: 2px;
            justify-content: center;
        }
        
        .summary-badge {
            display: inline-block;
            padding: 1px 4px;
            border-radius: 3px;
            font-size: 6pt;
            font-weight: bold;
            color: white;
            text-align: center;
            min-width: 16px;
        }
        
        .summary-badge.straordinario {
            background-color: #f44336;
        }
        
        .summary-badge.prolungamento {
            background-color: #4caf50;
        }
        
        .summary-badge.rientro {
            background-color: #ff9800;
        }
        
        .summary-badge.gettone {
            background-color: #2196f3;
        }
        
        .planner-cell {
            background-color: #fff;
            font-size: 7pt;
            line-height: 1.2;
        }
        
        .planner-cell.empty {
            background-color: #fafafa;
        }
        
        .planner-cell.has-extra {
            background-color: #fff;
        }
        
        .shift-name {
            font-weight: bold;
            font-size: 7pt;
            margin-bottom: 2px;
            color: #333;
        }
        
        .extra-indicators {
            margin: 2px 0;
            display: flex;
            justify-content: center;
            gap: 2px;
            flex-wrap: wrap;
        }
        
        .extra-indicator {
            display: inline-block;
            width: 12px;
            height: 12px;
            border-radius: 2px;
            font-size: 7pt;
            font-weight: bold;
            line-height: 12px;
            text-align: center;
            color: white;
        }
        
        .extra-indicator.straordinario {
            background-color: #f44336;
        }
        
        .extra-indicator.prolungamento {
            background-color: #4caf50;
        }
        
        .extra-indicator.rientro {
            background-color: #ff9800;
        }
        
        .extra-indicator.gettone {
            background-color: #2196f3;
        }
        
        .extra-details {
            margin-top: 2px;
            font-size: 6pt;
            color: #666;
            line-height: 1.1;
        }
        
        .extra-time {
            display: block;
            font-weight: bold;
        }
        
        .extra-hours {
            display: block;
            color: #333;
            font-weight: bold;
        }
        
        .extra-details-block {
            margin-top: 4px;
            padding: 2px 4px;
            background-color: #fff3e0;
            border-radius: 3px;
            border-left: 2px solid #ff9800;
        }
        
        .extra-time-line {
            font-size: 7pt;
            font-weight: bold;
            color: #333;
            margin-bottom: 1px;
        }
        
        .extra-hours-line {
            font-size: 7pt;
            color: #d84315;
            font-weight: bold;
        }
        
        .operator-total-hours {
            text-align: center;
            font-size: 8pt;
            font-weight: bold;
            color: #1976d2;
            margin-top: 4px;
            padding: 2px 4px;
            background-color: #e3f2fd;
            border-radius: 3px;
            border: 1px solid #1976d2;
        }
        
        .planner-cell.has-straordinario {
            border-left: 3px solid #f44336;
        }
        
        .planner-cell.has-prolungamento {
            border-left: 3px solid #4caf50;
        }
        
        .planner-cell.has-rientro {
            border-left: 3px solid #ff9800;
        }
        
        .planner-cell.has-gettone {
            border-right: 3px solid #2196f3;
        }
        
        @media print {
            .planner-style-table {
                font-size: 8pt;
                border-spacing: 0.5px;
            }
            
            .planner-style-table th,
            .planner-style-table td {
                padding: 2px 1px;
                min-height: 35px;
                height: 35px;
            }
            
            .extra-indicator {
                width: 10px;
                height: 10px;
                font-size: 6pt;
                line-height: 10px;
            }
            
            .extra-details {
                font-size: 5pt;
            }
            
            .shift-name {
                font-size: 6pt;
            }
            
            .day-header {
                width: 30px;
            }
            
            .summary-badge {
                padding: 1px 2px;
                font-size: 5pt;
                min-width: 12px;
            }
            
            .operator-summary {
                margin-top: 2px;
                gap: 1px;
            }
            
            .extra-details-block {
                margin-top: 2px;
                padding: 1px 2px;
                background-color: #f5f5f5;
                border-radius: 2px;
                border-left: 1px solid #ff9800;
            }
            
            .extra-time-line {
                font-size: 5pt;
                font-weight: bold;
                margin-bottom: 0.5px;
            }
            
            .extra-hours-line {
                font-size: 5pt;
                color: #333;
                font-weight: bold;
            }
            
            .operator-total-hours {
                text-align: center;
                font-size: 6pt;
                font-weight: bold;
                color: #333;
                margin-top: 2px;
                padding: 1px 2px;
                background-color: #f0f0f0;
                border-radius: 2px;
                border: 1px solid #666;
            }
        }
        
        .symbols-summary {
            margin: 15px 0;
            padding: 10px;
            background-color: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 4px;
        }
        
        .symbols-summary p {
            margin: 0;
            font-size: 11pt;
            text-align: center;
        }
        
        .hours-summary {
            margin: 20px 0;
        }
        
        .hours-summary h3 {
            margin: 0 0 10px 0;
            font-size: 14pt;
            text-align: center;
            color: #333;
        }
        
        .total-hours-summary {
            margin-top: 15px;
            padding: 10px;
            background-color: #f0f8ff;
            border: 2px solid #4caf50;
            border-radius: 5px;
            text-align: center;
        }
        
        .total-hours-summary p {
            margin: 0;
            font-size: 12pt;
            color: #2e7d32;
        }
        
        @media print {
            .symbols-summary {
                margin: 10px 0;
                padding: 8px;
            }
            
            .symbols-summary p {
                font-size: 10pt;
            }
        }
    `;
    
    return css;
}



// Gestione touch per sotto-menu su mobile
function initializeDropdownTouchHandlers() {
    const dropdowns = document.querySelectorAll('.nav-dropdown');
    
    dropdowns.forEach(dropdown => {
        const toggle = dropdown.querySelector('.dropdown-toggle');
        const menu = dropdown.querySelector('.dropdown-menu');
        
        // Touch handlers per mobile
        toggle.addEventListener('touchstart', (e) => {
            e.preventDefault();
            
            // Chiudi altri dropdown aperti
            dropdowns.forEach(other => {
                if (other !== dropdown) {
                    other.classList.remove('active');
                }
            });
            
            // Toggle del dropdown corrente
            dropdown.classList.toggle('active');
        });
        
        // Chiudi dropdown quando si clicca fuori
        document.addEventListener('touchstart', (e) => {
            if (!dropdown.contains(e.target)) {
                dropdown.classList.remove('active');
            }
        });
        
        // Gestione hover per desktop
        dropdown.addEventListener('mouseenter', () => {
            if (window.innerWidth > 768) {
                dropdown.classList.add('active');
            }
        });
        
        dropdown.addEventListener('mouseleave', () => {
            if (window.innerWidth > 768) {
                dropdown.classList.remove('active');
            }
        });
    });
}

// Inizializza i gestori touch al caricamento
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initializeDropdownTouchHandlers();
    });
} else {
    initializeDropdownTouchHandlers();
}

// CSS per il riepilogo ore (dovrebbe essere in style.css)
function getHoursSummaryCss() {
    return `
        .hours-summary h3 {
            font-size: 12pt;
            margin-bottom: 8px;
        }
        
        .total-hours-summary {
                 margin-top: 10px;
                 padding: 8px;
             }
             
             .total-hours-summary p {
                 font-size: 11pt;
             }
         }
    `;
}

/**
 * Crea e apre la finestra di stampa
 */
function createPrintWindow(htmlContent) {
    try {
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        
        if (printWindow) {
            printWindow.document.write(htmlContent);
            printWindow.document.close();
            
            // Finestra aperta senza avvio automatico della stampa
            // L'utente può stampare manualmente usando Ctrl+P o il menu del browser
        } else {
            showToast('Impossibile aprire la finestra di stampa. Verifica le impostazioni del browser e consenti i popup.', 'error');
        }
    } catch (error) {
        console.error('Errore durante l\'apertura della finestra di stampa:', error);
        showToast('Errore durante l\'apertura della finestra di stampa.', 'error');
    }
}

// ===============================================================
// MOBILE INTERFACE FUNCTIONS
// ===============================================================

function initializeMobileInterface() {
    console.log('Inizializzazione interfaccia mobile...');
    
    // Elementi del menu mobile
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const mobileMenuPanel = document.getElementById('mobile-menu-panel');
    const mobileMenuOverlay = document.getElementById('mobile-menu-overlay');
    const mobileFullscreenToggle = document.getElementById('mobile-fullscreen-toggle');
    
    // Controlli mobile nel menu
    const mobileThemeToggle = document.getElementById('mobile-theme-toggle');
    const mobileThreedToggle = document.getElementById('mobile-threed-toggle');
    const mobileSymbolsToggle = document.getElementById('mobile-symbols-toggle');
    
    // Controlli desktop corrispondenti
    const desktopThemeToggle = document.getElementById('theme-toggle');
    const desktopThreedToggle = document.getElementById('threed-effect-toggle');
    const desktopSymbolsToggle = document.getElementById('mod-symbols-toggle');
    
    if (!mobileMenuToggle || !mobileMenuPanel || !mobileMenuOverlay || !mobileFullscreenToggle) {
        console.error('Elementi del menu mobile non trovati');
        return;
    }
    
    // Stato del menu mobile
    let isMobileMenuOpen = false;
    let isMobileFullscreen = false;
    
    // Funzione per aprire/chiudere il menu mobile
    function toggleMobileMenu() {
        isMobileMenuOpen = !isMobileMenuOpen;
        
        if (isMobileMenuOpen) {
            mobileMenuPanel.classList.add('open');
            mobileMenuOverlay.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        } else {
            mobileMenuPanel.classList.remove('open');
            mobileMenuOverlay.classList.add('hidden');
            document.body.style.overflow = '';
        }
    }
    
    // Funzione per attivare/disattivare la modalità fullscreen mobile
    function toggleMobileFullscreen() {
        isMobileFullscreen = !isMobileFullscreen;
        const plannerDiv = document.getElementById('planner');
        
        if (isMobileFullscreen) {
            plannerDiv.classList.add('mobile-fullscreen');
            document.body.classList.add('planner-active');
            
            // Nascondi i nomi e mostra solo i cognomi
            const operatorNames = document.querySelectorAll('.operator-name');
            const operatorSurnames = document.querySelectorAll('.operator-surname');
            
            operatorNames.forEach(name => name.style.display = 'none');
            operatorSurnames.forEach(surname => {
                surname.style.display = 'block';
                surname.style.fontWeight = '600';
            });
            
            // Aggiorna l'icona del pulsante fullscreen
            mobileFullscreenToggle.innerHTML = `
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            `;
            
            showToast('Modalità fullscreen attivata', 'success');
        } else {
            plannerDiv.classList.remove('mobile-fullscreen');
            document.body.classList.remove('planner-active');
            
            // Ripristina la visualizzazione normale
            const operatorNames = document.querySelectorAll('.operator-name');
            const operatorSurnames = document.querySelectorAll('.operator-surname');
            
            operatorNames.forEach(name => name.style.display = '');
            operatorSurnames.forEach(surname => {
                surname.style.display = '';
                surname.style.fontWeight = '';
            });
            
            // Ripristina l'icona del pulsante fullscreen
            mobileFullscreenToggle.innerHTML = `
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path>
                </svg>
            `;
            
            showToast('Modalità fullscreen disattivata', 'info');
        }
    }
    
    // Sincronizzazione dei controlli mobile con quelli desktop
    function syncMobileControls() {
        if (mobileThemeToggle && desktopThemeToggle) {
            mobileThemeToggle.checked = desktopThemeToggle.checked;
        }
        if (mobileThreedToggle && desktopThreedToggle) {
            mobileThreedToggle.checked = desktopThreedToggle.checked;
        }
        if (mobileSymbolsToggle && desktopSymbolsToggle) {
            mobileSymbolsToggle.checked = desktopSymbolsToggle.checked;
        }
    }
    
    // Event listeners
    mobileMenuToggle.addEventListener('click', toggleMobileMenu);
    mobileMenuOverlay.addEventListener('click', toggleMobileMenu);
    mobileFullscreenToggle.addEventListener('click', toggleMobileFullscreen);
    
    // Sincronizzazione controlli mobile-desktop
    if (mobileThemeToggle && desktopThemeToggle) {
        mobileThemeToggle.addEventListener('change', () => {
            desktopThemeToggle.checked = mobileThemeToggle.checked;
            desktopThemeToggle.dispatchEvent(new Event('change'));
        });
    }
    
    if (mobileThreedToggle && desktopThreedToggle) {
        mobileThreedToggle.addEventListener('change', () => {
            desktopThreedToggle.checked = mobileThreedToggle.checked;
            desktopThreedToggle.dispatchEvent(new Event('change'));
        });
    }
    
    if (mobileSymbolsToggle && desktopSymbolsToggle) {
        mobileSymbolsToggle.addEventListener('change', () => {
            desktopSymbolsToggle.checked = mobileSymbolsToggle.checked;
            desktopSymbolsToggle.dispatchEvent(new Event('change'));
        });
    }
    
    // Sincronizzazione iniziale
    syncMobileControls();
    
    // Gestione touch per zoom e pan nella modalità fullscreen
    let initialDistance = 0;
    let initialScale = 1;
    let currentScale = 1;
    let isPanning = false;
    let startX = 0;
    let startY = 0;
    let translateX = 0;
    let translateY = 0;
    
    function getDistance(touches) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    // Reset zoom function
    function resetZoom() {
        if (!isMobileFullscreen) return;
        
        currentScale = 1;
        translateX = 0;
        translateY = 0;
        
        const tableContainer = document.querySelector('.mobile-fullscreen .table-container');
        if (tableContainer) {
            tableContainer.style.transformOrigin = 'top left';
            tableContainer.style.transform = 'scale(1) translate(0px, 0px)';
            tableContainer.style.transition = 'transform 0.3s ease-out';
            
            setTimeout(() => {
                tableContainer.style.transition = '';
            }, 300);
        }
    }
    
    // Double tap to reset zoom
    let lastTapTime = 0;
    function handleDoubleTap(e) {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTapTime;
        
        if (tapLength < 500 && tapLength > 0) {
            e.preventDefault();
            resetZoom();
        }
        
        lastTapTime = currentTime;
    }
    
    function handleTouchStart(e) {
        if (!isMobileFullscreen) return;
        
        const tableContainer = document.querySelector('.mobile-fullscreen .table-container');
        if (!tableContainer) return;
        
        if (e.touches.length === 2) {
            // Zoom gesture
            initialDistance = getDistance(e.touches);
            initialScale = currentScale;
            tableContainer.classList.add('zooming');
            document.getElementById('planner').classList.add('gesture-active');
        } else if (e.touches.length === 1) {
            // Pan gesture
            isPanning = true;
            startX = e.touches[0].clientX - translateX;
            startY = e.touches[0].clientY - translateY;
            tableContainer.classList.add('panning');
            document.getElementById('planner').classList.add('gesture-active');
        }
    }
    
    function handleTouchMove(e) {
        if (!isMobileFullscreen) return;
        
        e.preventDefault();
        
        if (e.touches.length === 2 && initialDistance > 0) {
            // Zoom gesture with center point
            const currentDistance = getDistance(e.touches);
            const scale = (currentDistance / initialDistance) * initialScale;
            currentScale = Math.max(0.3, Math.min(5, scale)); // Expanded zoom range
            
            // Calculate zoom center point
            const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            
            const tableContainer = document.querySelector('.mobile-fullscreen .table-container');
            if (tableContainer) {
                const rect = tableContainer.getBoundingClientRect();
                const offsetX = (centerX - rect.left) / rect.width;
                const offsetY = (centerY - rect.top) / rect.height;
                
                tableContainer.style.transformOrigin = `${offsetX * 100}% ${offsetY * 100}%`;
                tableContainer.style.transform = `scale(${currentScale}) translate(${translateX}px, ${translateY}px)`;
            }
        } else if (e.touches.length === 1 && isPanning) {
            // Pan gesture with momentum and boundaries
            const deltaX = e.touches[0].clientX - startX;
            const deltaY = e.touches[0].clientY - startY;
            
            // Apply momentum and boundaries
            translateX = Math.max(-window.innerWidth, Math.min(window.innerWidth, deltaX));
            translateY = Math.max(-window.innerHeight, Math.min(window.innerHeight, deltaY));
            
            const tableContainer = document.querySelector('.mobile-fullscreen .table-container');
            if (tableContainer) {
                tableContainer.style.transform = `scale(${currentScale}) translate(${translateX}px, ${translateY}px)`;
            }
        }
    }
    
    function handleTouchEnd(e) {
        if (!isMobileFullscreen) return;
        
        const tableContainer = document.querySelector('.mobile-fullscreen .table-container');
        if (tableContainer) {
            tableContainer.classList.remove('zooming', 'panning');
        }
        
        if (e.touches.length === 0) {
            isPanning = false;
            initialDistance = 0;
            document.getElementById('planner').classList.remove('gesture-active');
        }
    }
    
    // Aggiungi event listeners per touch
    document.addEventListener('touchstart', handleTouchStart, { passive: false });
        document.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.addEventListener('touchend', handleTouchEnd, { passive: false });
        
        // Add double tap listener for zoom reset
        const plannerTable = document.getElementById('planner-table');
        if (plannerTable) {
            plannerTable.addEventListener('touchend', handleDoubleTap, { passive: false });
        }
    
    // Gestione tasto ESC per uscire dalla modalità fullscreen
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isMobileFullscreen) {
            toggleMobileFullscreen();
        }
    });
    
    console.log('Interfaccia mobile inizializzata con successo');
}