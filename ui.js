// ui.js
// This file contains all functions that manipulate or read from the DOM (User Interface).

import { ancillaryCharges } from './config.js';

// --- Helper Functions ---

export function formatCurrency(number) {
    return number.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// --- DOM Manipulation Functions ---

export function renderQuoteHTML(elements, quoteData) {
    let quoteHTML = `
        <h2>Charge Summary</h2>
        <p><b>Route:</b> ${quoteData.origin} to ${quoteData.destination} | <b>Chargeable Weight:</b> ${quoteData.chargeableWeight} kg</p>
        <table class="quote-breakdown-table">
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
    quoteData.lineItems.forEach(item => {
        quoteHTML += `
            <tr>
                <td>${item.name}</td>
                <td>${item.rate.toFixed(2)}</td>
                <td>${formatCurrency(item.subTotal)}</td>
                <td>${formatCurrency(item.gst)}</td>
                <td>${formatCurrency(item.total)}</td>
            </tr>
        `;
    });

    quoteHTML += `
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="2"><strong>Totals</strong></td>
                    <td><strong>${formatCurrency(quoteData.subTotal)}</strong></td>
                    <td><strong>${formatCurrency(quoteData.gst)}</strong></td>
                    <td><strong>${formatCurrency(quoteData.grandTotal)}</strong></td>
                </tr>
            </tfoot>
        </table>
    `;

    elements.quoteOutputDiv.innerHTML = quoteHTML;
}


export function populateDropdowns(elements, locations) {
    elements.originSelect.innerHTML = '';
    elements.destinationSelect.innerHTML = '';
    locations.forEach(location => {
        const option1 = document.createElement('option');
        option1.value = location;
        option1.textContent = location;
        elements.originSelect.appendChild(option1);

        const option2 = document.createElement('option');
        option2.value = location;
        option2.textContent = location;
        elements.destinationSelect.appendChild(option2);
    });
}

export function addPiece(elements) {
    const newPieceRow = elements.pieceRowTemplate.content.cloneNode(true);
    elements.piecesContainer.appendChild(newPieceRow);
}

export function toggleFormLock(elements, isLocked) {
    const inputsToLock = elements.form.querySelectorAll('input, select, button#add-piece-btn');
    inputsToLock.forEach(input => input.disabled = isLocked);
    elements.piecesContainer.querySelectorAll('.btn-remove').forEach(btn => btn.disabled = isLocked);
}

export function resetApp(elements) {
    toggleFormLock(elements, false);

    // Clone the entire template content
    const newFirstRowFragment = elements.pieceRowTemplate.content.cloneNode(true);
    // Find the button within the cloned fragment
    const removeButton = newFirstRowFragment.querySelector('.btn-remove');

    // **YOUR EXCELLENT FIX:** Add a check to ensure the button exists
    if (removeButton) {
      removeButton.style.visibility = 'hidden';
    }

    elements.piecesContainer.innerHTML = ''; 
    elements.piecesContainer.appendChild(newFirstRowFragment); // Append the whole fragment

    elements.chargeableWeightDisplay.textContent = '0';
    elements.quoteOutputDiv.innerHTML = '';

    // Hide action buttons
    if (elements.saveQuoteBtn) elements.saveQuoteBtn.style.display = 'none';
    if (elements.downloadPdfBtn) elements.downloadPdfBtn.style.display = 'none';

    elements.originSelect.selectedIndex = 0;
    elements.destinationSelect.selectedIndex = 0;

    // Also clear customer selection
    clearCustomerSelection(elements);
}

// --- Customer UI Functions ---

export function populateCustomerDropdown(elements, customers) {
    const select = elements.customerSelect;
    if (!select) {
        console.warn("Customer select dropdown not found in elements.");
        return;
    }
    // Store existing value to try and reselect if it's in the new list
    const existingValue = select.value;
    select.innerHTML = '<option value="">-- Select Existing Customer --</option>'; // Reset
    customers.forEach(customer => {
        const option = document.createElement('option');
        option.value = customer.id;
        option.textContent = `${customer.name} ${customer.companyName ? '(' + customer.companyName + ')' : ''}`;
        select.appendChild(option);
    });
    // Try to reselect previous value
    if (customers.find(c => c.id === existingValue)) {
        select.value = existingValue;
    }
}

export function displaySelectedCustomerDetails(elements, customer) {
    const detailsDiv = elements.selectedCustomerDetails;
    if (!detailsDiv) {
        console.warn("Selected customer details div not found in elements.");
        return;
    }
    if (customer) {
        detailsDiv.innerHTML = `
            <p><strong>Selected:</strong> ${customer.name}</p>
            ${customer.companyName ? `<p><strong>Company:</strong> ${customer.companyName}</p>` : ''}
            ${customer.email ? `<p><strong>Email:</strong> ${customer.email}</p>` : ''}
            ${customer.phone ? `<p><strong>Phone:</strong> ${customer.phone}</p>` : ''}
            ${customer.address ? `<p><strong>Address:</strong> ${customer.address.replace(/\n/g, '<br>')}</p>` : ''}
        `;
        detailsDiv.style.display = 'block';
    } else {
        detailsDiv.innerHTML = '';
        detailsDiv.style.display = 'none';
    }
}

export function openCustomerModal(elements, customerData = null) {
    const modal = elements.customerModal;
    const title = elements.customerModalTitle;
    const idInput = elements.customerIdInput;
    const nameInput = elements.customerNameInput;
    const companyInput = elements.customerCompanyInput;
    const emailInput = elements.customerEmailInput;
    const phoneInput = elements.customerPhoneInput;
    const addressInput = elements.customerAddressInput;

    if (!modal || !title || !idInput || !nameInput || !companyInput || !emailInput || !phoneInput || !addressInput) {
        console.error("One or more customer modal elements are missing.");
        return;
    }

    // Reset form
    idInput.value = '';
    nameInput.value = '';
    companyInput.value = '';
    emailInput.value = '';
    phoneInput.value = '';
    addressInput.value = '';

    if (customerData) { // Editing existing customer
        title.textContent = 'Edit Customer';
        idInput.value = customerData.id;
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

export function closeCustomerModal(elements) {
    const modal = elements.customerModal;
    if (modal) {
        modal.style.display = 'none';
    }
}

export function clearCustomerSelection(elements) {
    if (elements.customerSelect) {
        elements.customerSelect.value = "";
    }
    if (elements.selectedCustomerDetails) {
        elements.selectedCustomerDetails.innerHTML = '';
        elements.selectedCustomerDetails.style.display = 'none';
    }
}


// --- Data & Calculation Functions ---

export function getChargeableWeight(elements) {
    let totalChargeableWeight = 0;
    const pieceRows = elements.piecesContainer.querySelectorAll('.piece-row');
    pieceRows.forEach(row => {
        const actualWeight = parseFloat(row.querySelector('.weight').value) || 0;
        const length = parseFloat(row.querySelector('.length').value) || 0;
        const width = parseFloat(row.querySelector('.width').value) || 0;
        const height = parseFloat(row.querySelector('.height').value) || 0;
        if (actualWeight > 0 || length > 0) {
            const volumetricWeight = (length * width * height) / 6000;
            totalChargeableWeight += Math.max(actualWeight, volumetricWeight);
        }
    });
    const finalChargeableWeight = Math.ceil(totalChargeableWeight);
    elements.chargeableWeightDisplay.textContent = finalChargeableWeight;
    return finalChargeableWeight;
}

export function generateQuote(elements, freightRates) {
    const chargeableWeight = getChargeableWeight(elements);
    if (chargeableWeight <= 0) { alert("Please enter shipment details."); return null; }

    const origin = elements.originSelect.value;
    const destination = elements.destinationSelect.value;
    if (origin === destination) { alert("Origin and destination must be different."); return null; }

    const route = freightRates[origin]?.[destination];
    if (!route || route.rate <= 0) { alert(`Sorry, a rate for ${origin} to ${destination} is not available.`); return null; }

    const lineItems = [];
    
    // --- Helper to build each line item ---
    const buildLineItem = (name, rate, calculationValue, isPercentage = false, minCharge = 0) => {
        let subTotal;
        let displayRate = rate;

        if (isPercentage) {
            subTotal = calculationValue * rate; // calculationValue is the cost this surcharge depends on
        } else {
            subTotal = calculationValue === 0 ? rate : calculationValue * rate; // calculationValue is weight or 0 for flat fees
        }

        if (minCharge > 0 && subTotal < minCharge) {
            subTotal = minCharge;
        }

        const gst = subTotal * 0.10;
        const total = subTotal + gst;
        
        return { name, rate: displayRate, subTotal, gst, total };
    };
    
    // --- Build Line Items ---
    
    // 1. Air Freight
    const airFreightItem = buildLineItem('Air Freight', route.rate, chargeableWeight);
    lineItems.push(airFreightItem);

    // 2. Ancillary Charges (excluding PUD-related fees)
    ancillaryCharges.forEach(charge => {
        // *** THE FIX IS HERE: We skip PUD charges in this generic loop ***
        // Use exact match or regex for 'PUD' to avoid false positives
        if (charge.name === 'PUD' || charge.name === 'PUD Fee' || charge.dependsOn === 'PUD Fee') {
            return;
        }

        if (charge.type === 'Per-Shipment') {
            const item = buildLineItem(charge.name, charge.rate, 0); // 0 for flat fee calculation
            lineItems.push(item);
        } else if (charge.type === 'Per-KG') {
            const item = buildLineItem(charge.name, charge.rate, chargeableWeight, false, charge.min);
            lineItems.push(item);
        }
    });

    // 3. PUD Charges (This is now the ONLY place PUD charges are handled)
    const validPudLocations = ['POM', 'LAE'];
    if (validPudLocations.includes(origin) || validPudLocations.includes(destination)) {
        const pudChargeItem = ancillaryCharges.find(c => c.name === 'PUD Fee');
        if (pudChargeItem) {
            const pudItem = buildLineItem('PUD Fee', pudChargeItem.rate, chargeableWeight, false, pudChargeItem.min);
            lineItems.push(pudItem);
            
            const pudFuelChargeItem = ancillaryCharges.find(c => c.dependsOn === 'PUD Fee');
            if (pudFuelChargeItem) {
                // The calculation value for the fuel surcharge is the final subtotal of the PUD Fee itself.
                const pudFuelItem = buildLineItem('PUD Fuel Surcharge', pudFuelChargeItem.rate, pudItem.subTotal, true);
                lineItems.push(pudFuelItem);
            }
        }
    }

    lineItems.sort((a,b) => a.name.localeCompare(b.name));
    
    // Final grand totals are calculated from the sum of the detailed lines
    const grandTotalSubTotal = lineItems.reduce((sum, item) => sum + item.subTotal, 0);
    const grandTotalGst = lineItems.reduce((sum, item) => sum + item.gst, 0);
    const grandTotal = lineItems.reduce((sum, item) => sum + item.total, 0);

    // --- Customer Data Integration ---
    let customerId = null;
    let customerName = ''; // For display on quote list
    let clientName = 'Valued Customer'; // For PDF: {{clientName}}
    let clientAddress = ''; // For PDF: {{clientAddress}}
    let clientContact = ''; // For PDF: {{clientContact}} (could be email or phone)

    const selectedCustomerId = elements.customerSelect ? elements.customerSelect.value : null;

    if (selectedCustomerId && elements.customers && elements.customers.length > 0) {
        const selectedCustomer = elements.customers.find(c => c.id === selectedCustomerId);
        if (selectedCustomer) {
            customerId = selectedCustomer.id;
            // For quote list display: use name, fallback to companyName if name is empty
            customerName = selectedCustomer.name || selectedCustomer.companyName || '';
            clientName = selectedCustomer.name;   // For PDF, will be augmented below
            clientAddress = selectedCustomer.address || '';
            clientContact = selectedCustomer.email || selectedCustomer.phone || '';
            // If company name exists and clientName is just person's name, append company.
            if (selectedCustomer.companyName && selectedCustomer.name !== selectedCustomer.companyName) {
                clientName += ` (${selectedCustomer.companyName})`;
            } else if (!selectedCustomer.name && selectedCustomer.companyName) {
                clientName = selectedCustomer.companyName; // If only company name is there
            }
        }
    }
    // --- End Customer Data Integration ---

    const quoteData = {
        origin,
        destination,
        chargeableWeight,
        lineItems,
        subTotal: grandTotalSubTotal,
        gst: grandTotalGst,
        grandTotal: grandTotal,
        quoteGeneratedAt: new Date().toISOString(),
        // Customer related fields
        customerId,
        customerName, // For quick display in quote lists
        clientName,   // For PDF
        clientAddress,// For PDF
        clientContact // For PDF
    };
    
    renderQuoteHTML(elements, quoteData);
    toggleFormLock(elements, true);
    
    elements.saveQuoteBtn.style.display = 'inline-block';
    elements.downloadPdfBtn.style.display = 'inline-block';

    return quoteData;
}

