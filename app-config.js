// This file manages environment-specific configurations for the application.

// Determine if the app is running on the local development server or a live server.
const isLocal = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';

// Define the configuration object
const CONFIG = {
    // PDF Generator URL
    // If we are on a local machine, use a local test URL (we'll set this up later if needed).
    // If we are on the live site, use the real Cloud Function URL.
    PDF_GENERATOR_URL: isLocal 
        ? 'http://127.0.0.1:5001/long-justice-454003-b0/australia-southeast1/generateQuotePdf' // Local Firebase emulator URL
        : 'https://generatequotepdf-dbmt2pal4q-ts.a.run.app', // Your LIVE Production URL

    // We can add other configuration variables here in the future
    // e.g., API_URL: isLocal ? 'http://localhost:3000/api' : 'https://api.efmrates.com'
};

// Make the CONFIG object available to any script that imports this file.
export default CONFIG;
