// dashboard.js
import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getQuotesFromDb, getCustomersFromDb, addCustomerToDb, updateCustomerInDb, deleteCustomerFromDb } from './database.js';

// --- State ---
let allQuotes = [];
let allCustomers = [];
let currentView = 'quotes'; // 'quotes' or 'customers'
let currentEditingCustomerId = null; // For customer modal

// --- Element References (add more as needed) ---
const elements = {};

// --- Helper Functions ---
function formatCurrency(number) {
    return (number || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(isoString) {
    if (!isoString) return 'N/A';
    return new Date(isoString).toLocaleDateString('en-AU', {
        day: '2-digit', month: '2-digit', year: '2-digit'
    });
}

// --- Modal Logic ---
function populateAndShowModal(quoteId) {
    const quote = allQuotes.find(q => q.id === quoteId);
    if (!quote) return;

    const modal = document.getElementById('quote-modal');
    const modalDetailsContainer = document.getElementById('modal-quote-details');
    
    let detailsHtml = `
        <div class="modal-info-grid">
            <p><strong>Quote ID:</strong> ${quote.id.slice(-6).toUpperCase()}</p>
            <p><strong>Date:</strong> ${new Date(quote.quoteGeneratedAt).toLocaleString()}</p>
            ${quote.customerName ? `<p><strong>Customer:</strong> ${quote.customerName}</p>` : ''}
            <p><strong>Route:</strong> ${quote.origin} &rarr; ${quote.destination}</p>
            <p><strong>Chargeable Wt:</strong> ${quote.chargeableWeight} kg</p>
        </div>
        <hr>
        <h4>Charge Summary</h4>
        <table class="modal-breakdown-table">
            <thead>
                <tr>
                    <th>Description</th>
                    <th>Rate</th>
                    <th>Subtotal</th>
                    <th>GST</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
    `;
    quote.lineItems.forEach(item => {
        detailsHtml += `
            <tr>
                <td>${item.name}</td>
                <td>${item.rate.toFixed(2)}</td>
                <td>${formatCurrency(item.subTotal)}</td>
                <td>${formatCurrency(item.gst)}</td>
                <td>${formatCurrency(item.total)}</td>
            </tr>
        `;
    });
    detailsHtml += `
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="2"><strong>Totals</strong></td>
                    <td><strong>${formatCurrency(quote.subTotal)}</strong></td>
                    <td><strong>${formatCurrency(quote.gst)}</strong></td>
                    <td><strong>${formatCurrency(quote.grandTotal)}</strong></td>
                </tr>
            </tfoot>
        </table>
    `;

    modalDetailsContainer.innerHTML = detailsHtml;
    modal.style.display = 'flex'; // Show the modal
}

function setupModal() {
    const modal = document.getElementById('quote-modal');
    const closeBtn = document.querySelector('.modal-close-btn');

    closeBtn.onclick = () => {
        modal.style.display = 'none';
    };

    // Close modal if user clicks on the dark overlay
    window.onclick = (event) => {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    };
}


// --- Rendering & Event Logic ---
function renderQuotesTable(quotesToRender) {
    const quotesListContainer = document.getElementById('quotes-list-container');
    
    if (quotesToRender.length === 0 && allQuotes.length > 0) {
        quotesListContainer.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2em;">No matching quotes found.</td></tr>';
        return;
    }
    
    // Map quotes to table rows, now including an "Actions" column and Customer
    const quotesHtml = quotesToRender.map(quote => `
        <tr>
            <td>${quote.id.slice(-6).toUpperCase()}</td>
            <td>${formatDate(quote.quoteGeneratedAt)}</td>
            <td>${quote.customerName || 'N/A'}</td>
            <td>${quote.origin} &rarr; ${quote.destination}</td>
            <td>${quote.chargeableWeight} kg</td>
            <td style="text-align: right;">${formatCurrency(quote.grandTotal)}</td>
            <td><button class="btn-view-quote" data-quote-id="${quote.id}">View</button></td>
        </tr>
    `).join('');

    elements.quotesListContainer.innerHTML = quotesHtml;
}

// --- Customer View Functions ---
function renderCustomersTable(customersToRender) {
    if (!elements.customersListContainer) return;

    if (customersToRender.length === 0 && allCustomers.length > 0) {
        elements.customersListContainer.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2em;">No matching customers found.</td></tr>';
        return;
    }
     if (customersToRender.length === 0) {
        elements.customersListContainer.innerHTML = ''; // Clear if no customers at all after potential filter
        return;
    }


    const customersHtml = customersToRender.map(cust => `
        <tr>
            <td>${cust.name}</td>
            <td>${cust.companyName || 'N/A'}</td>
            <td>${cust.email || 'N/A'}</td>
            <td>${cust.phone || 'N/A'}</td>
            <td>
                <button class="btn-edit-customer" data-customer-id="${cust.id}">Edit</button>
                <button class="btn-delete-customer" data-customer-id="${cust.id}">Delete</button>
            </td>
        </tr>
    `).join('');
    elements.customersListContainer.innerHTML = customersHtml;
}

async function initializeCustomersView(userId) {
    if (!elements.customersView || !elements.customersLoadingSpinner || !elements.noCustomersMessage || !elements.customersTableContainer) {
        console.error("Customer view elements not all defined.");
        return;
    }
    elements.customersLoadingSpinner.style.display = 'flex';
    elements.noCustomersMessage.style.display = 'none';
    elements.customersTableContainer.style.display = 'none';

    try {
        allCustomers = await getCustomersFromDb(userId);
        if (allCustomers.length === 0) {
            elements.noCustomersMessage.style.display = 'block';
        } else {
            elements.customersTableContainer.style.display = 'block';
            renderCustomersTable(allCustomers);
        }
    } catch (error) {
        console.error("Error initializing customers view:", error);
        if (elements.customersListContainer) {
            elements.customersListContainer.innerHTML = '<tr><td colspan="5" style="color:red; text-align:center; padding: 2em;">Failed to load customers.</td></tr>';
        }
    } finally {
        elements.customersLoadingSpinner.style.display = 'none';
    }
}


// --- Modal Logic for Customer Add/Edit on Dashboard ---
function openDashboardCustomerModal(customerData = null) {
    const modal = elements.customerModal; // Reusing the modal from index.html structure
    if (!modal) {
        console.error("Customer modal not found in dashboard DOM elements.");
        return;
    }

    // Ensure all form elements are correctly referenced from `elements`
    const title = elements.customerModalTitle;
    const idInput = elements.customerIdInput; // Hidden input for ID
    const nameInput = elements.customerNameInput;
    const companyInput = elements.customerCompanyInput;
    const emailInput = elements.customerEmailInput;
    const phoneInput = elements.customerPhoneInput;
    const addressInput = elements.customerAddressInput;

    if (!title || !idInput || !nameInput || !companyInput || !emailInput || !phoneInput || !addressInput ) {
        console.error("One or more customer modal input elements are missing in dashboard DOM elements.");
        return;
    }

    // Reset form
    idInput.value = '';
    nameInput.value = '';
    companyInput.value = '';
    emailInput.value = '';
    phoneInput.value = '';
    addressInput.value = '';
    currentEditingCustomerId = null;


    if (customerData) { // Editing existing customer
        title.textContent = 'Edit Customer';
        idInput.value = customerData.id; // Set the hidden ID field
        currentEditingCustomerId = customerData.id;
        nameInput.value = customerData.name || '';
        companyInput.value = customerData.companyName || '';
        emailInput.value = customerData.email || '';
        phoneInput.value = customerData.phone || '';
        addressInput.value = customerData.address || '';
    } else { // Adding new customer
        title.textContent = 'Add New Customer';
    }
    modal.style.display = 'flex';
}

function closeDashboardCustomerModal() {
    if (elements.customerModal) {
        elements.customerModal.style.display = 'none';
        currentEditingCustomerId = null;
    }
}

// --- Navigation and View Switching ---
function switchView(viewName) {
    currentView = viewName;
    elements.quotesView.style.display = viewName === 'quotes' ? 'block' : 'none';
    elements.customersView.style.display = viewName === 'customers' ? 'block' : 'none';

    const navTitle = document.getElementById('app-nav-title');
    if (navTitle) {
        navTitle.textContent = viewName === 'quotes' ? 'RateEngine - My Quotes' : 'RateEngine - Customers';
    }

    // Highlight active nav link
    elements.navQuotesViewLink.classList.toggle('active', viewName === 'quotes');
    elements.navCustomersViewLink.classList.toggle('active', viewName === 'customers');


    // Initialize views if they haven't been loaded yet or need refresh
    if (viewName === 'quotes' && allQuotes.length === 0 && auth.currentUser) { // Avoid re-init if already loaded
        initializeQuotesView(auth.currentUser.uid);
    } else if (viewName === 'customers' && allCustomers.length === 0 && auth.currentUser) { // Avoid re-init
        initializeCustomersView(auth.currentUser.uid);
    }
}


function setupEventListeners(userId) {
    // Search input for Quotes
    if (elements.searchInput) {
        elements.searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const filteredQuotes = allQuotes.filter(quote => {
                const route = `${quote.origin} ${quote.destination}`.toLowerCase();
                const quoteId = quote.id.toLowerCase();
                const customerName = (quote.customerName || '').toLowerCase();
                return route.includes(searchTerm) || quoteId.includes(searchTerm) || customerName.includes(searchTerm);
            });
            renderQuotesTable(filteredQuotes);
        });
    }

    // Event delegation for "View Quote" buttons
    if (elements.quotesListContainer) {
        elements.quotesListContainer.addEventListener('click', (e) => {
            if (e.target && e.target.classList.contains('btn-view-quote')) {
                const quoteId = e.target.getAttribute('data-quote-id');
                populateAndShowModal(quoteId);
            }
        });
    }

    // Navigation Links
    if (elements.navQuotesViewLink) {
        elements.navQuotesViewLink.addEventListener('click', (e) => {
            e.preventDefault();
            switchView('quotes');
        });
    }
    if (elements.navCustomersViewLink) {
        elements.navCustomersViewLink.addEventListener('click', (e) => {
            e.preventDefault();
            switchView('customers');
        });
    }

    // Customer View Buttons
    if (elements.dashboardAddNewCustomerBtn) {
        elements.dashboardAddNewCustomerBtn.addEventListener('click', () => {
            openDashboardCustomerModal();
        });
    }

    // Customer Modal Buttons (using shared modal structure)
    if (elements.customerModalCloseBtn) { // From shared modal
        elements.customerModalCloseBtn.addEventListener('click', closeDashboardCustomerModal);
    }
    if (elements.cancelCustomerBtn) { // From shared modal
         elements.cancelCustomerBtn.addEventListener('click', closeDashboardCustomerModal);
    }

    if (elements.saveCustomerBtn) { // From shared modal
        elements.saveCustomerBtn.addEventListener('click', async () => {
            if (!auth.currentUser) return;
            const name = elements.customerNameInput.value.trim();
            const companyName = elements.customerCompanyInput.value.trim();
            const email = elements.customerEmailInput.value.trim();
            const phone = elements.customerPhoneInput.value.trim();
            const address = elements.customerAddressInput.value.trim();

            if (!name && !companyName) {
                alert("Customer Name or Company Name is required.");
                return;
            }
            const finalName = name || companyName;

            const customerData = { name: finalName, companyName: companyName || null, email: email || null, phone: phone || null, address: address || null, userId: auth.currentUser.uid };

            elements.saveCustomerBtn.disabled = true;
            elements.saveCustomerBtn.textContent = currentEditingCustomerId ? 'Saving...' : 'Adding...';

            let success = false;
            if (currentEditingCustomerId) {
                success = await updateCustomerInDb(currentEditingCustomerId, customerData);
            } else {
                const newId = await addCustomerToDb(customerData);
                if (newId) success = true;
            }

            elements.saveCustomerBtn.disabled = false;
            elements.saveCustomerBtn.textContent = 'Save Customer';

            if (success) {
                await initializeCustomersView(auth.currentUser.uid); // Refresh customer list
                closeDashboardCustomerModal();
            } else {
                alert(`Failed to ${currentEditingCustomerId ? 'update' : 'add'} customer.`);
            }
        });
    }

    // Event delegation for Customer Edit/Delete buttons
    if (elements.customersListContainer) {
        elements.customersListContainer.addEventListener('click', async (e) => {
            if (e.target && e.target.classList.contains('btn-edit-customer')) {
                const customerId = e.target.getAttribute('data-customer-id');
                const customer = allCustomers.find(c => c.id === customerId);
                if (customer) openDashboardCustomerModal(customer);
            }
            if (e.target && e.target.classList.contains('btn-delete-customer')) {
                const customerId = e.target.getAttribute('data-customer-id');
                if (confirm("Are you sure you want to delete this customer? This action cannot be undone.")) {
                    const success = await deleteCustomerFromDb(customerId);
                    if (success) {
                        await initializeCustomersView(auth.currentUser.uid); // Refresh list
                    } else {
                        alert("Failed to delete customer.");
                    }
                }
            }
        });
    }
}


// --- Initializer for Quotes View---
async function initializeQuotesView(userId) {
    if (!elements.quotesLoadingSpinner || !elements.noQuotesMessage || !elements.quotesTableContainer || !elements.quotesListContainer) {
         console.error("Quotes view elements not all defined for initialization.");
         return;
    }
    elements.quotesLoadingSpinner.style.display = 'flex';
    elements.noQuotesMessage.style.display = 'none';
    elements.quotesTableContainer.style.display = 'none';


    try {
        allQuotes = await getQuotesFromDb(userId); 
        if (allQuotes.length === 0) {
            elements.noQuotesMessage.style.display = 'block';
        } else {
            elements.quotesTableContainer.style.display = 'block';
            renderQuotesTable(allQuotes);
        }
    } catch (error) {
        console.error("Error initializing quotes view:", error);
        elements.quotesListContainer.innerHTML = '<tr><td colspan="7" style="color:red; text-align:center; padding: 2em;">Failed to load quotes.</td></tr>';
    } finally {
        elements.quotesLoadingSpinner.style.display = 'none';
    }
}

// --- Main Initializer & Auth Guard ---
function initializeDashboardElements() {
    // Main Views
    elements.quotesView = document.getElementById('quotes-view');
    elements.customersView = document.getElementById('customers-view');

    // Navigation
    elements.navQuotesViewLink = document.getElementById('nav-quotes-view');
    elements.navCustomersViewLink = document.getElementById('nav-customers-view');

    // Quotes View Elements
    elements.quotesLoadingSpinner = document.getElementById('quotes-loading-spinner');
    elements.noQuotesMessage = document.getElementById('no-quotes-message');
    elements.quotesTableContainer = elements.quotesView ? elements.quotesView.querySelector('.table-container') : null;
    elements.quotesListContainer = document.getElementById('quotes-list-container');
    elements.searchInput = document.getElementById('search-input');
    elements.quoteModal = document.getElementById('quote-modal'); // Quote detail modal
    elements.quoteModalCloseBtn = document.getElementById('quote-modal-close-btn');


    // Customers View Elements
    elements.customersLoadingSpinner = document.getElementById('customers-loading-spinner');
    elements.noCustomersMessage = document.getElementById('no-customers-message');
    elements.customersTableContainer = elements.customersView ? elements.customersView.querySelector('.table-container') : null;
    elements.customersListContainer = document.getElementById('customers-list-container');
    elements.dashboardAddNewCustomerBtn = document.getElementById('dashboard-add-new-customer-btn');

    // Shared Customer Modal Elements (IDs are same as in index.html)
    elements.customerModal = document.getElementById('customer-modal');
    elements.customerModalTitle = document.getElementById('customer-modal-title');
    elements.customerModalCloseBtn = document.getElementById('customer-modal-close-btn'); // This is the 'X'
    elements.customerIdInput = document.getElementById('customer-id-input');
    elements.customerNameInput = document.getElementById('customer-name');
    elements.customerCompanyInput = document.getElementById('customer-company');
    elements.customerEmailInput = document.getElementById('customer-email');
    elements.customerPhoneInput = document.getElementById('customer-phone');
    elements.customerAddressInput = document.getElementById('customer-address');
    elements.saveCustomerBtn = document.getElementById('save-customer-btn');
    elements.cancelCustomerBtn = document.getElementById('cancel-customer-btn'); // This is the explicit cancel button

    // Logout button
    elements.logoutBtn = document.getElementById('nav-logout-btn');
}


onAuthStateChanged(auth, user => {
    if (!user) {
        window.location.href = 'login.html';
    } else {
        initializeDashboardElements(); // Get all DOM elements first

        if (elements.logoutBtn) {
            elements.logoutBtn.addEventListener('click', () => auth.signOut());
        }

        // Setup quote modal close button (distinct from customer modal)
        if (elements.quoteModal && elements.quoteModalCloseBtn) {
            elements.quoteModalCloseBtn.onclick = () => {
                elements.quoteModal.style.display = 'none';
            };
             // Close modal if user clicks on the dark overlay
            window.addEventListener('click', (event) => {
                if (event.target == elements.quoteModal) {
                    elements.quoteModal.style.display = 'none';
                }
            });
        }


        setupEventListeners(user.uid); // Setup all event listeners
        
        // Determine initial view based on hash or default to quotes
        const initialHash = window.location.hash;
        if (initialHash === '#customers-view') {
            switchView('customers');
        } else {
            switchView('quotes'); // Default view
        }
    }
});

// --- Injecting Styles (minor adjustments for .active nav and customers table) ---
const style = document.createElement('style');
style.textContent = `
    .navbar-links a.active { font-weight: bold; text-decoration: underline; } /* Style for active nav link */
    .customers-table { width: 100%; border-collapse: collapse; font-size: 0.9em; }
    .customers-table th, .customers-table td { padding: 12px 15px; text-align: left; border-bottom: 1px solid var(--border-color); white-space: nowrap;}
    .customers-table thead { background-color: #f8f9fa; }
    .customers-table th { font-weight: 600; color: #343a40; }
    .customers-table tbody tr:hover { background-color: #f1f3f5; }
    .customers-table .btn-edit-customer, .customers-table .btn-delete-customer { margin-right: 5px; padding: 4px 8px; font-size: 0.85em; }

    .dashboard-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5em; flex-wrap: wrap; gap: 1em;}
    .dashboard-controls { display: flex; gap: 1em; }
    #search-input { padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 0.9em; width: 250px; }
    .table-container { overflow-x: auto; }
    .quotes-table { width: 100%; border-collapse: collapse; font-size: 0.9em; }
    .quotes-table th, .quotes-table td { padding: 12px 15px; text-align: left; border-bottom: 1px solid var(--border-color); white-space: nowrap;}
    .quotes-table thead { background-color: #f8f9fa; }
    .quotes-table th { font-weight: 600; color: #343a40; }
    .quotes-table tbody tr:hover { background-color: #f1f3f5; }
    .btn-view { background-color: var(--primary-color); color: white; border: none; border-radius: 5px; padding: 6px 12px; font-size: 0.9em; cursor: pointer; }
    .btn-view:hover { background-color: #001f4a; }

    /* Modal Styles */
    .modal-overlay { position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; overflow: auto; background-color: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;}
    .modal-content { background-color: #fff; margin: auto; padding: 20px; border-radius: 8px; box-shadow: 0 5px 15px rgba(0,0,0,0.3); width: 90%; max-width: 700px; /* Increased max-width */ }
    .modal-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #dee2e6; padding-bottom: 10px; margin-bottom: 15px; }
    .modal-header h2 { margin: 0; font-size: 1.25rem; }
    .modal-close-btn { color: #aaa; font-size: 28px; font-weight: bold; cursor: pointer; }
    .modal-close-btn:hover, .modal-close-btn:focus { color: #000; }
    .modal-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 20px; margin-bottom: 15px; }
    .modal-info-grid p { margin: 0; }

    /* --- THE FIX IS HERE: New styles for the breakdown table inside the modal --- */
    .modal-breakdown-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 1em;
        font-size: 0.9em;
    }
    .modal-breakdown-table th, .modal-breakdown-table td {
        padding: 8px;
        text-align: left;
        border-bottom: 1px solid #e9ecef;
    }
    .modal-breakdown-table thead {
        background-color: #f8f9fa;
    }
    .modal-breakdown-table th {
        font-weight: 600;
    }
    .modal-breakdown-table tfoot td {
        font-weight: bold;
        border-top: 2px solid #343a40;
        padding-top: 10px;
    }
    /* Right-align all numerical columns */
    .modal-breakdown-table th:not(:first-child),
    .modal-breakdown-table td:not(:first-child) {
        text-align: right;
    }
    /* Special alignment for the "Totals" label in the footer */
    .modal-breakdown-table tfoot td[colspan="2"] {
        text-align: right;
    }
`;
document.head.appendChild(style);
