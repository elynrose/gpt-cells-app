/**
 * GPT Cells Application Server
 * A Node.js server providing AI-powered spreadsheet functionality
 * with support for text, image, and audio generation
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');
const sqlite3 = require('sqlite3').verbose();

// Load environment variables from .env file
require('dotenv').config();

// Firebase server integration for cloud deployment
const { initializeFirebase, getFalAIApiKey, getOpenRouterApiKey, getActiveModelsFromFirebase } = require('./firebase-server-config');

// Local development configuration
const { initializeLocalDev, getFalAIApiKeyLocal, getActiveModelsLocal } = require('./local-dev-config');

// Configuration
const publicDir = path.join(__dirname, 'public');
const port = process.env.PORT || 3000;


// Rate limiting configuration
const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW) || 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100; // Max requests per window
const rateLimitMap = new Map();

// Cache for available models
let availableModels = [];
let modelsCacheTime = 0;
const CACHE_DURATION = parseInt(process.env.CACHE_DURATION) || 5 * 60 * 1000; // 5 minutes

// Circuit breaker for API requests
let apiRequestInProgress = false;

// Database setup
const dbPath = process.env.DATABASE_URL || path.join(__dirname, 'spreadsheet.db');
let db;

/**
 * Rate limiting middleware
 */
function checkRateLimit(ip) {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;
  
  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, []);
  }
  
  const requests = rateLimitMap.get(ip);
  // Remove old requests outside the window
  const validRequests = requests.filter(timestamp => timestamp > windowStart);
  rateLimitMap.set(ip, validRequests);
  
  if (validRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  
  validRequests.push(now);
  return true;
}

/**
 * Enhanced error handling
 */
function handleError(res, statusCode, message, error = null) {
  // Log error for monitoring (production logging)
  if (error) {
    // In production, you might want to send this to a logging service
    // For now, we'll just ensure the error is handled gracefully
  }
  
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Return sanitized error message for production
  const sanitizedMessage = statusCode >= 500 ? 'Internal server error' : message;
  res.end(JSON.stringify({ 
    error: sanitizedMessage, 
    timestamp: new Date().toISOString(),
    status: statusCode
  }));
}

/**
 * Initialize SQLite database
 */
function initializeDatabase() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err);
        return;
      }
      
      // Create tables
      db.serialize(() => {
        // Sheets table
        db.run(`
          CREATE TABLE IF NOT EXISTS sheets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            num_rows INTEGER DEFAULT 10,
            num_cols INTEGER DEFAULT 10,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        
        // Cells table
        db.run(`
          CREATE TABLE IF NOT EXISTS cells (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sheet_id INTEGER NOT NULL,
            cell_id TEXT NOT NULL,
            prompt TEXT,
            output TEXT,
            model TEXT DEFAULT 'gpt-3.5-turbo',
            temperature REAL DEFAULT 0.7,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (sheet_id) REFERENCES sheets (id),
            UNIQUE(sheet_id, cell_id)
          )
        `);
        
        // Check and add missing columns to existing tables
        db.get("PRAGMA table_info(cells)", (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          
          // Check if model column exists
          db.all("PRAGMA table_info(cells)", (err, columns) => {
            if (err) {
              reject(err);
              return;
            }
            
            const hasModel = columns.some(col => col.name === 'model');
            const hasTemperature = columns.some(col => col.name === 'temperature');
            
            if (!hasModel) {
              db.run("ALTER TABLE cells ADD COLUMN model TEXT DEFAULT 'gpt-3.5-turbo'", (err) => {
                if (err) {}
              });
            }
            
            if (!hasTemperature) {
              db.run("ALTER TABLE cells ADD COLUMN temperature REAL DEFAULT 0.7", (err) => {
                if (err) {}
              });
            }
            
            // Check if sheets table has num_rows and num_cols
            db.all("PRAGMA table_info(sheets)", (err, sheetColumns) => {
              if (err) {
                reject(err);
                return;
              }
              
              const hasNumRows = sheetColumns.some(col => col.name === 'num_rows');
              const hasNumCols = sheetColumns.some(col => col.name === 'num_cols');
              
              if (!hasNumRows) {
                db.run("ALTER TABLE sheets ADD COLUMN num_rows INTEGER DEFAULT 10", (err) => {
                  if (err) {}
                });
              }
              
              if (!hasNumCols) {
                db.run("ALTER TABLE sheets ADD COLUMN num_cols INTEGER DEFAULT 10", (err) => {
                  if (err) {}
                });
              }
              
              // Create default sheet if none exists
              db.get("SELECT COUNT(*) as count FROM sheets", (err, row) => {
                if (err) {
                  reject(err);
                  return;
                }
                
                if (row.count === 0) {
                  db.run("INSERT INTO sheets (name) VALUES ('Sheet1')", (err) => {
                    if (err) {
                      reject(err);
                      return;
                    }
                    resolve();
                  });
                } else {
                  resolve();
                }
              });
            });
          });
        });
      });
    });
  });
}

/**
 * Database functions
 */

/**
 * Get all sheets from database
 */
function getSheets() {
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM sheets ORDER BY created_at", (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

/**
 * Get cells for a specific sheet
 */
function getSheetCells(sheetId) {
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM cells WHERE sheet_id = ?", [sheetId], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

/**
 * Save or update a cell
 */
function saveCell(sheetId, cellId, prompt, output, model = 'gpt-3.5-turbo', temperature = 0.7) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO cells (sheet_id, cell_id, prompt, output, model, temperature, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    
    stmt.run([sheetId, cellId, prompt || '', output || '', model, temperature], function(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve(this.changes);
    });
    
    stmt.finalize();
  });
}

/**
 * Create a new sheet
 */
function createSheet(name) {
  return new Promise((resolve, reject) => {
    db.run("INSERT INTO sheets (name) VALUES (?)", [name], function(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve(this.lastID);
    });
  });
}

/**
 * Delete a sheet
 */
function deleteSheet(sheetId) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Delete all cells for this sheet
      db.run("DELETE FROM cells WHERE sheet_id = ?", [sheetId], (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Delete the sheet
        db.run("DELETE FROM sheets WHERE id = ?", [sheetId], (err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });
    });
  });
}

/**
 * Rename a sheet
 */
function renameSheet(sheetId, newName) {
  return new Promise((resolve, reject) => {
    db.run("UPDATE sheets SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [newName, sheetId], function(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve(this.changes);
    });
  });
}

/**
 * Update sheet dimensions
 */
function updateSheetDimensions(sheetId, numRows, numCols) {
  return new Promise((resolve, reject) => {
    db.run("UPDATE sheets SET num_rows = ?, num_cols = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [numRows, numCols, sheetId], function(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve(this.changes);
    });
  });
}

/**
 * Model providers configuration
 */
const MODEL_PROVIDERS = {
  'fal-ai': {
    name: 'Fal.ai',
    baseUrl: 'https://fal.run',
    apiKey: process.env.FAL_AI_API_KEY || '',
    models: [
      // Working image generation models only
      { id: 'fal-ai/flux/dev', name: 'FLUX Dev', description: 'High-quality image generation', type: 'image' },
      { id: 'fal-ai/recraft-v3', name: 'Recraft V3', description: 'Vector art and image generation', type: 'image' }
    ],
    endpoint: '/v1/chat/completions'
  },
  'openrouter': {
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY || '',
    models: [
      { id: 'openai/gpt-4', name: 'GPT-4', description: 'Most advanced GPT-4 model', type: 'text' },
      { id: 'openai/gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Fast and efficient model', type: 'text' },
      { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', description: 'Advanced reasoning model', type: 'text' },
      { id: 'meta-llama/llama-3.1-8b-instruct', name: 'Llama 3.1 8B', description: 'Fast and efficient text model', type: 'text' },
      { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B', description: 'More capable text model', type: 'text' }
    ],
    endpoint: '/chat/completions'
  },
  'openai': {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY || '',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', description: 'Most advanced GPT-4 model' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Faster, cheaper GPT-4 model' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Previous generation GPT-4' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Fast and efficient model' },
      { id: 'dall-e-3', name: 'DALL-E 3', description: 'AI image generation model', type: 'image' },
      { id: 'tts-1', name: 'TTS-1', description: 'Text-to-Speech model', type: 'audio' },
      { id: 'tts-1-hd', name: 'TTS-1 HD', description: 'High-definition Text-to-Speech model', type: 'audio' },
      // Add more OpenAI models here:
      // { id: 'gpt-4o-2024-08-06', name: 'GPT-4o (Aug 6)', description: 'GPT-4o with specific date' },
      // { id: 'gpt-3.5-turbo-0125', name: 'GPT-3.5 Turbo (Jan 25)', description: 'Latest GPT-3.5 Turbo' }
    ],
    endpoint: '/chat/completions'
  },
  
  // Example: Add Anthropic Claude
  // 'anthropic': {
  //   name: 'Anthropic',
  //   baseUrl: 'https://api.anthropic.com/v1',
  //   apiKey: process.env.ANTHROPIC_API_KEY || '',
  //   models: [
  //     { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Most capable Claude model' },
  //     { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Fast and efficient Claude model' }
  //   ],
  //   endpoint: '/messages'
  // }
};

/**
 * Make HTTP request to any API provider with dynamic API key
 */
async function makeAPIRequest(provider, endpoint, data = null, apiKey = null) {
  return new Promise(async (resolve, reject) => {
    const config = MODEL_PROVIDERS[provider];
    if (!config) {
      reject(new Error(`Unknown provider: ${provider}`));
      return;
    }

    // Get API key dynamically if not provided
    let finalApiKey = apiKey;
    if (!finalApiKey) {
      if (provider === 'fal-ai') {
        finalApiKey = process.env.FAL_AI_API_KEY;
      } else if (provider === 'openrouter') {
        finalApiKey = process.env.OPENROUTER_API_KEY;
      } else {
        finalApiKey = config.apiKey;
      }
    }

    if (!finalApiKey) {
      reject(new Error(`API key required for ${provider}`));
      return;
    }

    const url = new URL(config.baseUrl + endpoint);
    console.log(`🌐 Making API request to: ${url.toString()}`);
    console.log(`🔑 Using API key: ${finalApiKey ? finalApiKey.substring(0, 10) + '...' : 'NOT SET'}`);
    
    // Check if this is a TTS request (audio endpoint)
    const isAudioRequest = endpoint === '/audio/speech';
    
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: data ? 'POST' : 'GET',
      headers: {
        'Authorization': `Bearer ${finalApiKey}`,
        'Content-Type': 'application/json',
      }
    };
    
    // Add provider-specific headers
    if (provider === 'fal-ai') {
      options.headers['Authorization'] = `Key ${finalApiKey}`;
    } else if (provider === 'openrouter') {
      options.headers['Authorization'] = `Bearer ${finalApiKey}`;
    }

    // Add timeout to prevent hanging requests
    const req = https.request(options, (res) => {
      console.log(`📡 API Response Status: ${res.statusCode}`);
      console.log(`📡 API Response Headers:`, res.headers);
      
      if (isAudioRequest) {
        // Handle binary audio data
        const chunks = [];
        res.on('data', (chunk) => {
          chunks.push(chunk);
        });
        res.on('end', () => {
          if (res.statusCode >= 400) {
            const errorData = Buffer.concat(chunks).toString();
            console.log(`❌ API Error ${res.statusCode}: ${errorData}`);
            reject(new Error(`API Error ${res.statusCode}: ${errorData.substring(0, 200)}`));
            return;
          }
          
          // Return the audio data as base64
          const audioBuffer = Buffer.concat(chunks);
          const base64Audio = audioBuffer.toString('base64');
          resolve(base64Audio);
        });
      } else {
        // Handle JSON responses
        let responseData = '';
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        res.on('end', () => {
          console.log(`📡 API Response Data: ${responseData.substring(0, 500)}...`);
          
          if (res.statusCode >= 400) {
            console.log(`❌ API Error ${res.statusCode}: ${responseData}`);
            reject(new Error(`API Error ${res.statusCode}: ${responseData.substring(0, 200)}`));
            return;
          }
          
          try {
            const parsed = JSON.parse(responseData);
            console.log(`✅ API Success:`, parsed);
            resolve(parsed);
          } catch (error) {
            console.log(`❌ JSON Parse Error:`, error.message);
            reject(new Error(`Invalid JSON response: ${responseData.substring(0, 200)}`));
          }
        });
      }
    });

    // Set timeout to prevent hanging requests
    req.setTimeout(30000, () => {
      console.log(`⏰ Request timeout after 30 seconds`);
      req.destroy();
      reject(new Error('Request timeout - API did not respond within 30 seconds'));
    });

    req.on('error', (error) => {
      console.log(`❌ Request error:`, error.message);
      reject(error);
    });

    if (data) {
      console.log(`📤 Sending request data:`, JSON.stringify(data).substring(0, 200) + '...');
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

/**
 * Fetch available models from all providers
 */
async function fetchAvailableModels() {
  const allModels = [];
  
  try {
    // Only load models from Firestore (production deployment)
    const models = await getActiveModelsFromFirebase();
    
    if (models.length > 0) {
      allModels.push(...models);
    } else {
    }
  } catch (error) {
  }
  
  return allModels;
}

/**
 * Get available models (with caching)
 */
async function getAvailableModels() {
  const now = Date.now();
  if (availableModels.length === 0 || (now - modelsCacheTime) > CACHE_DURATION) {
    availableModels = await fetchAvailableModels();
    modelsCacheTime = now;
  }
  return availableModels;
}

/**
 * Get original model ID from sanitized ID
 */
async function getOriginalModelId(sanitizedId) {
  try {
    // If it already contains a slash, it's likely already in the correct format
    if (sanitizedId.includes('/')) {
      return sanitizedId;
    }
    
    // Handle common model ID patterns
    if (sanitizedId.includes('-')) {
      const parts = sanitizedId.split('-');
      
      // Handle specific known patterns
      if (sanitizedId.startsWith('qwen-')) {
        return `qwen/${parts.slice(1).join('-')}`;
      } else if (sanitizedId.startsWith('openai-')) {
        return `openai/${parts.slice(1).join('-')}`;
      } else if (sanitizedId.startsWith('anthropic-')) {
        return `anthropic/${parts.slice(1).join('-')}`;
      } else if (sanitizedId.startsWith('meta-llama-')) {
        return `meta-llama/${parts.slice(2).join('-')}`;
      } else if (sanitizedId.startsWith('google-')) {
        return `google/${parts.slice(1).join('-')}`;
      } else if (sanitizedId.startsWith('stability-ai-')) {
        return `stability-ai/${parts.slice(2).join('-')}`;
      } else if (sanitizedId.startsWith('gpt-') || sanitizedId.startsWith('tts-')) {
        // These are OpenAI models without provider prefix - add openai/ prefix for OpenRouter
        return `openai/${sanitizedId}`;
      } else if (sanitizedId.startsWith('dall-e-')) {
        // DALL-E models are not supported by Fal.ai
        return sanitizedId;
      } else if (sanitizedId.startsWith('fal-ai-')) {
        // Convert Fal.ai sanitized IDs back to original format
        const modelName = sanitizedId.replace('fal-ai-', '');
        if (modelName === 'flux-dev') {
          return 'fal-ai/flux/dev';
        } else if (modelName === 'recraft-v3') {
          return 'fal-ai/recraft-v3';
        } else {
          return `fal-ai/${modelName}`;
        }
      } else {
        // Generic pattern: assume first part is provider
        return `${parts[0]}/${parts.slice(1).join('-')}`;
      }
    }
    
    return sanitizedId; // Return as-is if no conversion needed
  } catch (error) {
    return sanitizedId;
  }
}

/**
 * Call AI API with hybrid approach: Fal.ai for images, OpenRouter for text
 */
async function callHybridAI(model, prompt, temperature = 0.7) {
  try {
    // Determine if this is an image generation model
    const isImageModel = model.includes('flux') || model.includes('stable-diffusion') || model.includes('recraft');
    const isTextModel = model.includes('llama') || model.includes('mistral') || model.includes('codellama') || model.includes('gpt') || model.includes('claude') || model.includes('gemini');
    
    if (isImageModel) {
      // Image generation via Fal.ai
      
      // Get Fal.ai API key from environment variables
      const falApiKey = process.env.FAL_AI_API_KEY;
      if (!falApiKey) {
        throw new Error('Fal.ai API key is required for image generation. Please configure FAL_AI_API_KEY in Railway.');
      }
      
      // Convert sanitized model ID back to original format for Fal.ai
      const originalModelId = await getOriginalModelId(model);
      
      // Image models expect prompt at root level, not in input object
      const response = await makeAPIRequest('fal-ai', `/${originalModelId}`, {
        prompt: prompt,
        num_inference_steps: 20,
        guidance_scale: 7.5
      }, falApiKey);
      
      // Return the image URL
      return response.images?.[0]?.url || response.data?.[0]?.url || 'No image generated';
      
    } else if (isTextModel) {
      // Text generation via OpenRouter
      
      // Get OpenRouter API key from environment variables
      const openRouterApiKey = process.env.OPENROUTER_API_KEY;
      if (!openRouterApiKey) {
        throw new Error('OpenRouter API key is required for text generation. Please configure OPENROUTER_API_KEY in Railway.');
      }
      
      // Convert sanitized model ID back to original format for OpenRouter
      const originalModelId = await getOriginalModelId(model);
      console.log(`🤖 Text generation - Original model ID: ${originalModelId}`);
      
      // Text generation via OpenRouter
      const response = await makeAPIRequest('openrouter', '/chat/completions', {
        model: originalModelId,
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: temperature,
        max_tokens: 2000
      }, openRouterApiKey);
      
      return response.choices?.[0]?.message?.content || 'No response generated';
      
    } else {
      // Default to text generation via OpenRouter
      
      const openRouterApiKey = process.env.OPENROUTER_API_KEY;
      if (!openRouterApiKey) {
        throw new Error('OpenRouter API key is required for text generation. Please configure OPENROUTER_API_KEY in Railway.');
      }
      
      const originalModelId = await getOriginalModelId(model);
      
      const response = await makeAPIRequest('openrouter', '/chat/completions', {
        model: originalModelId,
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: temperature,
        max_tokens: 2000
      }, openRouterApiKey);
      
      return response.choices?.[0]?.message?.content || 'No response generated';
    }
    
  } catch (error) {
    throw error;
  }
}


/**
 * Resolve a request URL to a file path on disk. Defaults to index.html for the root.
 * @param {string} url The URL from the request.
 * @returns {string} Absolute file system path.
 */
function resolveFilePath(url) {
  let filePath = url;
  if (filePath === '/' || filePath === '') {
    filePath = '/index.html';
  }
  // Remove query string if present
  filePath = filePath.split('?')[0];
  return path.join(publicDir, filePath);
}

/**
 * Determine the correct Content-Type for a given file extension.
 * @param {string} filePath File path with extension.
 * @returns {string} MIME type string.
 */
function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html':
      return 'text/html';
    case '.js':
      return 'application/javascript';
    case '.css':
      return 'text/css';
    case '.json':
      return 'application/json';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Handle incoming HTTP requests.
 * For GET requests, serves files from the public directory.
 * For API requests, handles Fal.ai integration.
 */
const server = http.createServer(async (req, res) => {
  try {
    // Get client IP for rate limiting
    const clientIP = req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
    
    // Handle CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.statusCode = 200;
      res.end();
      return;
    }

    // Health check endpoint
    if (req.url === '/health') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.end(JSON.stringify({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        port: port
      }));
      return;
    }

    // Debug endpoint to check environment variables
    if (req.url === '/debug-env') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.end(JSON.stringify({
        FIREBASE_API_KEY: process.env.FIREBASE_API_KEY ? 'SET' : 'NOT SET',
        FIREBASE_API_KEY_VALUE: process.env.FIREBASE_API_KEY ? process.env.FIREBASE_API_KEY.substring(0, 10) + '...' : 'NOT SET',
        FAL_AI_API_KEY: process.env.FAL_AI_API_KEY ? 'SET' : 'NOT SET',
        OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ? 'SET' : 'NOT SET',
        NODE_ENV: process.env.NODE_ENV,
        allEnvKeys: Object.keys(process.env).filter(key => key.includes('FIREBASE') || key.includes('FAL_AI') || key.includes('OPENROUTER'))
      }));
      return;
    }

    // Firebase configuration endpoint - respond with dynamic config from environment, fallback to file
    if (req.url === '/firebase-config.js') {
      const envConfig = {
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN || 'cellulai.firebaseapp.com',
        projectId: process.env.FIREBASE_PROJECT_ID || 'cellulai',
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'cellulai.appspot.com',
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '857760697765',
        appId: process.env.FIREBASE_APP_ID || '1:857760697765:web:74605f6e0667d0feebec4c',
        measurementId: process.env.FIREBASE_MEASUREMENT_ID || 'G-NBGFZ6T90R'
      };

      const hasApiKey = typeof envConfig.apiKey === 'string' && envConfig.apiKey.trim().length > 0 && envConfig.apiKey !== 'YOUR_FIREBASE_API_KEY';

      if (hasApiKey) {
        const js = `// Served dynamically by server.js using environment variables\n` +
          `const firebaseConfig = ${JSON.stringify(envConfig)};\n` +
          `const app = firebase.initializeApp(firebaseConfig);\n` +
          `const auth = firebase.auth();\n` +
          `const db = firebase.firestore();\n` +
          `const storage = firebase.storage ? firebase.storage() : null;\n` +
          `window.auth = auth; window.db = db; window.storage = storage;`;
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/javascript');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(js);
        return;
      }

      // Fallback to static file if env not set
      const filePath = path.join(publicDir, 'firebase-config.js');
      fs.readFile(filePath, (err, content) => {
        if (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'text/plain');
          res.end('Firebase config not available');
          return;
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/javascript');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(content);
      });
      return;
    }

    // Rate limiting for API endpoints
    if (req.url.startsWith('/api/') && !checkRateLimit(clientIP)) {
      handleError(res, 429, 'Rate limit exceeded. Please try again later.');
      return;
    }

  // Handle API endpoints
  if (req.url === '/api/models') {
    try {
      const models = await getAvailableModels();
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ models }));
    } catch (error) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  // Database API endpoints
  if (req.url === '/api/sheets') {
    try {
      const sheets = await getSheets();
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ sheets }));
    } catch (error) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  if (req.url.startsWith('/api/sheets/') && req.method === 'GET') {
    try {
      const sheetId = parseInt(req.url.split('/')[3]);
      const cells = await getSheetCells(sheetId);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ cells }));
    } catch (error) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  if (req.url === '/api/sheets' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const sheetId = await createSheet(data.name);
        res.statusCode = 201;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ id: sheetId, name: data.name }));
      } catch (error) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: error.message }));
      }
    });
    return;
  }

  if (req.url.startsWith('/api/sheets/') && req.method === 'DELETE') {
    try {
      const sheetId = parseInt(req.url.split('/')[3]);
      await deleteSheet(sheetId);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true }));
    } catch (error) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  if (req.url.startsWith('/api/sheets/') && req.method === 'PUT') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const sheetId = parseInt(req.url.split('/')[3]);
        const data = JSON.parse(body);
        await renameSheet(sheetId, data.name);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true }));
      } catch (error) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: error.message }));
      }
    });
    return;
  }

  if (req.url === '/api/save-cell' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        await saveCell(
          data.sheetId, 
          data.cellId, 
          data.prompt, 
          data.output, 
          data.model || 'gpt-3.5-turbo', 
          data.temperature || 0.7
        );
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true }));
      } catch (error) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: error.message }));
      }
    });
    return;
  }

  if (req.url === '/api/update-sheet-dimensions' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        await updateSheetDimensions(data.sheetId, data.numRows, data.numCols);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true }));
      } catch (error) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: error.message }));
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/llm') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      // Avoid overly large request bodies
      if (body.length > 1e7) req.connection.destroy();
    });
    req.on('end', async () => {
      try {
        // Circuit breaker - prevent multiple concurrent API requests
        if (apiRequestInProgress) {
          console.log(`🚫 API request already in progress, rejecting new request`);
          res.statusCode = 429;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'API request already in progress. Please wait.' }));
          return;
        }
        
        apiRequestInProgress = true;
        console.log(`🔒 Circuit breaker: API request started`);
        
        const data = JSON.parse(body || '{}');
        const prompt = data.prompt || '';
        const model = data.model || 'gpt-3.5-turbo';
        const temperature = data.temperature || 0.7;
        
        console.log(`🚀 API Request - Model: ${model}, Prompt: ${prompt.substring(0, 50)}...`);
        
        // Call Hybrid AI API (Fal.ai for images, OpenRouter for text)
        const responseText = await callHybridAI(model, prompt, temperature);
        
        console.log(`✅ AI Generation Success - Response: ${responseText.substring(0, 100)}...`);
        
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ text: responseText }));
        
        // Reset circuit breaker on success
        apiRequestInProgress = false;
        console.log(`🔓 Circuit breaker: API request completed successfully`);
      } catch (err) {
        console.log(`❌ AI Generation Error:`, err.message);
        console.log(`❌ Error Stack:`, err.stack);
        
        // Reset circuit breaker on error
        apiRequestInProgress = false;
        console.log(`🔓 Circuit breaker: API request failed, resetting`);
        
        // Handle different types of errors gracefully
        let errorMessage = 'An error occurred while processing your request';
        let statusCode = 500;
        
        if (err.message.includes('API key')) {
          errorMessage = 'API configuration error. Please check your API keys.';
          statusCode = 400;
        } else if (err.message.includes('rate limit') || err.message.includes('429')) {
          errorMessage = 'Rate limit exceeded. Please try again later.';
          statusCode = 429;
        } else if (err.message.includes('authentication') || err.message.includes('401')) {
          errorMessage = 'Authentication failed. Please check your API keys.';
          statusCode = 401;
        }
        
        res.statusCode = statusCode;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: errorMessage }));
      }
    });
    return;
  }

  // Serve static files for GET requests
  if (req.method === 'GET' || req.method === 'HEAD') {
    const filePath = resolveFilePath(req.url);
    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Not Found');
        return;
      }
      const contentType = getContentType(filePath);
      res.statusCode = 200;
      res.setHeader('Content-Type', contentType);
      if (req.method === 'HEAD') {
        res.end();
      } else {
        res.end(content);
      }
    });
    return;
  }

    // For any other methods or routes, return 405 Method Not Allowed
    res.statusCode = 405;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Method Not Allowed');
  } catch (error) {
    handleError(res, 500, 'Internal server error', error);
  }
});

// Note: API endpoints for models are handled in the main server request handler

// Start the server
async function startServer() {
  try {
    // Initialize Firebase for cloud deployment
    const firebaseResult = await initializeFirebase();
    if (firebaseResult === null) {
      console.log('⚠️ Firebase Admin SDK not initialized, but server will continue');
    }
    
    // Initialize local development mode
    await initializeLocalDev();
    
    // Initialize database
    await initializeDatabase();
    
    server.listen(port, () => {
      console.log(`🚀 Server running on port ${port}`);
      console.log(`📊 Health check available at http://localhost:${port}/health`);
    });

    server.on('error', (error) => {
      console.error('❌ Server error:', error);
      process.exit(1);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();