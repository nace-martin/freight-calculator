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
        if (charge.name.includes('PUD') || charge.dependsOn === 'PUD Fee') {
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

    const quoteData = {
        origin,
        destination,
        chargeableWeight,
        lineItems,
        subTotal: grandTotalSubTotal,
        gst: grandTotalGst,
        grandTotal: grandTotal,
        quoteGeneratedAt: new Date().toISOString()
    };
    
    renderQuoteHTML(elements, quoteData);
    toggleFormLock(elements, true);
    
    elements.saveQuoteBtn.style.display = 'inline-block';
    elements.downloadPdfBtn.style.display = 'inline-block';

    return quoteData;
}

