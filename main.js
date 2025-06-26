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
    formatCurrency,
    // Customer UI functions
    populateCustomerDropdown,
    displaySelectedCustomerDetails,
    openCustomerModal,
    closeCustomerModal,
    clearCustomerSelection
} from './ui.js';
import { saveQuoteToDb, addCustomerToDb, getCustomersFromDb, updateCustomerInDb } from './database.js';
import CONFIG from './app-config.js';

// 2. A central place for the application's data (The "State")
const state = {
    freightRates: {},
    locations: [],
    customers: [], // To store fetched customer data
    currentQuoteData: null,
    currentEditingCustomerId: null // To track if we are editing a customer
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
            // Pass state.customers to generateQuote so it can find selected customer details
            // Note: elements.customers will be populated in initializeApp and passed to ui.js functions
            const quoteData = generateQuote(elements, state.freightRates, state.customers);
            if (quoteData) {
                state.currentQuoteData = quoteData;
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
            const userId = auth.currentUser.uid;
            // currentQuoteData already contains customerId, customerName, clientName, clientAddress, clientContact from generateQuote
            const dataToSave = {
                ...state.currentQuoteData,
                userId: userId, // User who created the quote
            };

            elements.saveQuoteBtn.disabled = true;
            elements.saveQuoteBtn.textContent = 'Saving...';

            const success = await saveQuoteToDb(dataToSave);

            if (success) {
                elements.saveQuoteBtn.textContent = 'Saved!';
                console.log("Quote successfully saved to the database.");
                // Potentially refresh something or give other feedback
            } else {
                elements.saveQuoteBtn.textContent = 'Save Failed';
                alert("There was an error saving the quote. Please try again.");
                elements.saveQuoteBtn.disabled = false;
            }
        });
        console.log("Listener attached: saveQuoteBtn");
    } else {
        console.error("CRITICAL ERROR: saveQuoteBtn is null. Cannot attach listener.");
    }

    // Attach listeners for piecesContainer (assuming it's always available as per HTML structure)

    // Customer related event listeners
    if (elements.addNewCustomerBtn) {
        elements.addNewCustomerBtn.addEventListener('click', () => {
            state.currentEditingCustomerId = null; // Ensure we are in "add new" mode
            openCustomerModal(elements); // elements should contain all modal inputs by now
        });
        console.log("Listener attached: addNewCustomerBtn");
    }

    if (elements.customerModalCloseBtn) {
        elements.customerModalCloseBtn.addEventListener('click', () => closeCustomerModal(elements));
        console.log("Listener attached: customerModalCloseBtn");
    }

    if (elements.cancelCustomerBtn) {
        elements.cancelCustomerBtn.addEventListener('click', () => closeCustomerModal(elements));
        console.log("Listener attached: cancelCustomerBtn");
    }

    if (elements.saveCustomerBtn) {
        elements.saveCustomerBtn.addEventListener('click', async () => {
            const name = elements.customerNameInput.value.trim();
            // Use companyName from input, not customerCompany (which is the DOM element)
            const companyName = elements.customerCompanyInput.value.trim();
            const email = elements.customerEmailInput.value.trim();
            const phone = elements.customerPhoneInput.value.trim();
            const address = elements.customerAddressInput.value.trim();

            if (!name && !companyName) { // Require at least a name or company name
                alert("Customer Name or Company Name is required.");
                return;
            }

            // If name is empty but companyName is not, use companyName for the 'name' field.
            const finalName = name || companyName;

            const customerData = {
                name: finalName, // Main identifier
                companyName: companyName || null,
                email: email || null,
                phone: phone || null,
                address: address || null,
                userId: auth.currentUser.uid
            };

            let success;
            let customerIdToSelect = null;

            elements.saveCustomerBtn.disabled = true;
            elements.saveCustomerBtn.textContent = state.currentEditingCustomerId ? 'Saving...' : 'Adding...';

            if (state.currentEditingCustomerId) { // Editing existing customer
                success = await updateCustomerInDb(state.currentEditingCustomerId, customerData);
                if (success) customerIdToSelect = state.currentEditingCustomerId;
            } else { // Adding new customer
                const newCustomerId = await addCustomerToDb(customerData);
                if (newCustomerId) {
                    success = true;
                    customerIdToSelect = newCustomerId;
                } else {
                    success = false;
                }
            }

            elements.saveCustomerBtn.disabled = false;
            elements.saveCustomerBtn.textContent = 'Save Customer';

            if (success) {
                // Call helper to refresh customer list in state and UI
                await fetchAndSetCustomers(elements, auth.currentUser.uid);
                if (customerIdToSelect && elements.customerSelect) {
                     elements.customerSelect.value = customerIdToSelect;
                     // Manually trigger change to update details display
                     const changeEvent = new Event('change', { bubbles: true });
                     elements.customerSelect.dispatchEvent(changeEvent);
                }
                closeCustomerModal(elements);
            } else {
                alert(`Failed to ${state.currentEditingCustomerId ? 'update' : 'add'} customer. Please try again.`);
            }
        });
        console.log("Listener attached: saveCustomerBtn");
    }

    if (elements.customerSelect) {
        elements.customerSelect.addEventListener('change', (e) => {
            const selectedId = e.target.value;
            if (selectedId) {
                const selectedCustomer = state.customers.find(c => c.id === selectedId);
                displaySelectedCustomerDetails(elements, selectedCustomer);
            } else {
                // Pass elements to clearCustomerSelection
                clearCustomerSelection(elements);
            }
        });
        console.log("Listener attached: customerSelect");
    }

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

            // Show a loading indicator to the user
            elements.downloadPdfBtn.disabled = true;
            elements.downloadPdfBtn.textContent = 'Generating...';

            try {
                const pdfGeneratorUrl = CONFIG.PDF_GENERATOR_URL;

                // --- NEW: Timeout logic ---
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000); // 30-second timeout
                // --- End of new logic ---

                const response = await fetch(pdfGeneratorUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(state.currentQuoteData),
                    signal: controller.signal // Link the AbortController to the fetch request
                });

                // --- NEW: Clear the timeout if the fetch completes in time ---
                clearTimeout(timeoutId);
                // --- End of new logic ---

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Server responded with an error: ${response.status} ${errorText}`);
                }

                const pdfBlob = await response.blob();
                // ... (rest of the download logic is the same)

            } catch (error) {
                if (error.name === 'AbortError') {
                    console.error("PDF Generation timed out.");
                    alert("The request took too long and was cancelled. Please try again.");
                } else {
                    console.error("PDF Generation Error:", error);
                    alert("Could not generate the PDF. Please check the console for details.");
                }
            } finally {
                // Re-enable the button
                elements.downloadPdfBtn.disabled = false;
                elements.downloadPdfBtn.textContent = 'Download PDF';
            }
        });
        console.log("Listener attached for server-side PDF generation.");
    } else {
        console.error("CRITICAL ERROR: downloadPdfBtn is null. Cannot attach listener.");
    }

    
    if (elements.logoutBtn) {
        elements.logoutBtn.addEventListener('click', () => {
            auth.signOut().then(() => {
                console.log('User signed out successfully.');
                // The onAuthStateChanged listener will automatically redirect to login.html
            }).catch((error) => {
                console.error('Sign out error:', error);
                alert("Error signing out. Please try again.");
            });
        });
        console.log("Listener attached: logoutBtn");
    } else {
        console.error("CRITICAL ERROR: logoutBtn is null. Cannot attach listener.");
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
        logoutBtn: document.getElementById('nav-logout-btn'),

        // Customer UI Elements
        customerSelect: document.getElementById('customer-select'),
        addNewCustomerBtn: document.getElementById('add-new-customer-btn'),
        selectedCustomerDetails: document.getElementById('selected-customer-details'),
        // Customer Modal Elements
        customerModal: document.getElementById('customer-modal'),
        customerModalTitle: document.getElementById('customer-modal-title'),
        customerModalCloseBtn: document.getElementById('customer-modal-close-btn'),
        customerIdInput: document.getElementById('customer-id-input'),
        customerNameInput: document.getElementById('customer-name'),
        customerCompanyInput: document.getElementById('customer-company'),
        customerEmailInput: document.getElementById('customer-email'),
        customerPhoneInput: document.getElementById('customer-phone'),
        customerAddressInput: document.getElementById('customer-address'),
        saveCustomerBtn: document.getElementById('save-customer-btn'),
        cancelCustomerBtn: document.getElementById('cancel-customer-btn')
    };
    // Pass elements to ui.js functions that need it, e.g. for generateQuote
    elements.customers = state.customers;


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
        // Fetch locations and rates
        const apiData = await loadRateData();
        state.freightRates = apiData.freightRates;
        state.locations = apiData.locations;
        populateDropdowns(elements, state.locations); // For origin/destination

        // Fetch customers for the current user
        if (auth.currentUser) {
            await fetchAndSetCustomers(elements, auth.currentUser.uid);
        }

        resetApp(elements); // Resets form, including customer selection
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

// Helper function to fetch customers and update state & UI
async function fetchAndSetCustomers(elements, userId) {
    try {
        state.customers = await getCustomersFromDb(userId);
        // Make sure elements.customers is updated for other functions (like generateQuote in ui.js)
        // This assumes generateQuote in ui.js will receive 'elements' which has 'customers' property.
        elements.customers = state.customers;
        populateCustomerDropdown(elements, state.customers);
        console.log("Customers fetched and dropdown populated:", state.customers.length);
    } catch (error) {
        console.error("Error fetching and setting customers:", error);
        // Optionally, inform the user that customer list couldn't be loaded
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
});