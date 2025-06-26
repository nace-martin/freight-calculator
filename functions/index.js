// This is the complete, corrected server-side code using local assets.

const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const PDFDocument = require('pdfkit');
const cors = require('cors')({ origin: true });
const fs = require('fs'); // The built-in Node.js File System module
const path = require('path'); // The built-in Node.js Path module

// Set the region for all functions in this file.
setGlobalOptions({ region: "australia-southeast1" });


// EXPORT THE FUNCTION
exports.generateQuotePdf = onRequest((req, res) => { // No longer needs to be async at this level
    // Enable CORS
    cors(req, res, () => { // No longer needs to be async
        if (req.method !== 'POST') {
            return res.status(405).send('Method Not Allowed');
        }

        const quote = req.body;

        // Enhanced Validation
        if (!quote || typeof quote !== 'object') {
            return res.status(400).send('Bad Request: Invalid quote data format.');
        }
        const requiredFields = ['origin', 'destination', 'chargeableWeight', 'lineItems', 'grandTotal'];
        for (const field of requiredFields) {
            if (quote[field] === undefined) {
                return res.status(400).send(`Bad Request: Missing required field '${field}'.`);
            }
        }
        if (!Array.isArray(quote.lineItems) || quote.lineItems.length === 0) {
            return res.status(400).send('Bad Request: lineItems must be a non-empty array.');
        }

        console.log('[generateQuotePdf] Function started.');
        const doc = new PDFDocument({
            size: 'A4',
            margin: 50,
            layout: 'portrait',
            info: { Title: 'Freight Quotation', Author: 'Express Freight Management' }
        });
        console.log('[generateQuotePdf] PDFDocument instantiated.');

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=EFM_Quote_${Date.now()}.pdf`);
        console.log('[generateQuotePdf] Headers set.');

        doc.pipe(res);
        console.log('[generateQuotePdf] PDF piped to response.');

        // Helper Functions
        const formatCurrency = (number) => (number || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const formatDate = (isoString) => isoString ? new Date(isoString).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';

        console.log('[generateQuotePdf] Starting PDF content generation.');
        // PDF Content

        // --- THE FIX IS HERE ---
        // Load the logo directly from the local file system.
        // This is fast, reliable, and removes the network dependency.
        const logoPath = path.join(__dirname, 'logo.png'); // Changed to logo.png
        console.log(`[generateQuotePdf] Logo path: ${logoPath}`);
        if (fs.existsSync(logoPath)) {
            console.log('[generateQuotePdf] Logo PNG file exists. Attempting to add to PDF.');
            // Adjusted Y position slightly to align better with top margin if 45 was too high.
            // X position 50 should align with the left margin.
            doc.image(logoPath, 50, 50, { width: 150 }); 
            console.log('[generateQuotePdf] Logo PNG image added to PDF.');
        } else {
            console.log('[generateQuotePdf] Logo PNG file NOT found. Make sure logo.png is in the functions directory.');
        }
        
        doc.fontSize(20).font('Helvetica-Bold').text('QUOTATION', { align: 'right' });
        doc.fontSize(10).font('Helvetica').text('Express Freight Management', { align: 'right' });
        doc.moveDown(0.5);
        console.log('[generateQuotePdf] Header texts added.');

        // ... The rest of the PDF generation code is identical ...
        
        // Underline
        doc.strokeColor("#002D62").lineWidth(1.5).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown(2);
        console.log('[generateQuotePdf] Finished main headers, starting quote info section.');

        // Quote Info
        const infoTop = doc.y;
        doc.font('Helvetica-Bold').text('QUOTE FOR:');
        doc.font('Helvetica').text('Valued Client');
        
        doc.font('Helvetica-Bold').text('Quote Date:', 320, infoTop);
        doc.font('Helvetica').text(formatDate(quote.quoteGeneratedAt), 420, infoTop);
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold').text('Quote ID:', 320);
        doc.font('Helvetica').text(`Q-${Date.now().toString().slice(-6)}`, 420);
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold').text('Route:', 320);
        doc.font('Helvetica').text(`${quote.origin} to ${quote.destination}`, 420);
        doc.moveDown(2);
        console.log('[generateQuotePdf] Finished quote info section, starting breakdown table.');

        // Breakdown Table
        doc.font('Helvetica-Bold').fontSize(12).text('Charge Summary');
        doc.moveDown();

        const tableTop = doc.y;
        const columnSpacing = [190, 60, 70, 60, 80];
        const columnStartPositions = [50, 250, 320, 400, 470];
        const tableHeaders = ['Description', 'Rate', 'Subtotal', 'GST', 'Total'];

        doc.font('Helvetica-Bold').fontSize(10);
        tableHeaders.forEach((header, i) => {
            doc.text(header, columnStartPositions[i], tableTop, { width: columnSpacing[i], align: i === 0 ? 'left' : 'right' });
        });
        doc.moveDown(0.5);
        doc.strokeColor("#aaaaaa").lineWidth(0.5).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown();
        console.log('[generateQuotePdf] Breakdown table headers added. Starting line items.');
        
        doc.font('Helvetica').fontSize(10);
        quote.lineItems.forEach((item, index) => {
            console.log(`[generateQuotePdf] Adding line item ${index + 1}: ${item.name}`);
            if (doc.y > 700) {
                console.log('[generateQuotePdf] Adding new page for line items.');
                doc.addPage();
            }
            const y = doc.y;
            doc.text(item.name, columnStartPositions[0], y, { width: columnSpacing[0] });
            doc.text(item.rate.toFixed(2), columnStartPositions[1], y, { width: columnSpacing[1], align: 'right' });
            doc.text(formatCurrency(item.subTotal), columnStartPositions[2], y, { width: columnSpacing[2], align: 'right' });
            doc.text(formatCurrency(item.gst), columnStartPositions[3], y, { width: columnSpacing[3], align: 'right' });
            doc.text(formatCurrency(item.total), columnStartPositions[4], y, { width: columnSpacing[4], align: 'right' });
            doc.moveDown(1.5);
        });
        console.log('[generateQuotePdf] Finished line items. Adding totals.');
        
        doc.strokeColor("#aaaaaa").lineWidth(0.5).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown();

        // Totals
        const totalsTop = doc.y;
        doc.font('Helvetica-Bold');
        doc.text('Totals:', columnStartPositions[0], totalsTop, { width: columnSpacing[0] });
        doc.text(formatCurrency(quote.subTotal), columnStartPositions[2], totalsTop, { width: columnSpacing[2], align: 'right' });
        doc.text(formatCurrency(quote.gst), columnStartPositions[3], totalsTop, { width: columnSpacing[3], align: 'right' });
        doc.text(formatCurrency(quote.grandTotal), columnStartPositions[4], totalsTop, { width: columnSpacing[4], align: 'right' });
        doc.moveDown(3);
        console.log('[generateQuotePdf] Finished totals. Adding terms and conditions.');
        
        // Terms & Conditions
        doc.font('Helvetica-Bold').fontSize(10).text('Terms & Conditions');
        doc.strokeColor("#aaaaaa").lineWidth(0.5).moveTo(50, doc.y).lineTo(200, doc.y).stroke();
        doc.moveDown();
        
        doc.font('Helvetica').fontSize(8);
        const terms = [
            'All rates are quoted in PGK and are subject to change without notice, carrier acceptance and availability.',
            'This quote is valid for 7 days. Freight and Charges may be subject to local taxes.',
            'Fuel surcharges are subject to change at airline discretion without notice.',
            'Rates are not applicable to Dangerous Goods or over-dimensional cargo unless specifically detailed in this quote.',
            'This quote is subject to the standard trading conditions.'
        ];
        terms.forEach(term => {
            // Explicitly set X position to left margin and define width to prevent overflow
            doc.text(`• ${term}`, doc.page.margins.left, doc.y, { 
                align: 'left',
                width: doc.page.width - doc.page.margins.left - doc.page.margins.right
            });
            // Add a small gap after each term, .text() might not advance y enough by itself for distinct bullet points.
            // If text is too close, uncomment and adjust the moveDown factor.
            // doc.moveDown(0.3); 
        });
        console.log('[generateQuotePdf] Finished terms and conditions. Finalizing PDF.');

        // Finalize the PDF
        doc.end();
        console.log('[generateQuotePdf] doc.end() called. PDF generation complete.');
    });
});
