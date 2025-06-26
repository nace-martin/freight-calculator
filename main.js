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
    generateQuote,
    toggleFormLock,
    formatCurrency
} from './ui.js';
import { saveQuoteToDb } from './database.js';
import CONFIG from './app-config.js';

// 2. A central place for the application's data (The "State")
const state = {
    freightRates: {},
    locations: [],
    currentQuoteData: null
};

// 3. Setup event listeners to connect user actions to functions
// This function now explicitly accepts the 'elements' object
function setupEventListeners(elements) {
    console.log("Attempting to set up event listeners.");

    if (elements.addPieceBtn) {
        elements.addPieceBtn.addEventListener('click', () => addPiece(elements));
        console.log("Listener attached: addPieceBtn");
    } else {
        console.error("CRITICAL ERROR: addPieceBtn is null. Cannot attach listener.");
    }

    if (elements.resetButton) {
        elements.resetButton.addEventListener('click', () => resetApp(elements));
        console.log("Listener attached: resetButton");
    } else {
        console.error("CRITICAL ERROR: resetButton is null. Cannot attach listener.");
    }

    if (elements.quoteButton) {
        elements.quoteButton.addEventListener('click', () => {
            const quoteData = generateQuote(elements, state.freightRates);
            if (quoteData) {
                state.currentQuoteData = quoteData;
                // Protect calls using saveQuoteBtn if it's null
                if (elements.saveQuoteBtn) {
                    elements.saveQuoteBtn.disabled = false;
                    elements.saveQuoteBtn.textContent = 'Save Quote';
                } else {
                    console.warn("saveQuoteBtn is null after quote generation, cannot update its state.");
                }
            }
        });
        console.log("Listener attached: quoteButton");
    } else {
        console.error("CRITICAL ERROR: quoteButton is null. Cannot attach listener.");
    }

    // This listener can now be attached without immediate error, as saveQuoteBtn is now in HTML
    if (elements.saveQuoteBtn) {
        elements.saveQuoteBtn.addEventListener('click', async () => {
            if (!state.currentQuoteData) {
                alert("There is no quote data to save.");
                return;
            }

            if (!auth.currentUser) {
                alert("You must be logged in to save a quote.");
                return;
            }
            const userId = auth.currentUser.uid;            const dataToSave = {
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
        console.log("Listener attached: saveQuoteBtn");
    } else {
        console.error("CRITICAL ERROR: saveQuoteBtn is null. Cannot attach listener (this should now be fixed if HTML is updated).");
    }

    // Attach listeners for piecesContainer (assuming it's always available as per HTML structure)
    if (elements.piecesContainer) {
        elements.piecesContainer.addEventListener('input', () => getChargeableWeight(elements));
        elements.piecesContainer.addEventListener('click', function(event) {
            if (event.target.classList.contains('btn-remove')) {
                event.target.closest('.piece-row').remove();
                getChargeableWeight(elements);
            }
        });
        console.log("Listener attached: piecesContainer");
    } else {
        console.error("CRITICAL ERROR: piecesContainer is null. Cannot attach listener.");
    }


    if (elements.downloadPdfBtn) {
        elements.downloadPdfBtn.addEventListener('click', async () => {
            if (!state.currentQuoteData) {
                alert("Cannot generate PDF. No quote data available.");
                return;
            }

            elements.downloadPdfBtn.disabled = true;
            elements.downloadPdfBtn.textContent = 'Generating...';

            try {
                // This uses the config file to get the correct URL
                const pdfGeneratorUrl = CONFIG.PDF_GENERATOR_URL;

                // --- Timeout logic with increased time ---
                const controller = new AbortController();
                // We've increased the timeout to 60 seconds for local testing
                const timeoutId = setTimeout(() => controller.abort(), 60000); 
                
                const response = await fetch(pdfGeneratorUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(state.currentQuoteData),
                    signal: controller.signal 
                });

                // Clear the timeout if the fetch completes in time
                clearTimeout(timeoutId);

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Server responded with an error: ${response.status} ${errorText}`);
                }

                const pdfBlob = await response.blob();

                const url = window.URL.createObjectURL(pdfBlob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = `EFM_Quote_${Date.now()}.pdf`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                a.remove();

            } catch (error) {
                if (error.name === 'AbortError') {
                    console.error("PDF Generation timed out.");
                    alert("The request took too long and was cancelled. Please try again.");
                } else {
                    console.error("PDF Generation Error:", error);
                    alert("Could not generate the PDF. Please check the console for details.");
                }
            } finally {
                elements.downloadPdfBtn.disabled = false;
                elements.downloadPdfBtn.textContent = 'Download PDF';
            }
        });
    }
}
// 4. Initializer function that runs when the page loads
async function initializeApp() {
    // 1. A central place for all HTML element references (The "View")
    // This block is now correctly defined inside initializeApp
    const elements = {
        originSelect: document.getElementById('origin'),
        destinationSelect: document.getElementById('destination'),
        quoteButton: document.getElementById('generate-quote-btn'),
        resetButton: document.getElementById('reset-btn'),
        downloadPdfBtn: document.getElementById('download-pdf-btn'),
        saveQuoteBtn: document.getElementById('save-quote-btn'), // This was the null one!
        quoteOutputDiv: document.getElementById('quote-output'),
        piecesContainer: document.getElementById('pieces-container'),
        addPieceBtn: document.getElementById('add-piece-btn'),
        chargeableWeightDisplay: document.getElementById('chargeableWeightDisplay'),
        form: document.getElementById('calculator-form'),
        pieceRowTemplate: document.getElementById('piece-row-template'),
        logoutBtn: document.getElementById('nav-logout-btn')
    };
const navTitleElement = document.getElementById('app-nav-title');
    if (navTitleElement) {
        navTitleElement.textContent = 'Domestic Air Freight Calculator';
    }
    // --- ADD THESE CONSOLE LOGS ---
    console.log('--- Debugging Elements ---');
    for (const key in elements) {
        if (elements.hasOwnProperty(key)) {
            console.log(`${key}:`, elements[key]);
        }
    }
    console.log('--------------------------');
    // --- END DEBUGGING LOGS ---

    // Add a more robust check for critical elements before proceeding
    if (!elements.form || !elements.quoteButton || !elements.resetButton) {
        console.error("One or more critical application elements were not found in the DOM. App will not initialize.");
        return;
    }

    console.log("Initializing application...");
    const spinner = document.getElementById('loading-spinner');

    if (spinner) {
        spinner.style.display = 'flex';
    }

    try {
        const apiData = await loadRateData();
        state.freightRates = apiData.freightRates;
        state.locations = apiData.locations;

        populateDropdowns(elements, state.locations);
        resetApp(elements);

        setupEventListeners(elements);
    } catch (error) {
        console.error("Error during application initialization:", error);
        alert("Failed to load application data. Please refresh the page.");
    } finally {
        if (spinner) {
            spinner.style.display = 'none';
        }
        console.log("Application initialization attempt finished.");
    }
}

// 5. Start the application
// Auth Guard - This protects the application
onAuthStateChanged(auth, user => {
  console.log("onAuthStateChanged fired! User object:", user); // Keep this log for verification
  if (user) {
    // User is signed in. Now check if the DOM is ready.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeApp, { once: true });
    } else {
        initializeApp();
    }
  } else {
    // User is signed out. Redirect to login.
    window.location.href = 'login.html';
  }
})