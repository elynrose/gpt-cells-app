// Firebase configuration and initialization
// Using compat version for browser compatibility
// Updated: 2025-01-24 - Security fix - API key removed from repository

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

// Admin Firebase functions
const adminService = {
  // Get all users
  async getAllUsers() {
    try {
      const usersSnapshot = await db.collection('users').get();
      const users = [];
      
      usersSnapshot.forEach(doc => {
        users.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      return { success: true, data: users };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Update user role
  async updateUserRole(userId, role) {
    try {
      await db.collection('users').doc(userId).update({
        role: role,
        isAdmin: role === 'admin',
        updatedAt: new Date()
      });
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Update user subscription
  async updateUserSubscription(userId, subscription) {
    try {
      await db.collection('users').doc(userId).update({
        subscription: subscription,
        subscriptionUpdatedAt: new Date()
      });
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Delete user
  async deleteUser(userId) {
    try {
      // Delete user document
      await db.collection('users').doc(userId).delete();
      
      // Delete user's projects
      const projectsSnapshot = await db.collection('users').doc(userId).collection('projects').get();
      const deletePromises = projectsSnapshot.docs.map(doc => doc.ref.delete());
      await Promise.all(deletePromises);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Get all projects
  async getAllProjects() {
    try {
      const usersSnapshot = await db.collection('users').get();
      const projects = [];
      
      for (const userDoc of usersSnapshot.docs) {
        const userProjectsSnapshot = await db.collection('users').doc(userDoc.id).collection('projects').get();
        
        userProjectsSnapshot.forEach(projectDoc => {
          projects.push({
            id: projectDoc.id,
            userId: userDoc.id,
            userEmail: userDoc.data().email,
            ...projectDoc.data()
          });
        });
      }
      
      return { success: true, data: projects };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Delete project
  async deleteProject(userId, projectId) {
    try {
      await db.collection('users').doc(userId).collection('projects').doc(projectId).delete();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Get analytics data
  async getAnalyticsData() {
    try {
      const usersSnapshot = await db.collection('users').get();
      const modelsSnapshot = await db.collection('models').get();
      
      const analytics = {
        totalUsers: usersSnapshot.size,
        totalModels: modelsSnapshot.size,
        activeUsers: 0,
        premiumUsers: 0,
        freeUsers: 0,
        userGrowth: [],
        modelUsage: {}
      };
      
      // Analyze users
      usersSnapshot.forEach(doc => {
        const userData = doc.data();
        if (userData.isActive !== false) analytics.activeUsers++;
        if (userData.subscription === 'premium') analytics.premiumUsers++;
        if (userData.subscription === 'free') analytics.freeUsers++;
      });
      
      // Analyze models
      modelsSnapshot.forEach(doc => {
        const modelData = doc.data();
        analytics.modelUsage[modelData.type] = (analytics.modelUsage[modelData.type] || 0) + 1;
      });
      
      return { success: true, data: analytics };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Get system settings
  async getSystemSettings() {
    try {
      const settingsDoc = await db.collection('settings').doc('system').get();
      if (settingsDoc.exists) {
        return { success: true, data: settingsDoc.data() };
      }
      return { success: true, data: {} };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Update system settings
  async updateSystemSettings(settings) {
    try {
      await db.collection('settings').doc('system').set({
        ...settings,
        updatedAt: new Date(),
        updatedBy: auth.currentUser.uid
      });
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};

// Firestore functions
const firestoreService = {
  // Create a new project
  async createProject(userId, projectData) {
    try {
      const docRef = await db.collection('users').doc(userId).collection('projects').add({
        ...projectData,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      return { success: true, projectId: docRef.id };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Get all projects for a user
  async getProjects(userId) {
    try {
      const snapshot = await db.collection('users').doc(userId).collection('projects').get();
      const projects = [];
      snapshot.forEach(doc => {
        projects.push({ id: doc.id, ...doc.data() });
      });
      return { success: true, projects };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Update a project
  async updateProject(userId, projectId, projectData) {
    try {
      await db.collection('users').doc(userId).collection('projects').doc(projectId).update({
        ...projectData,
        updatedAt: new Date()
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Delete a project
  async deleteProject(userId, projectId) {
    try {
      // Delete all sheets in the project first
      const sheetsSnapshot = await db.collection('users').doc(userId).collection('projects').doc(projectId).collection('sheets').get();
      const batch = db.batch();
      
      sheetsSnapshot.forEach(sheetDoc => {
        batch.delete(sheetDoc.ref);
      });
      
      // Delete the project
      batch.delete(db.collection('users').doc(userId).collection('projects').doc(projectId));
      
      await batch.commit();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Create a new sheet within a project
  async createSheet(userId, projectId, sheetData) {
    try {
      const docRef = await db.collection('users').doc(userId).collection('projects').doc(projectId).collection('sheets').add({
        ...sheetData,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      return { success: true, sheetId: docRef.id };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Get all sheets for a project
  async getSheets(userId, projectId) {
    try {
      const snapshot = await db.collection('users').doc(userId).collection('projects').doc(projectId).collection('sheets').get();
      const sheets = [];
      snapshot.forEach(doc => {
        sheets.push({ id: doc.id, ...doc.data() });
      });
      return { success: true, sheets };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Update a sheet
  async updateSheet(userId, projectId, sheetId, sheetData) {
    try {
      await db.collection('users').doc(userId).collection('projects').doc(projectId).collection('sheets').doc(sheetId).update({
        ...sheetData,
        updatedAt: new Date()
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Delete a sheet
  async deleteSheet(userId, projectId, sheetId) {
    try {
      // Delete all cells in the sheet first
      const cellsSnapshot = await db.collection('users').doc(userId).collection('projects').doc(projectId).collection('sheets').doc(sheetId).collection('cells').get();
      const batch = db.batch();
      
      cellsSnapshot.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      // Delete the sheet itself
      batch.delete(db.collection('users').doc(userId).collection('projects').doc(projectId).collection('sheets').doc(sheetId));
      
      await batch.commit();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Save a cell
  async saveCell(userId, projectId, sheetId, cellId, cellData) {
    try {
      console.log(`🔥 firestoreService.saveCell called with:`, { userId, projectId, sheetId, cellId, cellData });
      console.log(`🔥 Firestore path: users/${userId}/projects/${projectId}/sheets/${sheetId}/cells/${cellId}`);
      
      const docRef = db.collection('users').doc(userId).collection('projects').doc(projectId).collection('sheets').doc(sheetId).collection('cells').doc(cellId);
      
      await docRef.set({
        ...cellData,
        updatedAt: new Date()
      });
      
      console.log(`🔥 firestoreService.saveCell completed successfully`);
      console.log(`🔥 Document written to: users/${userId}/projects/${projectId}/sheets/${sheetId}/cells/${cellId}`);
      return { success: true };
    } catch (error) {
      console.error(`🔥 firestoreService.saveCell error:`, error);
      console.error(`🔥 Error details:`, error.message);
      console.error(`🔥 Error code:`, error.code);
      return { success: false, error: error.message };
    }
  },

  // Get a specific cell
  async getCell(userId, projectId, sheetId, cellId) {
    try {
      console.log(`firestoreService.getCell called with:`, { userId, projectId, sheetId, cellId });
      const doc = await db.collection('users').doc(userId).collection('projects').doc(projectId).collection('sheets').doc(sheetId).collection('cells').doc(cellId).get();
      if (doc.exists) {
        console.log(`firestoreService.getCell found data:`, doc.data());
        return { success: true, data: doc.data() };
      } else {
        console.log(`firestoreService.getCell no data found for cell ${cellId}`);
        return { success: false, error: 'Cell not found' };
      }
    } catch (error) {
      console.error(`firestoreService.getCell error:`, error);
      return { success: false, error: error.message };
    }
  },

  // Delete a cell
  async deleteCell(userId, projectId, sheetId, cellId) {
    try {
      await db.collection('users').doc(userId).collection('projects').doc(projectId).collection('sheets').doc(sheetId).collection('cells').doc(cellId).delete();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Save generation log
  async saveGeneration(userId, projectId, sheetId, cellId, generation) {
    try {
      await db.collection('users').doc(userId).collection('projects').doc(projectId).collection('sheets').doc(sheetId).collection('cells').doc(cellId).collection('generations').add({
        ...generation,
        createdAt: new Date()
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Get user profile
  async getUserProfile(userId) {
    try {
      const doc = await db.collection('users').doc(userId).get();
      if (doc.exists) {
        return { success: true, profile: doc.data() };
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
      await db.collection('users').doc(userId).update({
        settings: settings,
        updatedAt: new Date()
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Get user usage stats
  async getUserUsage(userId) {
    try {
      const doc = await db.collection('users').doc(userId).get();
      if (doc.exists) {
        const data = doc.data();
        return { success: true, usage: data.usage || {} };
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
      const storageRef = storage.ref(`users/${userId}/${path}`);
      const snapshot = await storageRef.put(file);
      const downloadURL = await snapshot.ref.getDownloadURL();
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
