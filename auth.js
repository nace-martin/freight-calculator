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
        // Redirect them immediately to the new dashboard.
        console.log("User is already logged in. Redirecting to dashboard...");
        window.location.href = 'dashboard.html'; // CHANGE THIS LINE
    }
    // The code below will only run if the user is NOT logged in.
    else {
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        const loginBtn = document.getElementById('login-btn');
        const errorMsg = document.getElementById('error-message');

        if (loginBtn) {
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
                        // Redirect to the new dashboard page
                        window.location.href = 'dashboard.html'; // CHANGE THIS LINE
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