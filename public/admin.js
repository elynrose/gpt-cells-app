// Admin Dashboard JavaScript
// Global variables
let currentAdminUser = null;
let isAdminAuthenticated = false;
let adminData = {
    users: [],
    projects: [],
    models: [],
    subscriptions: [],
    payments: []
};

// Fal.ai configuration
let falAIConfig = {
    apiKey: null,
    baseUrl: 'https://fal.run',
    enabled: false
};

let openRouterConfig = {
    apiKey: null,
    baseUrl: 'https://openrouter.ai/api/v1',
    enabled: false
};

// Firebase services (will be available after firebase-config.js loads)
let adminDb, adminAuth;

// Initialize admin dashboard
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 Initializing Admin Dashboard...');
    
    // Wait for Firebase to be available
    setTimeout(() => {
        console.log('🔍 Checking Firebase availability...');
        console.log('Firebase available:', typeof firebase !== 'undefined');
        console.log('authService available:', typeof authService !== 'undefined');
        console.log('adminService available:', typeof adminService !== 'undefined');
        
        if (typeof firebase !== 'undefined') {
            adminDb = firebase.firestore();
            adminAuth = firebase.auth();
            console.log('✅ Firebase services initialized');
            checkAdminAuthentication();
            loadFalAIConfig();
            loadOpenRouterConfig();
        } else {
            console.error('❌ Firebase not available');
            showError('Firebase not loaded. Please refresh the page.');
        }
    }, 1000);
});

// Check if user is admin and authenticate
async function checkAdminAuthentication() {
    try {
        console.log('🔍 Checking admin authentication...');
        
        // Check if user is logged in
        const user = authService.getCurrentUser();
        if (!user) {
            console.log('❌ No user logged in');
            showError('Please log in to access admin panel');
            setTimeout(() => {
                window.location.href = '/login.html';
            }, 2000);
            return;
        }

        // Check if user is admin
        const isAdmin = await authService.isCurrentUserAdmin();
        if (!isAdmin) {
            console.log('❌ User is not admin');
            showError('Access denied. Admin privileges required.');
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);
            return;
        }

        console.log('✅ Admin authentication successful');
        currentAdminUser = user;
        isAdminAuthenticated = true;
        
        // Update UI
        document.getElementById('adminUserInfo').textContent = `Welcome, ${user.email}`;
        
        // Load initial data
        await loadDashboardData();
        
    } catch (error) {
        console.error('❌ Admin authentication error:', error);
        showError('Authentication failed. Please try again.');
    }
}

// Load dashboard data
async function loadDashboardData() {
    try {
        console.log('📊 Loading dashboard data...');
        
        // Load all data in parallel
        await Promise.all([
            loadUsers(),
            loadProjects(),
            loadModels(),
            loadSubscriptions(),
            loadPayments()
        ]);
        
        // Update dashboard stats
        updateDashboardStats();
        
        // Load recent activity
        loadRecentActivity();
        
        console.log('✅ Dashboard data loaded successfully');
        
    } catch (error) {
        console.error('❌ Error loading dashboard data:', error);
        showError('Failed to load dashboard data');
    }
}

// Update dashboard statistics
function updateDashboardStats() {
    document.getElementById('totalUsers').textContent = adminData.users.length;
    document.getElementById('totalProjects').textContent = adminData.projects.length;
    document.getElementById('totalModels').textContent = adminData.models.length;
    
    // Calculate total revenue
    const totalRevenue = adminData.payments
        .filter(payment => payment.status === 'completed')
        .reduce((sum, payment) => sum + (payment.amount || 0), 0);
    
    document.getElementById('totalRevenue').textContent = `$${totalRevenue.toFixed(2)}`;
}

// Load users data
async function loadUsers() {
    try {
        console.log('👥 Loading users...');
        
        // Use adminService if available, otherwise fallback to direct db calls
        if (typeof adminService !== 'undefined') {
            const result = await adminService.getAllUsers();
            if (result.success) {
                adminData.users = result.data;
                console.log(`✅ Loaded ${adminData.users.length} users via adminService`);
            } else {
                throw new Error(result.error);
            }
        } else {
            // Fallback to direct db calls
            const usersSnapshot = await adminDb.collection('users').get();
            adminData.users = [];
            
            usersSnapshot.forEach(doc => {
                const userData = doc.data();
                adminData.users.push({
                    id: doc.id,
                    ...userData
                });
            });
            console.log(`✅ Loaded ${adminData.users.length} users via direct db`);
        }
        
        renderUsersTable();
        
    } catch (error) {
        console.error('❌ Error loading users:', error);
        showError('Failed to load users: ' + error.message);
    }
}

// Render users table
function renderUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    
    if (adminData.users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #7f8c8d;">No users found</td></tr>';
        return;
    }
    
    tbody.innerHTML = adminData.users.map(user => `
        <tr>
            <td>
                <div style="display: flex; align-items: center;">
                    <div style="width: 40px; height: 40px; background: #3498db; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; margin-right: 10px;">
                        ${user.displayName ? user.displayName.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div style="font-weight: 600;">${user.displayName || 'No Name'}</div>
                        <div style="font-size: 12px; color: #7f8c8d;">ID: ${user.id}</div>
                    </div>
                </div>
            </td>
            <td>${user.email}</td>
            <td>
                <span class="status-badge ${user.role === 'admin' ? 'status-premium' : 'status-free'}">
                    ${user.role || 'user'}
                </span>
            </td>
            <td>
                <span class="status-badge ${user.isActive !== false ? 'status-active' : 'status-inactive'}">
                    ${user.isActive !== false ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td>${user.createdAt ? new Date(user.createdAt.seconds * 1000).toLocaleDateString() : 'Unknown'}</td>
            <td>
                <button class="btn btn-primary" onclick="editUser('${user.id}')" style="margin-right: 5px;">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-danger" onclick="deleteUser('${user.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// Load projects data
async function loadProjects() {
    try {
        console.log('📁 Loading projects...');
        
        const projectsSnapshot = await db.collection('users').get();
        adminData.projects = [];
        
        for (const userDoc of projectsSnapshot.docs) {
            const userProjectsSnapshot = await db.collection('users').doc(userDoc.id).collection('projects').get();
            
            userProjectsSnapshot.forEach(projectDoc => {
                const projectData = projectDoc.data();
                adminData.projects.push({
                    id: projectDoc.id,
                    userId: userDoc.id,
                    userEmail: userDoc.data().email,
                    ...projectData
                });
            });
        }
        
        console.log(`✅ Loaded ${adminData.projects.length} projects`);
        renderProjectsTable();
        
    } catch (error) {
        console.error('❌ Error loading projects:', error);
        showError('Failed to load projects');
    }
}

// Render projects table
function renderProjectsTable() {
    const tbody = document.getElementById('projectsTableBody');
    if (!tbody) return;
    
    if (adminData.projects.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #7f8c8d;">No projects found</td></tr>';
        return;
    }
    
    tbody.innerHTML = adminData.projects.map(project => `
        <tr>
            <td>
                <div style="font-weight: 600;">${project.name || 'Unnamed Project'}</div>
                <div style="font-size: 12px; color: #7f8c8d;">ID: ${project.id}</div>
            </td>
            <td>${project.userEmail || 'Unknown'}</td>
            <td>${project.sheets ? Object.keys(project.sheets).length : 0}</td>
            <td>${project.createdAt ? new Date(project.createdAt.seconds * 1000).toLocaleDateString() : 'Unknown'}</td>
            <td>
                <span class="status-badge ${project.status === 'archived' ? 'status-inactive' : 'status-active'}">
                    ${project.status || 'Active'}
                </span>
            </td>
            <td>
                <button class="btn btn-primary" onclick="editProject('${project.id}')" style="margin-right: 5px;">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-danger" onclick="deleteProject('${project.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// Load models data
async function loadModels() {
    try {
        console.log('🧠 Loading models...');
        
        const modelsSnapshot = await adminDb.collection('models').get();
        adminData.models = [];
        
        modelsSnapshot.forEach(doc => {
            const modelData = doc.data();
            adminData.models.push({
                id: doc.id,
                ...modelData
            });
        });
        
        console.log(`✅ Loaded ${adminData.models.length} models`);
        renderModelsTable();
        
    } catch (error) {
        console.error('❌ Error loading models:', error);
        showError('Failed to load models');
    }
}

// Get only active models (for main app use)
function getActiveModels() {
    return adminData.models.filter(model => 
        model.status === 'active' || model.isActive === true
    );
}

// Get models by type and status
function getModelsByTypeAndStatus(type = null, status = 'active') {
    let filteredModels = adminData.models;
    
    if (type) {
        filteredModels = filteredModels.filter(model => model.type === type);
    }
    
    if (status) {
        filteredModels = filteredModels.filter(model => 
            model.status === status || (status === 'active' && model.isActive === true)
        );
    }
    
    return filteredModels;
}

// Filter models in the admin table
function filterModels() {
    const searchTerm = document.getElementById('modelSearch')?.value.toLowerCase() || '';
    const typeFilter = document.getElementById('modelTypeFilter')?.value || '';
    const providerFilter = document.getElementById('modelProviderFilter')?.value || '';
    const statusFilter = document.getElementById('modelStatusFilter')?.value || '';
    
    let filteredModels = adminData.models;
    
    // Search filter
    if (searchTerm) {
        filteredModels = filteredModels.filter(model => 
            model.name.toLowerCase().includes(searchTerm) ||
            model.id.toLowerCase().includes(searchTerm) ||
            model.description.toLowerCase().includes(searchTerm)
        );
    }
    
    // Type filter
    if (typeFilter) {
        filteredModels = filteredModels.filter(model => model.type === typeFilter);
    }
    
    // Provider filter
    if (providerFilter) {
        filteredModels = filteredModels.filter(model => model.provider === providerFilter);
    }
    
    // Status filter
    if (statusFilter) {
        filteredModels = filteredModels.filter(model => {
            if (statusFilter === 'active') {
                return model.status === 'active' || model.isActive === true;
            } else if (statusFilter === 'inactive') {
                return model.status === 'inactive' || model.isActive === false;
            }
            return true;
        });
    }
    
    // Render filtered results
    renderFilteredModelsTable(filteredModels);
}

// Fal.ai API functions
async function fetchFalAIModels() {
    try {
        if (!falAIConfig.apiKey) {
            throw new Error('Fal.ai API key not configured');
        }

        console.log('🔄 Fetching models from Fal.ai...');
        
        // Fal.ai doesn't have a models endpoint, so we'll use our predefined models
        // Only include working image generation models (text models don't work on Fal.ai)
        const falAIModels = [
            {
                id: 'fal-ai/flux/dev',
                name: 'FLUX Dev',
                description: 'High-quality image generation model',
                provider: 'fal-ai',
                type: 'image'
            },
            {
                id: 'fal-ai/recraft-v3',
                name: 'Recraft V3',
                description: 'Vector art and image generation model',
                provider: 'fal-ai',
                type: 'image'
            }
        ];
        
        console.log(`✅ Fetched ${falAIModels.length} models from Fal.ai`);
        return falAIModels;
    } catch (error) {
        console.error('❌ Error fetching Fal.ai models:', error);
        throw error;
    }
}

async function fetchOpenRouterModels() {
    try {
        if (!openRouterConfig.apiKey) {
            throw new Error('OpenRouter API key not configured');
        }
        
        console.log('🔄 Fetching models from OpenRouter...');
        
        // OpenRouter models for text generation
        const openRouterModels = [
            // OpenAI models
            { id: 'openai/gpt-4', name: 'GPT-4', description: 'Most advanced GPT-4 model', provider: 'openrouter', type: 'text' },
            { id: 'openai/gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Fast and efficient model', provider: 'openrouter', type: 'text' },
            { id: 'openai/gpt-4o', name: 'GPT-4o', description: 'Latest GPT-4 model', provider: 'openrouter', type: 'text' },
            
            // Anthropic models
            { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', description: 'Advanced reasoning model', provider: 'openrouter', type: 'text' },
            { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku', description: 'Fast and efficient Claude model', provider: 'openrouter', type: 'text' },
            
            // Meta models
            { id: 'meta-llama/llama-3.1-8b-instruct', name: 'Llama 3.1 8B', description: 'Fast and efficient text model', provider: 'openrouter', type: 'text' },
            { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B', description: 'More capable text model', provider: 'openrouter', type: 'text' },
            
            // Google models
            { id: 'google/gemini-pro', name: 'Gemini Pro', description: 'Google\'s advanced AI model', provider: 'openrouter', type: 'text' },
            { id: 'google/gemini-pro-vision', name: 'Gemini Pro Vision', description: 'Google\'s multimodal AI model', provider: 'openrouter', type: 'text' }
        ];
        
        console.log(`✅ Fetched ${openRouterModels.length} models from OpenRouter`);
        return openRouterModels;
        
    } catch (error) {
        console.error('❌ Error fetching OpenRouter models:', error);
        throw error;
    }
}

async function syncOpenRouterModels() {
    try {
        console.log('🔄 Syncing OpenRouter models...');
        const openRouterModels = await fetchOpenRouterModels();
        const syncedModels = [];
        
        for (const model of openRouterModels) {
            const sanitizedId = model.id.replace(/\//g, '-');
            const modelData = {
                id: sanitizedId,
                originalId: model.id,
                name: model.name,
                description: model.description || `Model: ${model.name}`,
                provider: model.provider || 'openrouter',
                type: model.type || 'text',
                contextLength: null,
                pricing: { prompt: null, completion: null },
                source: 'openrouter',
                status: 'inactive',
                isActive: false,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            const existingModel = adminData.models.find(m => m.id === sanitizedId);
            if (existingModel) {
                // Update existing model
                await adminDb.collection('models').doc(sanitizedId).update({
                    name: modelData.name,
                    description: modelData.description,
                    provider: modelData.provider,
                    type: modelData.type,
                    source: modelData.source,
                    updatedAt: modelData.updatedAt
                });
                console.log(`✅ Updated model: ${model.name} (ID: ${sanitizedId})`);
            } else {
                // Add new model
                await adminDb.collection('models').doc(sanitizedId).set(modelData);
                console.log(`✅ Added new model: ${model.name} (ID: ${sanitizedId})`);
            }
            
            syncedModels.push(modelData);
        }
        
        showSuccess(`Successfully synced ${syncedModels.length} models from OpenRouter`);
        await loadModels();
        
    } catch (error) {
        console.error('❌ Error syncing OpenRouter models:', error);
        showError('Failed to sync OpenRouter models: ' + error.message);
    }
}

async function syncFalAIModels() {
    try {
        console.log('🔄 Syncing Fal.ai models...');
        
        const falAIModels = await fetchFalAIModels();
        const syncedModels = [];
        
        for (const model of falAIModels) {
            // Sanitize model ID for Firestore (replace / with -)
            const sanitizedId = model.id.replace(/\//g, '-');
            
            // Transform Fal.ai model data to our format
            const modelData = {
                id: sanitizedId, // Use sanitized ID for Firestore document ID
                originalId: model.id, // Keep original ID for reference
                name: model.name,
                description: model.description || `Model: ${model.name}`,
                provider: model.provider || 'fal-ai',
                type: model.type || categorizeModelType(model.name, model.description),
                contextLength: null, // Fal.ai doesn't provide context length
                pricing: {
                    prompt: null,
                    completion: null
                },
                source: 'fal-ai',
                status: 'inactive', // Default to inactive, admin can enable
                isActive: false, // Keep for backward compatibility
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            // Check if model already exists (using sanitized ID)
            const existingModel = adminData.models.find(m => m.id === sanitizedId);
            
            if (existingModel) {
                // Update existing model with Fal.ai data
                await adminDb.collection('models').doc(sanitizedId).update({
                    name: modelData.name,
                    description: modelData.description,
                    provider: modelData.provider,
                    type: modelData.type,
                    contextLength: modelData.contextLength,
                    pricing: modelData.pricing,
                    source: modelData.source,
                    status: modelData.status,
                    originalId: modelData.originalId,
                    updatedAt: modelData.updatedAt
                });
                console.log(`✅ Updated model: ${model.name} (ID: ${sanitizedId})`);
            } else {
                // Create new model
                await adminDb.collection('models').doc(sanitizedId).set(modelData);
                console.log(`✅ Added new model: ${model.name} (ID: ${sanitizedId})`);
            }
            
            syncedModels.push(modelData);
        }
        
        showSuccess(`Successfully synced ${syncedModels.length} models from Fal.ai`);
        
        // Reload models to show updated data
        await loadModels();
        
    } catch (error) {
        console.error('❌ Error syncing Fal.ai models:', error);
        showError('Failed to sync Fal.ai models: ' + error.message);
    }
}

function categorizeModelType(name, description) {
    const nameLower = name.toLowerCase();
    const descLower = (description || '').toLowerCase();
    
    // Image generation models
    if (nameLower.includes('dall-e') || nameLower.includes('midjourney') || nameLower.includes('stable-diffusion')) {
        return 'image';
    }
    
    // Audio models
    if (nameLower.includes('whisper') || nameLower.includes('tts') || nameLower.includes('audio')) {
        return 'audio';
    }
    
    // Video models
    if (nameLower.includes('video') || nameLower.includes('sora') || nameLower.includes('runway')) {
        return 'video';
    }
    
    // Code models
    if (nameLower.includes('code') || nameLower.includes('claude') || nameLower.includes('gpt-4')) {
        return 'code';
    }
    
    // Default to text
    return 'text';
}

async function loadFalAIConfig() {
    try {
        const configDoc = await adminDb.collection('admin').doc('fal-ai-config').get();
        if (configDoc.exists) {
            const config = configDoc.data();
            falAIConfig.apiKey = config.apiKey;
            falAIConfig.enabled = config.enabled;
            console.log('✅ Fal.ai configuration loaded');
        } else {
            console.log('ℹ️ No Fal.ai configuration found');
        }
    } catch (error) {
        console.error('❌ Error loading Fal.ai config:', error);
    }
}

async function loadOpenRouterConfig() {
    try {
        const configDoc = await adminDb.collection('admin').doc('openrouter-config').get();
        if (configDoc.exists) {
            const config = configDoc.data();
            openRouterConfig.apiKey = config.apiKey;
            openRouterConfig.enabled = config.enabled;
            console.log('✅ OpenRouter configuration loaded');
        } else {
            console.log('ℹ️ No OpenRouter configuration found');
        }
    } catch (error) {
        console.error('❌ Error loading OpenRouter config:', error);
    }
}

async function configureFalAI() {
    const apiKey = prompt('Enter your Fal.ai API key:');
    if (!apiKey) {
        showError('API key is required');
        return;
    }
    
    try {
        // Test the API key
        falAIConfig.apiKey = apiKey;
        await fetchFalAIModels();
        
        // Save to Firestore
        await adminDb.collection('admin').doc('fal-ai-config').set({
            apiKey: apiKey,
            enabled: true,
            updatedAt: new Date()
        });
        
        falAIConfig.enabled = true;
        showSuccess('Fal.ai configuration saved successfully!');
        
    } catch (error) {
        console.error('❌ Error configuring Fal.ai:', error);
        showError('Invalid API key or connection failed: ' + error.message);
        falAIConfig.apiKey = null;
    }
}

async function configureOpenRouter() {
    const apiKey = prompt('Enter your OpenRouter API key:');
    if (!apiKey) {
        showError('API key is required');
        return;
    }
    
    try {
        // Test the API key
        openRouterConfig.apiKey = apiKey;
        await fetchOpenRouterModels();
        
        // Save to Firestore
        await adminDb.collection('admin').doc('openrouter-config').set({
            apiKey: apiKey,
            enabled: true,
            updatedAt: new Date()
        });
        
        openRouterConfig.enabled = true;
        showSuccess('OpenRouter configuration saved successfully!');
        
    } catch (error) {
        console.error('❌ Error configuring OpenRouter:', error);
        showError('Invalid API key or connection failed: ' + error.message);
        openRouterConfig.apiKey = null;
    }
}

// Render models table
function renderModelsTable() {
    const tbody = document.getElementById('modelsTableBody');
    if (!tbody) return;
    
    if (adminData.models.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #7f8c8d;">No models found</td></tr>';
        return;
    }
    
    tbody.innerHTML = adminData.models.map(model => `
        <tr>
            <td>
                <div style="font-weight: 600;">${model.id}</div>
                ${model.originalId ? `<div style="font-size: 11px; color: #666; margin-top: 2px;">Original: ${model.originalId}</div>` : ''}
            </td>
            <td>${model.name || 'Unnamed Model'}</td>
            <td>
                <span class="status-badge ${getModelTypeColor(model.type)}">
                    ${model.type || 'text'}
                </span>
            </td>
            <td>${model.provider || 'Unknown'}</td>
            <td>
                <label class="switch">
                    <input type="checkbox" ${(model.isActive || model.status === 'active') ? 'checked' : ''} 
                           onchange="toggleModelActive('${model.id}', this.checked)">
                    <span class="slider"></span>
                </label>
            </td>
            <td>
                <span class="status-badge ${(model.status === 'active' || model.isActive) ? 'status-active' : 'status-inactive'}">
                    ${model.status || (model.isActive ? 'active' : 'inactive')}
                </span>
            </td>
            <td>
                <button class="btn btn-primary" onclick="editModel('${model.id}')" style="margin-right: 5px;">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-danger" onclick="deleteModel('${model.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// Render filtered models table
function renderFilteredModelsTable(models) {
    const tbody = document.getElementById('modelsTableBody');
    if (!tbody) return;
    
    if (models.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #7f8c8d;">No models found matching your filters</td></tr>';
        return;
    }
    
    tbody.innerHTML = models.map(model => `
        <tr>
            <td>
                <div style="font-weight: 600;">${model.id}</div>
                ${model.originalId ? `<div style="font-size: 11px; color: #666; margin-top: 2px;">Original: ${model.originalId}</div>` : ''}
            </td>
            <td>${model.name || 'Unnamed Model'}</td>
            <td>
                <span class="status-badge ${getModelTypeColor(model.type)}">
                    ${model.type || 'text'}
                </span>
            </td>
            <td>${model.provider || 'Unknown'}</td>
            <td>
                <label class="switch">
                    <input type="checkbox" ${(model.isActive || model.status === 'active') ? 'checked' : ''} 
                           onchange="toggleModelActive('${model.id}', this.checked)">
                    <span class="slider"></span>
                </label>
            </td>
            <td>
                <span class="status-badge ${(model.status === 'active' || model.isActive) ? 'status-active' : 'status-inactive'}">
                    ${model.status || (model.isActive ? 'active' : 'inactive')}
                </span>
            </td>
            <td>
                <button class="btn btn-primary" onclick="editModel('${model.id}')" style="margin-right: 5px;">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-danger" onclick="deleteModel('${model.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

async function toggleModelActive(modelId, isActive) {
    try {
        const status = isActive ? 'active' : 'inactive';
        
        await adminDb.collection('models').doc(modelId).update({
            status: status,
            isActive: isActive, // Keep for backward compatibility
            updatedAt: new Date()
        });
        
        // Update local data
        const model = adminData.models.find(m => m.id === modelId);
        if (model) {
            model.status = status;
            model.isActive = isActive;
        }
        
        console.log(`✅ Model ${modelId} ${isActive ? 'enabled' : 'disabled'} (status: ${status})`);
        
    } catch (error) {
        console.error('❌ Error toggling model active status:', error);
        showError('Failed to update model status');
        
        // Revert checkbox state
        const checkbox = document.querySelector(`input[onchange*="${modelId}"]`);
        if (checkbox) {
            checkbox.checked = !isActive;
        }
    }
}

// Load subscriptions data
async function loadSubscriptions() {
    try {
        console.log('👑 Loading subscriptions...');
        
        const usersSnapshot = await db.collection('users').get();
        adminData.subscriptions = [];
        
        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            adminData.subscriptions.push({
                userId: doc.id,
                userEmail: userData.email,
                plan: userData.subscription || 'free',
                status: userData.subscriptionStatus || 'active',
                startDate: userData.subscriptionStartDate,
                endDate: userData.subscriptionEndDate
            });
        });
        
        console.log(`✅ Loaded ${adminData.subscriptions.length} subscriptions`);
        renderSubscriptionsTable();
        
    } catch (error) {
        console.error('❌ Error loading subscriptions:', error);
        showError('Failed to load subscriptions');
    }
}

// Render subscriptions table
function renderSubscriptionsTable() {
    const tbody = document.getElementById('subscriptionsTableBody');
    if (!tbody) return;
    
    if (adminData.subscriptions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #7f8c8d;">No subscription plans found</td></tr>';
        return;
    }
    
    tbody.innerHTML = adminData.subscriptions.map(subscription => `
        <tr>
            <td>${subscription.planName || 'Unknown Plan'}</td>
            <td>$${subscription.price || '0'}</td>
            <td>${subscription.interval || 'monthly'}</td>
            <td>${subscription.features ? (Array.isArray(subscription.features) ? subscription.features.join(', ') : subscription.features) : 'No features listed'}</td>
            <td>
                <span class="status-badge ${subscription.isActive ? 'status-active' : 'status-inactive'}">
                    ${subscription.isActive ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td>
                <button class="btn btn-primary" onclick="editSubscription('${subscription.id}')" style="margin-right: 5px;">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-danger" onclick="deleteSubscription('${subscription.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// Load payments data
async function loadPayments() {
    try {
        console.log('💳 Loading payments...');
        
        // For now, create mock payment data
        // In a real app, this would come from a payments collection or Stripe webhook data
        adminData.payments = [
            {
                id: 'pay_001',
                userId: 'user_001',
                userEmail: 'user@example.com',
                amount: 29.99,
                status: 'completed',
                date: new Date(),
                description: 'Premium Subscription'
            },
            {
                id: 'pay_002',
                userId: 'user_002',
                userEmail: 'admin@example.com',
                amount: 99.99,
                status: 'completed',
                date: new Date(Date.now() - 86400000),
                description: 'Enterprise Subscription'
            }
        ];
        
        console.log(`✅ Loaded ${adminData.payments.length} payments`);
        renderPaymentsTable();
        
    } catch (error) {
        console.error('❌ Error loading payments:', error);
        showError('Failed to load payments');
    }
}

// Render payments table
function renderPaymentsTable() {
    const tbody = document.getElementById('paymentsTableBody');
    if (!tbody) return;
    
    if (adminData.payments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #7f8c8d;">No payments found</td></tr>';
        return;
    }
    
    tbody.innerHTML = adminData.payments.map(payment => `
        <tr>
            <td>
                <div style="font-weight: 600;">${payment.id}</div>
            </td>
            <td>${payment.userEmail}</td>
            <td>$${payment.amount.toFixed(2)}</td>
            <td>
                <span class="status-badge ${getPaymentStatusColor(payment.status)}">
                    ${payment.status}
                </span>
            </td>
            <td>${new Date(payment.date).toLocaleDateString()}</td>
            <td>
                <button class="btn btn-primary" onclick="viewPayment('${payment.id}')" style="margin-right: 5px;">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-warning" onclick="refundPayment('${payment.id}')">
                    <i class="fas fa-undo"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// Load recent activity
async function loadRecentActivity() {
    try {
        console.log('📈 Loading recent activity...');
        
        const activityContainer = document.getElementById('recentActivity');
        if (!activityContainer) return;
        
        // Mock recent activity data
        const recentActivity = [
            { type: 'user', message: 'New user registered: john@example.com', time: '2 minutes ago' },
            { type: 'project', message: 'Project "Marketing Campaign" created', time: '15 minutes ago' },
            { type: 'payment', message: 'Payment received: $29.99', time: '1 hour ago' },
            { type: 'model', message: 'New AI model added: GPT-4 Turbo', time: '2 hours ago' },
            { type: 'subscription', message: 'User upgraded to Premium plan', time: '3 hours ago' }
        ];
        
        activityContainer.innerHTML = recentActivity.map(activity => `
            <div style="display: flex; align-items: center; padding: 10px; border-bottom: 1px solid #ecf0f1;">
                <div style="width: 8px; height: 8px; background: ${getActivityTypeColor(activity.type)}; border-radius: 50%; margin-right: 10px;"></div>
                <div style="flex: 1;">
                    <div style="font-size: 14px;">${activity.message}</div>
                    <div style="font-size: 12px; color: #7f8c8d;">${activity.time}</div>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('❌ Error loading recent activity:', error);
    }
}

// Navigation functions
function showSection(sectionId) {
    console.log('🔧 Showing section:', sectionId);
    
    // Hide all sections
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(section => section.classList.remove('active'));
    
    // Show selected section
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
        console.log('✅ Section shown:', sectionId);
    } else {
        console.error('❌ Section not found:', sectionId);
    }
    
    // Update navigation
    const navLinks = document.querySelectorAll('.admin-nav a');
    navLinks.forEach(link => link.classList.remove('active'));
    
    const activeLink = document.querySelector(`[onclick="showSection('${sectionId}')"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }
    
    // Update title
    const titles = {
        'dashboard': 'Dashboard',
        'users': 'User Management',
        'projects': 'Project Management',
        'models': 'AI Model Management',
        'subscriptions': 'Subscription Management',
        'payments': 'Payment Management',
        'analytics': 'Analytics',
        'settings': 'System Settings'
    };
    
    const titleElement = document.getElementById('adminTitle');
    if (titleElement) {
        titleElement.textContent = titles[sectionId] || 'Admin Panel';
    }
}

// Filter functions
function filterUsers() {
    const searchTerm = document.getElementById('userSearch').value.toLowerCase();
    const statusFilter = document.getElementById('userStatusFilter').value;
    const roleFilter = document.getElementById('userRoleFilter').value;
    
    const filteredUsers = adminData.users.filter(user => {
        const matchesSearch = user.email.toLowerCase().includes(searchTerm) ||
                            (user.displayName && user.displayName.toLowerCase().includes(searchTerm));
        const matchesStatus = !statusFilter || (statusFilter === 'active' ? user.isActive !== false : user.isActive === false);
        const matchesRole = !roleFilter || user.role === roleFilter;
        
        return matchesSearch && matchesStatus && matchesRole;
    });
    
    // Temporarily update the data for rendering
    const originalUsers = adminData.users;
    adminData.users = filteredUsers;
    renderUsersTable();
    adminData.users = originalUsers;
}

function filterProjects() {
    const searchTerm = document.getElementById('projectSearch').value.toLowerCase();
    const statusFilter = document.getElementById('projectStatusFilter').value;
    
    const filteredProjects = adminData.projects.filter(project => {
        const matchesSearch = (project.name && project.name.toLowerCase().includes(searchTerm)) ||
                            (project.userEmail && project.userEmail.toLowerCase().includes(searchTerm));
        const matchesStatus = !statusFilter || project.status === statusFilter;
        
        return matchesSearch && matchesStatus;
    });
    
    const originalProjects = adminData.projects;
    adminData.projects = filteredProjects;
    renderProjectsTable();
    adminData.projects = originalProjects;
}

function filterModels() {
    const searchTerm = document.getElementById('modelSearch').value.toLowerCase();
    const typeFilter = document.getElementById('modelTypeFilter').value;
    const providerFilter = document.getElementById('modelProviderFilter').value;
    
    const filteredModels = adminData.models.filter(model => {
        const matchesSearch = model.id.toLowerCase().includes(searchTerm) ||
                            (model.name && model.name.toLowerCase().includes(searchTerm));
        const matchesType = !typeFilter || model.type === typeFilter;
        const matchesProvider = !providerFilter || model.provider === providerFilter;
        
        return matchesSearch && matchesType && matchesProvider;
    });
    
    const originalModels = adminData.models;
    adminData.models = filteredModels;
    renderModelsTable();
    adminData.models = originalModels;
}

function filterSubscriptions() {
    const searchTerm = document.getElementById('subscriptionSearch').value.toLowerCase();
    const planFilter = document.getElementById('subscriptionPlanFilter').value;
    
    const filteredSubscriptions = adminData.subscriptions.filter(subscription => {
        const matchesSearch = subscription.userEmail.toLowerCase().includes(searchTerm);
        const matchesPlan = !planFilter || subscription.plan === planFilter;
        
        return matchesSearch && matchesPlan;
    });
    
    const originalSubscriptions = adminData.subscriptions;
    adminData.subscriptions = filteredSubscriptions;
    renderSubscriptionsTable();
    adminData.subscriptions = originalSubscriptions;
}

function filterPayments() {
    const searchTerm = document.getElementById('paymentSearch').value.toLowerCase();
    const statusFilter = document.getElementById('paymentStatusFilter').value;
    const dateFrom = document.getElementById('paymentDateFrom').value;
    const dateTo = document.getElementById('paymentDateTo').value;
    
    const filteredPayments = adminData.payments.filter(payment => {
        const matchesSearch = payment.id.toLowerCase().includes(searchTerm) ||
                            payment.userEmail.toLowerCase().includes(searchTerm);
        const matchesStatus = !statusFilter || payment.status === statusFilter;
        
        let matchesDate = true;
        if (dateFrom) {
            matchesDate = matchesDate && new Date(payment.date) >= new Date(dateFrom);
        }
        if (dateTo) {
            matchesDate = matchesDate && new Date(payment.date) <= new Date(dateTo);
        }
        
        return matchesSearch && matchesStatus && matchesDate;
    });
    
    const originalPayments = adminData.payments;
    adminData.payments = filteredPayments;
    renderPaymentsTable();
    adminData.payments = originalPayments;
}

// Modal functions
function openUserModal(userId = null) {
    const modal = document.getElementById('userModal');
    const title = document.getElementById('userModalTitle');
    const form = document.getElementById('userForm');
    
    if (userId) {
        title.textContent = 'Edit User';
        // Load user data
        const user = adminData.users.find(u => u.id === userId);
        if (user) {
            document.getElementById('userEmail').value = user.email;
            document.getElementById('userDisplayName').value = user.displayName || '';
            document.getElementById('userRole').value = user.role || 'user';
            document.getElementById('userSubscription').value = user.subscription || 'free';
            
            // Set the user ID in the form dataset for update operations
            form.dataset.userId = userId;
        }
    } else {
        title.textContent = 'Add User';
        form.reset();
        delete form.dataset.userId;
    }
    
    modal.style.display = 'block';
}

function closeUserModal() {
    document.getElementById('userModal').style.display = 'none';
}

function openProjectModal(projectId = null) {
    const modal = document.getElementById('projectModal');
    const title = document.getElementById('projectModalTitle');
    const form = document.getElementById('projectForm');
    
    if (projectId) {
        title.textContent = 'Edit Project';
        // Load project data
        const project = adminData.projects.find(p => p.id === projectId);
        if (project) {
            document.getElementById('projectName').value = project.name || '';
            document.getElementById('projectDescription').value = project.description || '';
            
            // Set the project ID and user ID in the form dataset for update operations
            form.dataset.projectId = projectId;
            form.dataset.userId = project.userId;
        }
    } else {
        title.textContent = 'Add Project';
        form.reset();
        delete form.dataset.projectId;
        delete form.dataset.userId;
    }
    
    // Populate owner dropdown
    const ownerSelect = document.getElementById('projectOwner');
    ownerSelect.innerHTML = '<option value="">Select Owner</option>';
    adminData.users.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = user.email;
        ownerSelect.appendChild(option);
    });
    
    modal.style.display = 'block';
}

function closeProjectModal() {
    document.getElementById('projectModal').style.display = 'none';
}

function openModelModal(modelId = null) {
    const modal = document.getElementById('modelModal');
    const title = document.getElementById('modelModalTitle');
    const form = document.getElementById('modelForm');
    
    if (modelId) {
        title.textContent = 'Edit Model';
        // Load model data
        const model = adminData.models.find(m => m.id === modelId);
        if (model) {
            document.getElementById('modelId').value = model.id;
            document.getElementById('modelName').value = model.name || '';
            document.getElementById('modelType').value = model.type || 'text';
            document.getElementById('modelProvider').value = model.provider || 'openai';
            document.getElementById('modelDescription').value = model.description || '';
            
            // Set the model ID in the form dataset for update operations
            form.dataset.modelId = modelId;
        }
    } else {
        title.textContent = 'Add Model';
        form.reset();
        delete form.dataset.modelId;
    }
    
    modal.style.display = 'block';
}

function closeModelModal() {
    document.getElementById('modelModal').style.display = 'none';
}

function openSubscriptionModal(subscriptionId = null) {
    const modal = document.getElementById('subscriptionModal');
    const title = document.getElementById('subscriptionModalTitle');
    const form = document.getElementById('subscriptionForm');
    
    if (subscriptionId) {
        title.textContent = 'Edit Subscription Plan';
        // Load subscription data
        const subscription = adminData.subscriptions.find(s => s.id === subscriptionId);
        if (subscription) {
            document.getElementById('subscriptionPlanName').value = subscription.planName || '';
            document.getElementById('subscriptionPrice').value = subscription.price || '';
            document.getElementById('subscriptionInterval').value = subscription.interval || 'monthly';
            document.getElementById('subscriptionFeatures').value = Array.isArray(subscription.features) ? subscription.features.join(', ') : '';
            
            // Set the subscription ID in the form dataset for update operations
            form.dataset.subscriptionId = subscriptionId;
        }
    } else {
        title.textContent = 'Add Subscription Plan';
        form.reset();
        delete form.dataset.subscriptionId;
    }
    
    modal.style.display = 'block';
}

function closeSubscriptionModal() {
    document.getElementById('subscriptionModal').style.display = 'none';
}

// Action functions
function editUser(userId) {
    openUserModal(userId);
}

async function deleteUser(userId) {
    if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
        try {
            console.log('🗑️ Deleting user:', userId);
            
            if (typeof adminService !== 'undefined') {
                const result = await adminService.deleteUser(userId);
                if (result.success) {
                    showSuccess('User deleted successfully');
                    loadUsers(); // Refresh the table
                } else {
                    showError('Failed to delete user: ' + result.error);
                }
            } else {
                // Fallback to direct deletion
                await adminDb.collection('users').doc(userId).delete();
                showSuccess('User deleted successfully');
                loadUsers(); // Refresh the table
            }
        } catch (error) {
            console.error('❌ Error deleting user:', error);
            showError('Failed to delete user: ' + error.message);
        }
    }
}

function editProject(projectId) {
    openProjectModal(projectId);
}

async function deleteProject(projectId) {
    if (confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
        try {
            console.log('🗑️ Deleting project:', projectId);
            
            // Find the project in adminData to get userId
            const project = adminData.projects.find(p => p.id === projectId);
            if (!project) {
                showError('Project not found');
                return;
            }
            
            if (typeof adminService !== 'undefined') {
                const result = await adminService.deleteProject(project.userId, projectId);
                if (result.success) {
                    showSuccess('Project deleted successfully');
                    loadProjects(); // Refresh the table
                } else {
                    showError('Failed to delete project: ' + result.error);
                }
            } else {
                // Fallback to direct deletion
                await adminDb.collection('users').doc(project.userId).collection('projects').doc(projectId).delete();
                showSuccess('Project deleted successfully');
                loadProjects(); // Refresh the table
            }
        } catch (error) {
            console.error('❌ Error deleting project:', error);
            showError('Failed to delete project: ' + error.message);
        }
    }
}

function editModel(modelId) {
    openModelModal(modelId);
}

async function deleteModel(modelId) {
    if (confirm('Are you sure you want to delete this model? This action cannot be undone.')) {
        try {
            console.log('🗑️ Deleting model:', modelId);
            
            // Delete from models collection
            await adminDb.collection('models').doc(modelId).delete();
            showSuccess('Model deleted successfully');
            loadModels(); // Refresh the table
        } catch (error) {
            console.error('❌ Error deleting model:', error);
            showError('Failed to delete model: ' + error.message);
        }
    }
}

function editSubscription(subscriptionId) {
    openSubscriptionModal(subscriptionId);
}

async function deleteSubscription(subscriptionId) {
    if (confirm('Are you sure you want to delete this subscription plan? This action cannot be undone.')) {
        try {
            console.log('🗑️ Deleting subscription plan:', subscriptionId);
            
            // Delete from subscriptions collection
            await adminDb.collection('subscriptions').doc(subscriptionId).delete();
            showSuccess('Subscription plan deleted successfully');
            loadSubscriptions(); // Refresh the table
        } catch (error) {
            console.error('❌ Error deleting subscription plan:', error);
            showError('Failed to delete subscription plan: ' + error.message);
        }
    }
}

function manageSubscription(userId) {
    console.log('Managing subscription for user:', userId);
    showSuccess('Subscription management feature coming soon');
}

function viewPayment(paymentId) {
    console.log('Viewing payment:', paymentId);
    showSuccess('Payment details feature coming soon');
}

function refundPayment(paymentId) {
    if (confirm('Are you sure you want to refund this payment?')) {
        console.log('Refunding payment:', paymentId);
        showSuccess('Payment refunded successfully');
        loadPayments(); // Refresh the table
    }
}

// Utility functions
function getModelTypeColor(type) {
    const colors = {
        'text': 'status-active',
        'image': 'status-premium',
        'audio': 'status-pending',
        'video': 'status-warning'
    };
    return colors[type] || 'status-active';
}

function getSubscriptionPlanColor(plan) {
    const colors = {
        'free': 'status-free',
        'premium': 'status-premium',
        'enterprise': 'status-active'
    };
    return colors[plan] || 'status-free';
}

function getPaymentStatusColor(status) {
    const colors = {
        'completed': 'status-active',
        'pending': 'status-pending',
        'failed': 'status-inactive'
    };
    return colors[status] || 'status-pending';
}

function getActivityTypeColor(type) {
    const colors = {
        'user': '#3498db',
        'project': '#e74c3c',
        'payment': '#27ae60',
        'model': '#f39c12',
        'subscription': '#9b59b6'
    };
    return colors[type] || '#7f8c8d';
}

// Refresh data
function refreshData() {
    console.log('🔄 Refreshing admin data...');
    loadDashboardData();
    showSuccess('Data refreshed successfully');
}

// Logout
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        authService.signOut().then(() => {
            window.location.href = '/login.html';
        });
    }
}

// Debug functions
function debugAdminDashboard() {
    console.log('🔧 Admin Dashboard Debug Info:');
    console.log('Current User:', currentAdminUser);
    console.log('Is Authenticated:', isAdminAuthenticated);
    console.log('Admin Data:', adminData);
    console.log('OpenRouter Config:', openRouterConfig);
    console.log('Active Models:', getActiveModels());
}

function forceLoadAdminData() {
    console.log('🔄 Force loading admin data...');
    loadDashboardData();
}

// Get active models for main app
function getActiveModelsForMainApp() {
    return getActiveModels();
}

// Get models by type for main app
function getActiveModelsByType(type) {
    return getModelsByTypeAndStatus(type, 'active');
}

// Get model by original ID (for API calls)
function getModelByOriginalId(originalId) {
    return adminData.models.find(model => model.originalId === originalId);
}

// Get sanitized ID from original ID
function getSanitizedId(originalId) {
    const model = getModelByOriginalId(originalId);
    return model ? model.id : originalId.replace(/\//g, '-');
}

// Get original ID from sanitized ID
function getOriginalId(sanitizedId) {
    const model = adminData.models.find(m => m.id === sanitizedId);
    return model ? model.originalId : sanitizedId;
}

// Migration function for existing models
async function migrateExistingModels() {
    try {
        console.log('🔄 Starting migration of existing models...');
        
        if (!adminData.models || adminData.models.length === 0) {
            console.log('ℹ️ No models found to migrate');
            return;
        }
        
        let migratedCount = 0;
        let skippedCount = 0;
        
        for (const model of adminData.models) {
            // Only migrate if status field doesn't exist
            if (!model.status) {
                const status = model.isActive ? 'active' : 'inactive';
                
                try {
                    await adminDb.collection('models').doc(model.id).update({
                        status: status,
                        migratedAt: new Date()
                    });
                    
                    // Update local data
                    model.status = status;
                    migratedCount++;
                    console.log(`✅ Migrated ${model.id} -> status: ${status}`);
                } catch (error) {
                    console.error(`❌ Failed to migrate ${model.id}:`, error);
                }
            } else {
                skippedCount++;
                console.log(`⏭️ Skipped ${model.id} (already has status: ${model.status})`);
            }
        }
        
        console.log(`🎉 Migration complete!`);
        console.log(`✅ Migrated: ${migratedCount} models`);
        console.log(`⏭️ Skipped: ${skippedCount} models`);
        
        if (migratedCount > 0) {
            showSuccess(`Migration complete! Updated ${migratedCount} models with status field.`);
            // Refresh the models table
            await loadModels();
        } else {
            showSuccess('No models needed migration - all models already have status field.');
        }
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        showError('Migration failed: ' + error.message);
    }
}

// Expose functions globally for debugging and main app access
window.debugAdminDashboard = debugAdminDashboard;
window.forceLoadAdminData = forceLoadAdminData;
window.getActiveModelsForMainApp = getActiveModelsForMainApp;
window.getActiveModelsByType = getActiveModelsByType;
window.migrateExistingModels = migrateExistingModels;
window.getModelByOriginalId = getModelByOriginalId;
window.getSanitizedId = getSanitizedId;
window.getOriginalId = getOriginalId;

// Error and success messages
function showError(message) {
    // Create or update error message
    let errorDiv = document.getElementById('errorMessage');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.id = 'errorMessage';
        errorDiv.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #e74c3c; color: white; padding: 15px; border-radius: 4px; z-index: 3000; max-width: 300px;';
        document.body.appendChild(errorDiv);
    }
    
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

function showSuccess(message) {
    // Create or update success message
    let successDiv = document.getElementById('successMessage');
    if (!successDiv) {
        successDiv = document.createElement('div');
        successDiv.id = 'successMessage';
        successDiv.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #27ae60; color: white; padding: 15px; border-radius: 4px; z-index: 3000; max-width: 300px;';
        document.body.appendChild(successDiv);
    }
    
    successDiv.textContent = message;
    successDiv.style.display = 'block';
    
    setTimeout(() => {
        successDiv.style.display = 'none';
    }, 3000);
}

// Form submission handlers
document.addEventListener('DOMContentLoaded', function() {
    // User form submission
    document.getElementById('userForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = {
            email: document.getElementById('userEmail').value,
            displayName: document.getElementById('userDisplayName').value,
            role: document.getElementById('userRole').value,
            subscription: document.getElementById('userSubscription').value
        };
        
        try {
            console.log('💾 Saving user:', formData);
            
            // Check if this is an edit (user ID exists in form)
            const userId = document.getElementById('userForm').dataset.userId;
            
            if (userId) {
                // Update existing user
                const userData = {
                    ...formData,
                    updatedAt: new Date(),
                    isAdmin: formData.role === 'admin'
                };
                
                await adminDb.collection('users').doc(userId).update(userData);
                showSuccess('User updated successfully');
            } else {
                // Create new user (this would require Firebase Auth integration)
                showError('Creating new users requires Firebase Auth integration. Please use the main app to register users.');
                return;
            }
            
            closeUserModal();
            loadUsers();
        } catch (error) {
            console.error('❌ Error saving user:', error);
            showError('Failed to save user: ' + error.message);
        }
    });
    
    // Project form submission
    document.getElementById('projectForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = {
            name: document.getElementById('projectName').value,
            owner: document.getElementById('projectOwner').value,
            description: document.getElementById('projectDescription').value
        };
        
        try {
            console.log('💾 Saving project:', formData);
            
            // Check if this is an edit (project ID exists in form)
            const projectId = document.getElementById('projectForm').dataset.projectId;
            const userId = document.getElementById('projectForm').dataset.userId;
            
            if (projectId && userId) {
                // Update existing project
                const projectData = {
                    ...formData,
                    updatedAt: new Date()
                };
                
                await adminDb.collection('users').doc(userId).collection('projects').doc(projectId).update(projectData);
                showSuccess('Project updated successfully');
            } else {
                // Create new project
                const projectData = {
                    ...formData,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                
                // Note: This would require knowing which user to create the project for
                showError('Creating new projects requires selecting a user. Please use the main app to create projects.');
                return;
            }
            
            closeProjectModal();
            loadProjects();
        } catch (error) {
            console.error('❌ Error saving project:', error);
            showError('Failed to save project: ' + error.message);
        }
    });
    
    // Model form submission
    document.getElementById('modelForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = {
            id: document.getElementById('modelId').value,
            name: document.getElementById('modelName').value,
            type: document.getElementById('modelType').value,
            provider: document.getElementById('modelProvider').value,
            description: document.getElementById('modelDescription').value
        };
        
        try {
            console.log('💾 Saving model:', formData);
            
            // Check if this is an edit (model ID exists in form)
            const modelId = document.getElementById('modelForm').dataset.modelId;
            
            if (modelId) {
                // Update existing model
                const modelData = {
                    ...formData,
                    updatedAt: new Date()
                };
                
                await adminDb.collection('models').doc(modelId).update(modelData);
                showSuccess('Model updated successfully');
            } else {
                // Create new model
                const modelData = {
                    ...formData,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    isActive: true
                };
                
                // Use the model ID from the form as the document ID
                await adminDb.collection('models').doc(formData.id).set(modelData);
                showSuccess('Model created successfully');
            }
            
            closeModelModal();
            loadModels();
        } catch (error) {
            console.error('❌ Error saving model:', error);
            showError('Failed to save model: ' + error.message);
        }
    });
    
    // Subscription form submission
    document.getElementById('subscriptionForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = {
            planName: document.getElementById('subscriptionPlanName').value,
            price: parseFloat(document.getElementById('subscriptionPrice').value),
            interval: document.getElementById('subscriptionInterval').value,
            features: document.getElementById('subscriptionFeatures').value.split(',').map(f => f.trim())
        };
        
        try {
            console.log('💾 Saving subscription plan:', formData);
            
            // Check if this is an edit (subscription ID exists in form)
            const subscriptionId = document.getElementById('subscriptionForm').dataset.subscriptionId;
            
            if (subscriptionId) {
                // Update existing subscription plan
                const subscriptionData = {
                    ...formData,
                    updatedAt: new Date()
                };
                
                await adminDb.collection('subscriptions').doc(subscriptionId).update(subscriptionData);
                showSuccess('Subscription plan updated successfully');
            } else {
                // Create new subscription plan
                const subscriptionData = {
                    ...formData,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    isActive: true
                };
                
                // Generate a new ID for the subscription plan
                const newId = adminDb.collection('subscriptions').doc().id;
                await adminDb.collection('subscriptions').doc(newId).set(subscriptionData);
                showSuccess('Subscription plan created successfully');
            }
            
            closeSubscriptionModal();
            loadSubscriptions();
        } catch (error) {
            console.error('❌ Error saving subscription plan:', error);
            showError('Failed to save subscription plan: ' + error.message);
        }
    });
});

// Close modals when clicking outside
window.onclick = function(event) {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
}

// Debug functions for admin dashboard
window.debugAdminDashboard = function() {
    console.log('🔍 Admin Dashboard Debug Info:');
    console.log('Current admin user:', currentAdminUser);
    console.log('Is admin authenticated:', isAdminAuthenticated);
    console.log('Admin data:', adminData);
    console.log('Firebase available:', typeof firebase !== 'undefined');
    console.log('DB available:', typeof adminDb !== 'undefined');
    console.log('Auth available:', typeof adminAuth !== 'undefined');
    console.log('authService available:', typeof authService !== 'undefined');
    console.log('adminService available:', typeof adminService !== 'undefined');
};

window.forceLoadAdminData = function() {
    console.log('🔧 Force loading admin data...');
    loadDashboardData();
};
