/**
 * Client-side AI generation without server
 * Direct API calls to AI services
 */

// AI Service Configuration
const AI_SERVICES = {
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey: null // Will be loaded from Firebase
  },
  falai: {
    baseUrl: 'https://fal.run',
    apiKey: null // Will be loaded from Firebase
  }
};

// Available models (fallback if server is not available)
const FALLBACK_MODELS = [
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', type: 'text', provider: 'openrouter' },
  { id: 'gpt-4', name: 'GPT-4', type: 'text', provider: 'openrouter' },
  { id: 'gpt-4o', name: 'GPT-4o', type: 'text', provider: 'openrouter' },
  { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', type: 'text', provider: 'openrouter' },
  { id: 'flux/dev', name: 'FLUX Dev', type: 'image', provider: 'falai' },
  { id: 'recraft-v3', name: 'Recraft V3', type: 'image', provider: 'falai' }
];

/**
 * Load API keys from Firebase
 */
async function loadAPIKeys() {
  try {
    if (typeof db === 'undefined') {
      console.warn('Firebase not available, using fallback models');
      return false;
    }

    // Load OpenRouter API key
    const openRouterDoc = await db.collection('settings').doc('openrouter').get();
    if (openRouterDoc.exists) {
      AI_SERVICES.openrouter.apiKey = openRouterDoc.data().apiKey;
    }

    // Load Fal.ai API key
    const falaiDoc = await db.collection('settings').doc('fal-ai').get();
    if (falaiDoc.exists) {
      AI_SERVICES.falai.apiKey = falaiDoc.data().apiKey;
    }

    return true;
  } catch (error) {
    console.error('Error loading API keys:', error);
    return false;
  }
}

/**
 * Generate content using client-side AI calls
 */
async function generateContent(prompt, model, temperature = 0.7) {
  try {
    console.log(`🤖 Generating content with ${model}:`, prompt);
    
    // Load API keys
    await loadAPIKeys();
    
    // Find the model configuration
    const modelConfig = FALLBACK_MODELS.find(m => m.id === model);
    if (!modelConfig) {
      throw new Error(`Model ${model} not found`);
    }

    if (modelConfig.type === 'text') {
      return await generateText(prompt, model, temperature);
    } else if (modelConfig.type === 'image') {
      return await generateImage(prompt, model);
    } else {
      throw new Error(`Unsupported model type: ${modelConfig.type}`);
    }
  } catch (error) {
    console.error('Error generating content:', error);
    throw error;
  }
}

/**
 * Generate text using OpenRouter
 */
async function generateText(prompt, model, temperature) {
  if (!AI_SERVICES.openrouter.apiKey) {
    throw new Error('OpenRouter API key not configured. Please configure it in the admin panel.');
  }

  const response = await fetch(`${AI_SERVICES.openrouter.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AI_SERVICES.openrouter.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'GPT Cells App'
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: temperature,
      max_tokens: 2000
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`OpenRouter API error: ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'No response generated';
}

/**
 * Generate image using Fal.ai
 */
async function generateImage(prompt, model) {
  if (!AI_SERVICES.falai.apiKey) {
    throw new Error('Fal.ai API key not configured. Please configure it in the admin panel.');
  }

  const response = await fetch(`${AI_SERVICES.falai.baseUrl}/${model}`, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${AI_SERVICES.falai.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt: prompt,
      num_inference_steps: 20,
      guidance_scale: 7.5
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Fal.ai API error: ${errorData.detail || response.statusText}`);
  }

  const data = await response.json();
  return data.images?.[0]?.url || data.data?.[0]?.url || 'No image generated';
}

/**
 * Get available models
 */
async function getAvailableModels() {
  try {
    // Try to load from Firebase first
    await loadAPIKeys();
    
    // Return models based on available API keys
    const models = [];
    
    if (AI_SERVICES.openrouter.apiKey) {
      models.push(...FALLBACK_MODELS.filter(m => m.provider === 'openrouter'));
    }
    
    if (AI_SERVICES.falai.apiKey) {
      models.push(...FALLBACK_MODELS.filter(m => m.provider === 'falai'));
    }
    
    // If no API keys are configured, return all models with a warning
    if (models.length === 0) {
      console.warn('No API keys configured, returning all models');
      return FALLBACK_MODELS;
    }
    
    return models;
  } catch (error) {
    console.error('Error getting models:', error);
    return FALLBACK_MODELS;
  }
}

/**
 * Check if API keys are configured
 */
async function checkAPIConfiguration() {
  await loadAPIKeys();
  
  const hasOpenRouter = !!AI_SERVICES.openrouter.apiKey;
  const hasFalai = !!AI_SERVICES.falai.apiKey;
  
  return {
    openrouter: hasOpenRouter,
    falai: hasFalai,
    configured: hasOpenRouter || hasFalai
  };
}

// Export functions for use in the main app
window.clientAI = {
  generateContent,
  getAvailableModels,
  checkAPIConfiguration,
  loadAPIKeys
};
