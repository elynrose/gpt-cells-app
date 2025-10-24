// Firebase configuration and initialization
// Using compat version for browser compatibility
const { initializeApp } = firebase;
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "cellulai.firebaseapp.com",
  projectId: "cellulai",
  storageBucket: "cellulai.firebasestorage.app",
  messagingSenderId: "857760697765",
  appId: "1:857760697765:web:74605f6e0667d0feebec4c",
  measurementId: "G-NBGFZ6T90R"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

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
  }
};

// Firestore functions
const firestoreService = {
  // Create a new sheet
  async createSheet(userId, sheetData) {
    try {
      const docRef = await db.collection('users').doc(userId).collection('sheets').add({
        ...sheetData,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      return { success: true, sheetId: docRef.id };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Get all sheets for a user
  async getSheets(userId) {
    try {
      const sheetsRef = collection(db, 'users', userId, 'sheets');
      const snapshot = await getDocs(sheetsRef);
      const sheets = [];
      snapshot.forEach(doc => {
        sheets.push({ id: doc.id, ...doc.data() });
      });
      return { success: true, sheets };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Update sheet
  async updateSheet(userId, sheetId, sheetData) {
    try {
      const sheetRef = doc(db, 'users', userId, 'sheets', sheetId);
      await updateDoc(sheetRef, {
        ...sheetData,
        updatedAt: new Date()
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Delete sheet
  async deleteSheet(userId, sheetId) {
    try {
      await deleteDoc(doc(db, 'users', userId, 'sheets', sheetId));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Save cell data
  async saveCell(userId, sheetId, cellId, cellData) {
    try {
      const cellRef = doc(db, 'users', userId, 'sheets', sheetId, 'cells', cellId);
      await setDoc(cellRef, {
        ...cellData,
        updatedAt: new Date()
      }, { merge: true });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Get all cells for a sheet
  async getCells(userId, sheetId) {
    try {
      const cellsRef = collection(db, 'users', userId, 'sheets', sheetId, 'cells');
      const snapshot = await getDocs(cellsRef);
      const cells = {};
      snapshot.forEach(doc => {
        cells[doc.id] = doc.data();
      });
      return { success: true, cells };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Save generation log
  async saveGeneration(userId, sheetId, cellId, generationData) {
    try {
      const generationRef = await addDoc(collection(db, 'users', userId, 'sheets', sheetId, 'cells', cellId, 'generations'), {
        ...generationData,
        createdAt: new Date()
      });
      return { success: true, generationId: generationRef.id };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Get user profile
  async getUserProfile(userId) {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        return { success: true, data: userDoc.data() };
      } else {
        return { success: false, error: 'User profile not found' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Save user settings
  async saveUserSettings(userId, settings) {
    try {
      await setDoc(doc(db, 'users', userId, 'settings', 'preferences'), {
        ...settings,
        updatedAt: new Date()
      }, { merge: true });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Get user usage statistics
  async getUserUsage(userId) {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        return { 
          success: true, 
          data: {
            apiCalls: userData.usage?.apiCalls || 0,
            images: userData.usage?.images || 0,
            audio: userData.usage?.audio || 0,
            storageUsed: userData.usage?.storageUsed || 0,
            subscription: userData.subscription || 'free'
          }
        };
      } else {
        return { success: false, error: 'User not found' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};

// Storage functions
const storageService = {
  // Upload file to Firebase Storage
  async uploadFile(userId, file, path) {
    try {
      const storageRef = ref(storage, `users/${userId}/${path}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      return { success: true, url: downloadURL };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Upload base64 data (for generated images/audio)
  async uploadBase64(userId, base64Data, filename, contentType) {
    try {
      // Convert base64 to blob
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: contentType });
      
      const storageRef = ref(storage, `users/${userId}/generated/${filename}`);
      const snapshot = await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(snapshot.ref);
      return { success: true, url: downloadURL };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};

// Make services globally available
window.authService = authService;
window.firestoreService = firestoreService;
window.storageService = storageService;
window.auth = auth;
window.db = db;
window.storage = storage;
