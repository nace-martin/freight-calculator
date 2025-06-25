// This is server-side code using the modern v2 syntax for Firebase Functions.
// It uses the 'pdfkit' library to generate PDFs with precision.

// Use the v2 syntax for HTTPS functions and setting global options
const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const PDFDocument = require('pdfkit');
const cors = require('cors')({ origin: true });

// THE FIX: Set the region for all functions in this file using the modern v2 syntax.
setGlobalOptions({ region: "australia-southeast1" });

// EXPORTS for the v2 syntax
exports.generateQuotePdf = onRequest((req, res) => {
    // Enable CORS to allow requests from your web app
    cors(req, res, () => {
        if (req.method !== 'POST') {
            return res.status(405).send('Method Not Allowed');
        }

        const quote = req.body;

        // Basic validation
        if (!quote || !quote.lineItems || !quote.grandTotal) {
            return res.status(400).send('Bad Request: Missing quote data.');
        }

        // --- Start PDF Generation ---
        const doc = new PDFDocument({
            size: 'A4',
            margin: 50,
            layout: 'portrait',
            info: {
                Title: 'Freight Quotation',
                Author: 'Express Freight Management',
            }
        });

        // Set the response headers to trigger a download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=EFM_Quote_${Date.now()}.pdf`);

        // Pipe the PDF document directly to the response stream
        doc.pipe(res);

        // --- Helper Functions ---
        const formatCurrency = (number) => {
            return (number || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        };
        const formatDate = (isoString) => {
            if (!isoString) return 'N/A';
            return new Date(isoString).toLocaleDateString('en-AU', {
                day: '2-digit', month: 'short', year: 'numeric'
            });
        };

        // --- PDF Content ---

        // Header
        doc.fontSize(20).font('Helvetica-Bold').text('QUOTATION', 50, 50, { align: 'right' });
        doc.fontSize(10).font('Helvetica').text('Express Freight Management', { align: 'right' });
        doc.moveDown(0.5);

        // Underline
        doc.strokeColor("#002D62").lineWidth(1.5).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown(2);

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


        // Breakdown Table
        doc.font('Helvetica-Bold').fontSize(12).text('Charge Summary');
        doc.moveDown();

        const tableTop = doc.y;
        doc.font('Helvetica-Bold').fontSize(10);
        doc.text('Description', 50, tableTop);
        doc.text('Rate', 250, tableTop, { width: 60, align: 'right' });
        doc.text('Subtotal', 320, tableTop, { width: 70, align: 'right' });
        doc.text('GST', 400, tableTop, { width: 60, align: 'right' });
        doc.text('Total', 470, tableTop, { width: 80, align: 'right' });
        doc.moveDown(0.5);

        doc.strokeColor("#aaaaaa").lineWidth(0.5).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown();
        
        doc.font('Helvetica').fontSize(10);
        quote.lineItems.forEach(item => {
            const y = doc.y;
            doc.text(item.name, 50, y, { width: 190 });
            doc.text(item.rate.toFixed(2), 250, y, { width: 60, align: 'right' });
            doc.text(formatCurrency(item.subTotal), 320, y, { width: 70, align: 'right' });
            doc.text(formatCurrency(item.gst), 400, y, { width: 60, align: 'right' });
            doc.text(formatCurrency(item.total), 470, y, { width: 80, align: 'right' });
            doc.moveDown(1.5);
        });
        
        doc.strokeColor("#aaaaaa").lineWidth(0.5).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown();

        // Totals
        const totalsTop = doc.y;
        doc.font('Helvetica-Bold');
        doc.text('Totals:', 50, totalsTop);
        doc.text(formatCurrency(quote.subTotal), 320, totalsTop, { width: 70, align: 'right' });
        doc.text(formatCurrency(quote.gst), 400, totalsTop, { width: 60, align: 'right' });
        doc.text(formatCurrency(quote.grandTotal), 470, totalsTop, { width: 80, align: 'right' });

        // Finalize the PDF and end the stream
        doc.end();
    });
});
