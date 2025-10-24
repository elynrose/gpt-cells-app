/**
 * Local Development Configuration
 * This handles local development when Firebase Admin SDK is not available
 */

// For local development, we'll use a simple approach
// In production, this will be replaced by Firebase integration

let localFalAIApiKey = null;
let localModels = [];

/**
 * Set Fal.ai API key for local development
 */
function setLocalFalAIApiKey(apiKey) {
  localFalAIApiKey = apiKey;
  console.log('✅ Fal.ai API key set for local development');
}

/**
 * Get Fal.ai API key (local development fallback)
 */
async function getFalAIApiKeyLocal() {
  // First try Firebase (for cloud deployment)
  try {
    const { getFalAIApiKey } = require('./firebase-server-config');
    const firebaseKey = await getFalAIApiKey();
    if (firebaseKey) {
      return firebaseKey;
    }
  } catch (error) {
    console.log('⚠️ Firebase not available, using local development mode');
  }
  
  // Fallback to local development
  if (localFalAIApiKey) {
    return localFalAIApiKey;
  }
  
  // Check environment variable directly
  if (process.env.FAL_AI_API_KEY) {
    console.log('✅ Found Fal.ai API key in environment variables');
    return process.env.FAL_AI_API_KEY;
  }
  
  // Last resort: return null
  return null;
}

/**
 * Set models for local development
 */
function setLocalModels(models) {
  localModels = models;
  console.log(`✅ ${models.length} models set for local development`);
}

/**
 * Get active models (local development fallback)
 */
async function getActiveModelsLocal() {
  // First try Firebase (for cloud deployment)
  try {
    const { getActiveModelsFromFirebase } = require('./firebase-server-config');
    const firebaseModels = await getActiveModelsFromFirebase();
    if (firebaseModels.length > 0) {
      return firebaseModels;
    }
  } catch (error) {
    console.log('⚠️ Firebase not available for models, using local development mode');
  }
  
  // Fallback to local development
  if (localModels.length > 0) {
    return localModels;
  }
  
  // Last resort: return empty array
  return [];
}

/**
 * Initialize local development mode
 */
async function initializeLocalDev() {
  console.log('🔄 Initializing local development mode...');
  
  // Try to get API key from environment
  const envKey = process.env.FAL_AI_API_KEY;
  if (envKey) {
    setLocalFalAIApiKey(envKey);
    console.log('✅ Using Fal.ai API key from environment variable');
    console.log(`🔑 API Key (first 10 chars): ${envKey.substring(0, 10)}...`);
  } else {
    console.log('⚠️ No Fal.ai API key found in environment variables');
    console.log('💡 Set FAL_AI_API_KEY environment variable or configure in admin dashboard');
  }
  
  // Set some default models for local development
  const defaultModels = [
    // Image generation models - using working Fal.ai model names
    {
      id: 'fal-ai-flux-dev',
      originalId: 'fal-ai/flux/dev',
      name: 'FLUX Dev',
      type: 'image',
      provider: 'fal-ai',
      status: 'active'
    },
    {
      id: 'fal-ai-recraft-v3',
      originalId: 'fal-ai/recraft-v3',
      name: 'Recraft V3',
      type: 'image',
      provider: 'fal-ai',
      status: 'active'
    },
    // Text generation models - using OpenRouter
    {
      id: 'openai-gpt-4',
      originalId: 'openai/gpt-4',
      name: 'GPT-4',
      type: 'text',
      provider: 'openrouter',
      status: 'active'
    },
    {
      id: 'openai-gpt-3.5-turbo',
      originalId: 'openai/gpt-3.5-turbo',
      name: 'GPT-3.5 Turbo',
      type: 'text',
      provider: 'openrouter',
      status: 'active'
    },
    {
      id: 'anthropic-claude-3.5-sonnet',
      originalId: 'anthropic/claude-3.5-sonnet',
      name: 'Claude 3.5 Sonnet',
      type: 'text',
      provider: 'openrouter',
      status: 'active'
    },
    {
      id: 'meta-llama-3.1-8b-instruct',
      originalId: 'meta-llama/llama-3.1-8b-instruct',
      name: 'Llama 3.1 8B',
      type: 'text',
      provider: 'openrouter',
      status: 'active'
    },
    {
      id: 'meta-llama-3.1-70b-instruct',
      originalId: 'meta-llama/llama-3.1-70b-instruct',
      name: 'Llama 3.1 70B',
      type: 'text',
      provider: 'openrouter',
      status: 'active'
    }
  ];
  
  setLocalModels(defaultModels);
  console.log('✅ Local development mode initialized');
}

module.exports = {
  setLocalFalAIApiKey,
  getFalAIApiKeyLocal,
  setLocalModels,
  getActiveModelsLocal,
  initializeLocalDev
};
