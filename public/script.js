/**
 * GPT Cells Application - Frontend
 * A client-side spreadsheet application with AI-powered content generation
 * supporting text, image, and audio generation with persistent storage
 */

// Firebase imports - loaded via CDN and firebase-config.js

// Authentication state
let currentUser = null;
let isAuthenticated = false;
let isAdmin = false;

// Project and sheet management
let currentProjectId = null;
let currentProject = null;
let projects = [];
let currentSheetIndex = 0;
let sheets = [
  {
    id: 'default-sheet-' + Date.now(), // Default sheet ID
    name: 'Sheet1',
    cells: {},
    numRows: 10,
    numCols: 10,
    columnNames: {} // Store column aliases: {0: 'Sales', 1: 'Marketing', etc.}
  }
];

// Current sheet reference
let currentSheet = sheets[currentSheetIndex];
let cells = currentSheet.cells;
let numRows = currentSheet.numRows;
let numCols = currentSheet.numCols;

// Available models
let availableModels = [];

/**
 * Load available models from the server
 */
async function loadAvailableModels() {
  try {
    console.log('🔄 Loading available models...');
    const response = await fetch('https://gpt-cells-app-production.up.railway.app/api/models');
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    availableModels = data.models || [];
    
    console.log('✅ Loaded models:', availableModels.length);
    
    // Populate the model selector
    populateModelSelector();
    
    // Also populate the modal model selector
    populateModalModelSelector();
    
  } catch (error) {
    console.error('❌ Error loading models:', error);
    availableModels = [];
    populateModelSelector(); // Still populate with empty state
    populateModalModelSelector(); // Also populate modal with empty state
  }
}

/**
 * Populate the model selector dropdown
 */
function populateModelSelector() {
  const modelSelect = document.getElementById('model-select');
  if (!modelSelect) {
    console.warn('⚠️ Model selector not found');
    return;
  }
  
  // Clear existing options
  modelSelect.innerHTML = '';
  
  if (availableModels.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No models available';
    modelSelect.appendChild(option);
    return;
  }
  
  // Add models to selector
  availableModels.forEach(model => {
    const option = document.createElement('option');
    option.value = model.id;
    option.textContent = model.name;
    modelSelect.appendChild(option);
  });
  
  // Set default selection to first model
  if (availableModels.length > 0) {
    modelSelect.value = availableModels[0].id;
  }
  
  console.log('✅ Model selector populated with', availableModels.length, 'models');
}

/**
 * Populate the modal model selector dropdown
 */
function populateModalModelSelector() {
  const modalModelSelect = document.getElementById('modalModel');
  if (!modalModelSelect) {
    console.warn('⚠️ Modal model selector not found');
    return;
  }
  
  // Clear existing options
  modalModelSelect.innerHTML = '';
  
  if (availableModels.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No models available';
    modalModelSelect.appendChild(option);
    return;
  }
  
  // Add models to modal selector
  availableModels.forEach(model => {
    const option = document.createElement('option');
    option.value = model.id;
    option.textContent = model.name;
    modalModelSelect.appendChild(option);
  });
  
  // Set default selection to first model
  if (availableModels.length > 0) {
    modalModelSelect.value = availableModels[0].id;
  }
  
  console.log('✅ Modal model selector populated with', availableModels.length, 'models');
}

/**
 * Get the default model for new cells
 * Priority: Main selector (current selection) > Project default model > Hardcoded fallback
 */
function getDefaultModel() {
  const mainModelSelect = document.getElementById('model-select');
  const selectorModel = mainModelSelect ? mainModelSelect.value : null;
  const projectDefaultModel = currentProject && currentProject.defaultModel;
  
  // Prioritize the current main selector value over the saved project default
  // This ensures real-time updates when the user changes the main selector
  return selectorModel || projectDefaultModel || 'gpt-3.5-turbo';
}

// Log initial sheet state
console.log('🚀 Initial sheet setup:');
console.log('🚀 currentSheet:', currentSheet);
console.log('🚀 currentSheet.id:', currentSheet?.id || 'null/undefined');
console.log('🚀 sheets array:', sheets);

// Error handling and user feedback
function showError(message, duration = 5000) {
  console.error('App Error:', message);
  
  // Create error notification
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-notification';
  errorDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #dc3545;
    color: white;
    padding: 12px 20px;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 10000;
    max-width: 400px;
    font-size: 14px;
    animation: slideIn 0.3s ease-out;
  `;
  errorDiv.textContent = message;
  
  document.body.appendChild(errorDiv);
  
  // Auto-remove after duration
  setTimeout(() => {
    if (errorDiv.parentNode) {
      errorDiv.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => errorDiv.remove(), 300);
    }
  }, duration);
}

function showSuccess(message, duration = 3000) {
  const successDiv = document.createElement('div');
  successDiv.className = 'success-notification';
  successDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #28a745;
    color: white;
    padding: 12px 20px;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 10000;
    max-width: 400px;
    font-size: 14px;
    animation: slideIn 0.3s ease-out;
  `;
  successDiv.textContent = message;
  
  document.body.appendChild(successDiv);
  
  setTimeout(() => {
    if (successDiv.parentNode) {
      successDiv.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => successDiv.remove(), 300);
    }
  }, duration);
}

/**
 * Show execution order to user
 */
function showExecutionOrder(updatedCellId, dependentCells) {
  const orderDiv = document.createElement('div');
  orderDiv.className = 'execution-order-notification';
  orderDiv.style.cssText = `
    position: fixed;
    top: 20px;
    left: 20px;
    background: #007bff;
    color: white;
    padding: 15px 20px;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 10000;
    max-width: 500px;
    font-size: 14px;
    animation: slideIn 0.3s ease-out;
  `;
  
  orderDiv.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 8px;">🔄 Dependency Chain Detected</div>
    <div style="font-size: 12px; margin-bottom: 8px;">Cell ${updatedCellId} updated → ${dependentCells.length} dependent cells will run:</div>
    <div style="font-size: 12px; color: #e3f2fd;">${dependentCells.join(' → ')}</div>
  `;
  
  document.body.appendChild(orderDiv);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (orderDiv.parentNode) {
      orderDiv.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => orderDiv.remove(), 300);
    }
  }, 5000);
}

/**
 * Show which cell is currently running
 */
function showCellRunning(cellId, current, total) {
  // Remove any existing running indicator
  const existing = document.getElementById('cell-running-indicator');
  if (existing) {
    existing.remove();
  }
  
  const runningDiv = document.createElement('div');
  runningDiv.id = 'cell-running-indicator';
  runningDiv.style.cssText = `
    position: fixed;
    top: 80px;
    left: 20px;
    background: #ffc107;
    color: #212529;
    padding: 10px 15px;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 10000;
    font-size: 14px;
    animation: slideIn 0.3s ease-out;
  `;
  
  runningDiv.innerHTML = `
    <div style="font-weight: bold;">⚡ Running Cell ${cellId}</div>
    <div style="font-size: 12px;">Step ${current} of ${total}</div>
  `;
  
  document.body.appendChild(runningDiv);
  
  // Highlight the cell being processed
  const cellContainer = document.querySelector(`[data-cell-id="${cellId}"]`) || 
                       document.querySelector(`#prompt-${cellId}`)?.closest('.cell-container');
  if (cellContainer) {
    cellContainer.classList.add('processing');
  }
}

/**
 * Show execution completion
 */
function showExecutionComplete(updatedCellId, executionOrder) {
  // Remove running indicator
  const runningIndicator = document.getElementById('cell-running-indicator');
  if (runningIndicator) {
    runningIndicator.remove();
  }
  
  // Remove processing class from all cells
  document.querySelectorAll('.cell-container.processing').forEach(container => {
    container.classList.remove('processing');
  });
  
  const completeDiv = document.createElement('div');
  completeDiv.className = 'execution-complete-notification';
  completeDiv.style.cssText = `
    position: fixed;
    top: 20px;
    left: 20px;
    background: #28a745;
    color: white;
    padding: 15px 20px;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 10000;
    max-width: 500px;
    font-size: 14px;
    animation: slideIn 0.3s ease-out;
  `;
  
  completeDiv.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 8px;">✅ Dependency Chain Complete</div>
    <div style="font-size: 12px;">Cell ${updatedCellId} → ${executionOrder.length} dependent cells executed</div>
  `;
  
  document.body.appendChild(completeDiv);
  
  // Auto-remove after 3 seconds
  setTimeout(() => {
    if (completeDiv.parentNode) {
      completeDiv.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => completeDiv.remove(), 300);
    }
  }, 3000);
}

/**
 * Show batch execution start notification
 */
function showBatchExecutionStart(totalCells) {
  const startDiv = document.createElement('div');
  startDiv.id = 'batch-execution-notification';
  startDiv.style.cssText = `
    position: fixed;
    top: 20px;
    left: 20px;
    background: #007bff;
    color: white;
    padding: 15px 20px;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 10000;
    max-width: 500px;
    font-size: 14px;
    animation: slideIn 0.3s ease-out;
  `;
  
  startDiv.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 8px;">🔄 Batch Execution Started</div>
    <div style="font-size: 12px;">Running ${totalCells} filled cells sequentially...</div>
  `;
  
  document.body.appendChild(startDiv);
}

/**
 * Show batch cell progress
 */
function showBatchCellProgress(cellId, current, total) {
  // Remove any existing progress indicator
  const existing = document.getElementById('batch-cell-progress');
  if (existing) {
    existing.remove();
  }
  
  const progressDiv = document.createElement('div');
  progressDiv.id = 'batch-cell-progress';
  progressDiv.style.cssText = `
    position: fixed;
    top: 80px;
    left: 20px;
    background: #ffc107;
    color: #212529;
    padding: 10px 15px;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 10000;
    font-size: 14px;
    animation: slideIn 0.3s ease-out;
  `;
  
  const progressPercent = Math.round((current / total) * 100);
  progressDiv.innerHTML = `
    <div style="font-weight: bold;">⚡ Processing Cell ${cellId}</div>
    <div style="font-size: 12px; margin-top: 4px;">Step ${current} of ${total} (${progressPercent}%)</div>
    <div style="width: 200px; height: 4px; background: rgba(0,0,0,0.1); border-radius: 2px; margin-top: 6px;">
      <div style="width: ${progressPercent}%; height: 100%; background: #28a745; border-radius: 2px; transition: width 0.3s ease;"></div>
    </div>
  `;
  
  document.body.appendChild(progressDiv);
}

/**
 * Show batch execution completion
 */
function showBatchExecutionComplete(totalCells) {
  // Remove progress indicator
  const progressIndicator = document.getElementById('batch-cell-progress');
  if (progressIndicator) {
    progressIndicator.remove();
  }
  
  // Remove processing class from all cells
  document.querySelectorAll('.cell-container.processing').forEach(container => {
    container.classList.remove('processing');
  });
  
  const completeDiv = document.createElement('div');
  completeDiv.className = 'batch-execution-complete-notification';
  completeDiv.style.cssText = `
    position: fixed;
    top: 20px;
    left: 20px;
    background: #28a745;
    color: white;
    padding: 15px 20px;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 10000;
    max-width: 500px;
    font-size: 14px;
    animation: slideIn 0.3s ease-out;
  `;
  
  completeDiv.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 8px;">✅ Batch Execution Complete</div>
    <div style="font-size: 12px;">Successfully processed ${totalCells} cells</div>
  `;
  
  document.body.appendChild(completeDiv);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (completeDiv.parentNode) {
      completeDiv.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => completeDiv.remove(), 300);
    }
  }, 5000);
}

/**
 * Convert column and row indices to a cell ID (e.g., 0,0 -> "A1").
 * @param {number} col Zero-based column index.
 * @param {number} row Zero-based row index.
 * @returns {string} Cell identifier like "A1".
 */
function getCellId(col, row) {
  return String.fromCharCode(65 + col) + (row + 1);
}

/**
 * Initialize cell objects for the current number of rows and columns.
 */
function initializeCells() {
  // Get the default model for new cells
  const defaultModel = getDefaultModel();
  
  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c < numCols; c++) {
      const id = getCellId(c, r);
      if (!cells[id]) {
        cells[id] = { 
          prompt: '', 
          output: '', 
          model: defaultModel, 
          temperature: 0.7,
          generations: [] // Log of all generations
        };
      }
    }
  }
}

/**
 * Render the grid of cells as an HTML table.
 */
function renderGrid() {
  // Don't initialize cells here - use the data from currentSheet.cells
  // initializeCells();
  const gridContainer = document.getElementById('grid');
  if (!gridContainer) {
    console.error('Grid container not found!');
    return;
  }
  let html = '<table><thead><tr><th class="row-header" style="width: 50px; min-width: 50px; max-width: 50px;"></th>';
  // Column headers (A, B, C...) with editable names
  for (let c = 0; c < numCols; c++) {
    const colLetter = String.fromCharCode(65 + c);
    const columnAlias = currentSheet.columnNames && currentSheet.columnNames[c] ? currentSheet.columnNames[c] : '';
    const hasAlias = columnAlias && columnAlias.trim() !== '';
    
    html += '<th class="column-header" onclick="toggleColumnHighlight(' + c + ')" oncontextmenu="showColumnContextMenu(event, ' + c + ')" data-column="' + c + '">';
    html += '<div class="column-header-content">';
    html += '<div class="column-sort-controls">';
    html += '<span class="sort-btn" onclick="sortColumn(' + c + ', \'asc\'); event.stopPropagation();" title="Sort A-Z">▲</span>';
    html += '<span class="sort-btn" onclick="sortColumn(' + c + ', \'desc\'); event.stopPropagation();" title="Sort Z-A">▼</span>';
    html += '</div>';
    html += '<div class="column-resize-handle" onmousedown="startColumnResize(event, ' + c + ')"></div>';
    
    if (hasAlias) {
      // Show alias with letter when it's set
      html += '<span class="column-letter" id="col-letter-' + c + '">' + colLetter + '</span>';
      html += '<input type="text" class="column-name-input" id="col-name-' + c + '" value="' + columnAlias + '" placeholder="Column name" onblur="saveColumnName(' + c + ')" onkeydown="handleColumnNameKeydown(event, ' + c + ')" style="display: none;">';
      html += '<span class="column-alias" id="col-alias-' + c + '" onclick="editColumnName(' + c + ')" title="Click to edit column name">' + columnAlias + '</span>';
    } else {
      // Show letter only when no alias is set
      html += '<span class="column-letter" id="col-letter-' + c + '" style="display: none;">' + colLetter + '</span>';
      html += '<input type="text" class="column-name-input" id="col-name-' + c + '" value="" placeholder="Column name" onblur="saveColumnName(' + c + ')" onkeydown="handleColumnNameKeydown(event, ' + c + ')" style="display: none;">';
      html += '<span class="column-alias" id="col-alias-' + c + '" onclick="editColumnName(' + c + ')" title="Click to edit column name">' + colLetter + '</span>';
    }
    
    html += '</div>';
    html += '</th>';
  }
  html += '</tr></thead><tbody>';
  // Rows
  for (let r = 0; r < numRows; r++) {
    html += '<tr data-row="' + r + '">';
    // Row header (1, 2, 3...)
    html += '<th class="row-header" style="width: 50px; min-width: 50px; max-width: 50px;" onclick="toggleRowHighlight(' + r + ')" oncontextmenu="showRowContextMenu(event, ' + r + ')" data-row="' + r + '">' + (r + 1) + '<div class="row-resize-handle" onmousedown="startRowResize(event, ' + r + ')"></div></th>';
    for (let c = 0; c < numCols; c++) {
      const id = getCellId(c, r);
      // Get the default model for new cells
      const defaultModel = getDefaultModel();
      const cell = currentSheet.cells[id] || { prompt: '', output: '', model: defaultModel, temperature: 0.7, cellPrompt: '', autoRun: false };
      console.log(`Rendering cell ${id} with content:`, cell.prompt);
      html += '<td>';
      const hasPrompt = cell.cellPrompt && cell.cellPrompt.trim() !== '';
      // Don't show required indicator in grid by default - only when cell is selected
      html += '<div class="cell-container' + (hasPrompt ? ' has-prompt' : '') + '">';
      html += '<button class="expand-btn" onclick="openModal(\'' + id + '\')" title="Expand cell">⛶</button>';
      html += '<textarea id="prompt-' + id + '" oninput="updatePrompt(\'' + id + '\')" onfocus="showOutput(\'' + id + '\')" onblur="hideCellControls(\'' + id + '\'); saveCellOnBlur(\'' + id + '\')" placeholder="Enter prompt...">' + (cell.prompt || '') + '</textarea>';
      html += '<div class="output" id="output-' + id + '"' + (cell.output ? ' style="display: block;"' : '') + '>';
      html += '<button class="output-close-btn" onclick="closeOutput(\'' + id + '\'); event.stopPropagation();" title="Close output">&times;</button>';
      html += '<div class="output-content">' + (cell.output || '') + '</div>';
      html += '</div>';
      html += '<div class="cell-controls">';
      html += '<select class="cell-model-select" id="model-' + id + '" onchange="updateCellModel(\'' + id + '\')" onfocus="keepCellControlsVisible(\'' + id + '\')">';
      // Models will be populated by updateModelSelector after grid is rendered
      html += '</select>';
      html += '<input type="number" class="cell-temp-input" id="temp-' + id + '" min="0" max="1" step="0.1" value="' + (cell.temperature || 0.7) + '" onchange="updateCellTemperature(\'' + id + '\')" onfocus="keepCellControlsVisible(\'' + id + '\')" title="Temperature">';
      html += '<label class="cell-auto-run-label" title="Auto-run when content changes or dependencies update">';
      html += '<input type="checkbox" class="cell-auto-run-checkbox" id="auto-run-' + id + '" ' + (cell.autoRun ? 'checked' : '') + ' onchange="updateCellAutoRun(\'' + id + '\')" onfocus="keepCellControlsVisible(\'' + id + '\')">';
      html += '<span class="auto-run-text">Auto</span>';
      html += '</label>';
      html += '<button class="cell-run-btn" onclick="runCell(\'' + id + '\')" onfocus="keepCellControlsVisible(\'' + id + '\')" title="Run this cell">▶</button>';
      html += '</div>';
      html += '</div>';
      html += '</td>';
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  gridContainer.innerHTML = html;
  
  // Populate cell model selectors after grid is rendered
  if (typeof populateCellModelSelectors === 'function') {
    // Get models from the global models array if available
    const models = availableModels || window.availableModels || [];
    if (models.length > 0) {
      console.log('Populating cell model selectors with', models.length, 'models');
      populateCellModelSelectors(models);
      
      // After populating, update all empty cells to use the current default model
      setTimeout(() => {
        updateAllCellModelDefaults();
      }, 100); // Small delay to ensure selectors are populated
    } else {
      console.log('No models available for cell selectors yet');
    }
  }
}

/**
 * Update the stored prompt for a cell when the user types in the textarea.
 * @param {string} id Cell identifier.
 */
function updatePrompt(id) {
  console.log(`updatePrompt called for cell ${id}`);
  const textarea = document.getElementById('prompt-' + id);
  if (textarea) {
    console.log(`Textarea value for ${id}:`, textarea.value);
    // Ensure cell exists in currentSheet.cells
    if (!currentSheet.cells[id]) {
      // Get the default model for new cells
      const defaultModel = getDefaultModel();
      currentSheet.cells[id] = { prompt: '', output: '', model: defaultModel, temperature: 0.7, cellPrompt: '', autoRun: false };
    }
    currentSheet.cells[id].prompt = textarea.value;
    console.log(`Updated cell ${id} prompt in memory:`, currentSheet.cells[id].prompt);
    
    // Remove required indicator when content is added
    const cellContainer = document.querySelector(`#prompt-${id}`)?.closest('.cell-container');
    if (cellContainer && textarea.value && textarea.value.trim() !== '') {
      cellContainer.classList.remove('cell-required');
    }
    
    // Don't save to Firebase on every keystroke - only save on blur
    
    // Check if cell has a prompt template and auto-run
    let finalPrompt = textarea.value;
    if (currentSheet.cells[id].cellPrompt && textarea.value.trim()) {
      console.log(`Cell ${id} has prompt template:`, currentSheet.cells[id].cellPrompt);
      console.log(`User input:`, textarea.value);
      
      // Replace {input} placeholder with the actual input
      const processedPrompt = currentSheet.cells[id].cellPrompt.replace('{input}', textarea.value);
      console.log(`Processed prompt:`, processedPrompt);
      
      // Update the cell's prompt with the processed template
      currentSheet.cells[id].prompt = processedPrompt;
      finalPrompt = processedPrompt;
      
      // Auto-run the cell
      setTimeout(() => {
        console.log(`Auto-running cell ${id} with processed prompt`);
        runCell(id);
      }, 500); // Small delay to allow user to finish typing
    } else if (currentSheet.cells[id].autoRun && textarea.value.trim()) {
      // Auto-run if enabled and content has changed
      console.log(`Auto-running cell ${id} due to auto-run setting`);
      setTimeout(() => {
        runCell(id);
      }, 500); // Small delay to allow user to finish typing
    }
    
    // Note: Database saving is now handled by saveCellOnBlur when user finishes editing
  }
}

/**
 * Update the model for a specific cell
 * @param {string} id Cell identifier.
 */
function updateCellModel(id) {
  const modelSelect = document.getElementById('model-' + id);
  if (modelSelect) {
    // Ensure cell exists in currentSheet.cells
    if (!currentSheet.cells[id]) {
      // Get the default model for new cells
      const defaultModel = getDefaultModel();
      currentSheet.cells[id] = { prompt: '', output: '', model: defaultModel, temperature: 0.7, cellPrompt: '', autoRun: false };
    }
    currentSheet.cells[id].model = modelSelect.value;
    
    // Update required indicator when model changes (only if modal is active)
    if (currentModalCellId === id) {
      const cellContainer = document.querySelector(`#prompt-${id}`)?.closest('.cell-container');
      if (cellContainer) {
        const isRequired = (!currentSheet.cells[id].prompt || currentSheet.cells[id].prompt.trim() === '');
        if (isRequired) {
          cellContainer.classList.add('cell-required');
        } else {
          cellContainer.classList.remove('cell-required');
        }
      }
    }
    
    // Save to database
    if (currentSheet.id) {
      saveCellToDatabase(id, currentSheet.cells[id].prompt, currentSheet.cells[id].output, currentSheet.cells[id].model, currentSheet.cells[id].temperature, currentSheet.cells[id].cellPrompt);
    }
  }
}

/**
 * Update the temperature for a specific cell
 * @param {string} id Cell identifier.
 */
function updateCellTemperature(id) {
  const tempInput = document.getElementById('temp-' + id);
  if (tempInput) {
    // Ensure cell exists in currentSheet.cells
    if (!currentSheet.cells[id]) {
      // Get the default model for new cells
      const defaultModel = getDefaultModel();
      currentSheet.cells[id] = { prompt: '', output: '', model: defaultModel, temperature: 0.7, cellPrompt: '', autoRun: false };
    }
    currentSheet.cells[id].temperature = parseFloat(tempInput.value);
    
    // Save to database
    if (currentSheet.id) {
      saveCellToDatabase(id, currentSheet.cells[id].prompt, currentSheet.cells[id].output, currentSheet.cells[id].model, currentSheet.cells[id].temperature, currentSheet.cells[id].cellPrompt, currentSheet.cells[id].autoRun);
    }
  }
}

/**
 * Update the auto-run setting for a specific cell
 * @param {string} id Cell identifier.
 */
function updateCellAutoRun(id) {
  const autoRunCheckbox = document.getElementById('auto-run-' + id);
  if (autoRunCheckbox) {
    // Ensure cell exists in currentSheet.cells
    if (!currentSheet.cells[id]) {
      // Get the default model for new cells
      const defaultModel = getDefaultModel();
      currentSheet.cells[id] = { prompt: '', output: '', model: defaultModel, temperature: 0.7, cellPrompt: '', autoRun: false };
    }
    currentSheet.cells[id].autoRun = autoRunCheckbox.checked;
    
    console.log(`Cell ${id} auto-run set to:`, autoRunCheckbox.checked);
    
    // Save to database
    if (currentSheet.id) {
      saveCellToDatabase(id, currentSheet.cells[id].prompt, currentSheet.cells[id].output, currentSheet.cells[id].model, currentSheet.cells[id].temperature, currentSheet.cells[id].cellPrompt, currentSheet.cells[id].autoRun);
    }
  }
}


/**
 * Edit column name - switch to input mode
 * @param {number} columnIndex Column index (0-based)
 */
function editColumnName(columnIndex) {
  const aliasSpan = document.getElementById('col-alias-' + columnIndex);
  const inputField = document.getElementById('col-name-' + columnIndex);
  
  if (aliasSpan && inputField) {
    // Hide the alias span and show the input field
    aliasSpan.style.display = 'none';
    inputField.style.display = 'inline-block';
    inputField.focus();
    inputField.select(); // Select all text for easy editing
  }
}

/**
 * Save column name when user finishes editing (onblur)
 * @param {number} columnIndex Column index (0-based)
 */
async function saveColumnName(columnIndex) {
  const inputField = document.getElementById('col-name-' + columnIndex);
  const aliasSpan = document.getElementById('col-alias-' + columnIndex);
  
  if (inputField && aliasSpan) {
    const newName = inputField.value.trim();
    
    // Update the sheet's column names
    if (!currentSheet.columnNames) {
      currentSheet.columnNames = {};
    }
    
    if (newName) {
      currentSheet.columnNames[columnIndex] = newName;
    } else {
      delete currentSheet.columnNames[columnIndex];
    }
    
    // Update the display
    const colLetter = String.fromCharCode(65 + columnIndex);
    const columnLetterSpan = document.getElementById(`col-letter-${columnIndex}`);
    
    if (newName) {
      // Show alias with letter
      aliasSpan.textContent = newName;
      if (columnLetterSpan) {
        columnLetterSpan.style.display = 'inline';
      }
    } else {
      // Show only letter
      aliasSpan.textContent = colLetter;
      if (columnLetterSpan) {
        columnLetterSpan.style.display = 'none';
      }
    }
    
    // Hide input and show alias
    inputField.style.display = 'none';
    aliasSpan.style.display = 'inline-block';
    
    console.log(`💾 Saved column ${columnIndex} name: "${newName}"`);
    
    // Save to database
    if (currentSheet.id) {
      await saveSheetColumnNames();
    }
  }
}

/**
 * Handle keydown events for column name input
 * @param {Event} event Keyboard event
 * @param {number} columnIndex Column index (0-based)
 */
function handleColumnNameKeydown(event, columnIndex) {
  if (event.key === 'Enter') {
    event.preventDefault();
    saveColumnName(columnIndex);
  } else if (event.key === 'Escape') {
    event.preventDefault();
    // Cancel editing and revert to original value
    const inputField = document.getElementById('col-name-' + columnIndex);
    const aliasSpan = document.getElementById('col-alias-' + columnIndex);
    
    if (inputField && aliasSpan) {
      const originalName = currentSheet.columnNames && currentSheet.columnNames[columnIndex] ? currentSheet.columnNames[columnIndex] : '';
      inputField.value = originalName;
      
      inputField.style.display = 'none';
      aliasSpan.style.display = 'inline-block';
    }
  }
}

/**
 * Save column names to database
 */
async function saveSheetColumnNames() {
  try {
    const userId = currentUser ? currentUser.uid : 'demo-user-123';
    const projectId = currentProjectId || 'default-project';
    
    console.log('💾 Saving column names to database:', currentSheet.columnNames);
    
    await firestoreService.updateSheet(userId, projectId, currentSheet.id, {
      columnNames: currentSheet.columnNames,
      updatedAt: new Date()
    });
    
    console.log('✅ Column names saved to database');
  } catch (error) {
    console.error('❌ Error saving column names:', error);
  }
}

/**
 * Create a default sheet for the current project
 */
async function createDefaultSheetForProject() {
  try {
    console.log('📄 Creating default sheet for project...');
    
    const userId = currentUser ? currentUser.uid : 'demo-user-123';
    const projectId = currentProjectId || 'default-project';
    
    // Create a default sheet
    const defaultSheet = {
      name: 'Sheet1',
      numRows: 10,
      numCols: 10,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Create sheet in Firebase
    const createResult = await firestoreService.createSheet(userId, projectId, defaultSheet);
    
    if (createResult.success) {
      const sheetId = createResult.sheetId;
      console.log('✅ Created default sheet with ID:', sheetId);
      
      // Update local sheets array
      const newSheet = {
        id: sheetId,
        name: defaultSheet.name,
        cells: {},
        numRows: defaultSheet.numRows,
        numCols: defaultSheet.numCols,
        columnNames: {}
      };
      
      sheets = [newSheet];
      currentSheetIndex = 0;
      currentSheet = newSheet;
      
      // Update global variables
      cells = currentSheet.cells;
      numRows = currentSheet.numRows;
      numCols = currentSheet.numCols;
      
      console.log('✅ Default sheet created and set as current:', currentSheet);
      
      // Render the grid and update UI
      renderGrid();
      updateSheetTabs();
      
    } else {
      throw new Error('Failed to create default sheet');
    }
    
  } catch (error) {
    console.error('❌ Error creating default sheet:', error);
    throw error;
  }
}

/**
 * Ensure the current sheet has a valid ID, create one if needed
 */
async function ensureSheetHasId() {
  console.log('🔍 Checking sheet ID - currentSheet:', currentSheet);
  console.log('🔍 Sheet ID exists:', currentSheet?.id);
  console.log('🔍 Sheet ID value:', currentSheet?.id || 'null/undefined');
  
  if (!currentSheet || !currentSheet.id) {
    console.log('🔧 No currentSheet.id found, creating a default sheet for project...');
    
    // Create a default sheet for the current project
    await createDefaultSheetForProject();
  }
}

/**
 * Save cell content when user clicks out of the cell (on blur)
 * @param {string} id Cell identifier.
 */
async function saveCellOnBlur(id) {
  console.log(`💾 Saving cell ${id} on blur`);
  console.log(`Current sheet:`, currentSheet);
  console.log(`Current sheet ID:`, currentSheet?.id || 'null/undefined');
  console.log(`Current user:`, currentUser);
  console.log(`Current project ID:`, currentProjectId);
  
  // Ensure sheet has an ID
  await ensureSheetHasId();
  
  console.log(`After ensureSheetHasId - Current sheet ID:`, currentSheet?.id || 'null/undefined');
  
  const textarea = document.getElementById('prompt-' + id);
  if (textarea && currentSheet && currentSheet.id) {
    // Ensure cell exists in currentSheet.cells
    if (!currentSheet.cells[id]) {
      // Get the default model for new cells
      const defaultModel = getDefaultModel();
      currentSheet.cells[id] = { prompt: '', output: '', model: defaultModel, temperature: 0.7, cellPrompt: '', autoRun: false };
    }
    
    // Update the cell's prompt with the current textarea value
    currentSheet.cells[id].prompt = textarea.value;
    
    console.log(`💾 Saving cell ${id} to Firebase on blur:`, textarea.value);
    
    saveCellToDatabase(id, textarea.value, currentSheet.cells[id].output, currentSheet.cells[id].model, currentSheet.cells[id].temperature, currentSheet.cells[id].cellPrompt, currentSheet.cells[id].autoRun)
      .then((result) => {
        console.log(`✅ Cell ${id} saved successfully on blur:`, result);
        
        // Fetch the cell from Firebase to ensure display matches database
        fetchCellFromFirebase(id)
          .then(() => {
            console.log(`✅ Cell ${id} fetched from Firebase after save`);
          })
          .catch(error => {
            console.error(`❌ Error fetching cell ${id} from Firebase after save:`, error);
          });
      })
      .catch(error => {
        console.error(`❌ Error saving cell ${id} to Firebase on blur:`, error);
      });
  } else {
    console.log(`❌ No currentSheet.id found or textarea not found, skipping Firebase save for cell ${id}`);
    console.log(`currentSheet:`, currentSheet);
    console.log(`currentSheet.id:`, currentSheet?.id);
    console.log(`textarea:`, textarea);
    
    // Still update the cell in memory even if we can't save to Firebase
    if (textarea && currentSheet) {
      if (!currentSheet.cells[id]) {
        // Get the default model from the main selector
        const mainModelSelect = document.getElementById('model-select');
        const defaultModel = mainModelSelect ? mainModelSelect.value : 'gpt-3.5-turbo';
        currentSheet.cells[id] = { prompt: '', output: '', model: defaultModel, temperature: 0.7, cellPrompt: '', autoRun: false };
      }
      currentSheet.cells[id].prompt = textarea.value;
      console.log(`💾 Updated cell ${id} in memory only:`, textarea.value);
    }
  }
}

/**
 * Fetch a specific cell from Firebase and update the display
 * @param {string} cellId Cell identifier.
 */
async function fetchCellFromFirebase(cellId) {
  try {
    console.log(`Fetching cell ${cellId} from Firebase`);
    
    if (!currentSheet || !currentSheet.id) {
      console.log(`No currentSheet.id found, skipping fetch for cell ${cellId}`);
      return;
    }

    const userId = currentUser ? currentUser.uid : 'demo-user-123';
    const projectId = currentProjectId || 'default-project';
    
    if (!userId || !projectId) {
      console.log(`Missing userId or projectId, skipping fetch for cell ${cellId}`);
      return;
    }

    // Fetch the cell data from Firebase
    const result = await firestoreService.getCell(userId, projectId, currentSheet.id, cellId);
    
    if (result.success && result.data) {
      console.log(`Successfully fetched cell ${cellId} from Firebase:`, result.data);
      
      // Update the cell in memory
      currentSheet.cells[cellId] = {
        prompt: result.data.prompt || '',
        output: result.data.output || '',
        model: result.data.model || 'gpt-3.5-turbo',
        temperature: result.data.temperature || 0.7,
        cellPrompt: result.data.cellPrompt || '',
        autoRun: result.data.autoRun || false
      };
      
      // Update the textarea display
      const textarea = document.getElementById('prompt-' + cellId);
      if (textarea) {
        textarea.value = result.data.prompt || '';
        console.log(`Updated textarea for cell ${cellId} with value:`, textarea.value);
        
        // Update the cell's prompt in memory to match what was fetched
        if (currentSheet && currentSheet.cells[cellId]) {
          currentSheet.cells[cellId].prompt = result.data.prompt || '';
          console.log(`Updated cell ${cellId} prompt in memory:`, currentSheet.cells[cellId].prompt);
        }
      }
      
      // Don't re-render the grid as it will lose focus and break editing
      // renderGrid();
      
    } else {
      console.log(`No data found for cell ${cellId} in Firebase`);
    }
    
  } catch (error) {
    console.error(`Error fetching cell ${cellId} from Firebase:`, error);
  }
}

/**
 * Auto-run a cell when user finishes editing (on blur or mouse leave)
 * @param {string} id Cell identifier.
 */
function autoRunCell(id) {
  const cell = cells[id];
  if (cell && cell.prompt && cell.prompt.trim() !== '') {
    // Only run if the prompt has changed or there's no output yet
    const textarea = document.getElementById('prompt-' + id);
    if (textarea && textarea.value.trim() !== '') {
      saveState();
      runCell(id);
    }
  }
}

/**
 * Show output div when textarea is focused
 * @param {string} id Cell identifier.
 */
function showOutput(id) {
  const outputDiv = document.getElementById('output-' + id);
  if (outputDiv) {
    outputDiv.style.display = 'block';
    
    // Add visual indicator to cell container
    const cellContainer = outputDiv.closest('.cell-container');
    if (cellContainer) {
      cellContainer.classList.add('focused');
      
      // Show required indicator when cell is selected if it has no content
      const cell = currentSheet.cells[id];
      if (cell && (!cell.prompt || cell.prompt.trim() === '')) {
        cellContainer.classList.add('cell-required');
      }
    }
  }
}

/**
 * Hide cell controls when textarea loses focus
 * @param {string} id Cell identifier.
 */
function hideCellControls(id) {
  // Add a small delay to allow for clicking on the controls
  setTimeout(() => {
    const cellContainer = document.querySelector(`#prompt-${id}`)?.closest('.cell-container');
    if (cellContainer) {
      // Check if any of the controls are focused
      const focusedElement = document.activeElement;
      const isControlFocused = cellContainer.contains(focusedElement) && 
        (focusedElement.classList.contains('cell-model-select') || 
         focusedElement.classList.contains('cell-temp-input') || 
         focusedElement.classList.contains('cell-run-btn'));
      
      if (!isControlFocused) {
        cellContainer.classList.remove('focused');
        // Hide required indicator when cell loses focus
        cellContainer.classList.remove('cell-required');
      }
    }
  }, 100);
}

/**
 * Keep cell controls visible when they are focused
 * @param {string} id Cell identifier.
 */
function keepCellControlsVisible(id) {
  const cellContainer = document.querySelector(`#prompt-${id}`)?.closest('.cell-container');
  if (cellContainer) {
    cellContainer.classList.add('focused');
  }
}

/**
 * Update all cell model selectors to use the main model selector's value as default
 * This is called when the grid is rendered or when models are loaded
 */
function updateAllCellModelDefaults() {
  const mainModelSelect = document.getElementById('model-select');
  if (!mainModelSelect) return;
  
  const selectedModel = mainModelSelect.value;
  if (!selectedModel || selectedModel === 'loading') return;
  
  // Find all cell model selectors
  const cellModelSelectors = document.querySelectorAll('.cell-model-select');
  
  cellModelSelectors.forEach(selector => {
    const cellId = selector.id.replace('model-', '');
    const cell = currentSheet.cells[cellId];
    
    // Only update if the cell doesn't have a specific model set
    if (!cell || !cell.model) {
      selector.value = selectedModel;
      // Also update the cell object in memory
      if (!currentSheet.cells[cellId]) {
        currentSheet.cells[cellId] = { 
          prompt: '', 
          output: '', 
          model: selectedModel, 
          temperature: 0.7, 
          cellPrompt: '', 
          autoRun: false 
        };
      } else {
        currentSheet.cells[cellId].model = selectedModel;
      }
    }
  });
  
  // Also update the modal model selector if it exists and doesn't have a specific model set
  const modalModelSelect = document.getElementById('modalModel');
  if (modalModelSelect && (!modalModelSelect.value || modalModelSelect.value === 'loading')) {
    modalModelSelect.value = selectedModel;
  }
}

/**
 * Parse dependencies from a prompt. Dependencies are denoted by {{ID}} where ID is another cell identifier.
 * @param {string} prompt The prompt string to parse.
 * @returns {string[]} List of referenced cell IDs.
 */
function parseDependencies(prompt) {
  // Support multiple reference formats:
  // {{A1}} - just the cell output
  // {{prompt:A1}} - the cell's prompt
  // {{output:A1}} - the cell's output (explicit)
  // {{A1-1}} - first generation of cell A1
  // {{A1-2}} - second generation of cell A1
  // {{A1:1-3}} - generations 1 to 3 of cell A1
  // {{A1:2}} - just generation 2 of cell A1
  // {{Sheet2!A1}} - cross-sheet reference
  // {{prompt:Sheet2!A1}} - cross-sheet prompt
  const regex = /\{\{([^}]+)\}\}/g;
  const deps = [];
  let match;
  console.log(`🔍 Parsing dependencies from prompt: "${prompt}"`);
  console.log(`🔍 Prompt contains {{:`, prompt.includes('{{'));
  console.log(`🔍 Prompt contains }}:`, prompt.includes('}}'));
  while ((match = regex.exec(prompt)) !== null) {
    console.log(`🔍 Found dependency: "${match[1]}"`);
    deps.push(match[1]);
  }
  console.log(`🔍 All dependencies found:`, deps);
  return deps;
}

/**
 * Resolve a cell reference to get its value, supporting cross-sheet references
 */
function resolveCellReference(reference) {
  console.log(`🔍 Resolving cell reference: "${reference}"`);
  
  // Parse the reference to determine what to return
  let targetSheet = currentSheet;
  let cellId = reference;
  let returnType = 'output'; // default to output
  let generationSpec = null; // for generation-specific references
  
  // Check for generation-specific references (A1-1, A1:1-3, A1:2)
  if (reference.includes('-') || reference.includes(':')) {
    // Handle generation references like A1-1, A1:1-3, A1:2
    if (reference.includes('-') && !reference.includes(':')) {
      // Format: A1-1 (single generation)
      const parts = reference.split('-');
      if (parts.length === 2) {
        cellId = parts[0];
        generationSpec = { type: 'single', index: parseInt(parts[1]) - 1 }; // Convert to 0-based index
        console.log(`🔍 Single generation reference: cell="${cellId}", generation="${parts[1]}"`);
      }
    } else if (reference.includes(':')) {
      // Format: A1:1-3 or A1:2
      const parts = reference.split(':');
      if (parts.length === 2) {
        cellId = parts[0];
        const genPart = parts[1];
        if (genPart.includes('-')) {
          // Format: A1:1-3 (range)
          const [start, end] = genPart.split('-').map(n => parseInt(n) - 1); // Convert to 0-based
          generationSpec = { type: 'range', start, end };
          console.log(`🔍 Generation range reference: cell="${cellId}", range="${genPart}"`);
        } else {
          // Format: A1:2 (single generation)
          generationSpec = { type: 'single', index: parseInt(genPart) - 1 }; // Convert to 0-based
          console.log(`🔍 Single generation reference: cell="${cellId}", generation="${genPart}"`);
        }
      }
    }
  }
  
  // Check for explicit type specification (prompt: or output:)
  if (!generationSpec && reference.includes(':')) {
    const [type, cellRef] = reference.split(':', 2);
    returnType = type;
    cellId = cellRef;
  }
  
  // Check if it's a cross-sheet reference (SheetName!CellId or prompt:SheetName!CellId)
  if (cellId.includes('!')) {
    const [sheetName, actualCellId] = cellId.split('!');
    console.log(`🔍 Cross-sheet reference: sheet="${sheetName}", cell="${actualCellId}", type="${returnType}"`);
    
    // Find the sheet by name
    targetSheet = sheets.find(sheet => sheet.name === sheetName);
    if (!targetSheet) {
      console.warn(`❌ Sheet "${sheetName}" not found`);
      return '[Sheet not found]';
    }
    cellId = actualCellId;
  } else {
    console.log(`🔍 Current sheet reference: "${cellId}", type="${returnType}"`);
  }
  
  // Get the cell from the target sheet
  const cell = targetSheet.cells[cellId];
  if (!cell) {
    console.warn(`❌ Cell "${cellId}" not found in sheet "${targetSheet.name}"`);
    console.log(`🔍 Available cells in sheet "${targetSheet.name}":`, Object.keys(targetSheet.cells));
    console.log(`🔍 All cells in sheet "${targetSheet.name}":`, targetSheet.cells);
    return '[Cell not found]';
  }
  
  // Debug: Log the cell content
  console.log(`🔍 Cell ${cellId} content:`, {
    prompt: cell.prompt,
    output: cell.output,
    hasPrompt: !!cell.prompt,
    hasOutput: !!cell.output,
    promptLength: cell.prompt ? cell.prompt.length : 0,
    outputLength: cell.output ? cell.output.length : 0,
    outputPreview: cell.output ? cell.output.substring(0, 100) + '...' : 'none'
  });
  
  // Return the requested value
  let result;
  
  // Handle generation-specific references
  if (generationSpec) {
    console.log(`🔍 Processing generation reference for ${cellId}:`, generationSpec);
    
    // Check if cell has generations
    if (!cell.generations || cell.generations.length === 0) {
      result = `[ERROR: Cell ${cellId} has no generations]`;
      console.warn(`❌ Cell ${cellId} has no generations`);
    } else {
      console.log(`🔍 Cell ${cellId} has ${cell.generations.length} generations`);
      
      if (generationSpec.type === 'single') {
        // Single generation reference (A1-1, A1:2)
        const index = generationSpec.index;
        if (index >= 0 && index < cell.generations.length) {
          result = cell.generations[index].output || '';
          console.log(`✅ Returning generation ${index + 1} for ${cellId}: "${result}"`);
        } else {
          result = `[ERROR: Cell ${cellId} generation ${index + 1} not found (has ${cell.generations.length} generations)]`;
          console.warn(`❌ Cell ${cellId} generation ${index + 1} not found`);
        }
      } else if (generationSpec.type === 'range') {
        // Range generation reference (A1:1-3)
        const { start, end } = generationSpec;
        if (start >= 0 && end < cell.generations.length && start <= end) {
          const generations = cell.generations.slice(start, end + 1);
          result = generations.map(gen => gen.output || '').join('\n\n---\n\n');
          console.log(`✅ Returning generations ${start + 1}-${end + 1} for ${cellId}: "${result}"`);
        } else {
          result = `[ERROR: Cell ${cellId} generation range ${start + 1}-${end + 1} not found (has ${cell.generations.length} generations)]`;
          console.warn(`❌ Cell ${cellId} generation range ${start + 1}-${end + 1} not found`);
        }
      }
    }
  } else if (returnType === 'prompt') {
    result = cell.prompt || '';
    console.log(`✅ Returning prompt for ${cellId}: "${result}"`);
  } else {
    // For output, if there's no output but there's a prompt, return the prompt content
    // This handles cases where the cell hasn't been run yet
    // Also treat "No generations yet" as if it's empty
    if (!cell.output || cell.output.trim() === '' || cell.output === 'No generations yet') {
      if (cell.prompt && cell.prompt.trim() !== '') {
        result = cell.prompt;
        console.log(`⚠️ Cell ${cellId} has no output (or "No generations yet"), returning prompt instead: "${result}"`);
      } else {
        // Cell has neither output nor prompt - throw an error
        result = `[ERROR: Cell ${cellId} is completely empty - no prompt or output]`;
        console.error(`❌ Cell ${cellId} is completely empty - no prompt or output`);
      }
    } else {
      // Check if the output contains generation history text (which shouldn't be returned)
      if (cell.output.includes('Generation History:') || cell.output.includes('Latest') && cell.output.includes('PM -')) {
        // This looks like generation history text, not actual output
        console.warn(`⚠️ Cell ${cellId} output appears to be generation history text, not actual output`);
        if (cell.prompt && cell.prompt.trim() !== '') {
          result = cell.prompt;
          console.log(`⚠️ Returning prompt instead of generation history: "${result}"`);
        } else {
          result = `[ERROR: Cell ${cellId} output is generation history, not actual content]`;
          console.error(`❌ Cell ${cellId} output is generation history, not actual content`);
        }
      } else {
        result = cell.output;
        console.log(`✅ Returning output for ${cellId}: "${result}"`);
      }
    }
  }
  
  // Debug: Log the final result
  console.log(`🔍 Final result for ${cellId}:`, {
    result: result,
    resultType: typeof result,
    resultLength: result ? result.length : 0,
    isEmpty: !result || result.trim() === '',
    containsNoGenerations: result && result.includes('No generations yet'),
    generationSpec: generationSpec
  });
  
  // Debug: Check if the result is empty or contains "No generations yet"
  if (!result || result.trim() === '') {
    console.warn(`⚠️ Cell ${cellId} resolved to empty result!`);
  }
  if (result && result.includes('No generations yet')) {
    console.warn(`⚠️ Cell ${cellId} result contains "No generations yet":`, result);
  }
  
  console.log(`🔍 Referenced cell details:`, {
    id: cellId,
    sheet: targetSheet.name,
    type: returnType,
    exists: !!cell,
    prompt: cell?.prompt || 'none',
    output: cell?.output || 'none',
    hasOutput: !!cell?.output,
    outputLength: cell?.output?.length || 0,
    result: result,
    fullCellObject: cell
  });
  
  // Check if the result is "No generations yet" and log a warning
  if (result === 'No generations yet') {
    console.warn(`⚠️ Cell ${cellId} resolved to "No generations yet" - this should not happen!`);
    console.warn(`⚠️ Cell ${cellId} prompt:`, cell?.prompt);
    console.warn(`⚠️ Cell ${cellId} output:`, cell?.output);
  }
  
  // Check if the result is empty or contains "No generations yet"
  if (!result || result.trim() === '') {
    console.warn(`⚠️ Cell ${cellId} resolved to empty result!`);
  }
  if (result && result.includes('No generations yet')) {
    console.warn(`⚠️ Cell ${cellId} result contains "No generations yet":`, result);
  }
  
  return result;
}

/**
 * Use selected generations in the current cell
 */
function useSelectedGenerations() {
  const checkboxes = document.querySelectorAll('.generation-checkbox:checked');
  if (checkboxes.length === 0) {
    alert('Please select at least one generation to use.');
    return;
  }
  
  const selectedGenerations = [];
  checkboxes.forEach(checkbox => {
    const cellId = checkbox.id.split('-')[2]; // Extract cell ID from checkbox ID
    const generationNumber = parseInt(checkbox.id.split('-')[3]); // Extract generation number
    const cell = currentSheet.cells[cellId];
    
    if (cell && cell.generations && cell.generations[generationNumber - 1]) {
      selectedGenerations.push({
        cellId: cellId,
        generationNumber: generationNumber,
        output: cell.generations[generationNumber - 1].output
      });
    }
  });
  
  if (selectedGenerations.length > 0) {
    // Combine selected generations
    const combinedOutput = selectedGenerations.map(gen => 
      `Generation ${gen.generationNumber} from ${gen.cellId}:\n${gen.output}`
    ).join('\n\n---\n\n');
    
    // Update the current cell's prompt with the combined output
    const modalPrompt = document.getElementById('modalPrompt');
    modalPrompt.value = combinedOutput;
    
    // Clear selection
    clearGenerationSelection();
    
    console.log('✅ Used selected generations:', selectedGenerations);
  }
}

/**
 * Clear generation selection
 */
function clearGenerationSelection() {
  const checkboxes = document.querySelectorAll('.generation-checkbox');
  checkboxes.forEach(checkbox => {
    checkbox.checked = false;
  });
}

/**
 * Delete a specific generation from a cell
 */
async function deleteGeneration(cellId, generationIndex) {
  try {
    console.log(`🗑️ Deleting generation ${generationIndex} from cell ${cellId}`);
    
    // Get the cell
    const cell = currentSheet.cells[cellId];
    if (!cell || !cell.generations || cell.generations.length === 0) {
      console.warn(`❌ Cell ${cellId} has no generations to delete`);
      return;
    }
    
    // Confirm deletion
    const generation = cell.generations[generationIndex];
    if (!generation) {
      console.warn(`❌ Generation ${generationIndex} not found in cell ${cellId}`);
      return;
    }
    
    const confirmMessage = `Are you sure you want to delete this generation?\n\n${generation.output.substring(0, 100)}${generation.output.length > 100 ? '...' : ''}`;
    if (!confirm(confirmMessage)) {
      return;
    }
    
    // Remove the generation from the array
    cell.generations.splice(generationIndex, 1);
    
    // Update the cell's output if this was the latest generation
    if (generationIndex === cell.generations.length) {
      // This was the latest generation, update the cell's output
      if (cell.generations.length > 0) {
        // Use the new latest generation
        const latestGen = cell.generations[cell.generations.length - 1];
        cell.output = latestGen.output;
      } else {
        // No generations left, clear the output
        cell.output = '';
      }
    }
    
    // Save to database
    if (currentSheet.id) {
      await saveCellToDatabase(cellId, cell.prompt, cell.output, cell.model, cell.temperature, cell.cellPrompt, cell.autoRun);
    }
    
    // Refresh the modal to show updated generations
    if (currentModalCellId === cellId) {
      openModal(cellId);
    }
    
    // Update the grid display
    renderGrid();
    
    console.log(`✅ Successfully deleted generation ${generationIndex} from cell ${cellId}`);
    showSuccess(`Generation deleted successfully!`);
    
  } catch (error) {
    console.error(`❌ Error deleting generation from cell ${cellId}:`, error);
    showError(`Failed to delete generation: ${error.message}`);
  }
}

/**
 * Find all cells that depend on a given cell (including cross-sheet dependencies)
 */
function findDependentCells(cellId) {
  const dependentCells = [];
  
  // Check current sheet
  for (const [id, cell] of Object.entries(currentSheet.cells)) {
    if (cell.prompt && (cell.prompt.includes(`{{${cellId}}}`) || 
                       cell.prompt.includes(`{{prompt:${cellId}}}`) || 
                       cell.prompt.includes(`{{output:${cellId}}}`) ||
                       cell.prompt.includes(`{{${cellId}-`))) {
      dependentCells.push(id);
    }
  }
  
  // Check all other sheets for cross-sheet references
  for (const sheet of sheets) {
    if (sheet.id === currentSheet.id) continue; // Skip current sheet (already checked)
    
    for (const [id, cell] of Object.entries(sheet.cells)) {
      if (cell.prompt && (cell.prompt.includes(`{{${currentSheet.name}!${cellId}}}`) ||
                         cell.prompt.includes(`{{prompt:${currentSheet.name}!${cellId}}}`) ||
                         cell.prompt.includes(`{{output:${currentSheet.name}!${cellId}}}`) ||
                         cell.prompt.includes(`{{${currentSheet.name}!${cellId}-`))) {
        dependentCells.push(`${sheet.name}!${id}`);
      }
    }
  }
  
  return dependentCells;
}

/**
 * Run dependent cells in sequence with visual feedback
 */
async function runDependentCells(cellId, executionOrder = []) {
  const dependentCells = findDependentCells(cellId);
  
  if (dependentCells.length === 0) {
    return;
  }
  
  console.log(`Cell ${cellId} updated. Found ${dependentCells.length} dependent cells:`, dependentCells);
  
  // Show execution order to user
  showExecutionOrder(cellId, dependentCells);
  
  // Filter dependent cells to only include those with auto-run enabled
  const autoRunDependentCells = dependentCells.filter(depCellId => {
    if (depCellId.includes('!')) {
      // Cross-sheet dependency - check the target sheet
      const [sheetName, cellId] = depCellId.split('!');
      const targetSheet = sheets.find(sheet => sheet.name === sheetName);
      return targetSheet && targetSheet.cells[cellId] && targetSheet.cells[cellId].autoRun;
    } else {
      // Current sheet dependency
      return currentSheet.cells[depCellId] && currentSheet.cells[depCellId].autoRun;
    }
  });
  
  if (autoRunDependentCells.length === 0) {
    console.log(`No dependent cells have auto-run enabled for cell ${cellId}`);
    return;
  }
  
  console.log(`Running ${autoRunDependentCells.length} dependent cells with auto-run enabled:`, autoRunDependentCells);
  
  // Run each dependent cell in sequence
  for (let i = 0; i < autoRunDependentCells.length; i++) {
    const depCellId = autoRunDependentCells[i];
    
    // Add to execution order
    executionOrder.push(depCellId);
    
    // Show which cell is currently running
    showCellRunning(depCellId, i + 1, autoRunDependentCells.length);
    
    try {
      // Handle cross-sheet dependencies
      if (depCellId.includes('!')) {
        const [sheetName, cellId] = depCellId.split('!');
        const targetSheet = sheets.find(sheet => sheet.name === sheetName);
        
        if (targetSheet) {
          // Switch to the target sheet temporarily
          const originalSheetIndex = currentSheetIndex;
          const originalSheet = currentSheet;
          
          // Switch to target sheet
          currentSheetIndex = sheets.indexOf(targetSheet);
          currentSheet = targetSheet;
          cells = currentSheet.cells;
          numRows = currentSheet.numRows;
          numCols = currentSheet.numCols;
          
          // Run the cell
          await runCell(cellId);
          
          // Switch back to original sheet
          currentSheetIndex = originalSheetIndex;
          currentSheet = originalSheet;
          cells = currentSheet.cells;
          numRows = currentSheet.numRows;
          numCols = currentSheet.numCols;
          
          // Re-render the grid
          renderGrid();
        }
      } else {
        // Current sheet dependency
        await runCell(depCellId);
      }
      
      // Check if this cell has its own dependencies
      const subDeps = findDependentCells(depCellId);
      if (subDeps.length > 0) {
        await runDependentCells(depCellId, executionOrder);
      }
      
    } catch (error) {
      console.error(`Error running dependent cell ${depCellId}:`, error);
      showError(`Failed to run dependent cell ${depCellId}: ${error.message}`);
    }
  }
  
  // Show completion message
  showExecutionComplete(cellId, executionOrder);
}

/**
 * Recursively run a cell by resolving dependencies and calling the API.
 * @param {string} id Cell identifier to run.
 * @param {Set<string>} visited Set of visited cell IDs to detect cycles.
 */
async function runCell(id, visited = new Set()) {
  if (visited.has(id)) {
    alert('Cycle detected for ' + id);
    return;
  }
  visited.add(id);
  // Ensure cell exists in currentSheet.cells
  if (!currentSheet.cells[id]) {
    // Get the default model from the main selector
    const mainModelSelect = document.getElementById('model-select');
    const defaultModel = mainModelSelect ? mainModelSelect.value : 'gpt-3.5-turbo';
    currentSheet.cells[id] = { prompt: '', output: '', model: defaultModel, temperature: 0.7 };
  }
  const cell = currentSheet.cells[id];
  
  // Show processing indicator
  const outDiv = document.getElementById('output-' + id);
  if (outDiv) {
    outDiv.textContent = 'Processing...';
    outDiv.style.color = '#6c757d';
    outDiv.style.fontStyle = 'italic';
  }
  
  // Resolve dependencies (including cross-sheet references)
  console.log(`🔍 Cell ${id} prompt:`, cell.prompt);
  console.log(`🔍 Cell ${id} prompt type:`, typeof cell.prompt);
  console.log(`🔍 Cell ${id} prompt length:`, cell.prompt ? cell.prompt.length : 0);
  const deps = parseDependencies(cell.prompt);
  console.log(`Cell ${id} has dependencies:`, deps);
  
  // Handle dependencies - only run cells from current sheet
  for (const depId of deps) {
    // Skip cross-sheet references (they don't need to be run)
    if (depId.includes('!')) {
      continue;
    }
    
    if (!currentSheet.cells[depId]) {
      console.warn(`❌ Referenced cell ${depId} does not exist. Creating empty cell.`);
      // Create the cell if it doesn't exist
      // Get the default model for new cells
      const defaultModel = getDefaultModel();
      currentSheet.cells[depId] = { prompt: '', output: '', model: defaultModel, temperature: 0.7, cellPrompt: '', autoRun: false };
      currentSheet.cells[depId].output = `[ERROR: Cell ${depId} does not exist]`;
      continue;
    }
    
    // If the dependent cell has no output, run it first
    // Also treat "No generations yet" as if it's empty
    if (!currentSheet.cells[depId].output || currentSheet.cells[depId].output.trim() === '' || currentSheet.cells[depId].output === 'No generations yet') {
      // Check if the dependent cell has a prompt
      if (!currentSheet.cells[depId].prompt || currentSheet.cells[depId].prompt.trim() === '') {
        // If the dependent cell is empty, set an error output
        currentSheet.cells[depId].output = `[ERROR: Cell ${depId} is completely empty - no prompt or output]`;
        console.error(`❌ Cell ${depId} is completely empty - no prompt or output`);
      } else {
        console.log(`🔄 Cell ${depId} has prompt but no output (or "No generations yet"), running it first...`);
      await runCell(depId, visited);
        console.log(`🔄 Cell ${depId} output after running:`, currentSheet.cells[depId].output);
    }
    } else {
      console.log(`✅ Cell ${depId} already has output:`, currentSheet.cells[depId].output);
  }
  }
  
  // Get model and temperature from cell's individual controls
  const modelSelect = document.getElementById('model-' + id);
  const tempInput = document.getElementById('temp-' + id);
  // Use the cell's model if it exists (from modal or previous runs), otherwise use the DOM selector
  const model = cell.model || (modelSelect ? modelSelect.value : 'gpt-3.5-turbo');
  const temperature = cell.temperature !== undefined ? cell.temperature : (tempInput ? parseFloat(tempInput.value) : 0.7);
  
  // Validate and set the final model early
  let finalModel = model;
  if (!model || model === '' || !availableModels.find(m => m.id === model)) {
    // Fallback to first available model or default
    const fallbackModel = availableModels.length > 0 ? availableModels[0].id : 'gpt-3.5-turbo';
    console.log(`⚠️ Invalid model "${model}", using fallback: "${fallbackModel}"`);
    finalModel = fallbackModel;
  }
  
  // Update cell's stored model and temperature
  cell.model = finalModel;
  cell.temperature = temperature;
  
  // Replace placeholders with actual outputs (including cross-sheet references)
  let processedPrompt = cell.prompt;
  console.log(`🔄 Original prompt for ${id}:`, processedPrompt);
  console.log(`🔄 Dependencies found:`, deps);
  console.log(`🔄 Current sheet cells:`, Object.keys(currentSheet.cells));
  console.log(`🔄 All cells in current sheet:`, currentSheet.cells);
  
  // Debug each dependency resolution
  for (const depId of deps) {
    console.log(`🔍 About to resolve dependency: ${depId}`);
    const resolvedValue = resolveCellReference(depId);
    console.log(`🔍 Resolved value for ${depId}:`, resolvedValue);
  }
  
  // Debug specific cells that are being referenced
  for (const depId of deps) {
    if (currentSheet.cells[depId]) {
      console.log(`🔍 Cell ${depId} details:`, {
        prompt: currentSheet.cells[depId].prompt,
        output: currentSheet.cells[depId].output,
        hasOutput: !!currentSheet.cells[depId].output,
        outputLength: currentSheet.cells[depId].output?.length || 0
      });
    } else {
      console.log(`❌ Cell ${depId} does not exist in currentSheet.cells`);
    }
  }
  
  for (const depId of deps) {
    const replacement = resolveCellReference(depId);
    console.log(`🔄 Replacing {{${depId}}} with:`, replacement);
    console.log(`🔄 Replacement type:`, typeof replacement);
    console.log(`🔄 Replacement length:`, replacement ? replacement.length : 0);
    
    // Replace all occurrences of the placeholder
    const beforeReplace = processedPrompt;
    processedPrompt = processedPrompt.split('{{' + depId + '}}').join(replacement);
    console.log(`🔄 Before: "${beforeReplace}"`);
    console.log(`🔄 After: "${processedPrompt}"`);
  }
  
  // For image generation (DALL-E), if the processed prompt is empty or contains error messages, use the cell's content
  if ((processedPrompt.trim() === '' || processedPrompt.includes('[ERROR:') || processedPrompt.includes('No generations yet')) && (finalModel === 'dall-e-2' || finalModel === 'dall-e-3')) {
    console.log(`🖼️ Empty or error prompt for image generation, using cell content as prompt`);
    console.log(`🖼️ Cell data:`, { prompt: cell.prompt, output: cell.output, cellPrompt: cell.cellPrompt });
    
    // Check if cell has any content
    const cellContent = cell.prompt || cell.output || cell.cellPrompt;
    if (!cellContent || cellContent.trim() === '') {
      // Show pretty alert for missing content
      showError(`🖼️ Image generation requires cell content! Please add a prompt, output, or cell prompt template to cell ${id} before generating an image.`);
      return; // Exit the function early
    }
    
    processedPrompt = cellContent;
    console.log(`🖼️ Using cell content as prompt: "${processedPrompt}"`);
  }
  
  // Final check: ensure we have a valid prompt for DALL-E
  if ((finalModel === 'dall-e-2' || finalModel === 'dall-e-3') && (processedPrompt.trim() === '' || processedPrompt.includes('[ERROR:'))) {
    console.log(`🖼️ Still empty or error prompt for DALL-E, using fallback`);
    processedPrompt = 'Generate an image';
    console.log(`🖼️ Using fallback prompt: "${processedPrompt}"`);
  }
  
  // Debug: Log the final prompt before sending to API
  console.log(`🔍 Final prompt before API call: "${processedPrompt}"`);
  console.log(`🔍 Final model: ${finalModel}`);
  console.log(`🔍 Prompt length: ${processedPrompt.length}`);
  
  // Final validation: ensure we have a valid prompt
  if (processedPrompt.trim() === '' || processedPrompt.includes('[ERROR:')) {
    console.error(`❌ Invalid prompt for API call: "${processedPrompt}"`);
    showError(`❌ Invalid prompt for cell ${id}: ${processedPrompt}. Please add content to the cell before generating.`);
    return; // Exit the function early
  }
  
  // If no dependencies were found, log that
  if (deps.length === 0) {
    console.log(`⚠️ No dependencies found in prompt: "${cell.prompt}"`);
  }
  
  console.log(`✅ Final processed prompt for ${id}:`, processedPrompt);
  // Check if it's an Excel formula
  if (processedPrompt.startsWith('=')) {
    cell.output = parseFormula(processedPrompt);
  } else {
    console.log(`🔍 Cell ${id} model debugging:`);
    console.log(`🔍 modelSelect element:`, modelSelect);
    console.log(`🔍 modelSelect value:`, modelSelect ? modelSelect.value : 'not found');
    console.log(`🔍 cell.model:`, cell.model);
    console.log(`🔍 final model:`, finalModel);
    console.log(`🔍 available models:`, availableModels.map(m => m.id));
    
  try {
    // Show loading state
    const outDiv = document.getElementById('output-' + id);
    if (outDiv) {
      const outputContent = outDiv.querySelector('.output-content');
      if (outputContent) {
        outputContent.innerHTML = '<div style="color: #6c757d; font-style: italic;">🔄 Processing...</div>';
      }
      outDiv.style.display = 'block';
    }

    // Get Firebase ID token for authentication
    const tokenResult = await authService.getIdToken();
    if (!tokenResult.success) {
      throw new Error('Authentication required');
    }

    // Get the original model ID for API calls (for OpenRouter models)
    const selectedModel = availableModels.find(m => m.id === finalModel);
    const modelForApi = selectedModel ? (selectedModel.originalId || selectedModel.id) : finalModel;
    
    console.log(`🔍 Making API request to /api/llm with:`, {
      prompt: processedPrompt,
      model: modelForApi,
      modelId: finalModel,
      originalId: selectedModel?.originalId,
      temperature: temperature,
      hasToken: !!tokenResult.token
    });

    // Try server API first, fallback to client-side AI
    let content;
    try {
      const response = await fetch('https://gpt-cells-app-production.up.railway.app/api/llm', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenResult.token}`
        },
        body: JSON.stringify({ prompt: processedPrompt, model: modelForApi, temperature }),
      });
      
      console.log(`🔍 API response status:`, response.status, response.statusText);

      if (!response.ok) {
        throw new Error(`Server API Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data || typeof data.text === 'undefined') {
        throw new Error('Invalid response from server');
      }

      content = data.text || '';
    } catch (serverError) {
      console.log('🔄 Server API failed:', serverError.message);
      throw new Error(`Server unavailable: ${serverError.message}`);
    }
    
    cell.output = content;
    console.log(`🔍 Setting cell ${id} output to:`, cell.output);
    
    // Log this generation
    const generation = {
      timestamp: new Date().toISOString(),
      prompt: processedPrompt,
      model: finalModel,
      temperature: temperature,
      output: cell.output,
      type: getMediaType(cell.output)
    };
    
    console.log(`🔍 Creating generation for cell ${id}:`, generation);
    
    // Initialize generations array if it doesn't exist
    if (!cell.generations) {
      cell.generations = [];
      console.log(`🔍 Initialized generations array for cell ${id}`);
    }
    cell.generations.push(generation);
    console.log(`🔍 Added generation to cell ${id}. Total generations: ${cell.generations.length}`);
    console.log(`🔍 All generations for cell ${id}:`, cell.generations);
    
    // Test: Check if the generation was actually added
    console.log(`🔍 Verification - cell ${id} generations after push:`, {
      length: cell.generations.length,
      lastGeneration: cell.generations[cell.generations.length - 1],
      allGenerations: cell.generations
    });
    
    // Check if the output is an image URL, audio, or text and render accordingly
    if (isImageUrl(cell.output)) {
      renderImageOutput(id, cell.output);
    } else if (isAudioUrl(cell.output)) {
      renderAudioOutput(id, cell.output);
    } else {
      renderTextOutput(id, cell.output);
    }

    // Show success notification for successful generation
    showSuccess(`Generated ${generation.type} content in cell ${id}`);
    
  } catch (err) {
    console.error('Error in runCell:', err);
    
    // Check if it's a network error
    if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
      cell.output = `Error: Network connection failed. Please check your internet connection and try again.`;
      showError(`Network error in cell ${id}: Please check your internet connection and try again.`);
    } else if (err.message.includes('Failed to download generated image')) {
      cell.output = `Error: Failed to download generated image. The image was created but couldn't be downloaded.`;
      showError(`Image download failed in cell ${id}: ${err.message}`);
    } else {
      cell.output = `Error: ${err.message}`;
      showError(`Failed to generate content in cell ${id}: ${err.message}`);
    }
    
    renderTextOutput(id, cell.output);
  }
  }
  // Update the UI
  if (outDiv) {
    const outputContent = outDiv.querySelector('.output-content');
    if (outputContent) {
      outputContent.textContent = cell.output;
    } else {
    outDiv.textContent = cell.output;
  }
    outDiv.style.color = '#495057';
    outDiv.style.fontStyle = 'normal';
    outDiv.style.display = 'block'; // Show output when it's updated
    
    // Add visual indicator to cell container
    const cellContainer = outDiv.closest('.cell-container');
    if (cellContainer && cell.output && cell.output.trim() !== '') {
      cellContainer.classList.add('has-output');
    }
  }
  
  // Save to database
  if (currentSheet.id) {
    saveCellToDatabase(id, cell.prompt, cell.output, cell.model, cell.temperature);
  }
  
  // Run dependent cells after this cell is updated
  await runDependentCells(id);
}

/**
 * Run all cells in the grid in row-major order. This function does not attempt
 * a sophisticated topological sort; instead, it simply iterates through all
 * cells and runs each one. Because runCell handles dependencies recursively,
 * referenced cells will run first.
 */
async function runAll() {
  // Find all cells that have prompts (filled cells)
  const filledCells = [];
  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c < numCols; c++) {
      const id = getCellId(c, r);
      const cell = cells[id];
      if (cell && cell.prompt && cell.prompt.trim() !== '') {
        filledCells.push({ id, row: r, col: c });
      }
    }
  }
  
  if (filledCells.length === 0) {
    showSuccess('No cells with prompts found to run');
    return;
  }
  
  console.log(`Running ${filledCells.length} filled cells in batch mode`);
  
  // Show batch execution notification
  showBatchExecutionStart(filledCells.length);
  
  // Run cells one by one with visual feedback
  for (let i = 0; i < filledCells.length; i++) {
    const { id, row, col } = filledCells[i];
    
    // Show current cell being processed
    showBatchCellProgress(id, i + 1, filledCells.length);
    
    try {
      // Highlight the cell being processed
      const cellContainer = document.querySelector(`#prompt-${id}`)?.closest('.cell-container');
      if (cellContainer) {
        cellContainer.classList.add('processing');
      }
      
      // Run the cell
      await runCell(id, new Set());
      
      // Remove processing highlight
      if (cellContainer) {
        cellContainer.classList.remove('processing');
      }
      
      // Small delay between cells for better visual feedback
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`Error running cell ${id}:`, error);
      showError(`Failed to run cell ${id}: ${error.message}`);
      
      // Remove processing highlight on error
      const cellContainer = document.querySelector(`#prompt-${id}`)?.closest('.cell-container');
      if (cellContainer) {
        cellContainer.classList.remove('processing');
      }
    }
  }
  
  // Show completion notification
  showBatchExecutionComplete(filledCells.length);
}

/**
 * Clear all cells in the grid.
 */
function clearAll() {
  for (let r = 0; r < numRows; r++) {
  for (let c = 0; c < numCols; c++) {
      const id = getCellId(c, r);
    cells[id] = { prompt: '', output: '' };
    }
  }
  renderGrid();
}

// Add Excel-like cell selection functionality
let selectedCell = null;
let highlightedRows = new Set();
let highlightedColumns = new Set();

/**
 * Handle cell selection (Excel-like behavior)
 */
function selectCell(cellId) {
  // Remove previous selection
  if (selectedCell) {
    const prevCell = document.querySelector(`#prompt-${selectedCell}`)?.closest('td');
    if (prevCell) {
      prevCell.classList.remove('cell-selected');
    }
  }
  
  // Add selection to new cell
  selectedCell = cellId;
  const cell = document.querySelector(`#prompt-${cellId}`)?.closest('td');
  if (cell) {
    cell.classList.add('cell-selected');
    // Focus the textarea
    const textarea = document.querySelector(`#prompt-${cellId}`);
    if (textarea) {
      textarea.focus();
    }
    // Show output for selected cell
    showOutput(cellId);
  }
  
  // Update status indicator
  const statusElement = document.getElementById('cell-status');
  if (statusElement) {
    statusElement.textContent = `Selected: ${cellId} | Grid: ${numCols}×${numRows}`;
  }
}

/**
 * Add keyboard navigation (Excel-like)
 */
function handleKeyNavigation(event) {
  // Don't handle navigation if modal is open or if target is modal textarea
  const modal = document.getElementById('cellModal');
  if (modal && modal.style.display === 'block') {
    return;
  }
  
  // Don't handle navigation if the target is the modal textarea
  if (event.target && event.target.id === 'modalPrompt') {
    return;
  }
  
  // Global keyboard shortcuts
  if (event.ctrlKey || event.metaKey) {
    switch(event.key) {
      case 'z':
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      case 'y':
        event.preventDefault();
        redo();
        return;
      case 'c':
        event.preventDefault();
        if (selectedCell) {
          copyCell(selectedCell);
        }
        return;
      case 'v':
        event.preventDefault();
        if (selectedCell) {
          pasteCell(selectedCell);
        }
        return;
      case 'f':
        event.preventDefault();
        showFindDialog();
        return;
      case 'h':
        event.preventDefault();
        showReplaceDialog();
        return;
    }
  }
  
  if (!selectedCell) return;
  
  const [col, row] = parseCellId(selectedCell);
  let newCol = col;
  let newRow = row;
  
  switch(event.key) {
    case 'ArrowUp':
      event.preventDefault();
      newRow = Math.max(0, row - 1);
      break;
    case 'ArrowDown':
      event.preventDefault();
      newRow = Math.min(numRows - 1, row + 1);
      break;
    case 'ArrowLeft':
      event.preventDefault();
      newCol = Math.max(0, col - 1);
      break;
    case 'ArrowRight':
      event.preventDefault();
      newCol = Math.min(numCols - 1, col + 1);
      break;
    case 'Enter':
      event.preventDefault();
      // Auto-run the current cell when Enter is pressed
      autoRunCell(selectedCell);
      return;
    case 'Delete':
    case 'Backspace':
      event.preventDefault();
      if (selectedCell) {
        // Ensure cell exists in currentSheet.cells
        if (!currentSheet.cells[selectedCell]) {
          // Get the default model from the main selector
          const mainModelSelect = document.getElementById('model-select');
          const defaultModel = mainModelSelect ? mainModelSelect.value : 'gpt-3.5-turbo';
          currentSheet.cells[selectedCell] = { prompt: '', output: '', model: defaultModel, temperature: 0.7 };
        }
        const cell = currentSheet.cells[selectedCell];
        if (cell) {
          saveState();
          cell.prompt = '';
          cell.output = '';
          const textarea = document.getElementById('prompt-' + selectedCell);
          if (textarea) {
            textarea.value = '';
          }
          const outputDiv = document.getElementById('output-' + selectedCell);
          if (outputDiv) {
            outputDiv.textContent = '';
          }
          // Save to database
          if (currentSheet.id) {
            saveCellToDatabase(selectedCell, '', '', cell.model, cell.temperature);
          }
        }
      }
      return;
    default:
      return;
  }
  
  const newCellId = getCellId(newCol, newRow);
  selectCell(newCellId);
}

/**
 * Parse cell ID to get column and row indices
 */
function parseCellId(cellId) {
  const col = cellId.charCodeAt(0) - 65;
  const row = parseInt(cellId.substring(1)) - 1;
  return [col, row];
}

/**
 * Add loading state to the grid
 */
function setLoadingState(loading) {
  const gridContainer = document.querySelector('.grid-container');
  if (loading) {
    gridContainer.classList.add('loading');
  } else {
    gridContainer.classList.remove('loading');
  }
}

/**
 * Toggle row highlighting
 */
function toggleRowHighlight(rowIndex) {
  if (highlightedRows.has(rowIndex)) {
    highlightedRows.delete(rowIndex);
  } else {
    highlightedRows.add(rowIndex);
  }
  updateRowHighlighting();
}

/**
 * Toggle column highlighting
 */
function toggleColumnHighlight(columnIndex) {
  if (highlightedColumns.has(columnIndex)) {
    highlightedColumns.delete(columnIndex);
  } else {
    highlightedColumns.add(columnIndex);
  }
  updateColumnHighlighting();
}

/**
 * Update row highlighting in the DOM
 */
function updateRowHighlighting() {
  // Remove all row highlighting
  document.querySelectorAll('tr[data-row]').forEach(row => {
    const rowIndex = parseInt(row.getAttribute('data-row'));
    row.classList.remove('row-highlighted');
    
    // Update row header
    const rowHeader = row.querySelector('.row-header');
    if (rowHeader) {
      rowHeader.classList.remove('header-highlighted');
    }
  });
  
  // Add highlighting to selected rows
  highlightedRows.forEach(rowIndex => {
    const row = document.querySelector(`tr[data-row="${rowIndex}"]`);
    if (row) {
      row.classList.add('row-highlighted');
      
      // Highlight row header
      const rowHeader = row.querySelector('.row-header');
      if (rowHeader) {
        rowHeader.classList.add('header-highlighted');
      }
    }
  });
}

/**
 * Update column highlighting in the DOM
 */
function updateColumnHighlighting() {
  // Remove all column highlighting
  document.querySelectorAll('.column-header').forEach(header => {
    header.classList.remove('header-highlighted');
  });
  
  document.querySelectorAll('td').forEach(cell => {
    cell.classList.remove('column-highlighted');
  });
  
  // Add highlighting to selected columns
  highlightedColumns.forEach(columnIndex => {
    // Highlight column header
    const columnHeader = document.querySelector(`th[data-column="${columnIndex}"]`);
    if (columnHeader) {
      columnHeader.classList.add('header-highlighted');
    }
    
    // Highlight all cells in this column
    document.querySelectorAll('tr').forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells[columnIndex]) {
        cells[columnIndex].classList.add('column-highlighted');
      }
    });
  });
}

/**
 * Clear all highlighting
 */
function clearAllHighlighting() {
  highlightedRows.clear();
  highlightedColumns.clear();
  updateRowHighlighting();
  updateColumnHighlighting();
}

/**
 * Delete a row
 */
function deleteRow(rowIndex) {
  if (numRows <= 1) {
    alert('Cannot delete the last row. Grid must have at least one row.');
    return;
  }
  
  // Remove cells from the deleted row
  for (let c = 0; c < numCols; c++) {
    const id = getCellId(c, rowIndex);
    delete cells[id];
  }
  
  // Shift cells up
  for (let r = rowIndex + 1; r < numRows; r++) {
    for (let c = 0; c < numCols; c++) {
      const oldId = getCellId(c, r);
      const newId = getCellId(c, r - 1);
      if (cells[oldId]) {
        cells[newId] = cells[oldId];
        delete cells[oldId];
      }
    }
  }
  
  numRows--;
  
  // Update highlighted rows
  const newHighlightedRows = new Set();
  highlightedRows.forEach(row => {
    if (row < rowIndex) {
      newHighlightedRows.add(row);
    } else if (row > rowIndex) {
      newHighlightedRows.add(row - 1);
    }
    // Skip the deleted row
  });
  highlightedRows = newHighlightedRows;
  
  renderGrid();
  updateRowHighlighting();
}

/**
 * Delete a column
 */
function deleteColumn(columnIndex) {
  if (numCols <= 1) {
    alert('Cannot delete the last column. Grid must have at least one column.');
    return;
  }
  
  // Remove cells from the deleted column
  for (let r = 0; r < numRows; r++) {
    const id = getCellId(columnIndex, r);
    delete cells[id];
  }
  
  // Shift cells left
  for (let c = columnIndex + 1; c < numCols; c++) {
    for (let r = 0; r < numRows; r++) {
      const oldId = getCellId(c, r);
      const newId = getCellId(c - 1, r);
      if (cells[oldId]) {
        cells[newId] = cells[oldId];
        delete cells[oldId];
      }
    }
  }
  
  numCols--;
  
  // Update highlighted columns
  const newHighlightedColumns = new Set();
  highlightedColumns.forEach(col => {
    if (col < columnIndex) {
      newHighlightedColumns.add(col);
    } else if (col > columnIndex) {
      newHighlightedColumns.add(col - 1);
    }
    // Skip the deleted column
  });
  highlightedColumns = newHighlightedColumns;
  
  renderGrid();
  updateColumnHighlighting();
}

/**
 * Insert a new row at the specified index
 */
function insertRow(rowIndex) {
  if (numRows >= 200) {
    alert('Maximum number of rows reached (200).');
    return;
  }
  
  // Shift cells down
  for (let r = numRows - 1; r >= rowIndex; r--) {
    for (let c = 0; c < numCols; c++) {
      const oldId = getCellId(c, r);
      const newId = getCellId(c, r + 1);
      if (cells[oldId]) {
        cells[newId] = cells[oldId];
        delete cells[oldId];
      }
    }
  }
  
  // Initialize new row
  for (let c = 0; c < numCols; c++) {
    const id = getCellId(c, rowIndex);
    cells[id] = { prompt: '', output: '' };
  }
  
  numRows++;
  currentSheet.numRows = numRows;
  
  // Update highlighted rows
  const newHighlightedRows = new Set();
  highlightedRows.forEach(row => {
    if (row < rowIndex) {
      newHighlightedRows.add(row);
    } else {
      newHighlightedRows.add(row + 1);
    }
  });
  highlightedRows = newHighlightedRows;
  
  renderGrid();
  updateRowHighlighting();
  
  // Save sheet dimensions to database
  saveSheetDimensions();
}

/**
 * Insert a new column at the specified index
 */
function insertColumn(columnIndex) {
  if (numCols >= 52) { // A-Z = 26, AA-AZ = 26 more
    alert('Maximum number of columns reached (52).');
    return;
  }
  
  // Shift cells right
  for (let c = numCols - 1; c >= columnIndex; c--) {
    for (let r = 0; r < numRows; r++) {
      const oldId = getCellId(c, r);
      const newId = getCellId(c + 1, r);
      if (cells[oldId]) {
        cells[newId] = cells[oldId];
        delete cells[oldId];
      }
    }
  }
  
  // Initialize new column
  for (let r = 0; r < numRows; r++) {
    const id = getCellId(columnIndex, r);
    cells[id] = { prompt: '', output: '' };
  }
  
  numCols++;
  currentSheet.numCols = numCols;
  
  // Update highlighted columns
  const newHighlightedColumns = new Set();
  highlightedColumns.forEach(col => {
    if (col < columnIndex) {
      newHighlightedColumns.add(col);
    } else {
      newHighlightedColumns.add(col + 1);
    }
  });
  highlightedColumns = newHighlightedColumns;
  
  renderGrid();
  updateColumnHighlighting();
  
  // Save sheet dimensions to database
  saveSheetDimensions();
}

/**
 * Delete a row at the specified index
 */
function deleteRow(rowIndex) {
  // Check if row has any data
  let hasData = false;
  for (let c = 0; c < numCols; c++) {
    const id = getCellId(c, rowIndex);
    if (cells[id] && (cells[id].prompt || cells[id].output)) {
      hasData = true;
      break;
    }
  }
  
  // Check for references to this row
  let hasReferences = false;
  const rowCells = [];
  for (let c = 0; c < numCols; c++) {
    const id = getCellId(c, rowIndex);
    rowCells.push(id);
  }
  
  // Check if any cells reference this row
  for (const [cellId, cell] of Object.entries(cells)) {
    if (cell.prompt) {
      for (const rowCellId of rowCells) {
        if (cell.prompt.includes(`{{${rowCellId}}}`)) {
          hasReferences = true;
          break;
        }
      }
    }
    if (hasReferences) break;
  }
  
  // Show warning if there's data or references
  if (hasData || hasReferences) {
    const message = hasReferences 
      ? `⚠️ WARNING: Row ${rowIndex + 1} contains data and is referenced by other cells. Deleting will break references and cause errors. Continue?`
      : `⚠️ WARNING: Row ${rowIndex + 1} contains data. All data will be lost. Continue?`;
    
    if (!confirm(message)) {
      return;
    }
  }
  
  if (numRows <= 1) {
    alert('Cannot delete the last row. Minimum 1 row required.');
    return;
  }
  
  // Shift cells up
  for (let r = rowIndex + 1; r < numRows; r++) {
    for (let c = 0; c < numCols; c++) {
      const oldId = getCellId(c, r);
      const newId = getCellId(c, r - 1);
      if (cells[oldId]) {
        cells[newId] = cells[oldId];
        delete cells[oldId];
      }
    }
  }
  
  // Clear the last row
  for (let c = 0; c < numCols; c++) {
    const id = getCellId(c, numRows - 1);
    delete cells[id];
  }
  
  numRows--;
  currentSheet.numRows = numRows;
  
  // Update highlighted rows
  const newHighlightedRows = new Set();
  highlightedRows.forEach(row => {
    if (row < rowIndex) {
      newHighlightedRows.add(row);
    } else if (row > rowIndex) {
      newHighlightedRows.add(row - 1);
    }
    // Skip the deleted row
  });
  highlightedRows = newHighlightedRows;
  
  renderGrid();
  updateRowHighlighting();
  
  // Save sheet dimensions to database
  saveSheetDimensions();
  
  showSuccess(`Row ${rowIndex + 1} deleted successfully`);
}

/**
 * Delete a column at the specified index
 */
function deleteColumn(columnIndex) {
  // Check if column has any data
  let hasData = false;
  for (let r = 0; r < numRows; r++) {
    const id = getCellId(columnIndex, r);
    if (cells[id] && (cells[id].prompt || cells[id].output)) {
      hasData = true;
      break;
    }
  }
  
  // Check for references to this column
  let hasReferences = false;
  const columnCells = [];
  for (let r = 0; r < numRows; r++) {
    const id = getCellId(columnIndex, r);
    columnCells.push(id);
  }
  
  // Check if any cells reference this column
  for (const [cellId, cell] of Object.entries(cells)) {
    if (cell.prompt) {
      for (const colCellId of columnCells) {
        if (cell.prompt.includes(`{{${colCellId}}}`)) {
          hasReferences = true;
          break;
        }
      }
    }
    if (hasReferences) break;
  }
  
  // Show warning if there's data or references
  if (hasData || hasReferences) {
    const columnLetter = String.fromCharCode(65 + columnIndex);
    const message = hasReferences 
      ? `⚠️ WARNING: Column ${columnLetter} contains data and is referenced by other cells. Deleting will break references and cause errors. Continue?`
      : `⚠️ WARNING: Column ${columnLetter} contains data. All data will be lost. Continue?`;
    
    if (!confirm(message)) {
      return;
    }
  }
  
  if (numCols <= 1) {
    alert('Cannot delete the last column. Minimum 1 column required.');
    return;
  }
  
  // Shift cells left
  for (let c = columnIndex + 1; c < numCols; c++) {
    for (let r = 0; r < numRows; r++) {
      const oldId = getCellId(c, r);
      const newId = getCellId(c - 1, r);
      if (cells[oldId]) {
        cells[newId] = cells[oldId];
        delete cells[oldId];
      }
    }
  }
  
  // Clear the last column
  for (let r = 0; r < numRows; r++) {
    const id = getCellId(numCols - 1, r);
    delete cells[id];
  }
  
  numCols--;
  currentSheet.numCols = numCols;
  
  // Update highlighted columns
  const newHighlightedColumns = new Set();
  highlightedColumns.forEach(col => {
    if (col < columnIndex) {
      newHighlightedColumns.add(col);
    } else if (col > columnIndex) {
      newHighlightedColumns.add(col - 1);
    }
    // Skip the deleted column
  });
  highlightedColumns = newHighlightedColumns;
  
  renderGrid();
  updateColumnHighlighting();
  
  // Save sheet dimensions to database
  saveSheetDimensions();
  
  const columnLetter = String.fromCharCode(65 + columnIndex);
  showSuccess(`Column ${columnLetter} deleted successfully`);
}

/**
 * Show context menu for row operations
 */
function showRowContextMenu(event, rowIndex) {
  event.preventDefault();
  
  // Remove existing context menu
  const existingMenu = document.getElementById('context-menu');
  if (existingMenu) {
    existingMenu.remove();
  }
  
  // Create context menu
  const menu = document.createElement('div');
  menu.id = 'context-menu';
  menu.style.cssText = `
    position: fixed;
    top: ${event.clientY}px;
    left: ${event.clientX}px;
    background: white;
    border: 1px solid #ccc;
    border-radius: 4px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    z-index: 1000;
    min-width: 150px;
  `;
  
  menu.innerHTML = `
    <div style="padding: 8px 12px; border-bottom: 1px solid #eee; font-weight: 600; color: #333;">Row ${rowIndex + 1}</div>
    <div style="padding: 6px 12px; cursor: pointer; border-bottom: 1px solid #eee;" onmouseover="this.style.backgroundColor='#f0f0f0'" onmouseout="this.style.backgroundColor='white'" onclick="insertRow(${rowIndex}); hideContextMenu();">Insert Row Above</div>
    <div style="padding: 6px 12px; cursor: pointer; border-bottom: 1px solid #eee;" onmouseover="this.style.backgroundColor='#f0f0f0'" onmouseout="this.style.backgroundColor='white'" onclick="insertRow(${rowIndex + 1}); hideContextMenu();">Insert Row Below</div>
    <div style="padding: 6px 12px; cursor: pointer; color: #dc3545;" onmouseover="this.style.backgroundColor='#f0f0f0'" onmouseout="this.style.backgroundColor='white'" onclick="deleteRow(${rowIndex}); hideContextMenu();">Delete Row</div>
  `;
  
  document.body.appendChild(menu);
  
  // Hide menu when clicking elsewhere
  setTimeout(() => {
    document.addEventListener('click', hideContextMenu, { once: true });
  }, 100);
}

/**
 * Show context menu for column operations
 */
function showColumnContextMenu(event, columnIndex) {
  event.preventDefault();
  
  // Remove existing context menu
  const existingMenu = document.getElementById('context-menu');
  if (existingMenu) {
    existingMenu.remove();
  }
  
  // Create context menu
  const menu = document.createElement('div');
  menu.id = 'context-menu';
  menu.style.cssText = `
    position: fixed;
    top: ${event.clientY}px;
    left: ${event.clientX}px;
    background: white;
    border: 1px solid #ccc;
    border-radius: 4px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    z-index: 1000;
    min-width: 150px;
  `;
  
  const colLetter = String.fromCharCode(65 + columnIndex);
  menu.innerHTML = `
    <div style="padding: 8px 12px; border-bottom: 1px solid #eee; font-weight: 600; color: #333;">Column ${colLetter}</div>
    <div style="padding: 6px 12px; cursor: pointer; border-bottom: 1px solid #eee;" onmouseover="this.style.backgroundColor='#f0f0f0'" onmouseout="this.style.backgroundColor='white'" onclick="insertColumn(${columnIndex}); hideContextMenu();">Insert Column Left</div>
    <div style="padding: 6px 12px; cursor: pointer; border-bottom: 1px solid #eee;" onmouseover="this.style.backgroundColor='#f0f0f0'" onmouseout="this.style.backgroundColor='white'" onclick="insertColumn(${columnIndex + 1}); hideContextMenu();">Insert Column Right</div>
    <div style="padding: 6px 12px; cursor: pointer; color: #dc3545;" onmouseover="this.style.backgroundColor='#f0f0f0'" onmouseout="this.style.backgroundColor='white'" onclick="deleteColumn(${columnIndex}); hideContextMenu();">Delete Column</div>
  `;
  
  document.body.appendChild(menu);
  
  // Hide menu when clicking elsewhere
  setTimeout(() => {
    document.addEventListener('click', hideContextMenu, { once: true });
  }, 100);
}

/**
 * Hide context menu
 */
function hideContextMenu() {
  const menu = document.getElementById('context-menu');
  if (menu) {
    menu.remove();
  }
}

/**
 * Show find dialog
 */
function showFindDialog() {
  const findText = prompt('Find:', '');
  if (findText) {
    let found = false;
    for (const [cellId, cell] of Object.entries(cells)) {
      if (cell.prompt.includes(findText)) {
        selectCell(cellId);
        found = true;
        break;
      }
    }
    if (!found) {
      alert('Text not found');
    }
  }
}

/**
 * Show replace dialog
 */
function showReplaceDialog() {
  const findText = prompt('Find:', '');
  if (findText) {
    const replaceText = prompt('Replace with:', '');
    const count = findAndReplace(findText, replaceText);
    alert(`Replaced ${count} occurrences`);
    renderGrid();
  }
}

// Performance optimization: Lazy loading and debouncing
const debounceMap = new Map();

function debounce(func, wait, key) {
  if (debounceMap.has(key)) {
    clearTimeout(debounceMap.get(key));
  }
  const timeout = setTimeout(() => {
    func();
    debounceMap.delete(key);
  }, wait);
  debounceMap.set(key, timeout);
}

// Initialize and render the grid on page load
document.addEventListener('DOMContentLoaded', function() {
  // Check authentication first
  checkAuthentication();
});

// Check if user is authenticated
async function checkAuthentication() {
  try {
    // Show loading state
    const gridContainer = document.getElementById('grid');
    if (gridContainer) {
      gridContainer.innerHTML = '<div style="text-align: center; padding: 50px; color: #6c757d;">🔄 Checking authentication...</div>';
    }

    // Listen for auth state changes
    authService.onAuthStateChanged(async (user) => {
      if (user) {
        currentUser = user;
        isAuthenticated = true;
        
        // Check if user is admin
        isAdmin = await authService.isCurrentUserAdmin();
        console.log('User authenticated:', user.email, 'Admin:', isAdmin);
        
        // If user is admin, show admin button
        if (isAdmin) {
          const adminBtn = document.getElementById('adminButton');
          if (adminBtn) {
            adminBtn.style.display = 'inline-block';
            console.log('✅ Admin button shown for admin user');
          }
        }
        
        await initializeApp();
      } else {
        currentUser = null;
        isAuthenticated = false;
        isAdmin = false;
        console.log('User not authenticated, using demo mode...');
        // For demo purposes, initialize without authentication
        await initializeApp();
      }
    });
  } catch (error) {
    console.error('Authentication error:', error);
    showError('Authentication failed. Please refresh the page.');
  }
}

// Initialize the application after authentication
async function initializeApp() {
  try {
    console.log('🚀 Initializing GPT Cells app...');
    
    // Show loading state
    const gridContainer = document.getElementById('grid');
    if (gridContainer) {
      gridContainer.innerHTML = '<div style="text-align: center; padding: 50px; color: #6c757d;">🔄 Loading GPT Cells...</div>';
    }

    // Check Firebase services
    console.log('🔍 Checking Firebase services...');
    console.log('firestoreService available:', typeof firestoreService !== 'undefined');
    console.log('db available:', typeof db !== 'undefined');
    console.log('auth available:', typeof auth !== 'undefined');
    
    // Wait for firestoreService to be available
    if (typeof firestoreService === 'undefined') {
      console.log('⏳ Waiting for firestoreService to load...');
      // Wait a bit and try again
      setTimeout(() => {
        if (typeof firestoreService !== 'undefined') {
          console.log('✅ firestoreService loaded, continuing...');
          initializeApp();
        } else {
          console.error('❌ firestoreService still not available after timeout');
          showError('Firebase services not loaded. Please refresh the page.');
        }
      }, 1000);
      return;
    }

    // Update user interface
    updateUserInterface();
    
    // Check admin status and add admin button if needed
    checkAdminStatus();
    
    // Check for project parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const requestedProjectId = urlParams.get('project');
    if (requestedProjectId) {
      console.log('📁 Requested project ID from URL:', requestedProjectId);
      currentProjectId = requestedProjectId;
    }
    
    // Load data from Firestore
    await loadProjectsFromDatabase();
    
    // Grid is already rendered by loadProjectsFromDatabase()
    updateSheetTabs();
    
    console.log('GPT Cells application initialized successfully');
    
    // Load available models
    loadAvailableModels();
    
    showSuccess('Application loaded successfully!');
  } catch (error) {
    console.error('Error initializing grid:', error);
    showError('Failed to load application. Please refresh the page.');
    
    // Fallback: create a simple grid
    const gridContainer = document.getElementById('grid');
    if (gridContainer) {
      gridContainer.innerHTML = '<table><tr><th>A</th><th>B</th></tr><tr><td>Test Cell A1</td><td>Test Cell B1</td></tr></table>';
    }
  }
}

// Update user interface with authentication info
function updateUserInterface() {
  if (currentUser) {
    // Update user email in the UI
    const userEmailElement = document.getElementById('userEmail');
    if (userEmailElement) {
      userEmailElement.textContent = currentUser.email || 'User';
    }
    
    // Load user profile data
    loadUserProfile();
  }
}

// Load user profile data
async function loadUserProfile() {
  try {
    if (!currentUser) return;
    
    // Get user document from Firestore
    const userDoc = await firestoreService.getUserProfile(currentUser.uid);
    if (userDoc.success) {
      const userData = userDoc.data;
      
      // Update profile modal if it exists
      const profileEmail = document.getElementById('profileEmail');
      const profileName = document.getElementById('profileName');
      const profileCreatedAt = document.getElementById('profileCreatedAt');
      const profilePlan = document.getElementById('profilePlan');
      const profileUsage = document.getElementById('profileUsage');
      
      if (profileEmail) profileEmail.textContent = userData.email || currentUser.email;
      if (profileName) profileName.textContent = userData.displayName || 'Not set';
      if (profileCreatedAt) profileCreatedAt.textContent = userData.createdAt ? new Date(userData.createdAt).toLocaleDateString() : 'Unknown';
      if (profilePlan) {
        profilePlan.textContent = userData.subscription || 'Free';
        profilePlan.className = userData.subscription === 'pro' ? 'plan-badge pro' : 'plan-badge';
      }
      if (profileUsage) profileUsage.textContent = `${userData.usage?.apiCalls || 0} / ${userData.subscription === 'pro' ? 'Unlimited' : '100'}`;
    }
  } catch (error) {
    console.error('Error loading user profile:', error);
  }
}

// User Management Functions

// Toggle user menu dropdown
function toggleUserMenu() {
  const dropdown = document.getElementById('userDropdown');
  if (dropdown) {
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
  }
}

// Close user menu when clicking outside
document.addEventListener('click', function(event) {
  const userMenu = document.getElementById('userMenu');
  const dropdown = document.getElementById('userDropdown');
  
  if (userMenu && dropdown && !userMenu.contains(event.target)) {
    dropdown.style.display = 'none';
  }
});

// Show user profile modal
function showProfile() {
  const modal = document.getElementById('profileModal');
  if (modal) {
    modal.style.display = 'block';
    loadUserProfile();
  }
}

// Close user profile modal
function closeProfile() {
  const modal = document.getElementById('profileModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// Show settings modal
function showSettings() {
  const modal = document.getElementById('settingsModal');
  if (modal) {
    modal.style.display = 'block';
    loadUserSettings();
  }
}

// Close settings modal
function closeSettings() {
  const modal = document.getElementById('settingsModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// Show usage modal
function showUsage() {
  const modal = document.getElementById('usageModal');
  if (modal) {
    modal.style.display = 'block';
    loadUsageStats();
  }
}

// Close usage modal
function closeUsage() {
  const modal = document.getElementById('usageModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// Load user settings
async function loadUserSettings() {
  try {
    if (!currentUser) return;
    
    // Load settings from localStorage or Firestore
    const settings = JSON.parse(localStorage.getItem('userSettings') || '{}');
    
    // Update form elements
    const defaultModel = document.getElementById('defaultModel');
    const defaultTemperature = document.getElementById('defaultTemperature');
    const tempValue = document.getElementById('tempValue');
    const autoSave = document.getElementById('autoSave');
    const emailNotifications = document.getElementById('emailNotifications');
    const browserNotifications = document.getElementById('browserNotifications');
    
    if (defaultModel) defaultModel.value = settings.defaultModel || 'gpt-4o';
    if (defaultTemperature) {
      defaultTemperature.value = settings.defaultTemperature || 0.7;
      if (tempValue) tempValue.textContent = settings.defaultTemperature || 0.7;
    }
    if (autoSave) autoSave.checked = settings.autoSave !== false;
    if (emailNotifications) emailNotifications.checked = settings.emailNotifications !== false;
    if (browserNotifications) browserNotifications.checked = settings.browserNotifications || false;
    
    // Add event listener for temperature slider
    if (defaultTemperature && tempValue) {
      defaultTemperature.addEventListener('input', function() {
        tempValue.textContent = this.value;
      });
    }
  } catch (error) {
    console.error('Error loading user settings:', error);
  }
}

// Save user settings
async function saveSettings() {
  try {
    if (!currentUser) return;
    
    // Get form values
    const defaultModel = document.getElementById('defaultModel')?.value || 'gpt-4o';
    const defaultTemperature = parseFloat(document.getElementById('defaultTemperature')?.value || 0.7);
    const autoSave = document.getElementById('autoSave')?.checked || false;
    const emailNotifications = document.getElementById('emailNotifications')?.checked || false;
    const browserNotifications = document.getElementById('browserNotifications')?.checked || false;
    
    const settings = {
      defaultModel,
      defaultTemperature,
      autoSave,
      emailNotifications,
      browserNotifications,
      updatedAt: new Date().toISOString()
    };
    
    // Save to localStorage
    localStorage.setItem('userSettings', JSON.stringify(settings));
    
    // Save to Firestore
    await firestoreService.saveUserSettings(currentUser.uid, settings);
    
    showSuccess('Settings saved successfully!');
    closeSettings();
  } catch (error) {
    console.error('Error saving settings:', error);
    showError('Failed to save settings. Please try again.');
  }
}

// Reset settings to defaults
function resetSettings() {
  if (confirm('Are you sure you want to reset all settings to defaults?')) {
    localStorage.removeItem('userSettings');
    loadUserSettings();
    showSuccess('Settings reset to defaults!');
  }
}

// Load usage statistics
async function loadUsageStats() {
  try {
    if (!currentUser) return;
    
    // Get usage data from Firestore
    const usageData = await firestoreService.getUserUsage(currentUser.uid);
    
    if (usageData.success) {
      const usage = usageData.data;
      
      // Update usage display
      const apiCalls = document.getElementById('usageApiCalls');
      const images = document.getElementById('usageImages');
      const audio = document.getElementById('usageAudio');
      const storage = document.getElementById('usageStorage');
      
      if (apiCalls) apiCalls.textContent = usage.apiCalls || 0;
      if (images) images.textContent = usage.images || 0;
      if (audio) audio.textContent = usage.audio || 0;
      if (storage) storage.textContent = `${Math.round((usage.storageUsed || 0) / 1024 / 1024 * 100) / 100} MB`;
      
      // Update limit bars
      const apiLimitFill = document.getElementById('apiLimitFill');
      const apiLimitText = document.getElementById('apiLimitText');
      const storageLimitFill = document.getElementById('storageLimitFill');
      const storageLimitText = document.getElementById('storageLimitText');
      
      if (apiLimitFill && apiLimitText) {
        const apiUsage = (usage.apiCalls || 0) / (usage.subscription === 'pro' ? 10000 : 100);
        const apiPercent = Math.min(apiUsage * 100, 100);
        apiLimitFill.style.width = `${apiPercent}%`;
        apiLimitText.textContent = `${usage.apiCalls || 0} / ${usage.subscription === 'pro' ? '10,000' : '100'}`;
      }
      
      if (storageLimitFill && storageLimitText) {
        const storageUsage = (usage.storageUsed || 0) / (usage.subscription === 'pro' ? 1024 * 1024 * 1024 * 10 : 1024 * 1024 * 1024);
        const storagePercent = Math.min(storageUsage * 100, 100);
        storageLimitFill.style.width = `${storagePercent}%`;
        storageLimitText.textContent = `${Math.round((usage.storageUsed || 0) / 1024 / 1024 * 100) / 100} MB / ${usage.subscription === 'pro' ? '10 GB' : '1 GB'}`;
      }
    }
  } catch (error) {
    console.error('Error loading usage stats:', error);
  }
}

// Edit profile
function editProfile() {
  showError('Profile editing not yet implemented. Coming soon!');
}

// Upgrade plan
function upgradePlan() {
  showError('Plan upgrade not yet implemented. Coming soon!');
}

// Logout user
async function logout() {
  try {
    if (confirm('Are you sure you want to logout?')) {
      const result = await authService.signOut();
      if (result.success) {
        showSuccess('Logged out successfully!');
        window.location.href = '/auth.html';
      } else {
        showError('Failed to logout. Please try again.');
      }
    }
  } catch (error) {
    console.error('Error during logout:', error);
    showError('Failed to logout. Please try again.');
  }
}

// Admin functions
async function makeCurrentUserAdmin() {
  try {
    console.log('🔧 Making current user admin...');
    
    const result = await authService.makeCurrentUserAdmin();
    if (result.success) {
      isAdmin = true;
      showSuccess('You are now an admin! Admin privileges granted.');
      console.log('✅ User is now admin');
      
      // Add admin button to UI if it doesn't exist
      addAdminButton();
    } else {
      showError('Failed to make user admin: ' + result.error);
      console.error('❌ Failed to make user admin:', result.error);
    }
  } catch (error) {
    console.error('❌ Error making user admin:', error);
    showError('Failed to make user admin: ' + error.message);
  }
}

// Add admin link to the user dropdown
function addAdminLink() {
  console.log('🔧 Attempting to show admin link in dropdown...');
  
  // Find the admin link in the dropdown
  const adminLink = document.getElementById('adminLink');
  
  if (adminLink) {
    // Show the admin link
    adminLink.style.display = 'block';
    console.log('✅ Admin link is now visible in dropdown');
  } else {
    console.log('❌ Admin link not found in dropdown');
  }
}

// Check admin status and add link if needed
function checkAdminStatus() {
  console.log('🔍 Checking admin status:', { isAdmin, currentUser: currentUser?.email });
  
  if (isAdmin) {
    console.log('✅ User is admin, showing admin link in dropdown...');
    addAdminLink();
  } else {
    console.log('❌ User is not admin, admin link not shown');
  }
}

/**
 * Load projects from database
 */
async function loadProjectsFromDatabase() {
  try {
    console.log('🔄 Loading projects from database...');
    
    // Check if Firebase services are available
    if (typeof firestoreService === 'undefined') {
      console.error('❌ firestoreService not available');
      throw new Error('Firebase services not loaded');
    }
    
    // Use demo user ID for testing (since we migrated demo data)
    const userId = currentUser ? currentUser.uid : 'demo-user-123';
    console.log('👤 Using user ID:', userId);
    
    const result = await firestoreService.getProjects(userId);
    console.log('📊 Projects result:', result);
    
    if (result.success && result.projects.length > 0) {
      projects = result.projects;
      
      // If a specific project was requested from URL, find it
      if (currentProjectId) {
        currentProject = projects.find(p => p.id === currentProjectId);
        if (!currentProject) {
          console.warn('⚠️ Requested project not found, using first project');
          currentProject = projects[0];
          currentProjectId = currentProject.id;
        }
      } else {
        currentProject = projects[0];
        currentProjectId = currentProject.id;
      }
      
      console.log('✅ Loaded projects:', projects.length);
      console.log('📊 Current project:', currentProject.name);
      console.log('📊 Project default model:', currentProject.defaultModel || 'none');
      console.log('📊 Full current project object:', currentProject);
      
      // Load sheets for the current project
      await loadSheetsFromDatabase();
      
    } else {
      console.log('📝 No projects found, creating default project...');
      
      // Create a default project
      const defaultProject = {
        name: 'My First Project',
        description: 'Default project',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const createResult = await firestoreService.createProject(userId, defaultProject);
      if (createResult.success) {
        currentProjectId = createResult.projectId;
        currentProject = { id: createResult.projectId, ...defaultProject };
        projects = [currentProject];
        
        console.log('✅ Created default project:', currentProject.name);
        
        // Create a default sheet for the new project
        await createDefaultSheetForProject();
      } else {
        throw new Error('Failed to create default project');
      }
    }
    
  } catch (error) {
    console.error('❌ Error loading projects from database:', error);
    throw error;
  }
}

/**
 * Load sheets from database for current project
 */
async function loadSheetsFromDatabase() {
  try {
    console.log('🔄 Loading sheets from database...');
    
    // Check if Firebase services are available
    if (typeof firestoreService === 'undefined') {
      console.error('❌ firestoreService not available');
      throw new Error('Firebase services not loaded');
    }
    
    // Use demo user ID for testing (since we migrated demo data)
    const userId = currentUser ? currentUser.uid : 'demo-user-123';
    const projectId = currentProjectId || 'default-project';
    console.log('👤 Using user ID:', userId);
    console.log('📁 Using project ID:', projectId);
    
    const result = await firestoreService.getSheets(userId, projectId);
    console.log('📊 Sheets result:', result);
    
    if (result.success && result.sheets.length > 0) {
      // Update sheets array
      sheets = result.sheets.map(sheet => ({
        id: sheet.id,
        name: sheet.name,
        cells: {},
        numRows: sheet.numRows || 10,
        numCols: sheet.numCols || 10,
        columnNames: sheet.columnNames || {}
      }));
      
      // Load first sheet
      if (sheets.length > 0) {
        currentSheetIndex = 0;
        currentSheet = sheets[currentSheetIndex];
        console.log('📊 Loaded sheet from database:', currentSheet);
        console.log('📊 Sheet ID from database:', currentSheet?.id || 'null/undefined');
        
        // Update global variables with loaded dimensions
        numRows = currentSheet.numRows;
        numCols = currentSheet.numCols;
        await loadSheetCells(currentSheet.id);
        loadProjectTitle();
renderGrid();
        updateSheetTabs();
      }
    } else {
      // No sheets found in Firestore, create a default sheet for this project
      console.log('📄 No sheets found in Firestore, creating default sheet for project...');
      await createDefaultSheetForProject();
    }
  } catch (error) {
    console.error('Error loading sheets:', error);
    // Try loading from localStorage
    console.log('Firestore failed, trying localStorage...');
    if (loadSheetsFromLocalStorage()) {
      loadProjectTitle();
      renderGrid();
      updateSheetTabs();
    } else {
      // Fallback: create a default sheet for this project
      console.log('📄 Creating default sheet as fallback...');
      await createDefaultSheetForProject();
    }
  }
}

/**
 * Load sheets from Firestore
 */
async function loadSheetsFromFirestore() {
  try {
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    const result = await firestoreService.getSheets(currentUser.uid);
    
    if (result.success && result.sheets.length > 0) {
      sheets = result.sheets;
      currentSheetIndex = 0;
      currentSheet = sheets[currentSheetIndex];
      cells = currentSheet.cells || {};
      numRows = currentSheet.numRows || 10;
      numCols = currentSheet.numCols || 10;
      
      console.log('Sheets loaded from Firestore:', sheets.length);
    } else {
      console.warn('No sheets found in Firestore, creating default sheet');
      // Create default sheet in Firestore
      await createDefaultSheet();
    }
  } catch (error) {
    console.error('Error loading sheets from Firestore:', error);
    // Continue with default sheets
  }
}

/**
 * Create default sheet in Firestore
 */
async function createDefaultSheet() {
  try {
    if (!currentUser) return;

    const sheetData = {
      name: 'Sheet1',
      numRows: 10,
      numCols: 10,
      cells: {}
    };

    const projectId = currentProjectId || 'default-project';
    const result = await firestoreService.createSheet(currentUser.uid, projectId, sheetData);
    if (result.success) {
      sheets[0].id = result.sheetId;
      currentSheet = sheets[0];
      console.log('Default sheet created in Firestore');
    }
  } catch (error) {
    console.error('Error creating default sheet:', error);
  }
}

/**
 * Load and set the project title from current sheet
 */
function loadProjectTitle() {
  if (currentSheet && currentSheet.name) {
    const titleElement = document.getElementById('project-title');
    if (titleElement) {
      titleElement.textContent = currentSheet.name;
    }
    
    // Update the page title
    document.title = `${currentSheet.name} - GPT Cells`;
  }
}

/**
 * Load cells for a specific sheet
 */
async function loadSheetCells(sheetId) {
  try {
    console.log(`🔄 Loading cells for sheet ${sheetId}`);
    const userId = currentUser ? currentUser.uid : 'demo-user-123';
    const projectId = currentProjectId || 'default-project';
    
    // Get cells from Firestore
    const cellsSnapshot = await db.collection('users').doc(userId).collection('projects').doc(projectId).collection('sheets').doc(sheetId).collection('cells').get();
    
    if (!cellsSnapshot.empty) {
      // Convert Firestore cells to our format
      currentSheet.cells = {};
      cellsSnapshot.forEach(doc => {
        const cellData = doc.data();
        // Get the default model from the main selector
        const mainModelSelect = document.getElementById('model-select');
        const loadDefaultModel = mainModelSelect ? mainModelSelect.value : 'gpt-3.5-turbo';
        
        const cell = {
          prompt: cellData.prompt || '',
          output: cellData.output || '',
          model: cellData.model || loadDefaultModel,
          temperature: cellData.temperature !== undefined ? cellData.temperature : 0.7,
          cellPrompt: cellData.cellPrompt || '',
          autoRun: cellData.autoRun || false,
          generations: cellData.generations || []
        };
        
        console.log(`🔍 Loading cell ${doc.id} from Firestore:`, {
          hasGenerations: !!cellData.generations,
          generationsLength: cellData.generations ? cellData.generations.length : 0,
          generationsData: cellData.generations,
          cellData: cellData
        });
        
        currentSheet.cells[doc.id] = cell;
      });
      console.log('✅ Loaded cells from Firestore:', currentSheet.cells);
      
      // Debug specific cell A1 if it exists
      if (currentSheet.cells['A1']) {
        console.log('🔍 Cell A1 loaded from Firestore:', {
          prompt: currentSheet.cells['A1'].prompt,
          output: currentSheet.cells['A1'].output,
          hasOutput: !!currentSheet.cells['A1'].output,
          outputLength: currentSheet.cells['A1'].output?.length || 0,
          generations: currentSheet.cells['A1'].generations?.length || 0,
          generationsData: currentSheet.cells['A1'].generations
        });
      } else {
        console.log('❌ Cell A1 not found in loaded cells');
      }
      
      // Re-render the grid to show the loaded cells
      renderGrid();
    } else {
      console.log('No cells found in Firestore for sheet', sheetId);
      // Initialize empty cells if none found
      currentSheet.cells = {};
    }
  } catch (error) {
    console.error('❌ Error loading sheet cells:', error);
  }
}

/**
 * Save cell to database
 */
async function saveCellToDatabase(cellId, prompt, output, model = null, temperature = null, cellPrompt = null, autoRun = null) {
  try {
    // Ensure sheet has an ID before saving
    await ensureSheetHasId();
    
    // Get current model and temperature from UI if not provided
    const currentModel = model || document.getElementById('model-select')?.value || 'gpt-3.5-turbo';
    const currentTemperature = temperature !== null ? temperature : parseFloat(document.getElementById('temp-input')?.value || 0.7);
    const currentCellPrompt = cellPrompt !== null ? cellPrompt : (currentSheet.cells[cellId]?.cellPrompt || '');
    const currentAutoRun = autoRun !== null ? autoRun : (currentSheet.cells[cellId]?.autoRun || false);
    
    const userId = currentUser ? currentUser.uid : 'demo-user-123';
    const projectId = currentProjectId || 'default-project';
    
    console.log(`🔍 Saving cell ${cellId} to database:`, { prompt, output, model, temperature, cellPrompt, autoRun });
    console.log(`🔍 Current sheet ID:`, currentSheet.id);
    console.log(`🔍 User ID:`, userId);
    console.log(`🔍 Project ID:`, projectId);
    console.log(`🔍 Current sheet object:`, currentSheet);
    
    // Get generations from the cell
    const generations = currentSheet.cells[cellId]?.generations || [];
    console.log(`🔍 Saving generations for cell ${cellId}:`, generations);
    
    // Save to Firestore
    console.log(`Calling firestoreService.saveCell with:`, {
      userId, projectId, sheetId: currentSheet.id, cellId,
      cellData: {
        prompt: prompt,
        output: output,
        model: currentModel,
        temperature: currentTemperature,
        cellPrompt: currentCellPrompt,
        autoRun: currentAutoRun,
        generations: generations,
        updatedAt: new Date()
      }
    });
    
    const cellData = {
      prompt: prompt,
      output: output,
      model: currentModel,
      temperature: currentTemperature,
      cellPrompt: currentCellPrompt,
      autoRun: currentAutoRun,
      generations: generations,
      updatedAt: new Date()
    };
    
    console.log(`🔍 Full cell data being saved for ${cellId}:`, cellData);
    console.log(`🔍 Generations array length:`, generations.length);
    console.log(`🔍 Generations array content:`, generations);
    
    const result = await firestoreService.saveCell(userId, projectId, currentSheet.id, cellId, cellData);
    
    console.log(`Firestore save result:`, result);
    console.log(`✅ Successfully saved cell ${cellId} to database`);
  } catch (error) {
    console.error('❌ Error saving cell:', error);
  }
}

/**
 * Save sheet dimensions to database
 */
async function saveSheetDimensions() {
  if (currentSheet.id) {
    try {
      const userId = currentUser ? currentUser.uid : 'demo-user-123';
      const projectId = currentProjectId || 'default-project';
      
      await firestoreService.updateSheet(userId, projectId, currentSheet.id, {
        numRows: currentSheet.numRows,
        numCols: currentSheet.numCols,
        updatedAt: new Date()
      });
      
      console.log('Sheet dimensions saved to Firestore');
    } catch (error) {
      console.error('Error saving sheet dimensions:', error);
      // Fallback to localStorage
      saveSheetsToLocalStorage();
      console.log('Sheet dimensions saved to localStorage');
    }
  }
}

/**
 * Save sheets to localStorage as backup
 */
function saveSheetsToLocalStorage() {
  try {
    const sheetsData = {
      sheets: sheets,
      currentSheetIndex: currentSheetIndex,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('gpt-cells-sheets', JSON.stringify(sheetsData));
    console.log('Sheets saved to localStorage');
  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
}

/**
 * Load sheets from localStorage
 */
function loadSheetsFromLocalStorage() {
  try {
    const saved = localStorage.getItem('gpt-cells-sheets');
    if (saved) {
      const sheetsData = JSON.parse(saved);
      sheets = sheetsData.sheets || [];
      currentSheetIndex = sheetsData.currentSheetIndex || 0;
      
      if (sheets.length > 0) {
        currentSheet = sheets[currentSheetIndex];
        numRows = currentSheet.numRows || 10;
        numCols = currentSheet.numCols || 10;
        cells = currentSheet.cells || {};
        
        console.log('Loaded sheets from localStorage:', sheets.length);
        return true;
      }
    }
  } catch (error) {
    console.error('Error loading from localStorage:', error);
  }
  return false;
}



/**
 * Populate all cell model selectors with available models
 */
function populateCellModelSelectors(models) {
  // Get the main model selector value
  const mainModelSelect = document.getElementById('model-select');
  const defaultModel = mainModelSelect ? mainModelSelect.value : (models[0]?.id || '');
  
  // Find all cell model selectors
  const cellModelSelectors = document.querySelectorAll('.cell-model-select');
  
  cellModelSelectors.forEach(selector => {
    // Clear existing options
    selector.innerHTML = '';
    
    // Add all models
    models.forEach(model => {
      const option = document.createElement('option');
      option.value = model.id;
      option.textContent = model.name;
      option.title = model.description || '';
      selector.appendChild(option);
    });
    
    // Set the current cell's model as selected, or default to project's default model
    const cellId = selector.id.replace('model-', '');
    const cell = currentSheet.cells[cellId];
    if (cell && cell.model) {
      selector.value = cell.model;
    } else {
      // Use project's default model if available, otherwise fallback to text model
      const projectDefaultModel = currentProject && currentProject.defaultModel;
      const textModels = models.filter(m => m.type === 'text');
      
      let defaultModelToUse;
      if (projectDefaultModel && models.find(m => m.id === projectDefaultModel)) {
        defaultModelToUse = projectDefaultModel;
        console.log(`📝 Cell ${cellId} using project default model:`, defaultModelToUse);
      } else {
        defaultModelToUse = textModels.length > 0 ? textModels[0].id : defaultModel;
        console.log(`📝 Cell ${cellId} defaulting to text model:`, defaultModelToUse);
      }
      
      selector.value = defaultModelToUse;
    }
  });
}

/**
 * Save the default model to the current project
 * @param {string} modelId The model ID to save as default
 */
async function saveProjectDefaultModel(modelId) {
  try {
    if (!currentProjectId) {
      console.log('⚠️ No current project ID, cannot save default model');
      return;
    }
    
    const userId = currentUser ? currentUser.uid : 'demo-user-123';
    
    console.log(`💾 Saving default model "${modelId}" to project ${currentProjectId}`);
    console.log(`💾 User ID: ${userId}`);
    console.log(`💾 Project ID: ${currentProjectId}`);
    
    const updateData = {
      defaultModel: modelId,
      updatedAt: new Date()
    };
    console.log(`💾 Update data:`, updateData);
    
    const result = await firestoreService.updateProject(userId, currentProjectId, updateData);
    console.log(`💾 Firestore update result:`, result);
    
    // Update the current project object with the new default model
    if (currentProject) {
      currentProject.defaultModel = modelId;
      console.log(`💾 Updated currentProject.defaultModel to:`, currentProject.defaultModel);
    }
    
    console.log('✅ Default model saved to project');
  } catch (error) {
    console.error('❌ Error saving default model to project:', error);
  }
}

/**
 * Update the model selector with available models
 */
function updateModelSelector(models) {
  const modelSelect = document.getElementById('model-select');
  const modalModelSelect = document.getElementById('modalModel');
  
  if (!modelSelect) {
    console.error('Model selector element not found!');
    return;
  }
  
  console.log('Updating model selector with', models.length, 'models');
  
  // Clear existing options
  modelSelect.innerHTML = '';
  if (modalModelSelect) {
    modalModelSelect.innerHTML = '';
  }
  
  // Group models by type
  const groupedModels = {};
  models.forEach(model => {
    const type = model.type || 'text';
    if (!groupedModels[type]) {
      groupedModels[type] = [];
    }
    groupedModels[type].push(model);
  });
  
  console.log('Grouped models:', groupedModels);
  
  // Add models to both selectors with type grouping
  Object.keys(groupedModels).forEach(type => {
    const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
    
    // Add type header to main selector
    const typeOption = document.createElement('option');
    typeOption.value = '';
    typeOption.textContent = `--- ${typeLabel} Models ---`;
    typeOption.disabled = true;
    typeOption.style.fontWeight = 'bold';
    modelSelect.appendChild(typeOption);
    
    // Add models for this type to main selector
    groupedModels[type].forEach(model => {
      const option = document.createElement('option');
      option.value = model.id;
      option.textContent = `  ${model.name}`;
      option.title = model.description || '';
      console.log('Adding model option:', model.id, model.name);
      modelSelect.appendChild(option);
    });
    
    // Add models to modal selector (without type headers)
    if (modalModelSelect) {
      groupedModels[type].forEach(model => {
        const modalOption = document.createElement('option');
        modalOption.value = model.id;
        modalOption.textContent = model.name;
        modalOption.title = model.description || '';
        modalModelSelect.appendChild(modalOption);
      });
    }
  });
  
  // Populate all cell model selectors
  populateCellModelSelectors(models);
  
  // Check if project has a saved default model
  const projectDefaultModel = currentProject && currentProject.defaultModel;
  let modelToSet = null;
  
  if (projectDefaultModel && models.find(m => m.id === projectDefaultModel)) {
    // Use the project's saved default model
    modelToSet = projectDefaultModel;
    console.log('✅ Using project default model:', modelToSet);
  } else {
    // Set default selection (first OpenAI TEXT model, not image/audio)
    const openaiTextModels = models.filter(m => m.provider === 'openai' && m.type === 'text');
    if (openaiTextModels.length > 0) {
      modelToSet = openaiTextModels[0].id;
      console.log('✅ Set default model to:', modelToSet);
      
      // Save the default model to the project
      saveProjectDefaultModel(modelToSet);
    } else if (models.length > 0) {
      // Fallback to first text model if no OpenAI text models
      const textModels = models.filter(m => m.type === 'text');
      if (textModels.length > 0) {
        modelToSet = textModels[0].id;
        console.log('✅ Set fallback text model to:', modelToSet);
        
        // Save the default model to the project
        saveProjectDefaultModel(modelToSet);
      } else {
        // Last resort - first model
        modelToSet = models[0].id;
        console.log('⚠️ Set last resort model to:', modelToSet);
        
        // Save the default model to the project
        saveProjectDefaultModel(modelToSet);
      }
    }
  }
  
  // Set the model selector value
  if (modelToSet) {
    modelSelect.value = modelToSet;
    if (modalModelSelect) {
      modalModelSelect.value = modelToSet;
    }
  }
  
  console.log('Model selector updated. Total options:', modelSelect.options.length);
  if (modalModelSelect) {
    console.log('Modal model selector updated. Total options:', modalModelSelect.options.length);
  }
  
  // Add event listener to save default model when user changes selection
  if (modelSelect) {
    // Remove any existing event listeners to prevent duplicates
    modelSelect.removeEventListener('change', handleModelSelectorChange);
    modelSelect.addEventListener('change', handleModelSelectorChange);
  }
}

/**
 * Update all empty cells to use the new default model
 * @param {string} newDefaultModel The new default model to apply
 */
function updateAllEmptyCellsToDefaultModel(newDefaultModel) {
  console.log(`🔄 Updating all empty cells to use model: ${newDefaultModel}`);
  
  // Find all cell model selectors
  const cellModelSelectors = document.querySelectorAll('.cell-model-select');
  let updatedCount = 0;
  
  cellModelSelectors.forEach(selector => {
    const cellId = selector.id.replace('model-', '');
    const cell = currentSheet.cells[cellId];
    
    // Check if cell is "empty" (no prompt or output)
    const isCellEmpty = !cell || (!cell.prompt || cell.prompt.trim() === '') && (!cell.output || cell.output.trim() === '');
    
    if (isCellEmpty) {
      // Update the cell's model in memory
      if (!currentSheet.cells[cellId]) {
        currentSheet.cells[cellId] = { 
          prompt: '', 
          output: '', 
          model: newDefaultModel, 
          temperature: 0.7, 
          cellPrompt: '', 
          autoRun: false 
        };
      } else {
        currentSheet.cells[cellId].model = newDefaultModel;
      }
      
      // Update the selector value
      selector.value = newDefaultModel;
      
      // Add a subtle visual indicator that this cell was updated
      const cellContainer = document.querySelector(`#prompt-${cellId}`)?.closest('.cell-container');
      if (cellContainer) {
        cellContainer.classList.add('model-updated');
        setTimeout(() => {
          cellContainer.classList.remove('model-updated');
        }, 1000); // Remove the indicator after 1 second
      }
      
      updatedCount++;
      console.log(`📝 Updated empty cell ${cellId} to model: ${newDefaultModel}`);
    }
  });
  
  // Show a brief success message
  if (updatedCount > 0) {
    showSuccess(`Updated ${updatedCount} empty cells to use ${newDefaultModel}`);
  }
  
  console.log(`✅ Updated ${updatedCount} empty cells to use model: ${newDefaultModel}`);
}

/**
 * Handle model selector change event
 */
function handleModelSelectorChange() {
  const selectedModel = this.value;
  console.log('🔄 User changed main model selector to:', selectedModel);
  saveProjectDefaultModel(selectedModel);
  
  // Update all empty cells to use the new default model
  updateAllEmptyCellsToDefaultModel(selectedModel);
}

// Keyboard shortcuts system
const KeyboardShortcuts = {
  'Ctrl+Enter': () => {
    const activeElement = document.activeElement;
    if (activeElement && activeElement.tagName === 'TEXTAREA') {
      const cellId = activeElement.id.replace('prompt-', '');
      runCell(cellId);
    }
  },
  'Ctrl+Shift+R': () => runAll(),
  'Ctrl+Shift+C': () => clearAll(),
  'Ctrl+Z': () => undo(),
  'Ctrl+Y': () => redo(),
  'Escape': () => {
    closeModal();
    closeImageModal();
    // Close any open cell outputs
    document.querySelectorAll('.output.show').forEach(output => {
      output.style.display = 'none';
    });
  }
};

// Enhanced keyboard navigation
function handleEnhancedKeyNavigation(event) {
  // Handle keyboard shortcuts
  const key = event.ctrlKey ? 'Ctrl+' : '';
  const keyWithShift = event.ctrlKey && event.shiftKey ? 'Ctrl+Shift+' : '';
  const keyCombo = keyWithShift + key + event.key;
  
  if (KeyboardShortcuts[keyCombo]) {
    event.preventDefault();
    KeyboardShortcuts[keyCombo]();
    return;
  }
  
  // Call original key navigation
  handleKeyNavigation(event);
}

// Add event listeners for Excel-like behavior
document.addEventListener('keydown', handleEnhancedKeyNavigation);

// Add click handlers for cell selection
document.addEventListener('click', (event) => {
  const textarea = event.target.closest('textarea[id^="prompt-"]');
  if (textarea) {
    const cellId = textarea.id.replace('prompt-', '');
    selectCell(cellId);
  } else {
    // Hide all outputs when clicking elsewhere
    hideAllOutputs();
  }
});

/**
 * Hide all output divs
 */
function hideAllOutputs() {
  document.querySelectorAll('.output').forEach(output => {
    output.style.display = 'none';
  });
  
  // Remove focused class from all cell containers
  document.querySelectorAll('.cell-container').forEach(container => {
    container.classList.remove('focused');
  });
}

/**
 * Switch to a different sheet
 */
async function switchSheet(sheetIndex) {
  if (sheetIndex >= 0 && sheetIndex < sheets.length) {
    currentSheetIndex = sheetIndex;
    currentSheet = sheets[currentSheetIndex];
    cells = currentSheet.cells;
    // Update global variables with current sheet dimensions
    numRows = currentSheet.numRows;
    numCols = currentSheet.numCols;
    
    // Load cells from database
    if (currentSheet.id) {
      await loadSheetCells(currentSheet.id);
    }
    
    // Update project title
    loadProjectTitle();
    
    // Clear highlighting
    clearAllHighlighting();
    
    // Re-render the grid
    renderGrid();
    updateSheetTabs();
  }
}

/**
 * Add a new sheet
 */
async function addSheet() {
  try {
    const userId = currentUser ? currentUser.uid : 'demo-user-123';
    const sheetNumber = sheets.length + 1;
    
    console.log('Creating sheet for user:', userId);
    
    // Create sheet in Firestore
    const projectId = currentProjectId || 'default-project';
    const result = await firestoreService.createSheet(userId, projectId, {
      name: `Sheet${sheetNumber}`,
      numRows: 10,
      numCols: 10
    });
    
    if (result.success) {
      const newSheet = {
        id: result.sheetId,
        name: `Sheet${sheetNumber}`,
        cells: {},
        numRows: 10,
        numCols: 10
      };
      
      sheets.push(newSheet);
      switchSheet(sheets.length - 1);
      updateSheetTabs();
      showSuccess('Sheet created successfully!');
    } else {
      console.error('Failed to create sheet:', result.error);
      
      // Fallback: create sheet locally if Firestore fails
      if (result.error.includes('permissions') || result.error.includes('Missing')) {
        console.log('Firestore permission denied, creating local sheet...');
        
        const localSheet = {
          id: 'local-' + Date.now(),
          name: `Sheet${sheetNumber}`,
          cells: {},
          numRows: 10,
          numCols: 10
        };
        
        sheets.push(localSheet);
        switchSheet(sheets.length - 1);
        updateSheetTabs();
        showSuccess('Sheet created locally (Firestore permissions needed for persistence)');
        
        // Save to localStorage as backup
        saveSheetsToLocalStorage();
      } else {
        showError('Failed to create sheet: ' + result.error);
      }
    }
  } catch (error) {
    console.error('Error creating sheet:', error);
    
    // Fallback: create sheet locally
    console.log('Creating local sheet as fallback...');
    const sheetNumber = sheets.length + 1;
    const localSheet = {
      id: 'local-' + Date.now(),
      name: `Sheet${sheetNumber}`,
      cells: {},
      numRows: 10,
      numCols: 10
    };
    
    sheets.push(localSheet);
    switchSheet(sheets.length - 1);
    updateSheetTabs();
    showSuccess('Sheet created locally (Firestore connection failed)');
  }
}

/**
 * Delete a sheet (if more than one exists)
 */
async function deleteSheet(sheetIndex) {
  if (sheets.length > 1) {
    try {
      const userId = currentUser ? currentUser.uid : 'demo-user-123';
      const projectId = currentProjectId || 'default-project';
      const sheetToDelete = sheets[sheetIndex];
      
      // Delete sheet from Firestore
      const result = await firestoreService.deleteSheet(userId, projectId, sheetToDelete.id);
      
      if (result.success) {
        sheets.splice(sheetIndex, 1);
        if (currentSheetIndex >= sheets.length) {
          currentSheetIndex = sheets.length - 1;
        }
        switchSheet(currentSheetIndex);
        updateSheetTabs();
        showSuccess('Sheet deleted successfully!');
      } else {
        showError('Failed to delete sheet: ' + result.error);
      }
    } catch (error) {
      console.error('Error deleting sheet:', error);
      showError('Failed to delete sheet');
    }
  } else {
    showError('Cannot delete the last sheet. At least one sheet must remain.');
  }
}

/**
 * Rename a sheet
 */
function renameSheet(sheetIndex, newName) {
  if (newName && newName.trim() !== '') {
    sheets[sheetIndex].name = newName.trim();
    updateSheetTabs();
  }
}

/**
 * Update sheet name when edited
 */
async function updateSheetName(sheetIndex, newName) {
  if (sheetIndex >= 0 && sheetIndex < sheets.length) {
    const trimmedName = newName.trim();
    if (trimmedName && trimmedName !== sheets[sheetIndex].name) {
      sheets[sheetIndex].name = trimmedName;
      
      // Save to database if sheet has an ID
      if (sheets[sheetIndex].id) {
        try {
          const userId = currentUser ? currentUser.uid : 'demo-user-123';
          const projectId = currentProjectId || 'default-project';
          
          await firestoreService.updateSheet(userId, projectId, sheets[sheetIndex].id, {
            name: trimmedName,
            updatedAt: new Date()
          });
          
          console.log('✅ Sheet name updated in database');
        } catch (error) {
          console.error('❌ Error updating sheet name:', error);
          showError('Failed to save sheet name');
        }
      }
      
      // Update the project title if this is the current sheet
      if (sheetIndex === currentSheetIndex) {
        loadProjectTitle();
      }
    }
  }
}

/**
 * Handle keyboard events for sheet name editing
 */
function handleSheetNameKeyPress(event, sheetIndex) {
  if (event.key === 'Enter') {
    event.preventDefault();
    event.target.blur(); // This will trigger the onblur event
  } else if (event.key === 'Escape') {
    event.preventDefault();
    // Restore original name
    event.target.textContent = sheets[sheetIndex].name;
    event.target.blur();
  }
}

/**
 * Handle sheet tab clicks (switch sheet unless clicking on editable name)
 */
function handleSheetTabClick(event, sheetIndex) {
  // Don't switch if clicking on the editable name or close button
  if (event.target.classList.contains('sheet-name') || 
      event.target.classList.contains('sheet-close')) {
    return;
  }
  
  // Switch to the clicked sheet
  switchSheet(sheetIndex);
}

/**
 * Update sheet tabs in the UI
 */
function updateSheetTabs() {
  const tabsContainer = document.getElementById('sheet-tabs');
  if (!tabsContainer) return;
  
  let html = '';
  sheets.forEach((sheet, index) => {
    const isActive = index === currentSheetIndex;
    html += `
      <div class="sheet-tab ${isActive ? 'active' : ''}" onclick="handleSheetTabClick(event, ${index})" oncontextmenu="showSheetContextMenu(event, ${index})">
        <span class="sheet-name" contenteditable="true" data-sheet-index="${index}" onblur="updateSheetName(${index}, this.textContent)" onkeypress="handleSheetNameKeyPress(event, ${index})" onclick="event.stopPropagation()">${sheet.name}</span>
        ${sheets.length > 1 ? '<span class="sheet-close" onclick="deleteSheet(' + index + '); event.stopPropagation();">×</span>' : ''}
      </div>
    `;
  });
  
  html += '<div class="add-sheet-btn" onclick="addSheet()">+</div>';
  tabsContainer.innerHTML = html;
}

/**
 * Excel-like formula support
 */
function parseFormula(formula) {
  if (!formula || !formula.startsWith('=')) {
    return formula; // Not a formula
  }
  
  // Remove the = sign
  formula = formula.substring(1);
  
  // Basic Excel functions
  const functions = {
    'SUM': (...args) => args.reduce((a, b) => a + b, 0),
    'AVERAGE': (...args) => args.reduce((a, b) => a + b, 0) / args.length,
    'MAX': (...args) => Math.max(...args),
    'MIN': (...args) => Math.min(...args),
    'COUNT': (...args) => args.filter(x => x !== '').length,
    'IF': (condition, trueVal, falseVal) => condition ? trueVal : falseVal
  };
  
  // Parse cell references like A1, B2, etc.
  const cellRefRegex = /([A-Z]+)([0-9]+)/g;
  let processedFormula = formula;
  
  // Replace cell references with actual values
  processedFormula = processedFormula.replace(cellRefRegex, (match, col, row) => {
    const cellId = col + row;
    const cell = cells[cellId];
    return cell ? (cell.output || cell.prompt || 0) : 0;
  });
  
  // Basic arithmetic operations
  try {
    // Replace function names with actual function calls
    for (const [funcName, func] of Object.entries(functions)) {
      const regex = new RegExp(funcName + '\\(([^)]+)\\)', 'g');
      processedFormula = processedFormula.replace(regex, (match, args) => {
        const argValues = args.split(',').map(arg => {
          const trimmed = arg.trim();
          return isNaN(trimmed) ? 0 : parseFloat(trimmed);
        });
        return func(...argValues);
      });
    }
    
    // Evaluate basic arithmetic
    return eval(processedFormula);
  } catch (error) {
    return 'ERROR: ' + error.message;
  }
}

/**
 * Copy/paste functionality
 */
let clipboard = null;

function copyCell(cellId) {
  const cell = cells[cellId];
  if (cell) {
    clipboard = {
      prompt: cell.prompt,
      output: cell.output,
      type: 'cell'
    };
  }
}

function pasteCell(cellId) {
  if (clipboard && clipboard.type === 'cell') {
    const cell = cells[cellId];
    if (cell) {
      cell.prompt = clipboard.prompt;
      cell.output = clipboard.output;
      
      // Update the UI
      const textarea = document.getElementById('prompt-' + cellId);
      if (textarea) {
        textarea.value = cell.prompt;
      }
      
      const outputDiv = document.getElementById('output-' + cellId);
      if (outputDiv) {
        outputDiv.textContent = cell.output;
      }
    }
  }
}

/**
 * Find and replace functionality
 */
function findAndReplace(findText, replaceText, matchCase = false) {
  let foundCount = 0;
  
  for (const [cellId, cell] of Object.entries(cells)) {
    let searchText = cell.prompt;
    let searchFind = findText;
    
    if (!matchCase) {
      searchText = searchText.toLowerCase();
      searchFind = searchFind.toLowerCase();
    }
    
    if (searchText.includes(searchFind)) {
      cell.prompt = cell.prompt.replace(
        new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), matchCase ? 'g' : 'gi'),
        replaceText
      );
      foundCount++;
      
      // Update UI
      const textarea = document.getElementById('prompt-' + cellId);
      if (textarea) {
        textarea.value = cell.prompt;
      }
    }
  }
  
  return foundCount;
}

/**
 * Undo/Redo functionality
 */
let undoStack = [];
let redoStack = [];
const MAX_UNDO_STEPS = 50;

function saveState() {
  const state = {
    cells: JSON.parse(JSON.stringify(cells)),
    currentSheetIndex: currentSheetIndex
  };
  
  undoStack.push(state);
  if (undoStack.length > MAX_UNDO_STEPS) {
    undoStack.shift();
  }
  
  // Clear redo stack when new action is performed
  redoStack = [];
}

function undo() {
  if (undoStack.length > 0) {
    const currentState = {
      cells: JSON.parse(JSON.stringify(cells)),
      currentSheetIndex: currentSheetIndex
    };
    
    redoStack.push(currentState);
    
    const previousState = undoStack.pop();
    cells = previousState.cells;
    currentSheetIndex = previousState.currentSheetIndex;
    
    renderGrid();
    updateSheetTabs();
  }
}

function redo() {
  if (redoStack.length > 0) {
    const currentState = {
      cells: JSON.parse(JSON.stringify(cells)),
      currentSheetIndex: currentSheetIndex
    };
    
    undoStack.push(currentState);
    
    const nextState = redoStack.pop();
    cells = nextState.cells;
    currentSheetIndex = nextState.currentSheetIndex;
    
    renderGrid();
    updateSheetTabs();
  }
}

// Modal functionality
let currentModalCellId = null;

function openModal(cellId) {
  currentModalCellId = cellId;
  console.log(`🔍 Opening modal for cell ${cellId}`);
  console.log(`🔍 Current sheet:`, currentSheet);
  console.log(`🔍 Current sheet cells:`, currentSheet.cells);
  console.log(`🔍 Cell ${cellId} in currentSheet.cells:`, currentSheet.cells[cellId]);
  
  // Get the default model from the main selector
  const mainModelSelect = document.getElementById('model-select');
  const defaultModel = mainModelSelect ? mainModelSelect.value : 'gpt-3.5-turbo';
  const cell = currentSheet.cells[cellId] || { prompt: '', output: '', model: defaultModel, temperature: 0.7, cellPrompt: '' };
  
  console.log(`🔍 Modal opening for cell ${cellId}, cell data:`, cell);
  
  // Show the modal
  document.getElementById('cellModal').style.display = 'block';
  console.log(`🔍 Modal display set to block`);
  
  // Update modal title
  document.getElementById('modalTitle').textContent = `Cell ${cellId} Editor`;
  
  // Populate modal fields
        document.getElementById('modalPrompt').value = cell.prompt || '';
        
        // Show required indicator in modal if cell has no content
        if (!cell.prompt || cell.prompt.trim() === '') {
          const cellContainer = document.querySelector(`#prompt-${cellId}`)?.closest('.cell-container');
          if (cellContainer) {
            cellContainer.classList.add('cell-required');
          }
        }
        
        // Add event listener to modal prompt field for real-time required state updates
        const modalPrompt = document.getElementById('modalPrompt');
        if (modalPrompt) {
          modalPrompt.addEventListener('input', function() {
            const cellContainer = document.querySelector(`#prompt-${cellId}`)?.closest('.cell-container');
            if (this.value && this.value.trim() !== '') {
              if (cellContainer) {
                cellContainer.classList.remove('cell-required');
              }
              this.classList.remove('required-field');
            } else {
              if (cellContainer) {
                cellContainer.classList.add('cell-required');
              }
              this.classList.add('required-field');
            }
          });
        }
  
  // Handle generation logs in modal
  const modalOutput = document.getElementById('modalOutput');
  console.log(`🔍 Modal output element:`, modalOutput);
  console.log(`🔍 Modal output element found:`, !!modalOutput);
  console.log(`🔍 Opening modal for cell ${cellId}:`, {
    hasGenerations: !!cell.generations,
    generationsLength: cell.generations ? cell.generations.length : 0,
    generations: cell.generations,
    cellData: cell,
    currentSheetCells: currentSheet.cells,
    currentSheetId: currentSheet.id
  });
  
  if (cell.generations && cell.generations.length > 0) {
    console.log(`✅ Cell ${cellId} has ${cell.generations.length} generations, displaying them`);
    let logsHTML = '<div class="generation-logs">';
    logsHTML += '<h4 style="margin: 0 0 10px 0; color: #495057; font-size: 14px;">Generation History:</h4>';
    logsHTML += '<div style="margin-bottom: 10px; font-size: 12px; color: #6c757d; background: #e3f2fd; padding: 8px; border-radius: 4px;">';
    logsHTML += '💡 <strong>Reference generations:</strong> Use {{' + cellId + '-1}} for first generation, {{' + cellId + '-2}} for second, etc.';
    logsHTML += '</div>';
    
    // Show generations in reverse order (most recent first)
    const sortedGenerations = [...cell.generations].reverse();
    
    sortedGenerations.forEach((gen, index) => {
      const isLatest = index === 0;
      const generationNumber = cell.generations.length - index; // Actual generation number (1-based)
      const timestamp = new Date(gen.timestamp).toLocaleString();
      
      logsHTML += `<div class="generation-log ${isLatest ? 'latest' : ''}" style="margin-bottom: 15px; padding: 10px; border: 1px solid #e9ecef; border-radius: 6px; background-color: ${isLatest ? '#f8f9fa' : '#ffffff'};">`;
      
      // Generation header with number, checkbox, and delete button
      logsHTML += '<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">';
      logsHTML += `<div style="font-size: 12px; color: #6c757d;"><strong>Generation #${generationNumber}</strong> - ${timestamp} - ${gen.model} (${gen.temperature}) ${isLatest ? '- Latest' : ''}</div>`;
      
      // Checkbox and delete button
      logsHTML += '<div style="display: flex; align-items: center; gap: 8px;">';
      logsHTML += `<input type="checkbox" id="gen-checkbox-${cellId}-${generationNumber}" class="generation-checkbox" style="margin: 0;">`;
      logsHTML += `<label for="gen-checkbox-${cellId}-${generationNumber}" style="font-size: 11px; color: #6c757d; margin: 0; cursor: pointer;">Select</label>`;
      logsHTML += `<button class="delete-generation-btn" onclick="deleteGeneration('${cellId}', ${index})" title="Delete this generation" style="background: #dc3545; color: white; border: none; border-radius: 3px; padding: 2px 6px; font-size: 10px; cursor: pointer; margin-left: 5px;">🗑️</button>`;
      logsHTML += '</div>';
      logsHTML += '</div>';
      
      if (gen.type === 'image') {
        console.log(`🖼️ Displaying image in modal:`, gen.output);
        logsHTML += `
          <div class="generation-content" style="position: relative;">
            <img src="${gen.output}" alt="Generated image" style="width: 100%; height: 100%; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div class="image-download-overlay" onclick="downloadImage('${gen.output}')" title="Download image">
              <span class="download-icon">⬇️</span>
            </div>
          </div>
        `;
      } else if (gen.type === 'video') {
        console.log(`🎥 Displaying video in modal:`, gen.output);
        logsHTML += `
          <div class="generation-content" style="position: relative;">
            <div class="video-container">
              <video controls style="max-width: 100%; max-height: 200px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <source src="${gen.output}" type="video/mp4">
                Your browser does not support the video element.
              </video>
              <div style="font-size: 10px; color: #6c757d; text-align: center; margin-top: 4px;">🎥 Video</div>
            </div>
            <div class="image-download-overlay" onclick="downloadVideo('${gen.output}')" title="Download video">
              <span class="download-icon">⬇️</span>
            </div>
          </div>
        `;
      } else if (gen.type === 'audio') {
        logsHTML += `
          <div class="generation-content" style="position: relative;">
            <div class="audio-container">
              <audio controls style="width: 100%; max-width: 300px;">
                <source src="${gen.output}" type="audio/mp3">
                Your browser does not support the audio element.
              </audio>
              <div style="font-size: 10px; color: #6c757d; text-align: center; margin-top: 4px;">🎵 Audio</div>
            </div>
            <div class="image-download-overlay" onclick="downloadAudio('${gen.output}')" title="Download audio">
              <span class="download-icon">⬇️</span>
            </div>
          </div>
        `;
      } else {
        logsHTML += `
          <div class="generation-content">
            <div style="white-space: pre-wrap; font-size: 12px; line-height: 1.4;">${gen.output}</div>
          </div>
        `;
      }
      
      logsHTML += '</div>';
    });
    
    // Add action buttons for selected generations
    logsHTML += '<div style="margin-top: 15px; padding: 10px; background: #f8f9fa; border-radius: 5px; border: 1px solid #e9ecef;">';
    logsHTML += '<div style="font-size: 12px; color: #495057; margin-bottom: 8px;"><strong>Selected Generations:</strong></div>';
    logsHTML += '<button id="use-selected-generations" onclick="useSelectedGenerations()" style="background: #007bff; color: white; border: none; padding: 6px 12px; border-radius: 3px; font-size: 12px; cursor: pointer; margin-right: 8px;">Use Selected</button>';
    logsHTML += '<button id="clear-selection" onclick="clearGenerationSelection()" style="background: #6c757d; color: white; border: none; padding: 6px 12px; border-radius: 3px; font-size: 12px; cursor: pointer;">Clear Selection</button>';
    logsHTML += '</div>';
    
    logsHTML += '</div>';
    console.log(`🔍 Setting modalOutput.innerHTML with logsHTML length:`, logsHTML.length);
    modalOutput.innerHTML = logsHTML;
    console.log(`🔍 Modal output innerHTML set successfully`);
  } else {
    console.log(`⚠️ Cell ${cellId} has no generations yet`);
    const noGenerationsHTML = `
      <div style="text-align: center; padding: 20px; color: #6c757d;">
        <div style="font-size: 16px; margin-bottom: 10px;">📝 No generations yet</div>
        <div style="font-size: 12px;">Run this cell to create your first generation!</div>
        <div style="font-size: 11px; margin-top: 10px; color: #007bff;">
          💡 Once you have generations, you can reference them with {{${cellId}-1}}, {{${cellId}-2}}, etc.
        </div>
      </div>
    `;
    console.log(`🔍 Setting modalOutput.innerHTML with no generations message`);
    modalOutput.innerHTML = noGenerationsHTML;
    console.log(`🔍 Modal output innerHTML set with no generations message`);
  }
  
  // Set modal model to cell's model, or default to the main model selector's value
  const modalDefaultModel = mainModelSelect ? mainModelSelect.value : 'gpt-3.5-turbo';
  document.getElementById('modalModel').value = cell.model || modalDefaultModel;
  document.getElementById('modalTemperature').value = cell.temperature || 0.7;
  document.getElementById('modalTempValue').textContent = cell.temperature || 0.7;
  document.getElementById('modalCellPrompt').value = cell.cellPrompt || '';
  document.getElementById('modalAutoRun').checked = cell.autoRun || false;
  
  console.log(`Opening modal for cell ${cellId}:`, { 
    prompt: cell.prompt, 
    output: cell.output, 
    model: cell.model, 
    temperature: cell.temperature, 
    cellPrompt: cell.cellPrompt,
    autoRun: cell.autoRun 
  });
  
  // Show modal
  document.getElementById('cellModal').style.display = 'block';
  
  // Update temperature display when slider changes
  document.getElementById('modalTemperature').addEventListener('input', function() {
    document.getElementById('modalTempValue').textContent = this.value;
  });
}

function closeModal() {
  document.getElementById('cellModal').style.display = 'none';
  currentModalCellId = null;
}

function runModalCell() {
  if (!currentModalCellId) return;
  
  const prompt = document.getElementById('modalPrompt').value;
  const model = document.getElementById('modalModel').value;
  const temperature = parseFloat(document.getElementById('modalTemperature').value);
  
  // Update the cell in memory
  if (!currentSheet.cells[currentModalCellId]) {
    // Get the default model from the main selector
    const mainModelSelect = document.getElementById('model-select');
    const defaultModel = mainModelSelect ? mainModelSelect.value : 'gpt-3.5-turbo';
    currentSheet.cells[currentModalCellId] = { prompt: '', output: '', model: defaultModel, temperature: 0.7 };
  }
  
  currentSheet.cells[currentModalCellId].prompt = prompt;
  currentSheet.cells[currentModalCellId].model = model;
  currentSheet.cells[currentModalCellId].temperature = temperature;
  
  // Show processing indicator
  document.getElementById('modalOutput').textContent = 'Processing...';
  document.getElementById('modalOutput').style.color = '#6c757d';
  document.getElementById('modalOutput').style.fontStyle = 'italic';
  
  // Run the cell
  runCell(currentModalCellId).then(() => {
    // Update the modal output with all generation logs
    const cell = currentSheet.cells[currentModalCellId];
    const modalOutput = document.getElementById('modalOutput');
    
    console.log(`🔍 Updating modal after run for cell ${currentModalCellId}:`, {
      hasGenerations: !!cell.generations,
      generationsLength: cell.generations ? cell.generations.length : 0,
      generations: cell.generations
    });
    
    if (cell.generations && cell.generations.length > 0) {
      let logsHTML = '<div class="generation-logs">';
      logsHTML += '<h4 style="margin: 0 0 10px 0; color: #495057; font-size: 14px;">Generation History:</h4>';
      logsHTML += '<div style="margin-bottom: 10px; font-size: 12px; color: #6c757d; background: #e3f2fd; padding: 8px; border-radius: 4px;">';
      logsHTML += '💡 <strong>Reference generations:</strong> Use {{' + currentModalCellId + '-1}} for first generation, {{' + currentModalCellId + '-2}} for second, etc.';
      logsHTML += '</div>';
      
      // Show generations in reverse order (most recent first)
      const sortedGenerations = [...cell.generations].reverse();
      
      sortedGenerations.forEach((gen, index) => {
        const isLatest = index === 0;
        const generationNumber = cell.generations.length - index; // Actual generation number (1-based)
        const timestamp = new Date(gen.timestamp).toLocaleString();
        
        logsHTML += `<div class="generation-log ${isLatest ? 'latest' : ''}" style="margin-bottom: 15px; padding: 10px; border: 1px solid #e9ecef; border-radius: 6px; background-color: ${isLatest ? '#f8f9fa' : '#ffffff'};">`;
        
        // Generation header with number, checkbox, and delete button
        logsHTML += '<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">';
        logsHTML += `<div style="font-size: 12px; color: #6c757d;"><strong>Generation #${generationNumber}</strong> - ${timestamp} - ${gen.model} (${gen.temperature}) ${isLatest ? '- Latest' : ''}</div>`;
        
        // Checkbox and delete button
        logsHTML += '<div style="display: flex; align-items: center; gap: 8px;">';
        logsHTML += `<input type="checkbox" id="gen-checkbox-${currentModalCellId}-${generationNumber}" class="generation-checkbox" style="margin: 0;">`;
        logsHTML += `<label for="gen-checkbox-${currentModalCellId}-${generationNumber}" style="font-size: 11px; color: #6c757d; margin: 0; cursor: pointer;">Select</label>`;
        logsHTML += `<button class="delete-generation-btn" onclick="deleteGeneration('${currentModalCellId}', ${index})" title="Delete this generation" style="background: #dc3545; color: white; border: none; border-radius: 3px; padding: 2px 6px; font-size: 10px; cursor: pointer; margin-left: 5px;">🗑️</button>`;
        logsHTML += '</div>';
        logsHTML += '</div>';
        
        if (gen.type === 'image') {
          console.log(`🖼️ Displaying image in modal:`, gen.output);
          logsHTML += `
            <div class="generation-content" style="position: relative;">
              <img src="${gen.output}" alt="Generated image" style="width: 100%; height: 100%; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <div class="image-download-overlay" onclick="downloadImage('${gen.output}')" title="Download image">
                <span class="download-icon">⬇️</span>
              </div>
            </div>
          `;
        } else if (gen.type === 'video') {
          console.log(`🎥 Displaying video in modal:`, gen.output);
          logsHTML += `
            <div class="generation-content" style="position: relative;">
              <div class="video-container">
                <video controls style="max-width: 100%; max-height: 200px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                  <source src="${gen.output}" type="video/mp4">
                  Your browser does not support the video element.
                </video>
                <div style="font-size: 10px; color: #6c757d; text-align: center; margin-top: 4px;">🎥 Video</div>
              </div>
              <div class="image-download-overlay" onclick="downloadVideo('${gen.output}')" title="Download video">
                <span class="download-icon">⬇️</span>
              </div>
            </div>
          `;
        } else if (gen.type === 'audio') {
          logsHTML += `
            <div class="generation-content" style="position: relative;">
              <div class="audio-container">
                <audio controls style="width: 100%; max-width: 300px;">
                  <source src="${gen.output}" type="audio/mp3">
                  Your browser does not support the audio element.
                </audio>
                <div style="font-size: 10px; color: #6c757d; text-align: center; margin-top: 4px;">🎵 Audio</div>
              </div>
              <div class="image-download-overlay" onclick="downloadAudio('${gen.output}')" title="Download audio">
                <span class="download-icon">⬇️</span>
              </div>
            </div>
          `;
        } else {
          logsHTML += `
            <div class="generation-content">
              <div style="white-space: pre-wrap; font-size: 12px; line-height: 1.4;">${gen.output}</div>
            </div>
          `;
        }
        
        logsHTML += '</div>';
      });
      
      // Add action buttons for selected generations
      logsHTML += '<div style="margin-top: 15px; padding: 10px; background: #f8f9fa; border-radius: 5px; border: 1px solid #e9ecef;">';
      logsHTML += '<div style="font-size: 12px; color: #495057; margin-bottom: 8px;"><strong>Selected Generations:</strong></div>';
      logsHTML += '<button id="use-selected-generations" onclick="useSelectedGenerations()" style="background: #007bff; color: white; border: none; padding: 6px 12px; border-radius: 3px; font-size: 12px; cursor: pointer; margin-right: 8px;">Use Selected</button>';
      logsHTML += '<button id="clear-selection" onclick="clearGenerationSelection()" style="background: #6c757d; color: white; border: none; padding: 6px 12px; border-radius: 3px; font-size: 12px; cursor: pointer;">Clear Selection</button>';
      logsHTML += '</div>';
      
      logsHTML += '</div>';
      modalOutput.innerHTML = logsHTML;
    } else {
      modalOutput.textContent = 'No generations yet';
    }
    
    modalOutput.style.color = '#495057';
    modalOutput.style.fontStyle = 'normal';
  }).catch(error => {
    document.getElementById('modalOutput').textContent = 'Error: ' + error.message;
    document.getElementById('modalOutput').style.color = '#dc3545';
    document.getElementById('modalOutput').style.fontStyle = 'normal';
  });
}

function saveModalCell() {
  if (!currentModalCellId) return;
  
  const prompt = document.getElementById('modalPrompt').value;
  const model = document.getElementById('modalModel').value;
  const temperature = parseFloat(document.getElementById('modalTemperature').value);
  const cellPrompt = document.getElementById('modalCellPrompt').value;
  const autoRun = document.getElementById('modalAutoRun').checked;
  
  console.log(`Saving modal cell ${currentModalCellId}:`, { prompt, model, temperature, cellPrompt, autoRun });
  
  // Get output - handle both text and images
  const modalOutput = document.getElementById('modalOutput');
  let output;
  if (modalOutput.querySelector('img')) {
    output = modalOutput.querySelector('img').src;
  } else {
    output = modalOutput.textContent;
  }
  
  // Update the cell in memory
  if (!currentSheet.cells[currentModalCellId]) {
    // Get the default model from the main selector
    const saveDefaultModel = mainModelSelect ? mainModelSelect.value : 'gpt-3.5-turbo';
    currentSheet.cells[currentModalCellId] = { prompt: '', output: '', model: saveDefaultModel, temperature: 0.7, cellPrompt: '', autoRun: false };
  }
  
  currentSheet.cells[currentModalCellId].prompt = prompt;
  currentSheet.cells[currentModalCellId].output = output;
  currentSheet.cells[currentModalCellId].model = model;
  currentSheet.cells[currentModalCellId].temperature = temperature;
  currentSheet.cells[currentModalCellId].cellPrompt = cellPrompt;
  currentSheet.cells[currentModalCellId].autoRun = autoRun;
  
  // Save to database
  if (currentSheet.id) {
    saveCellToDatabase(currentModalCellId, prompt, output, model, temperature, cellPrompt, autoRun);
  }
  
  // Update the grid display
  const textarea = document.getElementById('prompt-' + currentModalCellId);
  const outputDiv = document.getElementById('output-' + currentModalCellId);
  const modelSelect = document.getElementById('model-' + currentModalCellId);
  const tempInput = document.getElementById('temp-' + currentModalCellId);
  
  if (textarea) textarea.value = prompt;
  if (outputDiv) {
    const outputContent = outputDiv.querySelector('.output-content');
    if (outputContent) {
      if (isImageUrl(output)) {
        outputContent.innerHTML = `<img src="${output}" alt="Generated image" style="max-width: 100%; max-height: 200px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">`;
      } else if (isAudioUrl(output)) {
        outputContent.innerHTML = `
          <div class="audio-container">
            <audio controls style="width: 100%; max-width: 300px;">
              <source src="${output}" type="audio/mp3">
              Your browser does not support the audio element.
            </audio>
            <div style="font-size: 10px; color: #6c757d; text-align: center; margin-top: 2px;">Generated audio</div>
          </div>
        `;
      } else {
        outputContent.textContent = output;
      }
    }
    outputDiv.style.display = output ? 'block' : 'none';
  }
  if (modelSelect) modelSelect.value = model;
  if (tempInput) tempInput.value = temperature;
  
  // Update visual indicators
  const cellContainer = document.querySelector(`#prompt-${currentModalCellId}`)?.closest('.cell-container');
  if (cellContainer) {
    // Update prompt indicator
    if (cellPrompt && cellPrompt.trim() !== '') {
      cellContainer.classList.add('has-prompt');
    } else {
      cellContainer.classList.remove('has-prompt');
    }
    
    // Update output indicator
    if (output && output.trim() !== '') {
      cellContainer.classList.add('has-output');
    } else {
      cellContainer.classList.remove('has-output');
    }
    
    // Update required indicator for any model when modal is active
    const isRequired = (!prompt || prompt.trim() === '');
    if (isRequired) {
      cellContainer.classList.add('cell-required');
    } else {
      cellContainer.classList.remove('cell-required');
    }
    
    // Also update the modal prompt field to show required state
    const modalPrompt = document.getElementById('modalPrompt');
    if (modalPrompt) {
      if (isRequired) {
        modalPrompt.classList.add('required-field');
      } else {
        modalPrompt.classList.remove('required-field');
      }
    }
  }
  
  // Re-render the grid to update all visual indicators
  renderGrid();
  
  // Close modal
  closeModal();
}

// Close modal when clicking outside of it
window.onclick = function(event) {
  const modal = document.getElementById('cellModal');
  if (event.target === modal) {
    closeModal();
  }
}

// Close modal with Escape key
document.addEventListener('keydown', function(event) {
  if (event.key === 'Escape') {
    closeModal();
    closeImageModal();
  }
});

// Close image modal when clicking outside
document.addEventListener('click', function(event) {
  const imageModal = document.getElementById('imageModal');
  if (imageModal && imageModal.style.display === 'block' && event.target === imageModal) {
    closeImageModal();
  }
});

// Image handling functions
// Media type detection functions
function isImageUrl(text) {
  if (!text) return false;
  
  // Check for data URLs
  if (text.startsWith('data:image/')) return true;
  
  // Check for HTTP/HTTPS URLs with image extensions
  if (text.includes('https://') || text.includes('http://')) {
    return text.includes('.png') || 
           text.includes('.jpg') || 
           text.includes('.jpeg') || 
           text.includes('.gif') ||
           text.includes('.webp') ||
           text.includes('.svg') ||
           // Provider-specific patterns
           text.includes('oaidalleapiprodscus') ||  // OpenAI DALL-E
           text.includes('storage.googleapis.com') ||  // Firebase Storage
           text.includes('replicate.com') ||  // Replicate
           text.includes('stability.ai') ||  // Stability AI
           text.includes('midjourney.com') ||  // Midjourney
           text.includes('leonardo.ai');  // Leonardo AI
  }
  
  return false;
}

function isVideoUrl(text) {
  if (!text) return false;
  
  // Check for data URLs
  if (text.startsWith('data:video/')) return true;
  
  // Check for HTTP/HTTPS URLs with video extensions
  if (text.includes('https://') || text.includes('http://')) {
    return text.includes('.mp4') || 
           text.includes('.webm') || 
           text.includes('.mov') || 
           text.includes('.avi') ||
           // Provider-specific patterns
           text.includes('runwayml.com') ||  // Runway ML
           text.includes('pika.art') ||  // Pika Labs
           text.includes('stability.ai/video') ||  // Stability AI Video
           text.includes('replicate.com') ||  // Replicate Video
           text.includes('storage.googleapis.com');  // Firebase Storage
  }
  
  return false;
}

function isAudioUrl(text) {
  if (!text) return false;
  // Check if it's a base64 audio data URL
  return text.startsWith('data:audio/mp3;base64,') ||
         text.startsWith('data:audio/wav;base64,') ||
         text.startsWith('data:audio/ogg;base64,');
}

// Unified media type detection
function getMediaType(output) {
  if (!output) return 'text';
  
  if (isImageUrl(output)) return 'image';
  if (isVideoUrl(output)) return 'video';
  if (isAudioUrl(output)) return 'audio';
  
  return 'text';
}

function renderImageOutput(cellId, imageUrl) {
  const outDiv = document.getElementById('output-' + cellId);
  if (outDiv) {
    const outputContent = outDiv.querySelector('.output-content');
    if (outputContent) {
      // Create a thumbnail with click to view full size
      outputContent.innerHTML = `
        <div class="image-thumbnail-container">
          <img src="${imageUrl}" alt="Generated image" class="image-thumbnail" onclick="openImageModal('${imageUrl}')" title="Click to view full size">
          <div style="font-size: 10px; color: #6c757d; text-align: center; margin-top: 2px;">🖼️ Click to view full size</div>
        </div>
      `;
    }
    outDiv.style.display = 'block';
  }
}

function renderTextOutput(cellId, text) {
  const outDiv = document.getElementById('output-' + cellId);
  if (outDiv) {
    const outputContent = outDiv.querySelector('.output-content');
    if (outputContent) {
      outputContent.textContent = text;
    }
    outDiv.style.display = text ? 'block' : 'none';
  }
}

function renderAudioOutput(cellId, audioData) {
  const outDiv = document.getElementById('output-' + cellId);
  if (outDiv) {
    const outputContent = outDiv.querySelector('.output-content');
    if (outputContent) {
      // Create audio player with controls
      outputContent.innerHTML = `
        <div class="audio-container">
          <audio controls style="width: 100%; max-width: 300px;">
            <source src="${audioData}" type="audio/mp3">
            Your browser does not support the audio element.
          </audio>
          <div style="font-size: 10px; color: #6c757d; text-align: center; margin-top: 2px;">🎵 Generated audio</div>
        </div>
      `;
    }
    outDiv.style.display = 'block';
  }
}

function closeOutput(cellId) {
  console.log('Closing output for cell:', cellId);
  
  // Prevent event bubbling
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  
  const outDiv = document.getElementById('output-' + cellId);
  if (outDiv) {
    outDiv.style.display = 'none';
    console.log('Output closed for cell:', cellId);
  } else {
    console.log('Output div not found for cell:', cellId);
  }
  
  return false; // Prevent any further event handling
}

// Help modal functions
function showHelp() {
  document.getElementById('helpModal').style.display = 'block';
}

function closeHelp() {
  document.getElementById('helpModal').style.display = 'none';
}

// Image modal for full-size viewing
function openImageModal(imageUrl) {
  // Create image modal if it doesn't exist
  let imageModal = document.getElementById('imageModal');
  if (!imageModal) {
    imageModal = document.createElement('div');
    imageModal.id = 'imageModal';
    imageModal.className = 'image-modal';
    imageModal.innerHTML = `
      <div class="image-modal-content">
        <span class="image-modal-close" onclick="closeImageModal()">&times;</span>
        <img id="fullSizeImage" src="" alt="Full size image" class="full-size-image">
      </div>
    `;
    document.body.appendChild(imageModal);
  }
  
  // Set the image source and show modal
  document.getElementById('fullSizeImage').src = imageUrl;
  imageModal.style.display = 'block';
}

function closeImageModal() {
  const imageModal = document.getElementById('imageModal');
  if (imageModal) {
    imageModal.style.display = 'none';
  }
}

/**
 * Download an image from a URL
 * @param {string} imageUrl The URL of the image to download
 */
function downloadImage(imageUrl) {
  try {
    // Create a temporary anchor element
    const link = document.createElement('a');
    link.href = imageUrl;
    
    // Extract filename from URL or create a default one
    const urlParts = imageUrl.split('/');
    const filename = urlParts[urlParts.length - 1] || 'generated-image.png';
    
    // Set the download attribute
    link.download = filename;
    
    // Append to body, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log(`📥 Downloaded image: ${filename}`);
  } catch (error) {
    console.error('❌ Error downloading image:', error);
    showError('Failed to download image. Please try right-clicking and "Save image as..."');
  }
}

/**
 * Download a video from a URL
 * @param {string} videoUrl The URL of the video to download
 */
function downloadVideo(videoUrl) {
  try {
    // Create a temporary anchor element
    const link = document.createElement('a');
    link.href = videoUrl;
    
    // Extract filename from URL or create a default one
    const urlParts = videoUrl.split('/');
    const filename = urlParts[urlParts.length - 1] || 'generated-video.mp4';
    
    // Set the download attribute
    link.download = filename;
    
    // Append to body, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log(`📥 Downloaded video: ${filename}`);
  } catch (error) {
    console.error('❌ Error downloading video:', error);
    showError('Failed to download video. Please try right-clicking and "Save video as..."');
  }
}

/**
 * Download an audio file from a URL
 * @param {string} audioUrl The URL of the audio file to download
 */
function downloadAudio(audioUrl) {
  try {
    // Create a temporary anchor element
    const link = document.createElement('a');
    link.href = audioUrl;
    
    // Extract filename from URL or create a default one
    const urlParts = audioUrl.split('/');
    const filename = urlParts[urlParts.length - 1] || 'generated-audio.mp3';
    
    // Set the download attribute
    link.download = filename;
    
    // Append to body, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log(`📥 Downloaded audio: ${filename}`);
  } catch (error) {
    console.error('❌ Error downloading audio:', error);
    showError('Failed to download audio. Please try right-clicking and "Save audio as..."');
  }
}

/**
 * Sort a column by its content
 * @param {number} columnIndex The column index to sort
 * @param {string} direction 'asc' for ascending, 'desc' for descending
 */
function sortColumn(columnIndex, direction) {
  try {
    console.log(`🔄 Sorting column ${columnIndex} in ${direction} order`);
    
    // Collect all cells in the column with their row data
    const columnCells = [];
    for (let r = 0; r < numRows; r++) {
      const cellId = getCellId(columnIndex, r);
      const cell = currentSheet.cells[cellId];
      const cellData = {
        row: r,
        cellId: cellId,
        content: cell ? (cell.prompt || cell.output || '') : '',
        originalRow: r
      };
      columnCells.push(cellData);
    }
    
    // Sort the cells based on content
    columnCells.sort((a, b) => {
      const aContent = a.content.toLowerCase();
      const bContent = b.content.toLowerCase();
      
      if (direction === 'asc') {
        return aContent.localeCompare(bContent);
      } else {
        return bContent.localeCompare(aContent);
      }
    });
    
    // Create a mapping of old row to new row
    const rowMapping = {};
    columnCells.forEach((cellData, newIndex) => {
      rowMapping[cellData.originalRow] = newIndex;
    });
    
    // Reorder all cells in the sheet based on the column sort
    const reorderedCells = {};
    
    // For each row, move all cells to their new position
    for (let r = 0; r < numRows; r++) {
      const newRow = rowMapping[r];
      
      // Move all cells from row r to newRow
      for (let c = 0; c < numCols; c++) {
        const oldCellId = getCellId(c, r);
        const newCellId = getCellId(c, newRow);
        
        if (currentSheet.cells[oldCellId]) {
          reorderedCells[newCellId] = currentSheet.cells[oldCellId];
        }
      }
    }
    
    // Update the cells object
    currentSheet.cells = reorderedCells;
    
    // Re-render the grid to show the new order
    renderGrid();
    
    // Update sort indicators
    updateSortIndicators(columnIndex, direction);
    
    console.log(`✅ Column ${columnIndex} sorted in ${direction} order`);
    showSuccess(`Column ${String.fromCharCode(65 + columnIndex)} sorted ${direction === 'asc' ? 'A-Z' : 'Z-A'}`);
    
  } catch (error) {
    console.error('❌ Error sorting column:', error);
    showError('Failed to sort column. Please try again.');
  }
}

/**
 * Update sort indicators in column headers
 * @param {number} columnIndex The column that was sorted
 * @param {string} direction The sort direction
 */
function updateSortIndicators(columnIndex, direction) {
  // Clear all sort indicators
  document.querySelectorAll('.sort-indicator').forEach(indicator => {
    indicator.remove();
  });
  
  // Add sort indicator to the sorted column
  const columnHeader = document.querySelector(`[data-column="${columnIndex}"]`);
  if (columnHeader) {
    const indicator = document.createElement('span');
    indicator.className = 'sort-indicator';
    indicator.textContent = direction === 'asc' ? '▲' : '▼';
    indicator.style.color = '#007bff';
    indicator.style.fontWeight = 'bold';
    indicator.style.marginLeft = '5px';
    columnHeader.appendChild(indicator);
  }
}

// Resizing variables
let isResizing = false;
let resizeType = null; // 'column' or 'row'
let resizeIndex = null;
let startX = 0;
let startY = 0;
let startWidth = 0;
let startHeight = 0;
let currentX = 0;
let currentY = 0;

/**
 * Start column resizing
 * @param {Event} event Mouse event
 * @param {number} columnIndex Column index to resize
 */
function startColumnResize(event, columnIndex) {
  event.preventDefault();
  event.stopPropagation();
  
  isResizing = true;
  resizeType = 'column';
  resizeIndex = columnIndex;
  startX = event.clientX;
  
  const columnHeader = document.querySelector(`[data-column="${columnIndex}"]`);
  startWidth = columnHeader.offsetWidth;
  
  // Add resize indicator
  const indicator = document.createElement('div');
  indicator.className = 'resize-indicator vertical';
  indicator.id = 'resize-indicator';
  document.body.appendChild(indicator);
  
  // Add event listeners
  document.addEventListener('mousemove', handleColumnResize);
  document.addEventListener('mouseup', stopResize);
  
  console.log(`🔄 Started resizing column ${columnIndex}`);
}

/**
 * Handle column resizing
 * @param {Event} event Mouse event
 */
function handleColumnResize(event) {
  if (!isResizing || resizeType !== 'column') return;
  
  currentX = event.clientX;
  const deltaX = currentX - startX;
  const newWidth = Math.max(50, startWidth + deltaX); // Minimum width of 50px
  
  // Update indicator position
  const indicator = document.getElementById('resize-indicator');
  if (indicator) {
    const columnHeader = document.querySelector(`[data-column="${resizeIndex}"]`);
    const rect = columnHeader.getBoundingClientRect();
    indicator.style.left = (rect.left + newWidth) + 'px';
    indicator.style.top = rect.top + 'px';
    indicator.style.height = rect.height + 'px';
  }
}

/**
 * Start row resizing
 * @param {Event} event Mouse event
 * @param {number} rowIndex Row index to resize
 */
function startRowResize(event, rowIndex) {
  event.preventDefault();
  event.stopPropagation();
  
  isResizing = true;
  resizeType = 'row';
  resizeIndex = rowIndex;
  startY = event.clientY;
  
  const rowHeader = document.querySelector(`[data-row="${rowIndex}"]`);
  startHeight = rowHeader.offsetHeight;
  
  // Add resize indicator
  const indicator = document.createElement('div');
  indicator.className = 'resize-indicator horizontal';
  indicator.id = 'resize-indicator';
  document.body.appendChild(indicator);
  
  // Add event listeners
  document.addEventListener('mousemove', handleRowResize);
  document.addEventListener('mouseup', stopResize);
  
  console.log(`🔄 Started resizing row ${rowIndex}`);
}

/**
 * Handle row resizing
 * @param {Event} event Mouse event
 */
function handleRowResize(event) {
  if (!isResizing || resizeType !== 'row') return;
  
  currentY = event.clientY;
  const deltaY = currentY - startY;
  const newHeight = Math.max(30, startHeight + deltaY); // Minimum height of 30px
  
  // Update indicator position
  const indicator = document.getElementById('resize-indicator');
  if (indicator) {
    const rowHeader = document.querySelector(`[data-row="${resizeIndex}"]`);
    const rect = rowHeader.getBoundingClientRect();
    indicator.style.left = rect.left + 'px';
    indicator.style.top = (rect.top + newHeight) + 'px';
    indicator.style.width = rect.width + 'px';
  }
}

/**
 * Stop resizing and apply changes
 */
function stopResize() {
  if (!isResizing) return;
  
  const indicator = document.getElementById('resize-indicator');
  if (indicator) {
    indicator.remove();
  }
  
  // Remove event listeners
  document.removeEventListener('mousemove', handleColumnResize);
  document.removeEventListener('mousemove', handleRowResize);
  document.removeEventListener('mouseup', stopResize);
  
  // Apply the resize
  if (resizeType === 'column') {
    applyColumnResize();
  } else if (resizeType === 'row') {
    applyRowResize();
  }
  
  // Reset state
  isResizing = false;
  resizeType = null;
  resizeIndex = null;
  
  console.log(`✅ Finished resizing ${resizeType}`);
}

/**
 * Apply column resize
 */
function applyColumnResize() {
  const columnHeader = document.querySelector(`[data-column="${resizeIndex}"]`);
  if (columnHeader) {
    // Calculate the final width based on current mouse position
    const deltaX = currentX - startX;
    const newWidth = Math.max(50, startWidth + deltaX);
    
    // Apply the new width to all cells in the column
    const cells = document.querySelectorAll(`td:nth-child(${resizeIndex + 2})`); // +2 because of row header
    cells.forEach(cell => {
      cell.style.width = newWidth + 'px';
      cell.style.minWidth = newWidth + 'px';
    });
    
    columnHeader.style.width = newWidth + 'px';
    columnHeader.style.minWidth = newWidth + 'px';
    
    console.log(`✅ Column ${resizeIndex} resized to ${newWidth}px`);
  }
}

/**
 * Apply row resize
 */
function applyRowResize() {
  const rowHeader = document.querySelector(`[data-row="${resizeIndex}"]`);
  if (rowHeader) {
    // Calculate the final height based on current mouse position
    const deltaY = currentY - startY;
    const newHeight = Math.max(30, startHeight + deltaY);
    
    // Apply the new height to all cells in the row
    const row = document.querySelector(`tr[data-row="${resizeIndex}"]`);
    if (row) {
      const cells = row.querySelectorAll('td');
      cells.forEach(cell => {
        cell.style.height = newHeight + 'px';
        cell.style.minHeight = newHeight + 'px';
      });
      
      row.style.height = newHeight + 'px';
      row.style.minHeight = newHeight + 'px';
    }
    
    console.log(`✅ Row ${resizeIndex} resized to ${newHeight}px`);
  }
}

// Make admin functions available globally for console access
window.makeCurrentUserAdmin = makeCurrentUserAdmin;
window.checkAdminStatus = checkAdminStatus;
window.addAdminButton = addAdminButton;
window.forceAddAdminButton = function() {
  console.log('🔧 Force adding admin button...');
  addAdminButton();
};

window.forceAdminStatus = function() {
  console.log('🔧 Force setting admin status...');
  isAdmin = true;
  checkAdminStatus();
};

// Model loading is now handled in initializeApp() function