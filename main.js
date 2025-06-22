// main.js
// This is the main entry point of the application. It orchestrates all other modules.
import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { loadRateData } from './api.js';
import {
    populateDropdowns,
    getChargeableWeight,
    addPiece,
    resetApp,
    generateQuote
} from './ui.js';
import { saveQuoteToDb } from './database.js';

// 1. A central place for all HTML element references (The "View")
const elements = {
    originSelect: document.getElementById('origin'),
    destinationSelect: document.getElementById('destination'),
    quoteButton: document.getElementById('generate-quote-btn'),
    resetButton: document.getElementById('reset-btn'),
    downloadPdfBtn: document.getElementById('download-pdf-btn'),
    saveQuoteBtn: document.getElementById('save-quote-btn'),
    quoteOutputDiv: document.getElementById('quote-output'),
    piecesContainer: document.getElementById('pieces-container'),
    addPieceBtn: document.getElementById('add-piece-btn'),
    chargeableWeightDisplay: document.getElementById('chargeableWeightDisplay'),
    form: document.getElementById('calculator-form'),
    pieceRowTemplate: document.getElementById('piece-row-template'),
    logoutBtn: document.getElementById('logout-btn')
};

// 2. A central place for the application's data (The "State")
const state = {
    freightRates: {},
    locations: [],
    currentQuoteData: null
};

// 3. Setup event listeners to connect user actions to functions
function setupEventListeners() {
    elements.addPieceBtn.addEventListener('click', () => addPiece(elements));
    elements.resetButton.addEventListener('click', () => resetApp(elements));

    elements.quoteButton.addEventListener('click', () => {
        // The generateQuote function now returns the data object
        const quoteData = generateQuote(elements, state.freightRates);
        // If a quote was successfully generated, store its data in our state
        if (quoteData) {
            state.currentQuoteData = quoteData;
            elements.saveQuoteBtn.disabled = false; // Ensure save button is clickable
            elements.saveQuoteBtn.textContent = 'Save Quote';
        }
    });

    // This is the new event listener for our save button
    elements.saveQuoteBtn.addEventListener('click', async () => {
        if (!state.currentQuoteData) {
            alert("There is no quote data to save.");
            return;
        }

        // Get the current user's unique ID to link the quote to them
        const userId = auth.currentUser.uid;
        const dataToSave = {
            ...state.currentQuoteData,
            userId: userId 
        };

        elements.saveQuoteBtn.disabled = true;
        elements.saveQuoteBtn.textContent = 'Saving...';

        const success = await saveQuoteToDb(dataToSave);

        if (success) {
            elements.saveQuoteBtn.textContent = 'Saved!';
            console.log("Quote successfully saved to the database.");
        } else {
            elements.saveQuoteBtn.textContent = 'Save Failed';
            alert("There was an error saving the quote. Please try again.");
            elements.saveQuoteBtn.disabled = false;
        }
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
        html2pdf().set(opt).from(printableArea).save();
    });

        elements.logoutBtn.addEventListener('click', () => {
        auth.signOut().then(() => {
            console.log('User signed out successfully.');
            // The onAuthStateChanged listener will automatically redirect to login.html
        }).catch((error) => {
            console.error('Sign out error:', error);
        });
    });
}

// 4. Initializer function that runs when the page loads
async function initializeApp() {
    // This guard clause prevents the app from trying to initialize on the wrong page.
    // It checks for a core element of the main app (`calculator-form`). If it's not found,
    // it silently exits, preventing crashes.
    if (!elements.form) {
        return;
    }

    console.log("Initializing application...");
    const spinner = document.getElementById('loading-spinner');
    
    // Show the spinner before we start loading data
    spinner.style.display = 'flex';

    // Fetch data from the API and update the state
    const apiData = await loadRateData();
    state.freightRates = apiData.freightRates;
    state.locations = apiData.locations;

    // Initialize the UI with the loaded data
    populateDropdowns(elements, state.locations);
    resetApp(elements); // Ensures the app starts in a clean state

    // Activate all event listeners
    setupEventListeners();

    // Hide the spinner now that everything is loaded and ready
    spinner.style.display = 'none';
    
    console.log("Application initialized successfully.");
}

// 5. Start the application
// Auth Guard - This protects the application
onAuthStateChanged(auth, user => {
  if (user) {
    document.addEventListener('DOMContentLoaded', () => {
      initializeApp();
    });
  } else {
    window.location.href = 'login.html';
  }
});
