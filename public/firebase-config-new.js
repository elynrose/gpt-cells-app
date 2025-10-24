// Firebase configuration and initialization
// Using compat version for browser compatibility
// Updated: 2025-01-24 - Fixed API key - v3

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA63ET1bNMnxY3ZVmnaa8FCUuvkMOVls5k",
  authDomain: "cellulai.firebaseapp.com",
  projectId: "cellulai",
  storageBucket: "cellulai.firebasestorage.app",
  messagingSenderId: "857760697765",
  appId: "1:857760697765:web:74605f6e0667d0feebec4c",
  measurementId: "G-NBGFZ6T90R"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage ? firebase.storage() : null;

// Google Auth Provider
const googleProvider = new firebase.auth.GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');

// Authentication functions
const authService = {
  // Sign up new user
  async signUp(email, password, displayName) {
    try {
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;
      
      // Create user profile in Firestore
      await db.collection('users').doc(user.uid).set({
        email: user.email,
        displayName: displayName,
        createdAt: new Date(),
        subscription: 'free',
        role: 'user', // Default role
        isAdmin: false, // Default admin status
        usage: {
          apiCalls: 0,
          storageUsed: 0,
          sheetsCreated: 0
        }
      });
      
      return { success: true, user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Sign in with Google
  async signInWithGoogle() {
    try {
      console.log('🔐 Attempting Google sign-in...');
      const result = await auth.signInWithPopup(googleProvider);
      const user = result.user;
      console.log('✅ Google sign-in successful:', user.email);
      
      // Check if user exists in Firestore, if not create profile
      const userDoc = await db.collection('users').doc(user.uid).get();
      if (!userDoc.exists) {
        console.log('📝 Creating new user profile for:', user.email);
        await db.collection('users').doc(user.uid).set({
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          createdAt: new Date(),
          subscription: 'free',
          role: 'user',
          isAdmin: false,
          usage: {
            apiCalls: 0,
            storageUsed: 0,
            sheetsCreated: 0
          }
        });
      } else {
        console.log('👤 User profile already exists for:', user.email);
      }
      
      return { success: true, user };
    } catch (error) {
      console.error('❌ Google sign-in error:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      
      // Provide more specific error messages
      let errorMessage = error.message;
      if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = 'Sign-in was cancelled. Please try again.';
      } else if (error.code === 'auth/popup-blocked') {
        errorMessage = 'Popup was blocked by browser. Please allow popups and try again.';
      } else if (error.code === 'auth/unauthorized-domain') {
        errorMessage = 'This domain is not authorized for Google sign-in. Please contact support.';
      } else if (error.code === 'auth/operation-not-allowed') {
        errorMessage = 'Google sign-in is not enabled. Please contact support.';
      }
      
      return { success: false, error: errorMessage };
    }
  },

  // Sign in existing user
  async signIn(email, password) {
    try {
      const userCredential = await auth.signInWithEmailAndPassword(email, password);
      return { success: true, user: userCredential.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Sign out user
  async signOut() {
    try {
      await auth.signOut();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Get current user
  getCurrentUser() {
    return auth.currentUser;
  },

  // Listen to auth state changes
  onAuthStateChanged(callback) {
    return auth.onAuthStateChanged(callback);
  },

  // Get current user's ID token
  async getIdToken() {
    try {
      const user = auth.currentUser;
      if (user) {
        const token = await user.getIdToken();
        return { success: true, token };
      } else {
        return { success: false, error: 'No authenticated user' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Make current user admin
  async makeCurrentUserAdmin() {
    try {
      const user = auth.currentUser;
      if (!user) {
        return { success: false, error: 'No user logged in' };
      }

      await db.collection('users').doc(user.uid).update({
        role: 'admin',
        isAdmin: true,
        adminGrantedAt: new Date()
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Check if current user is admin
  async isCurrentUserAdmin() {
    try {
      const user = auth.currentUser;
      if (!user) {
        console.log('🔍 No current user for admin check');
        return false;
      }

      console.log('🔍 Checking admin status for user:', user.email);
      const userDoc = await db.collection('users').doc(user.uid).get();
      
      if (userDoc.exists) {
        const userData = userDoc.data();
        const isAdminUser = userData.isAdmin === true || userData.role === 'admin';
        console.log('🔍 User data:', { isAdmin: userData.isAdmin, role: userData.role, isAdminUser });
        return isAdminUser;
      } else {
        console.log('🔍 User document does not exist');
        return false;
      }
    } catch (error) {
      console.error('❌ Error checking admin status:', error);
      return false;
    }
  },

  // Get current user profile
  async getCurrentUserProfile() {
    try {
      const user = auth.currentUser;
      if (!user) {
        return { success: false, error: 'No user logged in' };
      }

      const userDoc = await db.collection('users').doc(user.uid).get();
      if (userDoc.exists) {
        return { success: true, data: userDoc.data() };
      }
      return { success: false, error: 'User profile not found' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};

// Make services globally available
window.authService = authService;
window.auth = auth;
window.db = db;
window.storage = storage;
