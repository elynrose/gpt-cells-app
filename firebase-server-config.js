/**
 * Firebase Server Configuration
 * For cloud deployment - server-side Firebase integration
 */

// Firebase Admin SDK setup for server-side operations
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
let firebaseApp = null;
let firestore = null;

/**
 * Initialize Firebase Admin SDK
 */
async function initializeFirebase() {
  try {
    // Check if Firebase is already initialized
    if (firebaseApp) {
      return firebaseApp;
    }

    // For cloud deployment, use service account key or environment variables
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      // Use service account key from environment variable
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID || 'cellulai'
      });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // Use service account file path
      firebaseApp = admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: process.env.FIREBASE_PROJECT_ID || 'cellulai'
      });
    } else {
      // For local development, you might want to use a service account file
      console.log('⚠️ Firebase Admin SDK not configured. Please set up service account credentials.');
      return null;
    }

    firestore = admin.firestore();
    console.log('✅ Firebase Admin initialized');
    
    return firebaseApp;
  } catch (error) {
    console.error('❌ Error initializing Firebase Admin SDK:', error);
    return null;
  }
}

/**
 * Get Fal.ai API key from Firebase
 */
async function getFalAIApiKey() {
  try {
    if (!firestore) {
      await initializeFirebase();
    }

    if (!firestore) {
      console.log('⚠️ Firebase not available, using environment fallback');
      return process.env.FAL_AI_API_KEY;
    }

    // Get Fal.ai configuration from Firebase
    const doc = await firestore.collection('settings').doc('fal-ai').get();
    
    if (doc.exists) {
      const data = doc.data();
      const apiKey = data.apiKey;
      
      if (apiKey) {
        console.log('✅ Fal.ai API key retrieved from Firebase');
        return apiKey;
      }
    }

    console.log('⚠️ Fal.ai API key not found in Firebase');
    return process.env.FAL_AI_API_KEY;
    
  } catch (error) {
    console.error('❌ Error getting Fal.ai API key from Firebase:', error);
    return process.env.FAL_AI_API_KEY;
  }
}

/**
 * Get OpenRouter API key from Firebase
 */
async function getOpenRouterApiKey() {
  try {
    if (!firestore) {
      await initializeFirebase();
    }

    if (!firestore) {
      console.log('⚠️ Firebase not available, using environment fallback');
      return process.env.OPENROUTER_API_KEY;
    }

    // Get OpenRouter configuration from Firebase
    const doc = await firestore.collection('settings').doc('openrouter').get();
    
    if (doc.exists) {
      const data = doc.data();
      const apiKey = data.apiKey;
      
      if (apiKey) {
        console.log('✅ OpenRouter API key retrieved from Firebase');
        return apiKey;
      }
    }

    console.log('⚠️ OpenRouter API key not found in Firebase');
    return process.env.OPENROUTER_API_KEY;
    
  } catch (error) {
    console.error('❌ Error getting OpenRouter API key from Firebase:', error);
    return process.env.OPENROUTER_API_KEY;
  }
}

/**
 * Get active models from Firebase
 */
async function getActiveModelsFromFirebase() {
  try {
    if (!firestore) {
      await initializeFirebase();
    }

    if (!firestore) {
      console.log('⚠️ Firebase not available for models');
      return [];
    }

    // Get active models from Firebase
    const snapshot = await firestore.collection('models')
      .where('status', '==', 'active')
      .get();

    const models = [];
    snapshot.forEach(doc => {
      const modelData = doc.data();
      models.push({
        id: modelData.id,
        originalId: modelData.originalId || modelData.id,
        name: modelData.name,
        type: modelData.type,
        provider: modelData.provider,
        description: modelData.description,
        status: modelData.status
      });
    });

    console.log(`✅ Retrieved ${models.length} active models from Firebase`);
    return models;
    
  } catch (error) {
    console.error('❌ Error getting models from Firebase:', error);
    return [];
  }
}

/**
 * Save generation to Firebase
 */
async function saveGenerationToFirebase(userId, projectId, sheetId, cellId, generationData) {
  try {
    if (!firestore) {
      await initializeFirebase();
    }

    if (!firestore) {
      console.log('⚠️ Firebase not available for saving generation');
      return false;
    }

    // Save generation to Firebase
    const docRef = firestore
      .collection('users')
      .doc(userId)
      .collection('projects')
      .doc(projectId)
      .collection('sheets')
      .doc(sheetId)
      .collection('cells')
      .doc(cellId)
      .collection('generations')
      .doc();

    await docRef.set({
      ...generationData,
      id: docRef.id,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('✅ Generation saved to Firebase');
    return true;
    
  } catch (error) {
    console.error('❌ Error saving generation to Firebase:', error);
    return false;
  }
}

module.exports = {
  initializeFirebase,
  getFalAIApiKey,
  getOpenRouterApiKey,
  getActiveModelsFromFirebase,
  saveGenerationToFirebase
};
