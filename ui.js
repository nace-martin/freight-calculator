// ui.js
// This file contains all functions that manipulate the DOM (User Interface).

import { ancillaryCharges } from './config.js';

function formatCurrency(number) {
    return number.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
    const firstPiece = elements.pieceRowTemplate.content.cloneNode(true);
    firstPiece.querySelector('.btn-remove').style.visibility = 'hidden';
    elements.piecesContainer.innerHTML = ''; 
    elements.piecesContainer.appendChild(firstPiece); 
    elements.chargeableWeightDisplay.textContent = '0';
    elements.quoteOutputDiv.innerHTML = '';
    document.getElementById('download-pdf-btn').style.display = 'none';
    elements.originSelect.selectedIndex = 0;
    elements.destinationSelect.selectedIndex = 0;
}
    
export function generateQuote(elements, freightRates) {
    const chargeableWeight = getChargeableWeight(elements);
    if (chargeableWeight <= 0) { alert("Please enter shipment details."); return; }
    const origin = elements.originSelect.value;
    const destination = elements.destinationSelect.value;
    if (origin === destination) {
        alert("Origin and destination must be different.");
        return;
    }

    const route = freightRates[origin]?.[destination];
    if (!route || route.rate <= 0) {
        alert(`Sorry, a rate for ${origin} to ${destination} is not available.`);
        return;
    }

    let quoteHTML = `<h2>Quote Breakdown</h2><p><b>Route:</b> ${origin} to ${destination}</p><p><b>Total Chargeable Weight:</b> ${chargeableWeight} kg</p>`;
    let lineItems = [];
    let subTotal = 0;
    
    // --- All calculation logic remains the same ---
    lineItems.push({ name: 'Air Freight', cost: chargeableWeight * route.rate });
    ancillaryCharges.forEach(charge => {
        if (charge.name.includes('PUD')) return;
        let cost = 0;
        if (charge.type === 'Per-Shipment') cost = charge.rate;
        else if (charge.type === 'Per-KG') { cost = chargeableWeight * charge.rate; if (cost < charge.min) cost = charge.min; }
        if (cost > 0) lineItems.push({ name: charge.name, cost: cost });
    });
    const validPudLocations = ['POM', 'LAE'];
    const originIsPud = validPudLocations.includes(origin);
    const destinationIsPud = validPudLocations.includes(destination);
    if (originIsPud || destinationIsPud) {
        const pudChargeItem = ancillaryCharges.find(c => c.name === 'PUD Fee');
        let pudCost = chargeableWeight * pudChargeItem.rate;
        if (pudCost < pudChargeItem.min) pudCost = pudChargeItem.min;
        lineItems.push({ name: 'PUD Fee', cost: pudCost });
        const pudFuelChargeItem = ancillaryCharges.find(c => c.dependsOn === 'PUD Fee');
        if (pudFuelChargeItem) {
            const pudFuelCost = pudCost * pudFuelChargeItem.rate;
            lineItems.push({ name: 'PUD Fuel Surcharge', cost: pudFuelCost });
        }
    }
    lineItems.forEach(item => subTotal += item.cost);
    quoteHTML += '<ul>';
    lineItems.sort((a, b) => a.name.localeCompare(b.name)).forEach(item => {
        quoteHTML += `<li><span>${item.name}</span><strong>PGK ${formatCurrency(item.cost)}</strong></li>`;
    });
    quoteHTML += '</ul>';
    const gst = subTotal * 0.10;
    const grandTotal = subTotal + gst;
    quoteHTML += `<h3>Sub-Total: PGK ${formatCurrency(subTotal)}</h3>`;
    quoteHTML += `<h3>GST (10%): PGK ${formatCurrency(gst)}</h3>`;
    quoteHTML += `<h2 class="total-line">Grand Total: PGK ${formatCurrency(grandTotal)}</h2>`;

    elements.quoteOutputDiv.innerHTML = quoteHTML;
    toggleFormLock(elements, true);
    document.getElementById('download-pdf-btn').style.display = 'inline-block';
}