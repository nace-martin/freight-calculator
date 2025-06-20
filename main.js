// main.js
// This is the main entry point of the application. It orchestrates all other modules.

import { loadRateData } from './api.js';
import {
    populateDropdowns,
    getChargeableWeight,
    addPiece,
    resetApp,
    generateQuote
} from './ui.js';

// 1. A central place for all HTML element references (The "View")
const elements = {
    originSelect: document.getElementById('origin'),
    destinationSelect: document.getElementById('destination'),
    quoteButton: document.getElementById('generate-quote-btn'),
    resetButton: document.getElementById('reset-btn'),
    downloadPdfBtn: document.getElementById('download-pdf-btn'),
    quoteOutputDiv: document.getElementById('quote-output'),
    piecesContainer: document.getElementById('pieces-container'),
    addPieceBtn: document.getElementById('add-piece-btn'),
    chargeableWeightDisplay: document.getElementById('chargeableWeightDisplay'),
    form: document.getElementById('calculator-form'),
    pieceRowTemplate: document.getElementById('piece-row-template')
};

// 2. A central place for the application's data (The "State")
const state = {
    freightRates: {},
    locations: []
};

// 3. Setup event listeners to connect user actions to functions
function setupEventListeners() {
    elements.addPieceBtn.addEventListener('click', () => addPiece(elements));

    elements.resetButton.addEventListener('click', () => resetApp(elements));

    elements.quoteButton.addEventListener('click', () => {
        // Pass the required state (freightRates) to the generateQuote function
        generateQuote(elements, state.freightRates);
    });

    elements.piecesContainer.addEventListener('input', () => getChargeableWeight(elements));

    elements.piecesContainer.addEventListener('click', function(event) {
        if (event.target.classList.contains('btn-remove')) {
            event.target.closest('.piece-row').remove();
            getChargeableWeight(elements);
        }
    });

    elements.downloadPdfBtn.addEventListener('click', () => {
        const headerToPrint = document.querySelector('.header');
        const quoteToPrint = document.getElementById('quote-output');
        if (quoteToPrint.innerHTML.trim() === "") return;

        const printableArea = document.createElement('div');
        printableArea.appendChild(headerToPrint.cloneNode(true));
        printableArea.appendChild(quoteToPrint.cloneNode(true));

        const opt = {
            margin: 0.5,
            filename: `EFM_Quote_${Date.now()}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
        };
        // html2pdf is available globally from the script tag in index.html
        html2pdf().set(opt).from(printableArea).save();
    });
}

// 4. Initializer function that runs when the page loads
async function initializeApp() {
    console.log("Initializing application...");

    // Fetch data from the API and update the state
    const apiData = await loadRateData();
    state.freightRates = apiData.freightRates;
    state.locations = apiData.locations;

    // Initialize the UI with the loaded data
    populateDropdowns(elements, state.locations);
    resetApp(elements); // Ensures the app starts in a clean state

    // Activate all event listeners
    setupEventListeners();

    console.log("Application initialized successfully.");
}

// 5. Start the application
initializeApp();