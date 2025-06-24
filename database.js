// database.js

// Import our database instance from the config file
import { db } from './firebase-config.js';
// Import the Firestore functions we need
import { collection, addDoc, serverTimestamp, query, where, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

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

/**
 * Fetches quotes from Firestore for a specific user, ordered by creation date.
 * @param {string} userId - The ID of the user whose quotes to fetch.
 * @returns {Array<object>} - An array of quote objects, or an empty array if an error occurs.
 */
export async function getQuotesFromDb(userId) {
    try {
        const q = query(
            collection(db, "quotes"),
            where("userId", "==", userId),
            orderBy("createdAt", "desc") // Order by creation date, newest first
        );
        const querySnapshot = await getDocs(q);
        const quotes = [];
        querySnapshot.forEach((doc) => {
            quotes.push({ id: doc.id, ...doc.data() });
        });
        console.log(`Fetched ${quotes.length} quotes for user ${userId}.`);
        return quotes;
    } catch (e) {
        console.error("Error fetching documents: ", e);
        return []; // Return empty array on error
    }
}