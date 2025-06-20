
    // --- 1. ELEMENT REFERENCES ---
    const elements = {
        originSelect: document.getElementById('origin'),
        destinationSelect: document.getElementById('destination'),
        quoteButton: document.getElementById('generate-quote-btn'),
        resetButton: document.getElementById('reset-btn'),
        quoteOutputDiv: document.getElementById('quote-output'),
        piecesContainer: document.getElementById('pieces-container'),
        addPieceBtn: document.getElementById('add-piece-btn'),
        chargeableWeightDisplay: document.getElementById('chargeableWeightDisplay'),
        form: document.getElementById('calculator-form'),
        pieceRowTemplate: document.getElementById('piece-row-template')
    };
    
    // --- 2. DATA & CONFIGURATION ---
    let freightRates = {};
    const ancillaryCharges = [ { name: 'AWB Fee', type: 'Per-Shipment', rate: 70.00, min: 0 }, { name: 'Security Surcharge', type: 'Per-KG', rate: 0.20, min: 5.00 }, { name: 'Airline Fuel Surcharge', type: 'Per-KG', rate: 0.35, min: 0 }, { name: 'PUD Fee', type: 'Per-KG', rate: 0.80, min: 80.00 }, { name: 'PUD Fuel Surcharge', type: 'Percentage_Of_PUD', rate: 0.10, min: 0, dependsOn: 'PUD Fee' } ];

    // --- 3. HELPER & CORE FUNCTIONS ---
    function formatCurrency(number) {
        return number.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    async function loadRateData() {
        const apiUrl = 'https://script.google.com/macros/s/AKfycbx4P2c2KsVNuTbIfMX5UvMpAX-QiG2_9nP_KRvQt79R6EDcbI_aPJhjlrUkULKVwfEU/exec';
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
            const dataFromSheet = await response.json();
            
            const nestedRates = {};
            const uniqueLocations = new Set();
            dataFromSheet.forEach(row => {
                const origin = row.OriginAirportCode;
                const dest = row.DestinationAirportCode;
                const rate = row.Rate_Per_KG_PGK;
                if(origin && dest && origin.trim() !== "" && dest.trim() !== "") {
                    uniqueLocations.add(origin);
                    uniqueLocations.add(dest);
                    if (!nestedRates[origin]) nestedRates[origin] = {};
                    nestedRates[origin][dest] = { rate: parseFloat(rate) };
                }
            });
            freightRates = nestedRates;
            populateDropdowns(Array.from(uniqueLocations).sort());
            console.log("Freight rates and locations loaded successfully!");
        } catch (error) {
            console.error("Failed to load rate data:", error);
            alert("Error: Could not load freight rates from the database. Please check your network connection and the API endpoint.");
        }
    }

    function populateDropdowns(locations) {
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

    function getChargeableWeight() {
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

    function addPiece() {
        const newPieceRow = elements.pieceRowTemplate.content.cloneNode(true);
        elements.piecesContainer.appendChild(newPieceRow);
    }

    function toggleFormLock(isLocked) {
        const inputsToLock = elements.form.querySelectorAll('input, select, button#add-piece-btn');
        inputsToLock.forEach(input => {
            input.disabled = isLocked;
        });
        elements.piecesContainer.querySelectorAll('.btn-remove').forEach(btn => btn.disabled = isLocked);
    }

    function resetApp() {
        toggleFormLock(false);
        
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
    
    function generateQuote() {
        const chargeableWeight = getChargeableWeight();
        if (chargeableWeight <= 0) { alert("Please enter shipment details."); return; }
        const origin = elements.originSelect.value;
        const destination = elements.destinationSelect.value;
        if (origin === destination) {
            alert("Origin and destination must be different.");
            return;
        }

        let quoteHTML = `<h2>Quote Breakdown</h2><p><b>Route:</b> ${origin} to ${destination}</p><p><b>Total Chargeable Weight:</b> ${chargeableWeight} kg</p>`;
        let lineItems = []; let subTotal = 0;
        const route = freightRates[origin]?.[destination];
        if (!route || route.rate <= 0) { alert(`Sorry, a rate for ${origin} to ${destination} is not available in the database.`); return; }
        lineItems.push({ name: 'Air Freight', cost: chargeableWeight * route.rate });
        ancillaryCharges.forEach(charge => {
            if (charge.name.includes('PUD')) return;
            let cost = 0;
            if (charge.type === 'Per-Shipment') cost = charge.rate;
            else if (charge.type === 'Per-KG') { cost = chargeableWeight * charge.rate; if (cost < charge.min) cost = charge.min; }
            if (cost > 0) { lineItems.push({ name: charge.name, cost: cost }); }
        });
        const validPudLocations = ['POM', 'LAE']; const originIsPud = validPudLocations.includes(origin); const destinationIsPud = validPudLocations.includes(destination);
        if (originIsPud || destinationIsPud) {
            const pudChargeItem = ancillaryCharges.find(c => c.name === 'PUD Fee');
            let pudCost = chargeableWeight * pudChargeItem.rate;
            if (pudCost < pudChargeItem.min) pudCost = pudChargeItem.min;
            lineItems.push({ name: 'PUD Fee', cost: pudCost });
            const pudFuelChargeItem = ancillaryCharges.find(c => c.dependsOn === 'PUD Fee');
            if (pudFuelChargeItem) { const pudFuelCost = pudCost * pudFuelChargeItem.rate; lineItems.push({ name: 'PUD Fuel Surcharge', cost: pudFuelCost }); }
        }
        lineItems.forEach(item => subTotal += item.cost);
        quoteHTML += '<ul>';
        lineItems.sort((a,b) => a.name.localeCompare(b.name)).forEach(item => { quoteHTML += `<li><span>${item.name}</span><strong>PGK ${formatCurrency(item.cost)}</strong></li>`; });
        quoteHTML += '</ul>';
        const gst = subTotal * 0.10; const grandTotal = subTotal + gst;
        quoteHTML += `<h3>Sub-Total: PGK ${formatCurrency(subTotal)}</h3>`;
        quoteHTML += `<h3>GST (10%): PGK ${formatCurrency(gst)}</h3>`;
        quoteHTML += `<h2 class="total-line">Grand Total: PGK ${formatCurrency(grandTotal)}</h2>`;
        
        elements.quoteOutputDiv.innerHTML = quoteHTML;
        toggleFormLock(true);
        document.getElementById('download-pdf-btn').style.display = 'inline-block';
    }

    // --- 4. EVENT LISTENERS ---
    elements.addPieceBtn.addEventListener('click', addPiece);
    elements.resetButton.addEventListener('click', resetApp);
    elements.quoteButton.addEventListener('click', generateQuote);
    elements.piecesContainer.addEventListener('click', function(event) { if (event.target.classList.contains('btn-remove')) { event.target.closest('.piece-row').remove(); getChargeableWeight(); } });
    elements.piecesContainer.addEventListener('input', getChargeableWeight);
    document.addEventListener('DOMContentLoaded', loadRateData);

    document.getElementById('download-pdf-btn').addEventListener('click', () => {
        const quoteOutput = document.getElementById('quote-output');
        if (quoteOutput.innerHTML.trim() === "") {
            alert("No quote available to download.");
            return;
        }

        const opt = {
            margin:       0.5,
            filename:     `EFM_Quote_${Date.now()}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2 },
            jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
        };

        html2pdf().set(opt).from(quoteOutput).save();
    });
