// database.js

// Import our database instance from the config file
import { db } from './firebase-config.js';
// Import the Firestore functions we need
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

/**
 * Saves a quote data object to the 'quotes' collection in Firestore.
 * @param {object} quoteData - The quote data to save.
 * @returns {boolean} - True if successful, false otherwise.
 */
export async function saveQuoteToDb(quoteData) {
    try {
        // Add a new document with a generated ID to the "quotes" collection.
        const docRef = await addDoc(collection(db, "quotes"), {
            ...quoteData, // Spread the original quote data
            createdAt: serverTimestamp() // Add a server-side timestamp for sorting
        });
        console.log("Quote saved successfully with ID: ", docRef.id);
        return true; // Indicate success
    } catch (e) {
        console.error("Error adding document: ", e);
        return false; // Indicate failure
    }
}