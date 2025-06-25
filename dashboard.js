// dashboard.js
import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getQuotesFromDb } from './database.js';

// --- State to hold all quotes for searching ---
let allQuotes = [];

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
    
    // Map quotes to table rows, now including an "Actions" column
    const quotesHtml = quotesToRender.map(quote => `
        <tr>
            <td>${quote.id.slice(-6).toUpperCase()}</td>
            <td>${formatDate(quote.quoteGeneratedAt)}</td>
            <td>${quote.origin} &rarr; ${quote.destination}</td>
            <td>${quote.chargeableWeight} kg</td>
            <td style="text-align: right;">${formatCurrency(quote.grandTotal)}</td>
            <td><button class="btn-view" data-quote-id="${quote.id}">View</button></td>
        </tr>
    `).join('');

    quotesListContainer.innerHTML = quotesHtml;
}

function setupEventListeners() {
    // Search input
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredQuotes = allQuotes.filter(quote => {
            const route = `${quote.origin} ${quote.destination}`.toLowerCase();
            const quoteId = quote.id.toLowerCase();
            return route.includes(searchTerm) || quoteId.includes(searchTerm);
        });
        renderQuotesTable(filteredQuotes);
    });

    // Event delegation for "View" buttons
    const quotesListContainer = document.getElementById('quotes-list-container');
    quotesListContainer.addEventListener('click', (e) => {
        if (e.target && e.target.classList.contains('btn-view')) {
            const quoteId = e.target.getAttribute('data-quote-id');
            populateAndShowModal(quoteId);
        }
    });
}


// --- Initializer ---
async function initializeDashboard(userId) {
    const quotesSpinner = document.getElementById('quotes-loading-spinner');
    const noQuotesMessage = document.getElementById('no-quotes-message');

    quotesSpinner.style.display = 'flex';
    noQuotesMessage.style.display = 'none';

    try {
        allQuotes = await getQuotesFromDb(userId); 

        if (allQuotes.length === 0) {
            noQuotesMessage.style.display = 'block';
            document.querySelector('.table-container').style.display = 'none';
        } else {
            document.querySelector('.table-container').style.display = 'block';
            renderQuotesTable(allQuotes);
            setupEventListeners();
            setupModal();
        }
    } catch (error) {
        console.error("Error initializing dashboard:", error);
        document.getElementById('quotes-list-container').innerHTML = '<tr><td colspan="6" style="color:red; text-align:center; padding: 2em;">Failed to load quotes.</td></tr>';
    } finally {
        quotesSpinner.style.display = 'none';
    }
}

// --- Auth Guard ---
onAuthStateChanged(auth, user => {
    if (!user) {
        window.location.href = 'login.html';
    } else {
        const navTitleElement = document.getElementById('app-nav-title');
        if (navTitleElement) navTitleElement.textContent = 'RateEngine - Dashboard'; 
        const logoutBtn = document.getElementById('nav-logout-btn'); 
        if (logoutBtn) logoutBtn.addEventListener('click', () => auth.signOut());
        
        initializeDashboard(user.uid);
    }
});

// --- Injecting Styles for the new dashboard features ---
const style = document.createElement('style');
style.textContent = `
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
