/**
 * Local Development Configuration
 * Handles local development setup and fallback configurations
 */

/**
 * Initialize local development environment
 */
async function initializeLocalDev() {
  try {
    console.log('🔧 Initializing local development environment...');
    
    // Check if we have required environment variables
    const requiredEnvVars = ['FAL_AI_API_KEY', 'OPENROUTER_API_KEY'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.log(`⚠️ Missing environment variables: ${missingVars.join(', ')}`);
      console.log('📝 Please set these in your .env file or environment');
    } else {
      console.log('✅ All required environment variables are set');
    }
    
    console.log('✅ Local development environment initialized');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize local development environment:', error);
    return false;
  }
}

/**
 * Get Fal.ai API key for local development
 */
function getFalAIApiKeyLocal() {
  return process.env.FAL_AI_API_KEY;
}

/**
 * Get OpenRouter API key for local development
 */
function getOpenRouterApiKeyLocal() {
  return process.env.OPENROUTER_API_KEY;
}

/**
 * Get active models for local development
 */
async function getActiveModelsLocal() {
  // Return a default set of models for local development
  return [
    {
      id: 'gpt-3.5-turbo',
      name: 'GPT-3.5 Turbo',
      type: 'text',
      provider: 'openrouter',
      active: true
    },
    {
      id: 'gpt-4',
      name: 'GPT-4',
      type: 'text',
      provider: 'openrouter',
      active: true
    },
    {
      id: 'flux/dev',
      name: 'FLUX Dev',
      type: 'image',
      provider: 'fal-ai',
      active: true
    },
    {
      id: 'flux/pro',
      name: 'FLUX Pro',
      type: 'image',
      provider: 'fal-ai',
      active: true
    },
    {
      id: 'sora-2',
      name: 'Sora 2',
      type: 'video',
      provider: 'openai',
      description: 'OpenAI Sora 2 - Advanced video generation with text-to-video and image-to-video capabilities',
      active: true
    }
  ];
}

module.exports = {
  initializeLocalDev,
  getFalAIApiKeyLocal,
  getOpenRouterApiKeyLocal,
  getActiveModelsLocal
};