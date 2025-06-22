// auth.js
import { auth } from './firebase-config.js';
import { 
    onAuthStateChanged, // ADD THIS IMPORT
    signInWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";

// NEW: Auth Guard for the login page
onAuthStateChanged(auth, user => {
    if (user) {
        // If the user is already logged in, don't show the login page.
        // Redirect them immediately to the main application.
        console.log("User is already logged in. Redirecting to app...");
        window.location.href = 'index.html';
    }
    // The code below will only run if the user is NOT logged in.
    else {
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        const loginBtn = document.getElementById('login-btn');
        const errorMsg = document.getElementById('error-message');

        // Only add the event listener if the login button exists on the page
        if (loginBtn) {
            // Event listener for the Login button
            loginBtn.addEventListener('click', () => {
                const email = emailInput.value;
                const password = passwordInput.value;

                if (!email || !password) {
                    errorMsg.textContent = "Please enter both email and password.";
                    return;
                }

                signInWithEmailAndPassword(auth, email, password)
                    .then(userCredential => {
                        // Login successful
                        console.log('User logged in:', userCredential.user);
                        // Redirect to the main calculator page
                        window.location.href = 'index.html';
                    })
                    .catch(error => {
                        // Handle login errors
                        errorMsg.textContent = "Error: Invalid email or password.";
                        console.error("Login error:", error);
                    });
            });
        }
    }
});