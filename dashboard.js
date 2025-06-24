// dashboard.js
import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getQuotesFromDb } from './database.js'; // Import the new function

// Helper function to format currency (copied from ui.js for consistency if ui.js isn't directly imported)
function formatCurrency(number) {
    return number.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Function to render quotes in the dashboard
async function renderQuotes(userId) {
    const quotesListContainer = document.getElementById('quotes-list-container');
    const noQuotesMessage = document.getElementById('no-quotes-message');
    const quotesSpinner = document.getElementById('quotes-loading-spinner');

    if (quotesSpinner) quotesSpinner.style.display = 'flex';
    if (noQuotesMessage) noQuotesMessage.style.display = 'none'; // Hide message initially
    quotesListContainer.innerHTML = ''; // Clear previous content

    try {
        const quotes = await getQuotesFromDb(userId);

        if (quotes.length === 0) {
            if (noQuotesMessage) noQuotesMessage.style.display = 'block'; // Show message if no quotes
            return;
        }

        const quotesHtml = quotes.map(quote => {
            const quoteDate = quote.quoteGeneratedAt ? new Date(quote.quoteGeneratedAt).toLocaleString() : 'N/A';
            return `
                <div class="quote-card">
                    <h3>Quote for ${quote.origin} to ${quote.destination}</h3>
                    <p><b>Date:</b> ${quoteDate}</p>
                    <p><b>Chargeable Weight:</b> ${quote.chargeableWeight} kg</p>
                    <ul>
                        ${quote.lineItems.map(item => `<li><span>${item.name}</span><strong>PGK ${formatCurrency(item.cost)}</strong></li>`).join('')}
                    </ul>
                    <p class="quote-total"><b>Grand Total:</b> PGK ${formatCurrency(quote.grandTotal)}</p>
                </div>
            `;
        }).join('');
        quotesListContainer.innerHTML = quotesHtml;
    } catch (error) {
        console.error("Error rendering quotes:", error);
        quotesListContainer.innerHTML = '<p style="color:var(--danger-color); text-align: center;">Failed to load quotes. Please try again.</p>';
    } finally {
        if (quotesSpinner) quotesSpinner.style.display = 'none';
    }
}

// Auth Guard for the dashboard page
onAuthStateChanged(auth, user => {
    if (!user) {
        // If user is not logged in, redirect to login page
        console.log("User not logged in. Redirecting to login.html from dashboard.");
        window.location.href = 'login.html';
    } else {
        console.log("User logged in on dashboard:", user.uid);
        // Set the specific title for this page's navigation bar
        const navTitleElement = document.getElementById('app-nav-title');
        if (navTitleElement) {
            navTitleElement.textContent = 'RateEngine - Dashboard'; 
        }

        // Set up the logout button listener for the dashboard page.
        const logoutBtn = document.getElementById('nav-logout-btn'); 
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                auth.signOut().then(() => {
                    console.log('User signed out successfully from dashboard.');
                    // onAuthStateChanged will handle redirection
                }).catch((error) => {
                    console.error('Sign out error from dashboard:', error);
                    alert("Error signing out. Please try again.");
                });
            });
        }

        // Render saved quotes for the logged-in user
        renderQuotes(user.uid);
    }
});

// Add some basic styling for quote cards for better presentation
// This would ideally be in a separate CSS file, but for quick integration:
const style = document.createElement('style');
style.textContent = `
    .quote-card {
        background-color: var(--form-background-color);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        padding: 1.5em;
        margin-bottom: 1.5em;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    }
    .quote-card h3 {
        color: var(--primary-color);
        font-size: 1.3em;
        margin-top: 0;
        border-bottom: 1px solid var(--border-color);
        padding-bottom: 0.5em;
        margin-bottom: 1em;
    }
    .quote-card p {
        margin-bottom: 0.5em;
        line-height: 1.5;
    }
    .quote-card ul {
        list-style-type: none;
        padding: 0;
        margin: 1em 0;
        border-top: 1px solid #eee;
    }
    .quote-card ul li {
        display: flex;
        justify-content: space-between;
        padding: 0.5em 0;
        border-bottom: 1px solid #f1f1f1;
        font-size: 0.95em;
    }
    .quote-card .quote-total {
        text-align: right;
        font-size: 1.2em;
        font-weight: bold;
        color: var(--primary-color);
        margin-top: 1.5em;
        padding-top: 1em;
        border-top: 2px solid var(--text-color);
    }
`;
document.head.appendChild(style);