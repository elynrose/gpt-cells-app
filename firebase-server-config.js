/**
 * Firebase Server Configuration
 * Handles Firebase Admin SDK initialization and API key retrieval
 */

const admin = require('firebase-admin');

let firestore = null;

/**
 * Initialize Firebase Admin SDK
 */
async function initializeFirebase() {
  try {
    if (firestore) {
      return firestore;
    }

    // Check if we're in production (Railway/Heroku) or development
    if (process.env.NODE_ENV === 'production') {
      // Production: Use environment variables for service account
      if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        try {
          // Check if the environment variable is empty or invalid
          if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim() === '') {
            console.log('⚠️ FIREBASE_SERVICE_ACCOUNT_KEY is empty, skipping Firebase Admin SDK');
            return null;
          }
          
          const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
          // Check if the service account has a valid private_key
          if (serviceAccount.private_key && serviceAccount.private_key !== '' && serviceAccount.private_key !== '""' && !serviceAccount.private_key.includes('""')) {
            console.log('✅ Using Firebase service account credentials');
            admin.initializeApp({
              credential: admin.credential.cert(serviceAccount),
              projectId: process.env.FIREBASE_PROJECT_ID || 'cellulai'
            });
          } else {
            // Invalid service account, skip Firebase Admin SDK initialization
            console.log('⚠️ Invalid Firebase service account (no private_key), skipping Firebase Admin SDK');
            console.log('⚠️ Firebase client config will still work via /firebase-config.js endpoint');
            return null; // Return null to indicate no Firebase Admin SDK
          }
        } catch (error) {
          // Invalid JSON, skip Firebase Admin SDK initialization
          console.log('⚠️ Invalid Firebase service account JSON, skipping Firebase Admin SDK');
          console.log('⚠️ Error details:', error.message);
          console.log('⚠️ Firebase client config will still work via /firebase-config.js endpoint');
          return null; // Return null to indicate no Firebase Admin SDK
        }
      } else {
        // Fallback: Use default credentials (for Railway/Heroku)
        admin.initializeApp({
          projectId: process.env.FIREBASE_PROJECT_ID || 'cellulai'
        });
      }
    } else {
      // Development: Use environment variables or service account file
      if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        try {
          const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
          // Check if the service account has a valid private_key
          if (serviceAccount.private_key && serviceAccount.private_key !== '') {
            admin.initializeApp({
              credential: admin.credential.cert(serviceAccount),
              projectId: process.env.FIREBASE_PROJECT_ID || 'cellulai'
            });
          } else {
            // Invalid service account, try local file or default
            console.log('⚠️ Invalid Firebase service account, trying local file');
            try {
              const serviceAccount = require('./cellulai-firebase-adminsdk-fbsvc-ec0b26e7de.json');
              admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId: 'cellulai'
              });
            } catch (error) {
              admin.initializeApp({
                projectId: 'cellulai'
              });
            }
          }
        } catch (error) {
          // Invalid JSON, try local file or default
          console.log('⚠️ Invalid Firebase service account JSON, trying local file');
          try {
            const serviceAccount = require('./cellulai-firebase-adminsdk-fbsvc-ec0b26e7de.json');
            admin.initializeApp({
              credential: admin.credential.cert(serviceAccount),
              projectId: 'cellulai'
            });
          } catch (error) {
            admin.initializeApp({
              projectId: 'cellulai'
            });
          }
        }
      } else {
        // Fallback: Use service account file (if available)
        try {
          const serviceAccount = require('./cellulai-firebase-adminsdk-fbsvc-ec0b26e7de.json');
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: 'cellulai'
          });
        } catch (error) {
          // No service account file, use default credentials
          admin.initializeApp({
            projectId: 'cellulai'
          });
        }
      }
    }

    firestore = admin.firestore();
    console.log('✅ Firebase Admin SDK initialized');
    return firestore;
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error);
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

    const modelsSnapshot = await firestore.collection('models').where('isActive', '==', true).get();
    const models = [];
    
    modelsSnapshot.forEach(doc => {
      const modelData = doc.data();
      models.push({
        id: doc.id,
        name: modelData.name,
        type: modelData.type,
        provider: modelData.provider,
        active: modelData.isActive
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
async function saveGenerationToFirebase(userId, projectId, sheetId, cellId, generation) {
  try {
    if (!firestore) {
      await initializeFirebase();
    }

    if (!firestore) {
      console.log('⚠️ Firebase not available for saving generation');
      return false;
    }

    await firestore
      .collection('users')
      .doc(userId)
      .collection('projects')
      .doc(projectId)
      .collection('sheets')
      .doc(sheetId)
      .collection('cells')
      .doc(cellId)
      .collection('generations')
      .add({
        ...generation,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
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