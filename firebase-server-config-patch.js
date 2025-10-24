/**
 * Firebase Server Configuration - PATCH
 * Fix: Use 'isActive' field instead of 'active' field for models
 */

// Replace the getActiveModelsFromFirebase function in firebase-server-config.js
// with this updated version:

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

module.exports = {
  initializeFirebase,
  getFalAIApiKey,
  getOpenRouterApiKey,
  getActiveModelsFromFirebase
};
