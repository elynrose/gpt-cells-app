/**
 * GPT Cells Application - Frontend
 * 
 * A client-side spreadsheet application with AI-powered content generation
 * supporting text, image, and audio generation with persistent storage.
 * 
 * @fileoverview Main application script for GPT Cells
 * @version 1.0.0
 * @author GPT Cells Team
 */

'use strict';

// ============================================================================
// SECTION 1: GLOBAL STATE MANAGEMENT
// ============================================================================

/**
 * Authentication state variables
 * @type {Object|null} currentUser - Currently authenticated user object
 * @type {boolean} isAuthenticated - Whether user is authenticated
 * @type {boolean} isAdmin - Whether current user has admin privileges
 */
let currentUser = null;
let isAuthenticated = false;
let isAdmin = false;

/**
 * Project and sheet management state
 * @type {string|null} currentProjectId - ID of the currently active project
 * @type {Object|null} currentProject - Currently active project object
 * @type {Array<Object>} projects - Array of all user projects
 * @type {number} currentSheetIndex - Index of currently active sheet
 * @type {Array<Object>} sheets - Array of all sheets in current project
 */
let currentProjectId = null;
let currentProject = null;
let projects = [];
let currentSheetIndex = 0;
let sheets = [
  {
    id: `default-sheet-${Date.now()}`, // Default sheet ID
    name: 'Sheet1',
    cells: {},
    numRows: 10,
    numCols: 10,
    columnNames: {}, // Store column aliases: {0: 'Sales', 1: 'Marketing', etc.}
    cardPositions: {} // Store card positions: {cellId: {x, y}, ...}
  }
];

/**
 * Current sheet reference and derived state
 * @type {Object} currentSheet - Currently active sheet object
 * @type {Object} cells - Reference to current sheet's cells object
 * @type {number} numRows - Number of rows in current sheet
 * @type {number} numCols - Number of columns in current sheet
 */
let currentSheet = sheets[currentSheetIndex];
let cells = currentSheet.cells;
let numRows = currentSheet.numRows;
let numCols = currentSheet.numCols;

/**
 * Available AI models for content generation
 * @type {Array<Object>} availableModels - Array of available AI model configurations
 */
let availableModels = [];

/**
 * Get the API base URL based on the current environment
 * @returns {string} API base URL
 */
function getApiBaseUrl() {
  // Use local API when running on localhost
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return `http://${window.location.hostname}:3000`;
  }
  
  // For production, use the Railway backend URL
  // This works whether the frontend is served from Railway or Firebase Hosting
  return 'https://gpt-cells-app-production.up.railway.app';
}

// ============================================================================
// SECTION 2: CONSTANTS AND CONFIGURATION
// ============================================================================

/**
 * Excel formula functions supported by the application
 * Provides spreadsheet-like formula evaluation capabilities
 * @constant {Object<string, Function>} EXCEL_FUNCTIONS
 */
const EXCEL_FUNCTIONS = {
  SUM: (...args) => args.reduce((sum, val) => sum + (parseFloat(val) || 0), 0),
  AVERAGE: (...args) => {
    const nums = args.filter(val => !isNaN(parseFloat(val)));
    return nums.length > 0 ? nums.reduce((sum, val) => sum + parseFloat(val), 0) / nums.length : 0;
  },
  COUNT: (...args) => args.filter(val => !isNaN(parseFloat(val))).length,
  MAX: (...args) => Math.max(...args.map(val => parseFloat(val) || -Infinity)),
  MIN: (...args) => Math.min(...args.map(val => parseFloat(val) || Infinity)),
  IF: (condition, trueVal, falseVal) => condition ? trueVal : falseVal,
  CONCATENATE: (...args) => args.join(''),
  LEN: (text) => String(text).length,
  UPPER: (text) => String(text).toUpperCase(),
  LOWER: (text) => String(text).toLowerCase(),
  TRIM: (text) => String(text).trim(),
  ROUND: (number, decimals = 0) => Math.round(number * Math.pow(10, decimals)) / Math.pow(10, decimals),
  ABS: (number) => Math.abs(number),
  SQRT: (number) => Math.sqrt(number),
  POWER: (base, exponent) => Math.pow(base, exponent)
};

// ============================================================================
// SECTION 3: CELL REFERENCE PARSING
// ============================================================================

/**
 * Parse a cell reference (e.g., "A1", "B2") and return its value
 * 
 * @param {string} ref - Cell reference in format "A1", "B2", etc.
 * @returns {string|number} The cell's output value, or 0 if not found
 * 
 * @example
 * parseCellReference('A1') // Returns the value of cell A1
 */
function parseCellReference(ref) {
  const match = ref.match(/^([A-Z]+)(\d+)$/);
  if (!match) return 0;

  const col = match[1];
  const row = parseInt(match[2]) - 1; // Convert to 0-based

  // Convert column letter to number (A=0, B=1, etc.)
  let colNum = 0;
  for (let i = 0; i < col.length; i++) {
    colNum = colNum * 26 + (col.charCodeAt(i) - 64);
  }
  colNum -= 1; // Convert to 0-based

  const cellId = String.fromCharCode(65 + colNum) + (row + 1);
  const cell = currentSheet.cells[cellId];

  if (cell && cell.output) {
    const value = cell.output.trim();
    return isNaN(parseFloat(value)) ? value : parseFloat(value);
  }

  return 0;
}

/**
 * Parse a cell range (e.g., "A1:B2") and return array of values
 * 
 * @param {string} range - Cell range in format "A1:B2"
 * @returns {Array<string|number>} Array of cell values from the range
 * 
 * @example
 * parseCellRange('A1:B2') // Returns [valueA1, valueB1, valueA2, valueB2]
 */
function parseCellRange(range) {
  const [start, end] = range.split(':');
  const startMatch = start.match(/^([A-Z]+)(\d+)$/);
  const endMatch = end.match(/^([A-Z]+)(\d+)$/);

  if (!startMatch || !endMatch) return [];

  const startCol = startMatch[1];
  const startRow = parseInt(startMatch[2]);
  const endCol = endMatch[1];
  const endRow = parseInt(endMatch[2]);

  const values = [];

  // Convert column letters to numbers
  const startColNum = startCol.charCodeAt(0) - 65;
  const endColNum = endCol.charCodeAt(0) - 65;

  for (let row = startRow; row <= endRow; row++) {
    for (let col = startColNum; col <= endColNum; col++) {
      const cellId = String.fromCharCode(65 + col) + row;
      const cell = currentSheet.cells[cellId];
      if (cell && cell.output) {
        const value = cell.output.trim();
        values.push(isNaN(parseFloat(value)) ? value : parseFloat(value));
      } else {
        values.push(0);
      }
    }
  }

  return values;
}

/**
 * Parse and evaluate an Excel formula
 * 
 * Supports cell references, ranges, and Excel functions.
 * Note: Uses eval() which should be replaced with a safer evaluator in production.
 * 
 * @param {string} formula - Formula string starting with "="
 * @returns {string|number} Evaluated result or "#ERROR" if parsing fails
 * 
 * @example
 * parseFormula('=SUM(A1:A3)') // Returns sum of cells A1 through A3
 */
function parseFormula(formula) {
  try {
    // Remove the = sign
    let expression = formula.substring(1);

    // Handle cell references (A1, B2, etc.)
    expression = expression.replace(/([A-Z]+\d+)/g, (match) => {
      return parseCellReference(match);
    });

    // Handle cell ranges (A1:B2)
    expression = expression.replace(/([A-Z]+\d+:[A-Z]+\d+)/g, (match) => {
      const values = parseCellRange(match);
      return `[${values.join(',')}]`;
    });

    // Handle Excel functions
    for (const [funcName, func] of Object.entries(EXCEL_FUNCTIONS)) {
      const regex = new RegExp(`${funcName}\\(([^)]+)\\)`, 'gi');
      expression = expression.replace(regex, (match, args) => {
        const argValues = args.split(',').map(arg => {
          arg = arg.trim();
          // Handle array notation from ranges
          if (arg.startsWith('[') && arg.endsWith(']')) {
            return arg.slice(1, -1).split(',').map(v => parseFloat(v.trim()) || 0);
          }
          return parseFloat(arg) || arg;
        });

        // Flatten arrays
        const flatArgs = argValues.reduce((acc, val) => {
          return acc.concat(Array.isArray(val) ? val : [val]);
        }, []);

        return func(...flatArgs);
      });
    }

    // Evaluate the final expression
    return eval(expression);
  } catch (error) {
    console.error('Formula parsing error:', error);
    return '#ERROR';
  }
}

/**
 * Check if a cell value is a formula
 * 
 * @param {*} value - Value to check
 * @returns {boolean} True if value is a formula (starts with "=")
 */
function isFormula(value) {
  return typeof value === 'string' && value.startsWith('=');
}

/**
 * Apply Excel formatting to a cell
 */
function applyCellFormatting(cellId, formatting) {
  const cell = currentSheet.cells[cellId];
  if (!cell) return;

  // Initialize formatting if it doesn't exist
  if (!cell.formatting) {
    cell.formatting = {
      bold: false,
      italic: false,
      underline: false,
      align: 'left',
      numberFormat: 'general',
      textColor: '#000000',
      backgroundColor: '#ffffff',
      border: false
    };
  }

  // Apply formatting
  Object.assign(cell.formatting, formatting);

  // Update the cell display
  updateCellDisplay(cellId);
}

/**
 * Update cell display with formatting
 */
function updateCellDisplay(cellId) {
  const cell = currentSheet.cells[cellId];
  if (!cell || !cell.formatting) return;

  const textarea = document.getElementById(`prompt-${cellId}`);
  const output = document.getElementById(`output-${cellId}`);

  if (textarea) {
    // Apply formatting to textarea
    textarea.style.fontWeight = cell.formatting.bold ? 'bold' : 'normal';
    textarea.style.fontStyle = cell.formatting.italic ? 'italic' : 'normal';
    textarea.style.textDecoration = cell.formatting.underline ? 'underline' : 'none';
    textarea.style.textAlign = cell.formatting.align;
    textarea.style.color = cell.formatting.textColor;
    textarea.style.backgroundColor = cell.formatting.backgroundColor;

    if (cell.formatting.border) {
      textarea.style.border = '2px solid #000000';
    } else {
      textarea.style.border = '1px solid transparent';
    }
  }

  if (output) {
    // Apply formatting to output
    output.style.fontWeight = cell.formatting.bold ? 'bold' : 'normal';
    output.style.fontStyle = cell.formatting.italic ? 'italic' : 'normal';
    output.style.textDecoration = cell.formatting.underline ? 'underline' : 'none';
    output.style.textAlign = cell.formatting.align;
    output.style.color = cell.formatting.textColor;
    output.style.backgroundColor = cell.formatting.backgroundColor;

    if (cell.formatting.border) {
      output.style.border = '2px solid #000000';
    } else {
      output.style.border = '1px solid #000000';
    }

    // Apply number formatting
    if (cell.output && cell.formatting.numberFormat !== 'general') {
      output.textContent = formatNumber(cell.output, cell.formatting.numberFormat);
    }
  }
}

/**
 * Format numbers according to Excel number formats
 */
function formatNumber(value, format) {
  const num = parseFloat(value);
  if (isNaN(num)) return value;

  switch (format) {
    case 'number':
      return num.toLocaleString();
    case 'currency':
      return '$' + num.toFixed(2);
    case 'percentage':
      return (num * 100).toFixed(2) + '%';
    case 'date':
      return new Date(num).toLocaleDateString();
    default:
      return value;
  }
}

/**
 * Load existing cell formatting into modal controls
 */
function loadCellFormatting(cellId) {
  const cell = currentSheet.cells[cellId];
  if (!cell || !cell.formatting) return;

  // Set current editing cell for formatting controls
  currentEditingCell = cellId;

  // Load formatting values into controls
  const formatBold = document.getElementById('formatBold');
  const formatItalic = document.getElementById('formatItalic');
  const formatUnderline = document.getElementById('formatUnderline');
  const formatAlign = document.getElementById('formatAlign');
  const formatNumber = document.getElementById('formatNumber');
  const formatTextColor = document.getElementById('formatTextColor');
  const formatBgColor = document.getElementById('formatBgColor');
  const formatBorder = document.getElementById('formatBorder');

  if (formatBold) formatBold.classList.toggle('active', cell.formatting.bold);
  if (formatItalic) formatItalic.classList.toggle('active', cell.formatting.italic);
  if (formatUnderline) formatUnderline.classList.toggle('active', cell.formatting.underline);
  if (formatAlign) formatAlign.value = cell.formatting.align;
  if (formatNumber) formatNumber.value = cell.formatting.numberFormat;
  if (formatTextColor) formatTextColor.value = cell.formatting.textColor;
  if (formatBgColor) formatBgColor.value = cell.formatting.backgroundColor;
  if (formatBorder) formatBorder.classList.toggle('active', cell.formatting.border);
}

/**
 * Initialize formatting controls in modal
 */
function initializeFormattingControls() {
  const formatBold = document.getElementById('formatBold');
  const formatItalic = document.getElementById('formatItalic');
  const formatUnderline = document.getElementById('formatUnderline');
  const formatAlign = document.getElementById('formatAlign');
  const formatNumber = document.getElementById('formatNumber');
  const formatTextColor = document.getElementById('formatTextColor');
  const formatBgColor = document.getElementById('formatBgColor');
  const formatBorder = document.getElementById('formatBorder');

  if (!formatBold) return; // Controls not found

  // Bold button
  formatBold.addEventListener('click', () => {
    formatBold.classList.toggle('active');
    const isActive = formatBold.classList.contains('active');
    if (currentEditingCell) {
      applyCellFormatting(currentEditingCell, { bold: isActive });
    }
  });

  // Italic button
  formatItalic.addEventListener('click', () => {
    formatItalic.classList.toggle('active');
    const isActive = formatItalic.classList.contains('active');
    if (currentEditingCell) {
      applyCellFormatting(currentEditingCell, { italic: isActive });
    }
  });

  // Underline button
  formatUnderline.addEventListener('click', () => {
    formatUnderline.classList.toggle('active');
    const isActive = formatUnderline.classList.contains('active');
    if (currentEditingCell) {
      applyCellFormatting(currentEditingCell, { underline: isActive });
    }
  });

  // Alignment
  formatAlign.addEventListener('change', () => {
    if (currentEditingCell) {
      applyCellFormatting(currentEditingCell, { align: formatAlign.value });
    }
  });

  // Number format
  formatNumber.addEventListener('change', () => {
    if (currentEditingCell) {
      applyCellFormatting(currentEditingCell, { numberFormat: formatNumber.value });
    }
  });

  // Text color
  formatTextColor.addEventListener('change', () => {
    if (currentEditingCell) {
      applyCellFormatting(currentEditingCell, { textColor: formatTextColor.value });
    }
  });

  // Background color
  formatBgColor.addEventListener('change', () => {
    if (currentEditingCell) {
      applyCellFormatting(currentEditingCell, { backgroundColor: formatBgColor.value });
    }
  });

  // Border
  formatBorder.addEventListener('click', () => {
    formatBorder.classList.toggle('active');
    const isActive = formatBorder.classList.contains('active');
    if (currentEditingCell) {
      applyCellFormatting(currentEditingCell, { border: isActive });
    }
  });
}

/**
 * Load available models from the server
 */
async function loadAvailableModels() {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/models`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    availableModels = data.models || [];

    // Use updateModelSelector to populate all selectors (top, modal, and cards) with the same active models
    if (typeof updateModelSelector === 'function') {
      updateModelSelector(availableModels);
    } else {
      // Fallback to individual functions if updateModelSelector doesn't exist
      populateModelSelector();
      populateModalModelSelector();
      if (typeof populateCellModelSelectors === 'function') {
        populateCellModelSelectors(availableModels);
      }
    }

    // After populating, update all empty cells to use the current default model
    setTimeout(() => {
      updateAllCellModelDefaults();
    }, 100);

  } catch (error) {
    console.error('❌ Error loading models:', error);
    availableModels = [];

    // Update all selectors with empty state to keep them synchronized
    if (typeof updateModelSelector === 'function') {
      updateModelSelector([]);
    } else {
      // Fallback to individual functions
      populateModelSelector();
      populateModalModelSelector();
      if (typeof populateCellModelSelectors === 'function') {
        populateCellModelSelectors([]);
      }
    }
  }
}

/**
 * Populate the model selector dropdown
 */
function populateModelSelector() {
  const modelSelect = document.getElementById('model-select');
  if (!modelSelect) {

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

}

/**
 * Populate the modal model selector dropdown
 */
function populateModalModelSelector() {
  const modalModelSelect = document.getElementById('modalModel');
  if (!modalModelSelect) {

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

}

/**
 * Get the default model for new cells
 * Priority: Main selector (current selection) > Project default model > Hardcoded fallback
 */
// ============================================================================
// SECTION 6: MODEL MANAGEMENT
// ============================================================================

/**
 * Get the default AI model from the main model selector
 * 
 * @returns {string} The selected model ID, or 'gpt-3.5-turbo' as fallback
 */
function getDefaultModel() {
  const mainModelSelect = document.getElementById('model-select');
  const selectorModel = mainModelSelect ? mainModelSelect.value : null;
  const projectDefaultModel = currentProject && currentProject.defaultModel;

  // Prioritize the current main selector value over the saved project default
  // This ensures real-time updates when the user changes the main selector
  return selectorModel || projectDefaultModel || 'gpt-3.5-turbo';
}


// Error handling and user feedback
// ============================================================================
// SECTION 5: USER FEEDBACK AND NOTIFICATIONS
// ============================================================================

/**
 * Display an error message to the user
 * 
 * Creates a temporary error notification that appears in the top-right corner
 * of the screen and automatically disappears after the specified duration.
 * 
 * @param {string} message - Error message to display
 * @param {number} [duration=5000] - Duration in milliseconds before auto-hiding
 * @returns {void}
 */
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

/**
 * Display a success message to the user
 * 
 * Creates a temporary success notification that appears in the top-right corner
 * of the screen and automatically disappears after the specified duration.
 * 
 * @param {string} message - Success message to display
 * @param {number} [duration=3000] - Duration in milliseconds before auto-hiding
 * @returns {void}
 */
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

// ============================================================================
// SECTION 8: UI RENDERING
// ============================================================================

/**
 * Render the card-based grid UI
 * 
 * This function renders all cards in the current sheet, ensuring:
 * - All cards from currentSheet.cells are displayed
 * - Card positions are preserved
 * - Ports are visible on all cards
 * - Connection lines are drawn
 * - Event handlers are set up
 * 
 * @returns {void}
 */
function renderGrid() {
  // Don't initialize cells here - use the data from currentSheet.cells
  // initializeCells();
  const cardsContainer = document.getElementById('cards-container');
  if (!cardsContainer) {
    setTimeout(renderGrid, 100);
    return;
  }

  // Ensure container is visible
  const loadingEl = document.getElementById('firebase-loading');
  if (loadingEl) {
    loadingEl.style.display = 'none';
  }
  if (cardsContainer.style.display === 'none' || !cardsContainer.style.display) {
    cardsContainer.style.display = 'block';
  }

  const cardsDiv = document.getElementById('cards');
  const svg = document.getElementById('connection-lines');

  if (!cardsDiv) {
    const newCardsDiv = document.createElement('div');
    newCardsDiv.id = 'cards';
    newCardsDiv.style.cssText = 'position: relative; z-index: 2;';
    cardsContainer.appendChild(newCardsDiv);
    setTimeout(renderGrid, 50);
    return;
  }

  if (!svg) {
    const newSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    newSvg.id = 'connection-lines';
    newSvg.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1;';
    cardsContainer.insertBefore(newSvg, cardsDiv);
    setTimeout(renderGrid, 50);
    return;
  }

  const gridContainer = cardsDiv;

  // Ensure currentSheet and cells exist
  if (!currentSheet) {
    return;
  }
  if (!currentSheet.cells) {
    currentSheet.cells = {};
  }

  // Get all cells (including those without content yet, so they can be connected)
  // CRITICAL: Ensure we're using the correct sheet reference from the array
  // Re-sync currentSheet to make sure we have the latest data
  if (currentSheetIndex >= 0 && currentSheetIndex < sheets.length) {
    const sheetInArray = sheets[currentSheetIndex];
    if (sheetInArray && sheetInArray.cells) {
      // Use the cells from the array to ensure we have the latest data
      currentSheet.cells = sheetInArray.cells;
      cells = currentSheet.cells;
    }
  }

  // Ensure cells object exists
  if (!currentSheet.cells) {
    currentSheet.cells = {};
  }

  const allCellIds = Object.keys(currentSheet.cells);

  // Clear the grid container to prepare for rendering cards
  gridContainer.innerHTML = '';

  // Card dimensions and spacing
  const cardWidth = 280;
  const cardHeight = 200;
  const spacing = 40;
  let x = 40;
  let y = 40;

  // Use global cardPositions, initialize from currentSheet if available
  if (typeof window.cardPositions === 'undefined') {
    if (currentSheet && currentSheet.cardPositions) {
      window.cardPositions = { ...currentSheet.cardPositions };
    } else {
      window.cardPositions = {};
    }
  }
  const cardPositions = window.cardPositions;

  // Instead of clearing and rebuilding, update existing cards or create missing ones
  // This preserves cards that were created via createCardForCell() before they're saved

  // First, ensure all cards in currentSheet.cells exist in the DOM
  // Track which card was focused before render
  const previouslyFocusedCard = document.querySelector('.card.focused');
  const previouslyFocusedCellId = previouslyFocusedCard ? previouslyFocusedCard.getAttribute('data-cell-id') : null;

  for (const id of allCellIds) {
    // Check if card already exists in DOM
    const existingCard = document.getElementById(`card-${id}`);
    if (!existingCard) {
      // Card doesn't exist, create it
      createCardForCell(id);
    } else {
      // Card exists, just update its position if needed
      const cell = currentSheet.cells[id];
      if (!cardPositions[id]) {
        cardPositions[id] = { x, y };
        x += cardWidth + spacing;
        if (x > 1000) {
          x = 40;
          y += cardHeight + spacing;
        }
      }
      const pos = cardPositions[id];
      existingCard.style.left = `${pos.x}px`;
      existingCard.style.top = `${pos.y}px`;

      // Restore focused state if this was the previously focused card
      if (previouslyFocusedCellId === id) {
        existingCard.classList.add('focused');
      }

      // Ensure ports exist (they might have been removed somehow)
      const inputPort = existingCard.querySelector('.card-port.input');
      const outputPort = existingCard.querySelector('.card-port.output');
      if (!inputPort) {
        const newInputPort = document.createElement('div');
        newInputPort.className = 'card-port input';
        newInputPort.title = 'Drop connection here';
        existingCard.insertBefore(newInputPort, existingCard.firstChild);
      }
      if (!outputPort) {
        const newOutputPort = document.createElement('div');
        newOutputPort.className = 'card-port output';
        newOutputPort.title = 'Drag to connect to another card';
        // Insert after input port or at the beginning
        const inputPortAfter = existingCard.querySelector('.card-port.input');
        if (inputPortAfter) {
          inputPortAfter.insertAdjacentElement('afterend', newOutputPort);
        } else {
          existingCard.insertBefore(newOutputPort, existingCard.firstChild);
        }
      }

      // If card is focused, ensure ports are visible
      if (existingCard.classList.contains('focused')) {
        const inputPortFinal = existingCard.querySelector('.card-port.input');
        const outputPortFinal = existingCard.querySelector('.card-port.output');
        if (inputPortFinal) {
          inputPortFinal.style.opacity = '1';
          inputPortFinal.style.visibility = 'visible';
        }
        if (outputPortFinal) {
          outputPortFinal.style.opacity = '1';
          outputPortFinal.style.visibility = 'visible';
        }
      }

      // Update textarea value if it changed (but don't overwrite user's current typing)
      const textarea = existingCard.querySelector(`#prompt-${id}`);
      if (textarea && cell) {
        // Only update if textarea is not currently focused (user is not typing)
        if (!document.activeElement || document.activeElement !== textarea) {
          if (textarea.value !== (cell.prompt || '')) {
            textarea.value = cell.prompt || '';
          }
        }
      }
    }
  }

  // Remove cards from DOM that are no longer in currentSheet.cells
  document.querySelectorAll('.card').forEach(card => {
    const cardId = card.getAttribute('data-cell-id');
    if (!currentSheet.cells[cardId]) {
      card.remove();
    }
  });

  // Redraw connection lines
  if (typeof drawConnectionLines === 'function') {
    drawConnectionLines();
  }

  // Populate cell model selectors after cards are rendered
  if (typeof populateCellModelSelectors === 'function') {
    const models = availableModels || window.availableModels || [];
    if (models.length > 0) {
      populateCellModelSelectors(models);
      setTimeout(() => {
        updateAllCellModelDefaults();
      }, 100);
    }
  }

  // Set up event delegation for card interactions
  if (typeof setupCardEventDelegation === 'function') {
    setupCardEventDelegation();
  }

  // Set up card dragging
  if (typeof setupCardDragging === 'function') {
    setupCardDragging();
  }

  // Set up card connections
  if (typeof setupCardConnections === 'function') {
    setupCardConnections();
  }

  // Ensure all cards have ports (safeguard)
  ensureAllCardPorts();

  // Ensure focused card's ports are visible
  const focusedCard = document.querySelector('.card.focused');
  if (focusedCard) {
    const inputPort = focusedCard.querySelector('.card-port.input');
    const outputPort = focusedCard.querySelector('.card-port.output');
    if (inputPort) {
      inputPort.style.opacity = '1';
      inputPort.style.visibility = 'visible';
    }
    if (outputPort) {
      outputPort.style.opacity = '1';
      outputPort.style.visibility = 'visible';
    }
  }

  // Initialize interval timers for cards with autoRun and interval set
  allCellIds.forEach(id => {
    updateCellIntervalTimer(id);
  });

  return; // Early return - we're done, no need to build HTML string

  // OLD CODE BELOW - keeping for reference but not executing
  let html = '';

  // Render each cell as a card (including those without content yet)
  for (const id of allCellIds) {
    const cell = currentSheet.cells[id];
    const defaultModel = getDefaultModel();

    // Initialize position if not set
    if (!cardPositions[id]) {
      cardPositions[id] = { x, y };
      x += cardWidth + spacing;
      if (x > 1000) {
        x = 40;
        y += cardHeight + spacing;
      }
    }

    const pos = cardPositions[id];
    const hasPrompt = cell.cellPrompt && cell.cellPrompt.trim() !== '';
    const hasSelectedGenerations = cell.selectedGenerations && cell.selectedGenerations.length > 0;

    html += `<div class="card" id="card-${id}" data-cell-id="${id}" style="left: ${pos.x}px; top: ${pos.y}px;">`;
    html += '<div class="card-port input" title="Drop connection here"></div>';
    html += '<div class="card-port output" title="Drag to connect to another card"></div>';
    html += `<div class="card-header">`;
    html += `<span class="card-id">${id}</span>`;
    html += `<div class="card-header-actions">`;
    html += `<button class="card-modal-btn" onclick="openModal('${id}')" title="Open in modal">📋</button>`;
    html += `<button class="card-disconnect-btn" onclick="showDisconnectMenu(event, '${id}')" title="Disconnect cards">🔌</button>`;
    html += `<button class="card-delete-btn" onclick="deleteCard('${id}')" title="Delete card">🗑️</button>`;
    html += `</div>`;
    html += `</div>`;
    html += '<div class="card-content">';
    html += `<textarea id="prompt-${id}" oninput="updatePrompt('${id}')" onfocus="showCardControls('${id}')" placeholder="Enter prompt...">${(cell.prompt || '')}</textarea>`;
    html += '</div>';
    html += '<div class="card-controls">';
    html += '<div class="cell-controls-header">';
    html += '<span>Settings</span>';
    html += `<span style="color: #5f6368; font-weight: 400;">${id}</span>`;
    html += '</div>';
    html += `<div class="cell-controls-status" id="cell-status-${id}" style="display: none; padding: 6px 10px; border-bottom: 1px solid #e8eaed; background: #f8f9fa; font-size: 11px; color: #5f6368;"></div>`;
    html += '<div class="cell-controls-body">';
    html += '<div class="cell-controls-main">';
    html += '<div class="cell-control-group">';
    html += '<label class="cell-control-label">AI Model</label>';
    html += '<div class="cell-model-select-wrapper">';
    html += `<button type="button" class="cell-model-button" id="model-btn-${id}" onclick="toggleModelDropdown('${id}')" title="Select AI Model">`;
    html += `<span class="model-button-text" id="model-text-${id}">Loading...</span>`;
    html += '<span class="model-button-arrow">▾</span>';
    html += '</button>';
    html += `<div class="cell-model-dropdown" id="model-dropdown-${id}" style="display: none;"></div>`;
    html += '</div>';
    html += '</div>';
    html += '<div class="cell-control-group">';
    html += '<label class="cell-control-label">Temperature</label>';
    html += '<div class="cell-temp-control">';
    html += `<input type="range" class="cell-temp-slider" id="temp-slider-${id}" min="0" max="1" step="0.1" value="${(cell.temperature || 0.7)}" oninput="updateTempFromSlider('${id}', this.value)">`;
    html += `<input type="number" class="cell-temp-input" id="temp-${id}" min="0" max="1" step="0.1" value="${(cell.temperature || 0.7)}" onchange="updateCellTemperature('${id}')" title="Temperature (0-1)">`;
    html += '</div>';
    html += '</div>';
    html += '<div class="cell-control-group">';
    html += '<label class="cell-control-label">Run Interval (seconds)</label>';
    html += '<div style="display: flex; align-items: center; gap: 8px;">';
    html += `<input type="number" class="cell-interval-input" id="interval-${id}" min="0" step="1" value="${(cell.interval || 0)}" onchange="updateCellInterval('${id}')" placeholder="0 = disabled" style="width: 80px; padding: 4px 8px; border: 1px solid #dadce0; border-radius: 4px; font-size: 12px;">`;
    html += '<span style="font-size: 11px; color: #5f6368;">0 = disabled</span>';
    html += '</div>';
    html += '</div>';
    html += '</div>';
    html += '<div class="cell-controls-actions">';
    html += '<label class="cell-auto-run-toggle" title="Auto-run when content changes or dependencies update">';
    html += `<input type="checkbox" class="cell-auto-run-checkbox" id="auto-run-${id}" ${cell.autoRun ? 'checked' : ''} onchange="updateCellAutoRun('${id}')">`;
    html += '<span class="cell-auto-run-switch"></span>';
    html += '<span class="auto-run-label-text">Auto</span>';
    html += '</label>';
    html += `<button class="cell-run-btn" onclick="runCell('${id}')" title="Run this card">Run</button>`;
    html += '</div>';
    html += '</div>';
    html += '</div>';
    html += '</div>';
  }

  gridContainer.innerHTML = html;

  // Set up SVG for connection lines
  if (svg && !svg.querySelector('defs')) {
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', 'arrowhead');
    marker.setAttribute('markerWidth', '10');
    marker.setAttribute('markerHeight', '10');
    marker.setAttribute('refX', '9');
    marker.setAttribute('refY', '3');
    marker.setAttribute('orient', 'auto');
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('points', '0 0, 10 3, 0 6');
    marker.appendChild(polygon);
    defs.appendChild(marker);
    svg.appendChild(defs);
  }

  // Draw connection lines
  if (typeof drawConnectionLines === 'function') {
    drawConnectionLines();
  }

  // Remove focused class from all cards
  document.querySelectorAll('.card').forEach(card => {
    card.classList.remove('focused');
  });

  // Populate cell model selectors after cards are rendered
  if (typeof populateCellModelSelectors === 'function') {
    const models = availableModels || window.availableModels || [];
    if (models.length > 0) {
      populateCellModelSelectors(models);
      setTimeout(() => {
        updateAllCellModelDefaults();
      }, 100);
    }
  }

  // Set up event delegation for card interactions
  if (typeof setupCardEventDelegation === 'function') {
    setupCardEventDelegation();
  }

  // Set up card dragging
  if (typeof setupCardDragging === 'function') {
    setupCardDragging();
  }

  // Set up card connections
  if (typeof setupCardConnections === 'function') {
    setupCardConnections();
  }

  // Initialize interval timers for cards with autoRun and interval set
  allCellIds.forEach(id => {
    updateCellIntervalTimer(id);
  });

  // Redraw connection lines after a short delay
  setTimeout(() => {
    if (typeof drawConnectionLines === 'function') {
      drawConnectionLines();
    }
  }, 100);

  return; // Early return - don't execute old table code below

  // OLD TABLE CODE BELOW - NOT USED
  let html_old = '<table><thead><tr><th class="row-header" style="width: 50px; min-width: 50px; max-width: 50px;"></th>';
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
      const cell = currentSheet.cells[id] || { prompt: '', output: '', model: defaultModel, temperature: 0.7, cellPrompt: '', autoRun: false, interval: 0 };
      // Rendering cell
      html += '<td>';
      const hasPrompt = cell.cellPrompt && cell.cellPrompt.trim() !== '';
      const hasSelectedGenerations = cell.selectedGenerations && cell.selectedGenerations.length > 0;
      // Don't show required indicator in grid by default - only when cell is selected
      html += '<div class="cell-container' + (hasPrompt ? ' has-prompt' : '') + (hasSelectedGenerations ? ' has-selected-generations' : '') + '">';
      html += '<button class="expand-btn" onclick="openModal(\'' + id + '\')" title="Expand cell">⛶</button>';
      html += '<textarea id="prompt-' + id + '" oninput="updatePrompt(\'' + id + '\')" onfocus="showOutput(\'' + id + '\')" placeholder="Enter prompt...">' + (cell.prompt || '') + '</textarea>';
      html += '<div class="output" id="output-' + id + '"' + (cell.output ? ' style="display: block;"' : '') + '>';
      html += '<button class="output-close-btn" onclick="closeOutput(\'' + id + '\'); event.stopPropagation();" title="Close output">&times;</button>';
      html += '<div class="output-content">' + (cell.output || '') + '</div>';
      html += '</div>';
      html += '<div class="cell-controls">';
      html += '<select class="cell-model-select" id="model-' + id + '" onchange="updateCellModel(\'' + id + '\')">';
      // Models will be populated by updateModelSelector after grid is rendered
      html += '</select>';
      html += '<input type="number" class="cell-temp-input" id="temp-' + id + '" min="0" max="1" step="0.1" value="' + (cell.temperature || 0.7) + '" onchange="updateCellTemperature(\'' + id + '\')" title="Temperature">';
      html += '<label class="cell-auto-run-label" title="Auto-run when content changes or dependencies update">';
      html += '<input type="checkbox" class="cell-auto-run-checkbox" id="auto-run-' + id + '" ' + (cell.autoRun ? 'checked' : '') + ' onchange="updateCellAutoRun(\'' + id + '\')">';
      html += '<span class="auto-run-text">Auto</span>';
      html += '</label>';
      html += '<button class="cell-run-btn" onclick="runCell(\'' + id + '\')" title="Run this cell">▶</button>';
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

      populateCellModelSelectors(models);

      // After populating, update all empty cells to use the current default model
      setTimeout(() => {
        updateAllCellModelDefaults();
      }, 100); // Small delay to ensure selectors are populated
    } else {

    }
  }

  // Apply formatting to all cells after grid is rendered
  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c < numCols; c++) {
      const id = getCellId(c, r);
      updateCellDisplay(id);
    }
  }

  // Set up improved event delegation for cell interactions
  setupCellEventDelegation();
}

/**
 * Set up improved event delegation for cell interactions
 */
function setupCellEventDelegation() {
  const gridContainer = document.getElementById('grid');
  if (!gridContainer) return;

  // Track which cell is currently active
  let activeCellId = null;
  let hideTimeout = null;

  // Handle focus events on cell elements
  gridContainer.addEventListener('focusin', function (event) {
    const target = event.target;

    // Find the cell container
    const cellContainer = target.closest('.cell-container');
    if (!cellContainer) return;

    // Extract cell ID from the container
    const textarea = cellContainer.querySelector('textarea');
    if (!textarea) return;

    const cellId = textarea.id.replace('prompt-', '');

    // Clear any pending hide timeout
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }

    // Show cell controls and set as active
    cellContainer.classList.add('focused');
    activeCellId = cellId;

    // Show output if textarea is focused
    if (target === textarea) {
      showOutput(cellId);
    }
  });

  // Handle blur events on cell elements
  gridContainer.addEventListener('focusout', function (event) {
    const target = event.target;

    // Find the cell container
    const cellContainer = target.closest('.cell-container');
    if (!cellContainer) return;

    // Extract cell ID from the container
    const textarea = cellContainer.querySelector('textarea');
    if (!textarea) return;

    const cellId = textarea.id.replace('prompt-', '');

    // Set a timeout to hide controls, but only if focus doesn't move to another element in the same cell
    hideTimeout = setTimeout(() => {
      // Check if focus moved to another element in the same cell
      const activeElement = document.activeElement;
      const isStillInCell = cellContainer.contains(activeElement);

      if (!isStillInCell) {
        cellContainer.classList.remove('focused');
        activeCellId = null;

        // Save cell content when leaving the cell
        saveCellOnBlur(cellId);
      }
    }, 150); // Small delay to allow for dropdown interactions
  });

  // Handle clicks on cell controls to keep them visible
  gridContainer.addEventListener('mousedown', function (event) {
    const target = event.target;

    // Check if clicking on cell controls
    if (target.classList.contains('cell-model-select') ||
      target.classList.contains('cell-temp-input') ||
      target.classList.contains('cell-auto-run-checkbox') ||
      target.classList.contains('cell-run-btn') ||
      target.closest('.cell-auto-run-label')) {

      const cellContainer = target.closest('.cell-container');
      if (cellContainer) {
        // Clear any pending hide timeout
        if (hideTimeout) {
          clearTimeout(hideTimeout);
          hideTimeout = null;
        }

        // Ensure cell controls stay visible
        cellContainer.classList.add('focused');

        // Extract cell ID and set as active
        const textarea = cellContainer.querySelector('textarea');
        if (textarea) {
          const cellId = textarea.id.replace('prompt-', '');
          activeCellId = cellId;
        }
      }
    }
  });
}

/**
 * Save cell content when user leaves the cell
 * @param {string} id Cell identifier.
 */
function saveCellOnBlur(id) {
  const textarea = document.getElementById('prompt-' + id);
  if (textarea) {
    // Ensure cell exists in currentSheet.cells
    if (!currentSheet.cells[id]) {
      const defaultModel = getDefaultModel();
      currentSheet.cells[id] = { prompt: '', output: '', model: defaultModel, temperature: 0.7, cellPrompt: '', autoRun: false, interval: 0 };
    }

    // Update the cell's prompt
    currentSheet.cells[id].prompt = textarea.value;

    // Save to Firestore if user is authenticated
    if (currentUser && currentProject) {
      saveSheetToFirestore();
    }

    // Saved cell content
  }
}

// Debounce timers for autosave
const autosaveTimers = {};

/**
 * Update the stored prompt for a cell when the user types in the textarea.
 * @param {string} id Cell identifier.
 */
// ============================================================================
// SECTION 7: CELL OPERATIONS
// ============================================================================

/**
 * Update a cell's prompt value and handle autosave/auto-run
 * 
 * This function is called whenever a user types in a cell's textarea.
 * It updates the cell data in memory and triggers autosave for cards.
 * Also handles live connection updates when dependencies are detected.
 * 
 * @param {string} id - Cell identifier (e.g., 'A1', 'B2')
 * @returns {void}
 */
function updatePrompt(id) {
  const textarea = document.getElementById('prompt-' + id);
  if (textarea) {
    // Ensure cell exists in currentSheet.cells
    if (!currentSheet.cells[id]) {
      // Get the default model for new cells
      const defaultModel = getDefaultModel();
      currentSheet.cells[id] = { prompt: '', output: '', model: defaultModel, temperature: 0.7, cellPrompt: '', autoRun: false, interval: 0 };
    }
    currentSheet.cells[id].prompt = textarea.value;

    // Remove required indicator when content is added
    const cellContainer = document.querySelector(`#prompt-${id}`)?.closest('.cell-container');
    if (cellContainer && textarea.value && textarea.value.trim() !== '') {
      cellContainer.classList.remove('cell-required');
    }

    // Check if this is a card (not a grid cell)
    const isCard = textarea.closest('.card');

    if (isCard && currentSheet.id) {
      // For cards, use debounced autosave
      // Clear existing timer for this cell
      if (autosaveTimers[id]) {
        clearTimeout(autosaveTimers[id]);
      }

      // Set new timer to save after 1 second of no typing
      autosaveTimers[id] = setTimeout(() => {
        const cell = currentSheet.cells[id];
        if (cell) {
          saveCellToDatabase(
            id,
            cell.prompt,
            cell.output,
            cell.model,
            cell.temperature,
            cell.cellPrompt,
            cell.autoRun,
            cell.interval
          );
        }
        delete autosaveTimers[id];
      }, 1000); // Save 1 second after user stops typing

      // Update connections in real-time (debounced for performance)
      // Clear existing connection update timer
      if (window.connectionUpdateTimers && window.connectionUpdateTimers[id]) {
        clearTimeout(window.connectionUpdateTimers[id]);
      }

      // Initialize connection update timers object if needed
      if (!window.connectionUpdateTimers) {
        window.connectionUpdateTimers = {};
      }

      // Update connections after a short delay (200ms) to allow user to finish typing reference
      window.connectionUpdateTimers[id] = setTimeout(() => {
        // Parse dependencies to check if any new connections should be created
        const deps = parseDependencies(currentSheet.cells[id].prompt);

        // Ensure referenced cards exist
        deps.forEach(depRef => {
          // Extract cell ID from dependency reference
          let depId = depRef;

          // Skip cross-sheet references
          if (depId.includes('!')) {
            return;
          }

          // Remove prefixes like "prompt:", "output:"
          if (depRef.includes(':')) {
            const parts = depRef.split(':');
            depId = parts[parts.length - 1];
          }

          // Remove generation suffixes like "-1", ":1-3", ":2"
          if (depId.includes('-')) {
            depId = depId.split('-')[0];
          }

          // Remove any remaining colons (for generation ranges)
          depId = depId.split(':')[0];

          // Ensure the referenced card exists
          if (!currentSheet.cells[depId]) {
            // Create the referenced cell if it doesn't exist
            const defaultModel = getDefaultModel();
            currentSheet.cells[depId] = {
              prompt: '',
              output: '',
              model: defaultModel,
              temperature: 0.7,
              cellPrompt: '',
              autoRun: false,
              interval: 0,
              generations: []
            };

            // Create the card in the DOM if it doesn't exist
            if (!document.getElementById(`card-${depId}`)) {
              createCardForCell(depId);
            }
          } else {
            // Card exists, ensure it's rendered
            if (!document.getElementById(`card-${depId}`)) {
              createCardForCell(depId);
            }
          }
        });

        // Redraw connection lines to show new connections
        if (typeof drawConnectionLines === 'function') {
          drawConnectionLines();
        }

        // Clean up timer
        delete window.connectionUpdateTimers[id];
      }, 200); // Update connections 200ms after user stops typing
    }
    // For grid cells, don't save on every keystroke - only save on blur

    // Check if cell has a prompt template and auto-run
    let finalPrompt = textarea.value;
    if (currentSheet.cells[id].cellPrompt && textarea.value.trim()) {
      // Replace {input} placeholder with the actual input
      const processedPrompt = currentSheet.cells[id].cellPrompt.replace('{input}', textarea.value);

      // Update the cell's prompt with the processed template
      currentSheet.cells[id].prompt = processedPrompt;
      finalPrompt = processedPrompt;

      // Auto-run the cell
      setTimeout(() => {
        runCell(id);
      }, 500); // Small delay to allow user to finish typing
    } else if (currentSheet.cells[id].autoRun && textarea.value.trim()) {
      // Auto-run if enabled and content has changed
      setTimeout(() => {
        runCell(id);
      }, 500); // Small delay to allow user to finish typing
    }

    // Note: Database saving is now handled by saveCellOnBlur when user finishes editing
  }
}

/**
 * Toggle the model dropdown for a specific cell
 * @param {string} id Cell identifier.
 */
function toggleModelDropdown(id) {
  const dropdown = document.getElementById(`model-dropdown-${id}`);
  if (!dropdown) return;

  // Close all other dropdowns
  document.querySelectorAll('.cell-model-dropdown').forEach(dd => {
    if (dd.id !== `model-dropdown-${id}`) {
      dd.style.display = 'none';
    }
  });

  // Toggle this dropdown
  if (dropdown.style.display === 'none' || !dropdown.style.display) {
    dropdown.style.display = 'block';
  } else {
    dropdown.style.display = 'none';
  }
}

/**
 * Select a model for a specific cell
 * @param {string} id Cell identifier.
 * @param {string} modelId Model ID to select.
 */
/**
 * Check if a card has a valid model selected
 * 
 * @param {string} cellId - Cell identifier
 * @returns {boolean} True if card has a valid model selected
 */
function checkCardHasModel(cellId) {
  const cell = currentSheet.cells[cellId];
  if (!cell || !cell.model) {
    return false;
  }

  // Check if the model exists in available models
  const models = availableModels || window.availableModels || [];
  const modelExists = models.some(m => m.id === cell.model);

  return modelExists;
}

/**
 * Update the model indicator in the card header
 * 
 * @param {string} cellId - Cell identifier
 * @returns {void}
 */
function updateCardModelIndicator(cellId) {
  const card = document.getElementById(`card-${cellId}`);
  if (!card) return;

  const headerLeft = card.querySelector('.card-header-left');
  if (!headerLeft) return;

  const hasValidModel = checkCardHasModel(cellId);
  let indicator = headerLeft.querySelector('.card-model-indicator');

  if (!hasValidModel) {
    // Add indicator if it doesn't exist
    if (!indicator) {
      indicator = document.createElement('span');
      indicator.className = 'card-model-indicator';
      indicator.title = 'No AI model selected';
      indicator.textContent = '⚠️';
      headerLeft.appendChild(indicator);
    }
  } else {
    // Remove indicator if model is valid
    if (indicator) {
      indicator.remove();
    }
  }
}

function selectCellModel(id, modelId) {
  // Ensure cell exists in currentSheet.cells
  if (!currentSheet.cells[id]) {
    const defaultModel = getDefaultModel();
    currentSheet.cells[id] = { prompt: '', output: '', model: defaultModel, temperature: 0.7, cellPrompt: '', autoRun: false, interval: 0 };
  }

  currentSheet.cells[id].model = modelId;

  // Update model indicator in card header
  updateCardModelIndicator(id);

  // Update button text
  const button = document.getElementById(`model-btn-${id}`);
  if (button) {
    const textSpan = button.querySelector('.model-button-text');
    if (textSpan) {
      const models = availableModels || window.availableModels || [];
      const model = models.find(m => m.id === modelId);
      textSpan.textContent = model ? model.name : modelId;
    }
  }

  // Update dropdown selection
  const dropdown = document.getElementById(`model-dropdown-${id}`);
  if (dropdown) {
    const models = availableModels || window.availableModels || [];
    dropdown.querySelectorAll('.cell-model-option').forEach(option => {
      option.classList.remove('selected');
      const model = models.find(m => m.id === modelId);
      if (option.textContent === (model ? model.name : modelId)) {
        option.classList.add('selected');
      }
    });
    dropdown.style.display = 'none';
  }

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
    saveCellToDatabase(id, currentSheet.cells[id].prompt, currentSheet.cells[id].output, currentSheet.cells[id].model, currentSheet.cells[id].temperature, currentSheet.cells[id].cellPrompt, currentSheet.cells[id].autoRun, currentSheet.cells[id].interval);
  }
}

/**
 * Update the model for a specific cell (for old select elements)
 * @param {string} id Cell identifier.
 */
function updateCellModel(id) {
  const modelSelect = document.getElementById('model-' + id);
  if (modelSelect) {
    // Ensure cell exists in currentSheet.cells
    if (!currentSheet.cells[id]) {
      // Get the default model for new cells
      const defaultModel = getDefaultModel();
      currentSheet.cells[id] = { prompt: '', output: '', model: defaultModel, temperature: 0.7, cellPrompt: '', autoRun: false, interval: 0 };
    }
    currentSheet.cells[id].model = modelSelect.value;

    // Update model indicator in card header
    updateCardModelIndicator(id);

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
      saveCellToDatabase(id, currentSheet.cells[id].prompt, currentSheet.cells[id].output, currentSheet.cells[id].model, currentSheet.cells[id].temperature, currentSheet.cells[id].cellPrompt, currentSheet.cells[id].autoRun || null, currentSheet.cells[id].interval || null);
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
      currentSheet.cells[id] = { prompt: '', output: '', model: defaultModel, temperature: 0.7, cellPrompt: '', autoRun: false, interval: 0 };
    }
    currentSheet.cells[id].temperature = parseFloat(tempInput.value);

    // Save to database
    if (currentSheet.id) {
      saveCellToDatabase(id, currentSheet.cells[id].prompt, currentSheet.cells[id].output, currentSheet.cells[id].model, currentSheet.cells[id].temperature, currentSheet.cells[id].cellPrompt, currentSheet.cells[id].autoRun, currentSheet.cells[id].interval || 0);
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
      currentSheet.cells[id] = { prompt: '', output: '', model: defaultModel, temperature: 0.7, cellPrompt: '', autoRun: false, interval: 0 };
    }
    currentSheet.cells[id].autoRun = autoRunCheckbox.checked;

    // Update interval timer if needed
    updateCellIntervalTimer(id);

    // Save to database
    if (currentSheet.id) {
      saveCellToDatabase(id, currentSheet.cells[id].prompt, currentSheet.cells[id].output, currentSheet.cells[id].model, currentSheet.cells[id].temperature, currentSheet.cells[id].cellPrompt, currentSheet.cells[id].autoRun, currentSheet.cells[id].interval);
    }
  }
}

// Interval timers storage
const cellIntervalTimers = {};

/**
 * Update the interval setting for a specific cell
 * @param {string} id Cell identifier.
 */
function updateCellInterval(id) {
  const intervalInput = document.getElementById('interval-' + id);
  if (intervalInput) {
    // Ensure cell exists in currentSheet.cells
    if (!currentSheet.cells[id]) {
      const defaultModel = getDefaultModel();
      currentSheet.cells[id] = { prompt: '', output: '', model: defaultModel, temperature: 0.7, cellPrompt: '', autoRun: false, interval: 0 };
    }
    currentSheet.cells[id].interval = parseInt(intervalInput.value) || 0;

    // Update interval timer
    updateCellIntervalTimer(id);

    // Save to database
    if (currentSheet.id) {
      saveCellToDatabase(id, currentSheet.cells[id].prompt, currentSheet.cells[id].output, currentSheet.cells[id].model, currentSheet.cells[id].temperature, currentSheet.cells[id].cellPrompt, currentSheet.cells[id].autoRun, currentSheet.cells[id].interval);
    }
  }
}

/**
 * Update or start/stop the interval timer for a cell
 * @param {string} id Cell identifier.
 */
function updateCellIntervalTimer(id) {
  // Clear existing timer
  if (cellIntervalTimers[id]) {
    clearInterval(cellIntervalTimers[id]);
    delete cellIntervalTimers[id];
  }

  const cell = currentSheet.cells[id];
  if (!cell) return;

  // Only start interval if both autoRun and interval are set
  if (cell.autoRun && cell.interval && cell.interval > 0) {
    const intervalMs = cell.interval * 1000; // Convert seconds to milliseconds

    // Start interval timer
    cellIntervalTimers[id] = setInterval(async () => {
      // Run the cell and its dependencies
      if (cell.prompt && cell.prompt.trim() !== '') {
        await runCellWithDependencies(id);
      }
    }, intervalMs);
  }
}

/**
 * Run a cell and all its dependencies
 * @param {string} cellId Cell identifier.
 */
async function runCellWithDependencies(cellId) {
  const cell = currentSheet.cells[cellId];
  if (!cell || !cell.prompt || cell.prompt.trim() === '') return;

  // Parse dependencies
  const deps = parseDependencies(cell.prompt);

  // Run dependencies first (in order)
  for (const depRef of deps) {
    // Skip cross-sheet references
    if (depRef.includes('!')) {
      continue;
    }

    // Extract cell ID from dependency reference
    // Handle formats like: "A1", "prompt:A1", "output:A1", "A1-1", "A1:1-3", "A1:2"
    let depId = depRef;

    // Remove prefixes like "prompt:", "output:"
    if (depRef.includes(':')) {
      const parts = depRef.split(':');
      depId = parts[parts.length - 1];
    }

    // Remove generation suffixes like "-1", ":1-3", ":2"
    if (depId.includes('-')) {
      depId = depId.split('-')[0];
    }

    // Remove any remaining colons (for generation ranges)
    depId = depId.split(':')[0];

    const depCell = currentSheet.cells[depId];
    if (depCell && depCell.prompt && depCell.prompt.trim() !== '') {
      // Recursively run dependencies
      await runCellWithDependencies(depId);
    }
  }

  // Run the cell itself
  await runCell(cellId);
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

    await firestoreService.updateSheet(userId, projectId, currentSheet.id, {
      columnNames: currentSheet.columnNames,
      updatedAt: new Date()
    });

  } catch (error) {
    console.error('❌ Error saving column names:', error);
  }
}

// Debounce timer for saving card positions
let cardPositionsSaveTimer = null;

/**
 * Save card positions to the database (debounced)
 */
async function saveCardPositions() {
  try {
    if (!currentSheet || !currentSheet.id) return;

    // Clear existing timer
    if (cardPositionsSaveTimer) {
      clearTimeout(cardPositionsSaveTimer);
    }

    // Debounce: save after 500ms of no changes
    cardPositionsSaveTimer = setTimeout(async () => {
      const userId = currentUser ? currentUser.uid : 'demo-user-123';
      const projectId = currentProjectId || 'default-project';

      // Update currentSheet.cardPositions with window.cardPositions
      if (typeof window.cardPositions !== 'undefined') {
        currentSheet.cardPositions = { ...window.cardPositions };
      }

      await firestoreService.updateSheet(userId, projectId, currentSheet.id, {
        cardPositions: currentSheet.cardPositions,
        updatedAt: new Date()
      });

      cardPositionsSaveTimer = null;
    }, 500);
  } catch (error) {
    // Silently handle error - positions will be saved on next change
  }
}

/**
 * Create a default sheet for the current project
 */
async function createDefaultSheetForProject() {
  try {

    const userId = currentUser ? currentUser.uid : 'demo-user-123';
    const projectId = currentProjectId || 'default-project';

    // Create a default sheet
    const defaultSheet = {
      name: 'Sheet1',
      numRows: 10,
      numCols: 10,
      cardPositions: {},
      order: 0, // First sheet has order 0
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Create sheet in Firebase
    const createResult = await firestoreService.createSheet(userId, projectId, defaultSheet);

    if (createResult.success) {
      const sheetId = createResult.sheetId;

      // Update local sheets array
      const newSheet = {
        id: sheetId,
        name: defaultSheet.name,
        cells: {},
        numRows: defaultSheet.numRows,
        numCols: defaultSheet.numCols,
        columnNames: {},
        cardPositions: {},
        order: 0 // First sheet has order 0
      };

      sheets = [newSheet];
      currentSheetIndex = 0;
      currentSheet = newSheet;

      // Update global variables
      cells = currentSheet.cells;
      numRows = currentSheet.numRows;
      numCols = currentSheet.numCols;

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



  if (!currentSheet || !currentSheet.id) {

    // Create a default sheet for the current project
    await createDefaultSheetForProject();
  }
}

/**
 * Save cell content when user clicks out of the cell (on blur)
 * @param {string} id Cell identifier.
 */
async function saveCellOnBlur(id) {





  // Ensure sheet has an ID
  await ensureSheetHasId();

  const textarea = document.getElementById('prompt-' + id);
  if (textarea && currentSheet && currentSheet.id) {
    // Ensure cell exists in currentSheet.cells
    if (!currentSheet.cells[id]) {
      // Get the default model for new cells
      const defaultModel = getDefaultModel();
      currentSheet.cells[id] = { prompt: '', output: '', model: defaultModel, temperature: 0.7, cellPrompt: '', autoRun: false, interval: 0 };
    }

    // Update the cell's prompt with the current textarea value
    currentSheet.cells[id].prompt = textarea.value;

    saveCellToDatabase(id, textarea.value, currentSheet.cells[id].output, currentSheet.cells[id].model, currentSheet.cells[id].temperature, currentSheet.cells[id].cellPrompt, currentSheet.cells[id].autoRun, currentSheet.cells[id].interval || 0)
      .then((result) => {

        // Fetch the cell from Firebase to ensure display matches database
        fetchCellFromFirebase(id)
          .then(() => {

          })
          .catch(error => {
            console.error(`❌ Error fetching cell ${id} from Firebase after save:`, error);
          });
      })
      .catch(error => {
        console.error(`❌ Error saving cell ${id} to Firebase on blur:`, error);
      });
  } else {




    // Still update the cell in memory even if we can't save to Firebase
    if (textarea && currentSheet) {
      if (!currentSheet.cells[id]) {
        // Get the default model from the main selector
        const mainModelSelect = document.getElementById('model-select');
        const defaultModel = mainModelSelect ? mainModelSelect.value : 'gpt-3.5-turbo';
        currentSheet.cells[id] = { prompt: '', output: '', model: defaultModel, temperature: 0.7, cellPrompt: '', autoRun: false, interval: 0 };
      }
      currentSheet.cells[id].prompt = textarea.value;

    }
  }
}

/**
 * Fetch a specific cell from Firebase and update the display
 * @param {string} cellId Cell identifier.
 */
async function fetchCellFromFirebase(cellId) {
  try {

    if (!currentSheet || !currentSheet.id) {

      return;
    }

    const userId = currentUser ? currentUser.uid : 'demo-user-123';
    const projectId = currentProjectId || 'default-project';

    if (!userId || !projectId) {

      return;
    }

    // Fetch the cell data from Firebase
    const result = await firestoreService.getCell(userId, projectId, currentSheet.id, cellId);

    if (result.success && result.data) {

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

        // Update the cell's prompt in memory to match what was fetched
        if (currentSheet && currentSheet.cells[cellId]) {
          currentSheet.cells[cellId].prompt = result.data.prompt || '';

        }
      }

      // Don't re-render the grid as it will lose focus and break editing
      // renderGrid();

    } else {

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
 * Update all cell model selectors to use the main model selector's value as default
 * 
 * Iterates through all cell model selectors (both old select elements and
 * new custom dropdown buttons) and updates them to use the main model selector's
 * value if the cell doesn't have a specific model set.
 * 
 * This is called when the grid is rendered or when models are loaded.
 * 
 * @returns {void}
 */
function updateAllCellModelDefaults() {
  const models = availableModels || window.availableModels || [];
  if (models.length === 0) return;

  // Update custom dropdown buttons
  document.querySelectorAll('.cell-model-button').forEach(button => {
    const cellId = button.id.replace('model-btn-', '');
    const cell = currentSheet.cells[cellId];
    if (cell && cell.model) {
      const model = models.find(m => m.id === cell.model);
      const textSpan = button.querySelector('.model-button-text');
      if (textSpan) {
        textSpan.textContent = model ? model.name : cell.model;
      }
    }
  });

  // Update old select elements
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

  // Update model indicators for all cards
  const allCellIds = Object.keys(currentSheet.cells);
  allCellIds.forEach(cellId => {
    updateCardModelIndicator(cellId);
  });
}

// ============================================================================
// SECTION 4: DEPENDENCY PARSING
// ============================================================================

/**
 * Parse dependencies from a prompt string
 * 
 * Dependencies are denoted by {{ID}} where ID is another cell identifier.
 * Supports multiple reference formats:
 * - {{A1}} - just the cell output
 * - {{prompt:A1}} - the cell's prompt
 * - {{output:A1}} - the cell's output (explicit)
 * - {{A1-1}} - first generation of cell A1
 * - {{A1-2}} - second generation of cell A1
 * - {{A1:1-3}} - generations 1 to 3 of cell A1
 * - {{A1:2}} - just generation 2 of cell A1
 * - {{Sheet2!A1}} - cross-sheet reference
 * - {{prompt:Sheet2!A1}} - cross-sheet prompt
 * 
 * @param {string} prompt - The prompt string to parse
 * @returns {Array<string>} List of referenced cell IDs/dependencies
 * 
 * @example
 * parseDependencies('Write a poem about {{A1}}') // Returns ['A1']
 * parseDependencies('{{A1}} and {{B2}}') // Returns ['A1', 'B2']
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
  while ((match = regex.exec(prompt)) !== null) {
    deps.push(match[1]);
  }
  return deps;
}

/**
 * Resolve a cell reference to get its value, supporting cross-sheet references
 * 
 * This function handles various cell reference formats including:
 * - Simple references: "A1"
 * - Type-specific: "prompt:A1", "output:A1"
 * - Generation-specific: "A1-1", "A1:2", "A1:1-3"
 * - Cross-sheet: "Sheet2!A1", "prompt:Sheet2!A1"
 * 
 * @param {string} reference - Cell reference string in various formats
 * @returns {Promise<string>} The resolved cell value (prompt, output, or generation content)
 * 
 * @example
 * await resolveCellReference('A1') // Returns cell A1's output
 * await resolveCellReference('prompt:A1') // Returns cell A1's prompt
 * await resolveCellReference('A1-1') // Returns first generation of A1
 * await resolveCellReference('Sheet2!A1') // Returns A1 from Sheet2
 */
async function resolveCellReference(reference) {
  try {
    // Parse the reference to determine what to return
    // Order matters: 1) Extract type prefix, 2) Extract sheet name, 3) Extract cell ID, 4) Extract generation spec
    let targetSheet = currentSheet;
    let cellId = reference;
    let returnType = 'output'; // default to output
    let generationSpec = null; // for generation-specific references

    // Step 1: Check for explicit type specification (prompt: or output:)
    // This must come first to handle cases like "prompt:Sheet2!A1"
    let remainingRef = reference;
    if (reference.includes(':') && (reference.startsWith('prompt:') || reference.startsWith('output:'))) {
      const colonIndex = reference.indexOf(':');
      returnType = reference.substring(0, colonIndex);
      remainingRef = reference.substring(colonIndex + 1);
    }

    // Step 2: Check if it's a cross-sheet reference (SheetName!CellId)
    // This must come before generation spec parsing to handle "Sheet2!A1:1-3"
    if (remainingRef.includes('!')) {
      const exclamationIndex = remainingRef.indexOf('!');
      const sheetName = remainingRef.substring(0, exclamationIndex);
      const cellRef = remainingRef.substring(exclamationIndex + 1);

      // Find the sheet by name
      targetSheet = sheets.find(sheet => sheet.name === sheetName);
      if (!targetSheet) {
        console.error(`❌ Sheet "${sheetName}" not found. Available sheets:`, sheets.map(s => s.name));
        return `[Sheet "${sheetName}" not found]`;
      }

      // Ensure cells are loaded for the target sheet (for cross-sheet references)
      // Check if cells need to be loaded (empty or not initialized)
      if (!targetSheet.cells || Object.keys(targetSheet.cells).length === 0) {
        console.log(`📥 Loading cells for sheet "${sheetName}" (ID: ${targetSheet.id})...`);
        await loadSheetCellsForSheet(targetSheet);
        console.log(`✅ Loaded ${Object.keys(targetSheet.cells).length} cells for sheet "${sheetName}"`);
      }

      cellId = cellRef;
    } else {
      cellId = remainingRef;
    }

    // Step 3: Check for generation-specific references (A1-1, A1:1-3, A1:2)
    // Now that we've extracted the cell ID, check for generation specs
    if (cellId.includes('-') || cellId.includes(':')) {
      // Handle generation references like A1-1, A1:1-3, A1:2
      if (cellId.includes('-') && !cellId.includes(':')) {
        // Format: A1-1 (single generation)
        const parts = cellId.split('-');
        if (parts.length === 2 && !isNaN(parseInt(parts[1]))) {
          cellId = parts[0];
          generationSpec = { type: 'single', index: parseInt(parts[1]) - 1 }; // Convert to 0-based index
        }
      } else if (cellId.includes(':')) {
        // Format: A1:1-3 or A1:2
        const parts = cellId.split(':');
        if (parts.length === 2) {
          const genPart = parts[1];
          if (genPart.includes('-')) {
            // Format: A1:1-3 (range)
            const [start, end] = genPart.split('-').map(n => parseInt(n) - 1); // Convert to 0-based
            if (!isNaN(start) && !isNaN(end)) {
              cellId = parts[0];
              generationSpec = { type: 'range', start, end };
            }
          } else {
            // Format: A1:2 (single generation)
            const genIndex = parseInt(genPart);
            if (!isNaN(genIndex)) {
              cellId = parts[0];
              generationSpec = { type: 'single', index: genIndex - 1 }; // Convert to 0-based
            }
          }
        }
      }
    }

    // Get the cell from the target sheet
    const cell = targetSheet.cells[cellId];
    if (!cell) {
      console.error(`❌ Cell "${cellId}" not found in sheet "${targetSheet.name}". Available cells:`, Object.keys(targetSheet.cells));
      return `[Cell "${cellId}" not found in sheet "${targetSheet.name}"]`;
    }

    // Debug: Log cell content for cross-sheet references
    if (targetSheet !== currentSheet) {
      console.log(`🔍 Resolving cross-sheet reference: Sheet "${targetSheet.name}", Cell "${cellId}"`);
      console.log(`   Cell prompt: "${(cell.prompt || '').substring(0, 50)}${cell.prompt && cell.prompt.length > 50 ? '...' : ''}"`);
      console.log(`   Cell output: "${(cell.output || '').substring(0, 50)}${cell.output && cell.output.length > 50 ? '...' : ''}"`);
      console.log(`   Has generations: ${cell.generations && cell.generations.length > 0 ? cell.generations.length : 0}`);
    }

    // Return the requested value
    let result;

    // Handle generation-specific references
    if (generationSpec) {
      // Check if cell has generations
      if (!cell.generations || cell.generations.length === 0) {
        result = `[ERROR: Cell ${cellId} has no generations]`;
      } else {
        if (generationSpec.type === 'single') {
          // Single generation reference (A1-1, A1:2)
          const index = generationSpec.index;
          if (index >= 0 && index < cell.generations.length) {
            result = cell.generations[index].output || '';
          } else {
            result = `[ERROR: Cell ${cellId} generation ${index + 1} not found (has ${cell.generations.length} generations)]`;
          }
        } else if (generationSpec.type === 'range') {
          // Range generation reference (A1:1-3)
          const { start, end } = generationSpec;
          if (start >= 0 && end < cell.generations.length && start <= end) {
            const generations = cell.generations.slice(start, end + 1);
            result = generations.map(gen => gen.output || '').join('\n\n---\n\n');
          } else {
            result = `[ERROR: Cell ${cellId} generation range ${start + 1}-${end + 1} not found (has ${cell.generations.length} generations)]`;
          }
        }
      }
    } else if (returnType === 'prompt') {
      result = cell.prompt || '';
    } else {
      // For output, if there's no output but there's a prompt, return the prompt content
      // This handles cases where the cell hasn't been run yet
      // Also treat "No generations yet" and UI placeholder text as if it's empty
      const outputText = cell.output || '';
      const isPlaceholderText = !outputText ||
        outputText.trim() === '' ||
        outputText === 'No generations yet' ||
        outputText.includes('📝 No generations yet') ||
        outputText.includes('No generations yet') && outputText.includes('Run');

      if (isPlaceholderText) {
        if (cell.prompt && cell.prompt.trim() !== '') {
          result = cell.prompt;
        } else {
          // Cell has neither output nor prompt - return error
          result = `[ERROR: Cell ${cellId} is completely empty - no prompt or output]`;
          console.error(`❌ Cell ${cellId} is completely empty - no prompt or output`);
        }
      } else {
        // Check if the output contains generation history text (which shouldn't be returned)
        if (outputText.includes('Generation History:') || (outputText.includes('Latest') && outputText.includes('PM -'))) {
          // This looks like generation history text, not actual output
          if (cell.prompt && cell.prompt.trim() !== '') {
            result = cell.prompt;
          } else {
            result = `[ERROR: Cell ${cellId} output is generation history, not actual content]`;
            console.error(`❌ Cell ${cellId} output is generation history, not actual content`);
          }
        } else {
          // Strip any HTML tags if present (in case output contains HTML)
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = outputText;
          const textContent = tempDiv.textContent || tempDiv.innerText || outputText;

          // Return the actual text content
          result = textContent.trim();

          // If after stripping HTML we have nothing meaningful, fall back to prompt
          if (!result || result === '' || result.includes('📝 No generations yet')) {
            if (cell.prompt && cell.prompt.trim() !== '') {
              result = cell.prompt;
            } else {
              result = `[ERROR: Cell ${cellId} has no valid content]`;
            }
          }
        }
      }
    }

    // Ensure result is always a string
    if (result === null || result === undefined) {
      result = '';
    }

    return String(result);
  } catch (error) {
    console.error(`❌ Error resolving cell reference "${reference}":`, error);
    return `[Error resolving reference: ${error.message}]`;
  }
}

/**
 * Extract the most recent image URL from referenced cells
 * 
 * Checks all referenced cells (from dependencies) to find image URLs.
 * Prioritizes the most recent generation, then current output, then older generations.
 * 
 * @param {Array<string>} depIds - Array of dependency cell IDs/references
 * @returns {Promise<string|null>} The most recent image URL found, or null if none found
 * 
 * @example
 * const imageUrl = await extractImageUrlFromReferencedCells(['A1', 'B2']);
 * if (imageUrl) console.log('Found image:', imageUrl);
 */
async function extractImageUrlFromReferencedCells(depIds) {
  const imageUrls = [];
  
  for (const depId of depIds) {
    try {
      // Parse the reference to get the cell ID and sheet
      let targetSheet = currentSheet;
      let cellId = depId;
      let returnType = 'output';
      
      // Handle cross-sheet references
      if (depId.includes('!')) {
        const exclamationIndex = depId.indexOf('!');
        const sheetName = depId.substring(0, exclamationIndex);
        cellId = depId.substring(exclamationIndex + 1);
        targetSheet = sheets.find(sheet => sheet.name === sheetName) || currentSheet;
      }
      
      // Handle type prefixes
      if (depId.includes(':') && (depId.startsWith('prompt:') || depId.startsWith('output:'))) {
        const colonIndex = depId.indexOf(':');
        returnType = depId.substring(0, colonIndex);
        const remaining = depId.substring(colonIndex + 1);
        if (remaining.includes('!')) {
          const exclamationIndex = remaining.indexOf('!');
          const sheetName = remaining.substring(0, exclamationIndex);
          cellId = remaining.substring(exclamationIndex + 1);
          targetSheet = sheets.find(sheet => sheet.name === sheetName) || currentSheet;
        } else {
          cellId = remaining;
        }
      }
      
      // Handle generation-specific references (A1-1, A1:2, etc.)
      let generationSpec = null;
      if (cellId.includes('-') || cellId.includes(':')) {
        if (cellId.includes('-') && !cellId.includes(':')) {
          const parts = cellId.split('-');
          if (parts.length === 2 && !isNaN(parseInt(parts[1]))) {
            cellId = parts[0];
            generationSpec = { type: 'single', index: parseInt(parts[1]) - 1 };
          }
        } else if (cellId.includes(':')) {
          const parts = cellId.split(':');
          if (parts.length === 2) {
            const genPart = parts[1];
            if (genPart.includes('-')) {
              const [start, end] = genPart.split('-').map(n => parseInt(n) - 1);
              if (!isNaN(start) && !isNaN(end)) {
                cellId = parts[0];
                generationSpec = { type: 'range', start, end };
              }
            } else {
              const genIndex = parseInt(genPart);
              if (!isNaN(genIndex)) {
                cellId = parts[0];
                generationSpec = { type: 'single', index: genIndex - 1 };
              }
            }
          }
        }
      }
      
      // Ensure cells are loaded for the target sheet
      if (!targetSheet.cells || Object.keys(targetSheet.cells).length === 0) {
        await loadSheetCellsForSheet(targetSheet);
      }
      
      const refCell = targetSheet.cells[cellId];
      if (!refCell) continue;
      
      // Check generations first (most recent first)
      if (refCell.generations && refCell.generations.length > 0) {
        if (generationSpec) {
          // Check specific generation(s)
          if (generationSpec.type === 'single') {
            const gen = refCell.generations[generationSpec.index];
            if (gen && gen.output && isImageUrl(gen.output)) {
              imageUrls.push({ url: gen.output, timestamp: gen.timestamp || '' });
            }
          } else if (generationSpec.type === 'range') {
            const { start, end } = generationSpec;
            for (let i = end; i >= start; i--) {
              const gen = refCell.generations[i];
              if (gen && gen.output && isImageUrl(gen.output)) {
                imageUrls.push({ url: gen.output, timestamp: gen.timestamp || '' });
                break; // Use the most recent in range
              }
            }
          }
        } else {
          // Check all generations, most recent first
          for (let i = refCell.generations.length - 1; i >= 0; i--) {
            const gen = refCell.generations[i];
            if (gen && gen.output && isImageUrl(gen.output)) {
              imageUrls.push({ url: gen.output, timestamp: gen.timestamp || '' });
              break; // Use the most recent image
            }
          }
        }
      }
      
      // Check current output if no image found in generations and not looking for prompt
      if (returnType !== 'prompt' && imageUrls.length === 0 && refCell.output && isImageUrl(refCell.output)) {
        imageUrls.push({ url: refCell.output, timestamp: new Date().toISOString() });
      }
    } catch (error) {
      console.error(`Error extracting image from cell reference ${depId}:`, error);
    }
  }
  
  // Return the most recent image URL (by timestamp, or first found if no timestamps)
  if (imageUrls.length > 0) {
    // Sort by timestamp (most recent first)
    imageUrls.sort((a, b) => {
      if (!a.timestamp) return 1;
      if (!b.timestamp) return -1;
      return new Date(b.timestamp) - new Date(a.timestamp);
    });
    return imageUrls[0].url;
  }
  
  return null;
}

/**
 * Use selected generations in the current cell
 * 
 * Collects all checked generation checkboxes from the modal and stores
 * them as references in the current cell. These selected generations will
 * be used when the cell is run, allowing users to reference specific
 * generations from other cells.
 * 
 * @returns {void}
 * 
 * @example
 * // User checks generation checkboxes in modal, then calls this function
 * useSelectedGenerations() // Stores selected generations in currentModalCellId
 */
function useSelectedGenerations() {
  const checkboxes = document.querySelectorAll('.generation-checkbox:checked');
  if (checkboxes.length === 0) {
    alert('Please select at least one generation to use.');
    return;
  }

  if (!currentModalCellId) {
    alert('No cell is currently selected.');
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
        generationNumber: generationNumber
      });
    }
  });

  if (selectedGenerations.length > 0) {
    // Store selected generations as references in the cell
    if (!currentSheet.cells[currentModalCellId]) {
      const defaultModel = getDefaultModel();
      currentSheet.cells[currentModalCellId] = {
        prompt: '',
        output: '',
        model: defaultModel,
        temperature: 0.7,
        cellPrompt: '',
        autoRun: false,
        selectedGenerations: []
      };
    }

    currentSheet.cells[currentModalCellId].selectedGenerations = selectedGenerations;

    // Save to database
    if (currentSheet.id) {
      const cell = currentSheet.cells[currentModalCellId];
      saveCellToDatabase(currentModalCellId, cell.prompt, cell.output, cell.model, cell.temperature, cell.cellPrompt, cell.autoRun, cell.interval || 0);
    }

    // Highlight selected generations in the modal
    highlightSelectedGenerations(selectedGenerations);

    // Show success message
    const generationRefs = selectedGenerations.map(gen => `${gen.cellId}-${gen.generationNumber}`).join(', ');
    showSuccess(`Selected generations (${generationRefs}) will be used when this cell runs`);

  }
}

/**
 * Highlight selected generations in the modal display
 * 
 * Visually marks generation checkboxes as checked based on the stored
 * selectedGenerations array in the current cell.
 * 
 * @param {Array<Object>} selectedGenerations - Array of {cellId, generationNumber} objects
 * @returns {void}
 */
function highlightSelectedGenerations(selectedGenerations) {
  // Remove any existing highlights
  document.querySelectorAll('.generation-log.highlighted').forEach(el => {
    el.classList.remove('highlighted');
  });

  // Add highlight to selected generations
  selectedGenerations.forEach(genRef => {
    const checkboxId = `gen-checkbox-${genRef.cellId}-${genRef.generationNumber}`;
    const checkbox = document.getElementById(checkboxId);
    if (checkbox) {
      const generationLog = checkbox.closest('.generation-log');
      if (generationLog) {
        generationLog.classList.add('highlighted');
      }
    }
  });
}

/**
 * Clear generation selection from the current cell
 * 
 * Removes all selected generations from the current modal cell and
 * unchecks all generation checkboxes in the modal.
 * 
 * @returns {void}
 */
function clearGenerationSelection() {
  const checkboxes = document.querySelectorAll('.generation-checkbox');
  checkboxes.forEach(checkbox => {
    checkbox.checked = false;
  });

  // Remove highlights
  document.querySelectorAll('.generation-log.highlighted').forEach(el => {
    el.classList.remove('highlighted');
  });
}

/**
 * Delete a specific generation from a cell's generation history
 * 
 * Removes a generation at the specified index from the cell's generations
 * array and updates the database. The generation index is 0-based and
 * refers to the position in the generations array (not the generation number).
 * If the deleted generation was the latest, updates the cell's output.
 * 
 * @param {string} cellId - Cell identifier
 * @param {number} generationIndex - Zero-based index of generation to delete
 * @returns {Promise<void>}
 * 
 * @example
 * // Delete the first generation (index 0) from cell A1
 * await deleteGeneration('A1', 0)
 */
async function deleteGeneration(cellId, generationIndex) {
  try {

    // Get the cell
    const cell = currentSheet.cells[cellId];
    if (!cell || !cell.generations || cell.generations.length === 0) {

      return;
    }

    // Confirm deletion
    const generation = cell.generations[generationIndex];
    if (!generation) {

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
      await saveCellToDatabase(cellId, cell.prompt, cell.output, cell.model, cell.temperature, cell.cellPrompt, cell.autoRun, cell.interval || 0);
    }

    // Refresh the modal to show updated generations
    if (currentModalCellId === cellId) {
      openModal(cellId);
    }

    // Update the grid display
    renderGrid();

    showSuccess(`Generation deleted successfully!`);

  } catch (error) {
    console.error(`❌ Error deleting generation from cell ${cellId}:`, error);
    showError(`Failed to delete generation: ${error.message}`);
  }
}

/**
 * Find all cells that depend on a given cell (including cross-sheet dependencies)
 * 
 * Scans all cells in all sheets to identify which cells reference
 * the specified cell in their prompts. Supports various reference formats
 * including simple references, type-specific references, and generation references.
 * 
 * @param {string} cellId - Cell identifier to find dependents for
 * @returns {Array<string>} Array of cell IDs that depend on the given cell
 *                          Format: "cellId" for same sheet, "sheetName!cellId" for cross-sheet
 * 
 * @example
 * // Find all cells that reference A1
 * const dependents = findDependentCells('A1') // Returns ['B2', 'Sheet2!C3']
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
 * Run all dependent cells after a cell is updated
 * 
 * Recursively runs all cells that depend on the given cell, maintaining
 * proper execution order. Handles cross-sheet dependencies and provides
 * visual feedback during execution. Only runs cells with auto-run enabled.
 * 
 * @param {string} cellId - Cell identifier that was updated
 * @param {Array<string>} [executionOrder=[]] - Array to track execution order
 * @returns {Promise<void>}
 * 
 * @example
 * // After updating cell A1, run all cells that depend on it
 * await runDependentCells('A1')
 */
async function runDependentCells(cellId, executionOrder = []) {
  const dependentCells = findDependentCells(cellId);

  if (dependentCells.length === 0) {
    return;
  }

  // Cell updated, found dependent cells

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
    // No dependent cells have auto-run enabled
    return;
  }

  // Running dependent cells with auto-run enabled

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

  // Check if this is an Excel formula first
  if (isFormula(cell.prompt)) {

    try {
      const result = parseFormula(cell.prompt);
      cell.output = String(result);

      // Update the output display
      if (outDiv) {
        outDiv.textContent = cell.output;
        outDiv.style.color = '#000000';
        outDiv.style.fontStyle = 'normal';
      }

      // Mark cell as processed
      const cellContainer = document.querySelector(`#prompt-${id}`)?.closest('.cell-container');
      if (cellContainer) {
        cellContainer.classList.remove('processing');
        cellContainer.classList.add('success');
        setTimeout(() => cellContainer.classList.remove('success'), 2000);
      }

      return; // Exit early for formulas
    } catch (error) {
      console.error(`❌ Excel formula error for ${id}:`, error);
      cell.output = '#ERROR';
      if (outDiv) {
        outDiv.textContent = '#ERROR';
        outDiv.style.color = '#dc3545';
        outDiv.style.fontStyle = 'normal';
      }
      return; // Exit early for formula errors
    }
  }

  // Resolve dependencies (including cross-sheet references)



  const deps = parseDependencies(cell.prompt);

  // Handle dependencies - only run cells from current sheet
  for (const depId of deps) {
    // Skip cross-sheet references (they don't need to be run)
    if (depId.includes('!')) {
      continue;
    }

    if (!currentSheet.cells[depId]) {

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

        await runCell(depId, visited);

      }
    } else {

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

    finalModel = fallbackModel;
  }

  // Update cell's stored model and temperature
  cell.model = finalModel;
  cell.temperature = temperature;

  // Replace placeholders with actual outputs (including cross-sheet references)
  let processedPrompt = cell.prompt;




  // Priority-based prompt processing:
  // 1. If selected generations exist, use them with the prompt
  // 2. If no selected generations but cell has value, use cell value with prompt
  // 3. If no selected generations and no cell value, just use the prompt

  if (cell.selectedGenerations && cell.selectedGenerations.length > 0) {

    const selectedGenerationsText = cell.selectedGenerations.map(genRef => {
      const refCell = currentSheet.cells[genRef.cellId];
      if (refCell && refCell.generations && refCell.generations[genRef.generationNumber - 1]) {
        const generation = refCell.generations[genRef.generationNumber - 1];
        return `Generation ${genRef.generationNumber} from ${genRef.cellId}:\n${generation.output}`;
      }
      return `[ERROR: Generation ${genRef.generationNumber} from ${genRef.cellId} not found]`;
    }).join('\n\n---\n\n');

    // Use selected generations with the prompt
    if (processedPrompt && processedPrompt.trim() !== '') {
      processedPrompt = `${selectedGenerationsText}\n\n${processedPrompt}`;

    } else {
      // If no prompt, use selected generations as the main content
      processedPrompt = selectedGenerationsText;

    }
  } else if (cell.prompt && cell.prompt.trim() !== '') {

    // Use cell value (original prompt) with the new prompt
    if (processedPrompt && processedPrompt.trim() !== '') {
      processedPrompt = `${cell.prompt}\n\n${processedPrompt}`;

    } else {
      // If no new prompt, use cell value as the main content
      processedPrompt = cell.prompt;

    }
  } else {

  }

  // Replace all dependency references in the prompt
  for (const depId of deps) {
    const replacement = await resolveCellReference(depId);
    
    // Ensure replacement is a string and handle undefined/null
    const replacementValue = replacement !== null && replacement !== undefined ? String(replacement) : '[Reference not found]';
    
    // Replace all occurrences of the placeholder {{depId}}
    const placeholder = '{{' + depId + '}}';
    if (processedPrompt.includes(placeholder)) {
      const beforeReplace = processedPrompt;
      processedPrompt = processedPrompt.split(placeholder).join(replacementValue);
      
      // Debug: Log replacement for cross-sheet references
      if (depId.includes('!')) {
        console.log(`✅ Cross-sheet reference replaced: ${placeholder} -> ${replacementValue.substring(0, 50)}...`);
      }
    }
  }

  // For image-to-video models, automatically extract image URLs from referenced cells or current cell
  const isImageToVideoModel = finalModel && (
    finalModel.includes('img2vid') || 
    finalModel.includes('image-to-video') || 
    finalModel.includes('stable-video-diffusion-img2vid') ||
    finalModel === 'fal-ai-stable-video-diffusion-img2vid' ||
    (finalModel.includes('stable-video-diffusion') && finalModel.includes('img2vid'))
  );
  
  if (isImageToVideoModel) {
    try {
      // Check if prompt already contains an image URL
      const hasImageUrlInPrompt = /image[_\s]*url[:\s]+(https?:\/\/[^\s]+)/i.test(processedPrompt) || 
                                   /(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp))/i.test(processedPrompt);
      
      if (!hasImageUrlInPrompt) {
        let imageUrl = null;
        
        // First, try to extract from referenced cells
        if (deps.length > 0) {
          console.log(`🔍 Image-to-video model detected. Checking ${deps.length} referenced cell(s) for image URLs...`);
          try {
            imageUrl = await extractImageUrlFromReferencedCells(deps);
            if (imageUrl) {
              console.log(`✅ Found image URL in referenced cells: ${imageUrl.substring(0, 80)}...`);
            } else {
              console.log(`⚠️ No image URLs found in referenced cells`);
            }
          } catch (extractError) {
            console.error(`❌ Error extracting image URL from referenced cells:`, extractError);
            // Continue without image URL - let the server handle the error
          }
        }
        
        // If no image found in referenced cells, check the current cell's own output/generations
        if (!imageUrl && cell) {
          console.log(`🔍 Checking current cell ${id} for image URLs...`);
          
          try {
            // Check current cell's generations (most recent first)
            if (cell.generations && cell.generations.length > 0) {
              for (let i = cell.generations.length - 1; i >= 0; i--) {
                const gen = cell.generations[i];
                if (gen && gen.output && isImageUrl(gen.output)) {
                  imageUrl = gen.output;
                  console.log(`✅ Found image URL in current cell's generation ${i + 1}: ${imageUrl.substring(0, 80)}...`);
                  break;
                }
              }
            }
            
            // Check current cell's output if no image found in generations
            if (!imageUrl && cell.output && isImageUrl(cell.output)) {
              imageUrl = cell.output;
              console.log(`✅ Found image URL in current cell's output: ${imageUrl.substring(0, 80)}...`);
            }
          } catch (cellCheckError) {
            console.error(`❌ Error checking current cell for image URL:`, cellCheckError);
            // Continue without image URL
          }
        }
        
        // If we found an image URL, format the prompt
        if (imageUrl) {
          processedPrompt = `image_url: ${imageUrl}\nprompt: ${processedPrompt}`;
          console.log(`🖼️ Auto-formatted prompt for image-to-video with extracted image URL`);
        } else {
          console.warn(`⚠️ Image-to-video model requires an image URL, but none found in referenced cells or current cell. Prompt: "${processedPrompt.substring(0, 100)}..."`);
          console.warn(`⚠️ Request will be sent anyway - server will return a helpful error message`);
        }
      } else {
        console.log(`✅ Prompt already contains an image URL, skipping extraction`);
      }
    } catch (error) {
      console.error(`❌ Error in image-to-video URL extraction:`, error);
      console.warn(`⚠️ Continuing with original prompt - request will be sent anyway`);
      // Don't block the request - let it proceed and the server will handle the error
    }
  }

  // For image generation (DALL-E), if the processed prompt is empty or contains error messages, use the cell's content
  if ((processedPrompt.trim() === '' || processedPrompt.includes('[ERROR:') || processedPrompt.includes('No generations yet')) && (finalModel === 'dall-e-2' || finalModel === 'dall-e-3')) {


    // Check if cell has any content
    const cellContent = cell.prompt || cell.output || cell.cellPrompt;
    if (!cellContent || cellContent.trim() === '') {
      // Show pretty alert for missing content
      showError(`🖼️ Image generation requires cell content! Please add a prompt, output, or cell prompt template to cell ${id} before generating an image.`);
      return; // Exit the function early
    }

    processedPrompt = cellContent;

  }

  // Final check: ensure we have a valid prompt for DALL-E
  if ((finalModel === 'dall-e-2' || finalModel === 'dall-e-3') && (processedPrompt.trim() === '' || processedPrompt.includes('[ERROR:'))) {

    processedPrompt = 'Generate an image';

  }

  // Debug: Log the final prompt before sending to API



  // Final validation: ensure we have a valid prompt
  if (processedPrompt.trim() === '' || processedPrompt.includes('[ERROR:')) {
    console.error(`❌ Invalid prompt for API call: "${processedPrompt}"`);
    showError(`❌ Invalid prompt for cell ${id}: ${processedPrompt}. Please add content to the cell before generating.`);
    return; // Exit the function early
  }

  // If no dependencies were found, log that
  if (deps.length === 0) {

  }

  // Check if it's an Excel formula
  if (processedPrompt.startsWith('=')) {
    cell.output = parseFormula(processedPrompt);
  } else {






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

      // Log before making the request
      console.log(`🚀 Preparing to send API request - Model: ${modelForApi}, Prompt length: ${processedPrompt.length}`);
      console.log(`📝 Prompt preview: ${processedPrompt.substring(0, 200)}...`);

      // Try server API first, fallback to client-side AI
      let content;
      try {
        const apiUrl = `${getApiBaseUrl()}/api/llm`;
        console.log(`🌐 Sending request to: ${apiUrl}`);
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokenResult.token}`
          },
          body: JSON.stringify({ prompt: processedPrompt, model: modelForApi, temperature }),
        });

        if (!response.ok) {
          throw new Error(`Server API Error ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (!data || typeof data.text === 'undefined') {
          throw new Error('Invalid response from server');
        }

        content = data.text || '';
      } catch (serverError) {

        throw new Error(`Server unavailable: ${serverError.message}`);
      }

      cell.output = content;

      // Log this generation
      const generation = {
        timestamp: new Date().toISOString(),
        prompt: processedPrompt,
        model: finalModel,
        temperature: temperature,
        output: cell.output,
        type: getMediaType(cell.output)
      };

      // Initialize generations array if it doesn't exist
      if (!cell.generations) {
        cell.generations = [];

      }
      cell.generations.push(generation);


      // Test: Check if the generation was actually added

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
    saveCellToDatabase(id, cell.prompt, cell.output, cell.model, cell.temperature, cell.cellPrompt || null, cell.autoRun || null, cell.interval || null);
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
 * 
 * Selects a cell, removes previous selection, focuses the textarea,
 * shows the output, and updates the status indicator.
 * 
 * @param {string} cellId - Cell identifier to select
 * @returns {void}
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
 * Handle keyboard navigation (Excel-like)
 * 
 * Provides arrow key navigation between cells, Enter/Tab for next cell,
 * Delete/Backspace for clearing cells, and Ctrl+Z/Y for undo/redo.
 * Does not handle navigation when modal is open or for card textareas.
 * 
 * @param {KeyboardEvent} event - Keyboard event object
 * @returns {void}
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

  // Don't handle navigation for card textareas - cards don't need cell navigation
  if (event.target && event.target.closest('.card')) {
    return;
  }

  // Global keyboard shortcuts
  if (event.ctrlKey || event.metaKey) {
    switch (event.key) {
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

  switch (event.key) {
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
            saveCellToDatabase(selectedCell, '', '', cell.model, cell.temperature, cell.cellPrompt || null, cell.autoRun || null, cell.interval || null);
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
 * 
 * Converts a cell ID (e.g., "A1") to zero-based column and row indices.
 * 
 * @param {string} cellId - Cell identifier (e.g., "A1", "B2")
 * @returns {Array<number>} [columnIndex, rowIndex] - Zero-based indices
 * 
 * @example
 * parseCellId('A1') // Returns [0, 0]
 * parseCellId('B2') // Returns [1, 1]
 */
function parseCellId(cellId) {
  const col = cellId.charCodeAt(0) - 65;
  const row = parseInt(cellId.substring(1)) - 1;
  return [col, row];
}

/**
 * Set loading state for the grid container
 * 
 * Adds or removes the 'loading' CSS class to show/hide loading indicators.
 * 
 * @param {boolean} loading - Whether to show loading state
 * @returns {void}
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
 * 
 * Adds or removes a row from the highlighted rows set and updates
 * the visual highlighting in the UI.
 * 
 * @param {number} rowIndex - Zero-based row index to toggle
 * @returns {void}
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
 * 
 * Adds or removes a column from the highlighted columns set and updates
 * the visual highlighting in the UI.
 * 
 * @param {number} columnIndex - Zero-based column index to toggle
 * @returns {void}
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
 * Update row highlighting in the UI
 * 
 * Applies the 'row-highlighted' CSS class to all rows that are in
 * the highlightedRows set. Also highlights row headers.
 * 
 * @returns {void}
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
 * Update column highlighting in the UI
 * 
 * Applies the 'header-highlighted' CSS class to all column headers
 * and 'column-highlighted' to all cells in columns that are in
 * the highlightedColumns set.
 * 
 * @returns {void}
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
 * Clear all row and column highlighting
 * 
 * Removes all rows and columns from their respective highlight sets
 * and updates the UI to reflect the changes.
 * 
 * @returns {void}
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
document.addEventListener('DOMContentLoaded', function () {
  // Check authentication first
  checkAuthentication();
});

// ============================================================================
// SECTION 10: AUTHENTICATION AND INITIALIZATION
// ============================================================================

/**
 * Check if user is authenticated and initialize the application
 * 
 * Sets up authentication state listener and initializes the app
 * when a user is authenticated.
 * 
 * @returns {Promise<void>}
 */
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

        // If user is admin, show admin button
        if (isAdmin) {
          const adminBtn = document.getElementById('adminButton');
          if (adminBtn) {
            adminBtn.style.display = 'inline-block';

          }
        }

        await initializeApp();
      } else {
        currentUser = null;
        isAuthenticated = false;
        isAdmin = false;

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

    // Show loading state
    const gridContainer = document.getElementById('grid');
    if (gridContainer) {
      gridContainer.innerHTML = '<div style="text-align: center; padding: 50px; color: #6c757d;">🔄 Loading GPT Cells...</div>';
    }

    // Check Firebase services




    // Wait for firestoreService to be available
    if (typeof firestoreService === 'undefined') {

      // Wait a bit and try again
      setTimeout(() => {
        if (typeof firestoreService !== 'undefined') {

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

      currentProjectId = requestedProjectId;
    }

    // Load data from Firestore
    await loadProjectsFromDatabase();

    // Grid is already rendered by loadProjectsFromDatabase()
    updateSheetTabs();

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
    if (!currentUser || !currentUser.uid) {
      // Set default values if no user
      const profileEmail = document.getElementById('profileEmail');
      if (profileEmail) profileEmail.textContent = 'Unknown';
      return;
    }

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

      if (profileEmail) {
        profileEmail.textContent = userData?.email || currentUser?.email || 'Unknown';
      }
      if (profileName) profileName.textContent = userData?.displayName || 'Not set';
      if (profileCreatedAt) profileCreatedAt.textContent = userData?.createdAt ? new Date(userData.createdAt).toLocaleDateString() : 'Unknown';
      if (profilePlan) {
        profilePlan.textContent = userData?.subscription || 'Free';
        profilePlan.className = userData?.subscription === 'pro' ? 'plan-badge pro' : 'plan-badge';
      }
      if (profileUsage) profileUsage.textContent = `${userData?.usage?.apiCalls || 0} / ${userData?.subscription === 'pro' ? 'Unlimited' : '100'}`;
    }
  } catch (error) {
    // Silently handle error - user profile is optional
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
document.addEventListener('click', function (event) {
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

// Handler functions for profile dropdown links
function handleProfileClick(event) {
  event.preventDefault();
  event.stopPropagation();
  const dropdown = document.getElementById('userDropdown');
  if (dropdown) {
    dropdown.style.display = 'none';
  }
  showProfile();
}

function handleSettingsClick(event) {
  event.preventDefault();
  event.stopPropagation();
  const dropdown = document.getElementById('userDropdown');
  if (dropdown) {
    dropdown.style.display = 'none';
  }
  showSettings();
}

function handleUsageClick(event) {
  event.preventDefault();
  event.stopPropagation();
  const dropdown = document.getElementById('userDropdown');
  if (dropdown) {
    dropdown.style.display = 'none';
  }
  showUsage();
}

function handleAdminClick(event) {
  event.preventDefault();
  event.stopPropagation();
  const dropdown = document.getElementById('userDropdown');
  if (dropdown) {
    dropdown.style.display = 'none';
  }
  // Navigate to admin dashboard
  window.location.href = '/admin.html';
}

function handleLogoutClick(event) {
  event.preventDefault();
  event.stopPropagation();
  const dropdown = document.getElementById('userDropdown');
  if (dropdown) {
    dropdown.style.display = 'none';
  }
  logout();
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
      defaultTemperature.addEventListener('input', function () {
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
        window.location.href = '/';
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

    const result = await authService.makeCurrentUserAdmin();
    if (result.success) {
      isAdmin = true;
      showSuccess('You are now an admin! Admin privileges granted.');

      // Add admin button to UI if it doesn't exist
      addAdminLink();
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

  // Find the admin link in the dropdown
  const adminLink = document.getElementById('adminLink');

  if (adminLink) {
    // Show the admin link
    adminLink.style.display = 'block';

  } else {

  }
}

// Check admin status and add link if needed
function checkAdminStatus() {

  if (isAdmin) {

    addAdminLink();
  } else {

  }
}

/**
 * Load projects from database
 */
async function loadProjectsFromDatabase() {
  try {

    // Check if Firebase services are available
    if (typeof firestoreService === 'undefined') {
      console.error('❌ firestoreService not available');
      throw new Error('Firebase services not loaded');
    }

    // Use demo user ID for testing (since we migrated demo data)
    const userId = currentUser ? currentUser.uid : 'demo-user-123';

    const result = await firestoreService.getProjects(userId);

    if (result.success && result.projects.length > 0) {
      projects = result.projects;

      // If a specific project was requested from URL, find it
      if (currentProjectId) {
        currentProject = projects.find(p => p.id === currentProjectId);
        if (!currentProject) {

          currentProject = projects[0];
          currentProjectId = currentProject.id;
        }
      } else {
        currentProject = projects[0];
        currentProjectId = currentProject.id;
      }




      // Load sheets for the current project
      await loadSheetsFromDatabase();

    } else {

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

    // Check if Firebase services are available
    if (typeof firestoreService === 'undefined') {
      console.error('❌ firestoreService not available');
      throw new Error('Firebase services not loaded');
    }

    // Use demo user ID for testing (since we migrated demo data)
    const userId = currentUser ? currentUser.uid : 'demo-user-123';
    const projectId = currentProjectId || 'default-project';


    const result = await firestoreService.getSheets(userId, projectId);

    if (result.success && result.sheets.length > 0) {
      // Update sheets array and sort by order
      sheets = result.sheets.map((sheet, index) => ({
        id: sheet.id,
        name: sheet.name,
        cells: {},
        numRows: sheet.numRows || 10,
        numCols: sheet.numCols || 10,
        columnNames: sheet.columnNames || {},
        cardPositions: sheet.cardPositions || {},
        order: sheet.order !== undefined ? sheet.order : index // Use stored order or fallback to index
      }));

      // Sort sheets by order
      sheets.sort((a, b) => (a.order || 0) - (b.order || 0));

      // If any sheets don't have an order, assign and save them
      const needsOrderUpdate = sheets.some((sheet, index) => sheet.order === undefined || sheet.order !== index);
      if (needsOrderUpdate) {
        sheets.forEach((sheet, index) => {
          sheet.order = index;
        });
        // Save updated order to database
        await saveSheetOrder();
      }

      // Load first sheet
      if (sheets.length > 0) {
        currentSheetIndex = 0;
        currentSheet = sheets[currentSheetIndex];


        // Update global variables with loaded dimensions
        numRows = currentSheet.numRows;
        numCols = currentSheet.numCols;

        // Load card positions from sheet
        if (currentSheet.cardPositions) {
          window.cardPositions = currentSheet.cardPositions;
        } else {
          window.cardPositions = {};
        }

        await loadSheetCells(currentSheet.id);
        loadProjectTitle();
        renderGrid();
        updateSheetTabs();
      }
    } else {
      // No sheets found in Firestore, create a default sheet for this project

      await createDefaultSheetForProject();
    }
  } catch (error) {
    console.error('Error loading sheets:', error);
    // Try loading from localStorage

    if (loadSheetsFromLocalStorage()) {
      loadProjectTitle();
      renderGrid();
      updateSheetTabs();
    } else {
      // Fallback: create a default sheet for this project

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

    } else {

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
      cells: {},
      cardPositions: {}
    };

    const projectId = currentProjectId || 'default-project';
    const result = await firestoreService.createSheet(currentUser.uid, projectId, sheetData);
    if (result.success) {
      sheets[0].id = result.sheetId;
      currentSheet = sheets[0];

    }
  } catch (error) {
    console.error('Error creating default sheet:', error);
  }
}

/**
 * Load and set the project title from current sheet
 * 
 * Updates both the page title and the project title element in the UI
 * with the current sheet's name.
 * 
 * @returns {void}
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
 * Load cells for a specific sheet from Firestore
 * 
 * Fetches all cell data for the given sheet from Firestore and populates
 * the currentSheet.cells object. Handles generation history and ensures
 * all cards have ports after loading.
 * 
 * @param {string} sheetId - Sheet identifier to load cells for
 * @param {boolean} [renderGrid=true] - Whether to re-render the grid after loading
 * @returns {Promise<void>}
 * 
 * @throws {Error} If loading fails
 */
async function loadSheetCells(sheetId, renderGridAfterLoad = true) {
  try {
    // Find the sheet object in the sheets array
    const targetSheet = sheets.find(s => s.id === sheetId);
    if (!targetSheet) {
      console.error(`❌ Sheet with ID ${sheetId} not found in sheets array`);
      return;
    }

    const userId = currentUser ? currentUser.uid : 'demo-user-123';
    const projectId = currentProjectId || 'default-project';

    // Get cells from Firestore
    const cellsSnapshot = await db.collection('users').doc(userId).collection('projects').doc(projectId).collection('sheets').doc(sheetId).collection('cells').get();

    if (!cellsSnapshot.empty) {
      // Convert Firestore cells to our format
      const loadedCells = {};
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
          interval: cellData.interval || 0,
          generations: cellData.generations || []
        };

        loadedCells[doc.id] = cell;
      });

      // Update the target sheet's cells in the array
      targetSheet.cells = loadedCells;

      // CRITICAL: Also update currentSheet.cells directly if this is the current sheet
      // This ensures the reference is always correct, even if currentSheet isn't the exact same object
      if (currentSheet && currentSheet.id === sheetId) {
        currentSheet.cells = loadedCells;
        cells = loadedCells;
      }

      // Re-render the grid to show the loaded cells (only if requested)
      if (renderGridAfterLoad) {
        renderGrid();

        // Ensure all cards have ports after loading
        setTimeout(() => {
          ensureAllCardPorts();
        }, 100);
      }
    } else {
      // Initialize empty cells if none found
      if (!targetSheet.cells) {
        targetSheet.cells = {};
      }
      // If this is the current sheet, also update currentSheet
      if (currentSheet && currentSheet.id === sheetId) {
        if (!currentSheet.cells) {
          currentSheet.cells = {};
        }
        cells = currentSheet.cells;
      }
    }
  } catch (error) {
    console.error('❌ Error loading sheet cells:', error);
    // Ensure cells object exists even on error
    const targetSheet = sheets.find(s => s.id === sheetId);
    if (targetSheet && !targetSheet.cells) {
      targetSheet.cells = {};
    }
    if (currentSheet && currentSheet.id === sheetId && !currentSheet.cells) {
      currentSheet.cells = {};
      cells = currentSheet.cells;
    }
  }
}

/**
 * Load cells for a specific sheet object (for cross-sheet references)
 * 
 * Fetches all cell data for the given sheet from Firestore and populates
 * the sheet's cells object. This is used when loading cells for cross-sheet
 * references without switching to that sheet.
 * 
 * @param {Object} sheet - Sheet object to load cells for
 * @returns {Promise<void>}
 * 
 * @throws {Error} If loading fails
 */
async function loadSheetCellsForSheet(sheet) {
  try {
    if (!sheet || !sheet.id) {
      console.error('❌ Cannot load cells: sheet or sheet.id is missing');
      return;
    }

    // Initialize cells object if it doesn't exist
    if (!sheet.cells) {
      sheet.cells = {};
    }

    const userId = currentUser ? currentUser.uid : 'demo-user-123';
    const projectId = currentProjectId || 'default-project';

    console.log(`📥 Loading cells for sheet "${sheet.name}" (ID: ${sheet.id}, User: ${userId}, Project: ${projectId})`);

    // Check if db is available
    if (typeof db === 'undefined' || !db) {
      console.error('❌ Firestore db is not available');
      return;
    }

    // Get cells from Firestore
    const cellsSnapshot = await db.collection('users').doc(userId).collection('projects').doc(projectId).collection('sheets').doc(sheet.id).collection('cells').get();

    if (!cellsSnapshot.empty) {
      // Convert Firestore cells to our format
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
          interval: cellData.interval || 0,
          generations: cellData.generations || []
        };

        sheet.cells[doc.id] = cell;
      });

      console.log(`✅ Successfully loaded ${Object.keys(sheet.cells).length} cells for sheet "${sheet.name}"`);
    } else {
      console.log(`⚠️ No cells found for sheet "${sheet.name}"`);
      // Initialize empty cells if none found
      sheet.cells = {};
    }
  } catch (error) {
    console.error(`❌ Error loading cells for sheet ${sheet ? sheet.name : 'unknown'}:`, error);
    // Initialize empty cells on error
    if (!sheet.cells) {
      sheet.cells = {};
    }
  }
}

/**
 * Save cell data to Firestore database
 * 
 * Persists cell data including prompt, output, model settings, and generation
 * history to Firestore. Ensures the sheet has an ID before saving.
 * 
 * @param {string} cellId - Cell identifier
 * @param {string} prompt - Cell prompt text
 * @param {string} output - Cell output text
 * @param {string|null} [model=null] - AI model ID (uses current if null)
 * @param {number|null} [temperature=null] - Temperature setting (uses current if null)
 * @param {string|null} [cellPrompt=null] - Cell prompt template (uses current if null)
 * @param {boolean|null} [autoRun=null] - Auto-run setting (uses current if null)
 * @param {number|null} [interval=null] - Run interval in seconds (uses current if null)
 * @returns {Promise<void>}
 * 
 * @throws {Error} If save operation fails
 */
async function saveCellToDatabase(cellId, prompt, output, model = null, temperature = null, cellPrompt = null, autoRun = null, interval = null) {
  try {
    // Ensure sheet has an ID before saving
    await ensureSheetHasId();

    // Get current model and temperature from UI if not provided
    const currentModel = model || document.getElementById('model-select')?.value || 'gpt-3.5-turbo';
    const currentTemperature = temperature !== null ? temperature : parseFloat(document.getElementById('temp-input')?.value || 0.7);
    const currentCellPrompt = cellPrompt !== null ? cellPrompt : (currentSheet.cells[cellId]?.cellPrompt || '');
    const currentAutoRun = autoRun !== null ? autoRun : (currentSheet.cells[cellId]?.autoRun || false);
    const currentInterval = interval !== null ? interval : (currentSheet.cells[cellId]?.interval || 0);

    const userId = currentUser ? currentUser.uid : 'demo-user-123';
    const projectId = currentProjectId || 'default-project';





    // Get generations from the cell
    const generations = currentSheet.cells[cellId]?.generations || [];

    // Save to Firestore

    const cellData = {
      prompt: prompt,
      output: output,
      model: currentModel,
      temperature: currentTemperature,
      cellPrompt: currentCellPrompt,
      autoRun: currentAutoRun,
      interval: currentInterval,
      generations: generations,
      updatedAt: new Date()
    };



    const result = await firestoreService.saveCell(userId, projectId, currentSheet.id, cellId, cellData);


  } catch (error) {
    console.error('❌ Error saving cell:', error);
  }
}

/**
 * Save sheet dimensions (rows and columns) to Firestore
 * 
 * Updates the sheet's numRows and numCols in Firestore. Falls back to
 * localStorage if Firestore update fails.
 * 
 * @returns {Promise<void>}
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

    } catch (error) {
      console.error('Error saving sheet dimensions:', error);
      // Fallback to localStorage
      saveSheetsToLocalStorage();

    }
  }
}

/**
 * Save sheets to localStorage as backup
 * 
 * Persists the current sheets array and currentSheetIndex to localStorage
 * for offline backup. Includes a timestamp for version tracking.
 * 
 * @returns {void}
 * 
 * @throws {Error} If localStorage write fails
 */
function saveSheetsToLocalStorage() {
  try {
    const sheetsData = {
      sheets: sheets,
      currentSheetIndex: currentSheetIndex,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('gpt-cells-sheets', JSON.stringify(sheetsData));

  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
}

/**
 * Load sheets from localStorage backup
 * 
 * Attempts to restore sheets data from localStorage. Returns true if
 * data was successfully loaded, false otherwise.
 * 
 * @returns {boolean} True if sheets were loaded successfully, false otherwise
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
 * 
 * Updates both old-style select elements and new custom dropdown buttons
 * with the available AI models. Sets appropriate default values based on
 * cell settings or project defaults.
 * 
 * @param {Array<Object>} models - Array of model objects with id, name, description, etc.
 * @returns {void}
 */
function populateCellModelSelectors(models) {
  // Ensure we're using the same active models as the top and modal selectors
  const activeModels = models && models.length > 0 ? models : (availableModels || []);

  // Get the main model selector value
  const mainModelSelect = document.getElementById('model-select');
  const defaultModel = mainModelSelect ? mainModelSelect.value : (activeModels[0]?.id || '');

  // Find all cell model selectors (old select elements)
  const cellModelSelectors = document.querySelectorAll('.cell-model-select');

  cellModelSelectors.forEach(selector => {
    // Clear existing options
    selector.innerHTML = '';

    // Add all active models (same as top and modal selectors)
    activeModels.forEach(model => {
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
      const textModels = activeModels.filter(m => m.type === 'text');

      let defaultModelToUse;
      if (projectDefaultModel && activeModels.find(m => m.id === projectDefaultModel)) {
        defaultModelToUse = projectDefaultModel;
      } else {
        defaultModelToUse = textModels.length > 0 ? textModels[0].id : defaultModel;
      }

      selector.value = defaultModelToUse;
    }
  });

  // Populate custom dropdown buttons for cards
  const cellModelButtons = document.querySelectorAll('.cell-model-button');
  cellModelButtons.forEach(button => {
    const cellId = button.id.replace('model-btn-', '');
    const cell = currentSheet.cells[cellId];
    // Always use the main selector's value as the default for new cards
    // If cell has no model or has the old default, use the main selector value
    let cellModel = cell && cell.model ? cell.model : defaultModel;
    // If cell model is the old hardcoded default, update it to use main selector
    if (cellModel === 'gpt-3.5-turbo' && defaultModel && defaultModel !== 'gpt-3.5-turbo') {
      cellModel = defaultModel;
      // Update the cell object
      if (cell) {
        cell.model = defaultModel;
      }
    }

    // Find model name from active models (same as top and modal)
    const model = activeModels.find(m => m.id === cellModel);
    const modelName = model ? model.name : 'Loading...';

    // Update button text
    const textSpan = button.querySelector('.model-button-text');
    if (textSpan) {
      textSpan.textContent = modelName;
    }

    // Update model indicator in card header
    updateCardModelIndicator(cellId);

    // Populate dropdown menu with active models (same as top and modal)
    const dropdown = document.getElementById(`model-dropdown-${cellId}`);
    if (dropdown) {
      dropdown.innerHTML = '';
      activeModels.forEach(model => {
        const option = document.createElement('div');
        option.className = 'cell-model-option';
        if (model.id === cellModel) {
          option.classList.add('selected');
        }
        option.textContent = model.name;
        option.title = model.description || '';
        option.onclick = () => selectCellModel(cellId, model.id);
        dropdown.appendChild(option);
      });
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

      return;
    }

    const userId = currentUser ? currentUser.uid : 'demo-user-123';



    const updateData = {
      defaultModel: modelId,
      updatedAt: new Date()
    };

    const result = await firestoreService.updateProject(userId, currentProjectId, updateData);

    // Update the current project object with the new default model
    if (currentProject) {
      currentProject.defaultModel = modelId;

    }

  } catch (error) {
    console.error('❌ Error saving default model to project:', error);
  }
}

/**
 * Update the main model selector with available models
 * 
 * Populates the main model selector dropdown with models grouped by type
 * (text, image, audio). Also updates the modal model selector and all cell
 * model selectors. Sets the default model based on project settings or
 * selects the first available OpenAI text model.
 * 
 * @param {Array<Object>} models - Array of model objects with id, name, type, provider, etc.
 * @returns {void}
 */
function updateModelSelector(models) {
  const modelSelect = document.getElementById('model-select');
  const modalModelSelect = document.getElementById('modalModel');

  if (!modelSelect) {
    console.error('Model selector element not found!');
    return;
  }

  // Ensure we're using the same models array for all selectors
  // Use availableModels if models parameter is empty/undefined
  const activeModels = models && models.length > 0 ? models : (availableModels || []);

  // Update the global availableModels to keep it synchronized
  if (models && models.length > 0) {
    availableModels = models;
  }

  // Clear existing options
  modelSelect.innerHTML = '';
  if (modalModelSelect) {
    modalModelSelect.innerHTML = '';
  }

  // Handle empty models case
  if (activeModels.length === 0) {
    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = 'No models available';
    modelSelect.appendChild(emptyOption);
    if (modalModelSelect) {
      const modalEmptyOption = document.createElement('option');
      modalEmptyOption.value = '';
      modalEmptyOption.textContent = 'No models available';
      modalModelSelect.appendChild(modalEmptyOption);
    }
    // Clear card selectors too
    populateCellModelSelectors([]);
    return;
  }

  // Group models by type
  const groupedModels = {};
  activeModels.forEach(model => {
    const type = model.type || 'text';
    if (!groupedModels[type]) {
      groupedModels[type] = [];
    }
    groupedModels[type].push(model);
  });

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

  // Populate all cell model selectors with the same active models
  populateCellModelSelectors(activeModels);

  // Check if project has a saved default model
  const projectDefaultModel = currentProject && currentProject.defaultModel;
  let modelToSet = null;

  if (projectDefaultModel && activeModels.find(m => m.id === projectDefaultModel)) {
    // Use the project's saved default model
    modelToSet = projectDefaultModel;

  } else {
    // Set default selection (first OpenAI TEXT model, not image/audio)
    const openaiTextModels = activeModels.filter(m => m.provider === 'openai' && m.type === 'text');
    if (openaiTextModels.length > 0) {
      modelToSet = openaiTextModels[0].id;

      // Save the default model to the project
      saveProjectDefaultModel(modelToSet);
    } else if (activeModels.length > 0) {
      // Fallback to first text model if no OpenAI text models
      const textModels = activeModels.filter(m => m.type === 'text');
      if (textModels.length > 0) {
        modelToSet = textModels[0].id;

        // Save the default model to the project
        saveProjectDefaultModel(modelToSet);
      } else {
        // Last resort - first model
        modelToSet = activeModels[0].id;

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

  if (modalModelSelect) {

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

    }
  });

  // Show a brief success message
  if (updatedCount > 0) {
    showSuccess(`Updated ${updatedCount} empty cells to use ${newDefaultModel}`);
  }

}

/**
 * Handle model selector change event
 */
function handleModelSelectorChange() {
  const selectedModel = this.value;

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
  // Don't handle navigation for card textareas - cards don't need cell navigation
  if (event.target && event.target.closest('.card')) {
    return;
  }

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
  // Handle card selection
  const card = event.target.closest('.card');
  if (card) {
    // Don't select if clicking on header actions, ports, or controls
    if (event.target.closest('.card-header-actions') ||
      event.target.classList.contains('card-port') ||
      event.target.closest('.card-controls')) {
      // Ensure ports exist on all cards after any click
      ensureAllCardPorts();
      return;
    }

    // Select the card (show ports)
    const cellId = card.getAttribute('data-cell-id');
    if (cellId) {
      showCardControls(cellId);
    }

    // Ensure ports exist on all cards after any click
    ensureAllCardPorts();
    return;
  }

  const textarea = event.target.closest('textarea[id^="prompt-"]');
  if (textarea) {
    const cellId = textarea.id.replace('prompt-', '');
    selectCell(cellId);
  } else {
    // Hide all outputs when clicking elsewhere
    hideAllOutputs();

    // Remove focused class from all cards when clicking outside
    document.querySelectorAll('.card').forEach(card => {
      card.classList.remove('focused');
    });
  }

  // Ensure ports exist on all cards after any click
  ensureAllCardPorts();
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

    // Ensure cells object exists (but don't clear if it already has data)
    if (!currentSheet.cells) {
      currentSheet.cells = {};
    }

    // Update global variables with current sheet dimensions
    numRows = currentSheet.numRows || 10;
    numCols = currentSheet.numCols || 10;

    // Load card positions from sheet
    if (currentSheet.cardPositions) {
      window.cardPositions = { ...currentSheet.cardPositions };
    } else {
      window.cardPositions = {};
    }

    // Load cells from database (this will populate the sheet's cells in the array)
    if (currentSheet.id) {
      await loadSheetCells(currentSheet.id, false); // Don't render grid yet, we'll do it after
    }

    // Re-sync currentSheet reference to ensure we have the latest data
    // This ensures we're using the same object reference that loadSheetCells updated
    currentSheet = sheets[currentSheetIndex];

    // CRITICAL: Ensure cells are properly loaded and synced
    // Double-check that cells exist and are not empty if they should have data
    if (!currentSheet.cells) {
      currentSheet.cells = {};
    }

    // Sync the global cells variable
    cells = currentSheet.cells;

    // Verify cells were loaded - if the sheet should have cells but doesn't, try loading again
    // This handles edge cases where the reference might have been lost
    const cellCount = Object.keys(currentSheet.cells).length;

    // Update project title
    loadProjectTitle();

    // Clear highlighting
    clearAllHighlighting();

    // Re-render the grid with loaded cells
    renderGrid();
    updateSheetTabs();

    // Ensure all cards have ports after rendering
    setTimeout(() => {
      ensureAllCardPorts();
      drawConnectionLines();
    }, 100);
  }
}

/**
 * Add a new sheet
 */
async function addSheet() {
  try {
    const userId = currentUser ? currentUser.uid : 'demo-user-123';
    const sheetNumber = sheets.length + 1;

    // Create sheet in Firestore
    const projectId = currentProjectId || 'default-project';
    const result = await firestoreService.createSheet(userId, projectId, {
      name: `Sheet${sheetNumber}`,
      numRows: 10,
      numCols: 10,
      order: sheets.length // Set order to the end
    });

    if (result.success) {
      const newSheet = {
        id: result.sheetId,
        name: `Sheet${sheetNumber}`,
        cells: {},
        numRows: 10,
        numCols: 10,
        order: sheets.length // Set order to the end
      };

      sheets.push(newSheet);

      // Save order for the new sheet
      await firestoreService.updateSheet(userId, projectId, newSheet.id, {
        order: newSheet.order,
        updatedAt: new Date()
      });

      switchSheet(sheets.length - 1);
      updateSheetTabs();
      showSuccess('Sheet created successfully!');
    } else {
      console.error('Failed to create sheet:', result.error);

      // Fallback: create sheet locally if Firestore fails
      if (result.error.includes('permissions') || result.error.includes('Missing')) {

        const localSheet = {
          id: 'local-' + Date.now(),
          name: `Sheet${sheetNumber}`,
          cells: {},
          numRows: 10,
          numCols: 10,
          order: sheets.length // Set order to the end
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

    const sheetNumber = sheets.length + 1;
    const localSheet = {
      id: 'local-' + Date.now(),
      name: `Sheet${sheetNumber}`,
      cells: {},
      numRows: 10,
      numCols: 10,
      order: sheets.length // Set order to the end
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
    const sheetToDelete = sheets[sheetIndex];
    const sheetName = sheetToDelete.name || `Sheet ${sheetIndex + 1}`;

    // Confirm deletion
    if (!confirm(`Are you sure you want to delete "${sheetName}"? This will permanently delete the sheet and all its cards. This action cannot be undone.`)) {
      return;
    }

    try {
      const userId = currentUser ? currentUser.uid : 'demo-user-123';
      const projectId = currentProjectId || 'default-project';

      // Delete sheet from Firestore
      const result = await firestoreService.deleteSheet(userId, projectId, sheetToDelete.id);

      if (result.success) {
        sheets.splice(sheetIndex, 1);
        if (currentSheetIndex >= sheets.length) {
          currentSheetIndex = sheets.length - 1;
        }

        // Update order for remaining sheets
        await saveSheetOrder();

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
 * Save title to Firestore (updates current sheet name)
 * This function is called from the title edit UI in app.html
 * 
 * @param {string} newTitle - The new title/name for the current sheet
 * @returns {Promise<void>}
 */
async function saveTitleToFirestore(newTitle) {
  if (!newTitle || !newTitle.trim()) {
    return;
  }

  const trimmedName = newTitle.trim();

  // Update the current sheet's name
  if (currentSheetIndex >= 0 && currentSheetIndex < sheets.length) {
    await updateSheetName(currentSheetIndex, trimmedName);
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

          showSuccess('Sheet name saved successfully');
        } catch (error) {
          console.error('❌ Error updating sheet name:', error);
          showError('Failed to save sheet name');
        }
      }

      // Update the project title if this is the current sheet
      if (sheetIndex === currentSheetIndex) {
        loadProjectTitle();
      }

      // Update sheet tabs to reflect the new name
      updateSheetTabs();
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
 * Handle sheet tab clicks (switch sheet unless clicking on buttons)
 */
function handleSheetTabClick(event, sheetIndex) {
  // Don't switch if clicking on buttons or interactive elements
  // Check if the click originated from a button or its child
  const clickedElement = event.target;
  const isButton = clickedElement.classList.contains('sheet-close') ||
    clickedElement.classList.contains('sheet-edit-btn') ||
    clickedElement.classList.contains('sheet-move-btn') ||
    clickedElement.closest('.sheet-move-btn') ||
    clickedElement.closest('.sheet-edit-btn') ||
    clickedElement.closest('.sheet-close') ||
    clickedElement.tagName === 'BUTTON';

  if (isButton) {
    return; // Let the button handle its own click
  }

  // Switch to the clicked sheet (entire tab area is clickable)
  switchSheet(sheetIndex);
}

/**
 * Save sheet order to database
 * 
 * Updates the order field for all sheets in Firestore to persist
 * the current tab order.
 * 
 * @returns {Promise<void>}
 */
async function saveSheetOrder() {
  try {
    const userId = currentUser ? currentUser.uid : 'demo-user-123';
    const projectId = currentProjectId || 'default-project';

    // Update order for all sheets
    const updatePromises = sheets.map((sheet, index) => {
      if (sheet.id) {
        return firestoreService.updateSheet(userId, projectId, sheet.id, {
          order: index,
          updatedAt: new Date()
        });
      }
      return Promise.resolve();
    });

    await Promise.all(updatePromises);
  } catch (error) {
    console.error('❌ Error saving sheet order:', error);
    // Don't show error to user as this is a background operation
  }
}

/**
 * Move sheet left (decrease index)
 */
async function moveSheetLeft(sheetIndex) {
  if (sheetIndex > 0) {
    // Swap sheets
    const temp = sheets[sheetIndex];
    sheets[sheetIndex] = sheets[sheetIndex - 1];
    sheets[sheetIndex - 1] = temp;

    // Update current sheet index if needed
    if (currentSheetIndex === sheetIndex) {
      currentSheetIndex = sheetIndex - 1;
    } else if (currentSheetIndex === sheetIndex - 1) {
      currentSheetIndex = sheetIndex;
    }

    updateSheetTabs();

    // Save order to database
    await saveSheetOrder();
    showSuccess('Sheet moved left');
  }
}

/**
 * Move sheet right (increase index)
 */
async function moveSheetRight(sheetIndex) {
  if (sheetIndex < sheets.length - 1) {
    // Swap sheets
    const temp = sheets[sheetIndex];
    sheets[sheetIndex] = sheets[sheetIndex + 1];
    sheets[sheetIndex + 1] = temp;

    // Update current sheet index if needed
    if (currentSheetIndex === sheetIndex) {
      currentSheetIndex = sheetIndex + 1;
    } else if (currentSheetIndex === sheetIndex + 1) {
      currentSheetIndex = sheetIndex;
    }

    updateSheetTabs();

    // Save order to database
    await saveSheetOrder();
    showSuccess('Sheet moved right');
  }
}

/**
 * Start editing sheet name (opens input field)
 */
function startEditingSheetName(sheetIndex) {
  const sheetNameElement = document.querySelector(`.sheet-name[data-sheet-index="${sheetIndex}"]`);
  if (!sheetNameElement) return;

  const currentName = sheets[sheetIndex].name;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentName;
  input.className = 'sheet-name-input';
  input.style.cssText = `
    border: 1px solid var(--color-accent);
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 13px;
    font-weight: 500;
    background: white;
    color: var(--color-text-main);
    outline: none;
    min-width: 80px;
    max-width: 200px;
  `;

  const finishEdit = () => {
    const newName = input.value.trim();
    if (newName && newName !== currentName) {
      updateSheetName(sheetIndex, newName);
    } else {
      sheetNameElement.textContent = currentName;
    }
    input.replaceWith(sheetNameElement);
  };

  input.addEventListener('blur', finishEdit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      finishEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      input.replaceWith(sheetNameElement);
      sheetNameElement.textContent = currentName;
    }
  });

  sheetNameElement.replaceWith(input);
  input.focus();
  input.select();
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
      <div class="sheet-tab ${isActive ? 'active' : ''}" onclick="handleSheetTabClick(event, ${index})" oncontextmenu="showSheetContextMenu(event, ${index})" style="cursor: pointer; position: relative;">
        <button class="sheet-move-btn sheet-move-left" onclick="moveSheetLeft(${index}); event.stopPropagation(); event.preventDefault();" title="Move left" ${index === 0 ? 'disabled style="opacity: 0.3; cursor: not-allowed;"' : ''}>◀</button>
        <span class="sheet-name" data-sheet-index="${index}" style="cursor: pointer; flex: 1; min-width: 0; pointer-events: auto;">${sheet.name}</span>
        <button class="sheet-edit-btn" onclick="startEditingSheetName(${index}); event.stopPropagation(); event.preventDefault();" title="Edit name">✏️</button>
        <button class="sheet-move-btn sheet-move-right" onclick="moveSheetRight(${index}); event.stopPropagation(); event.preventDefault();" title="Move right" ${index === sheets.length - 1 ? 'disabled style="opacity: 0.3; cursor: not-allowed;"' : ''}>▶</button>
        ${sheets.length > 1 ? '<span class="sheet-close" onclick="deleteSheet(' + index + '); event.stopPropagation(); event.preventDefault();" title="Delete sheet">×</span>' : ''}
      </div>
    `;
  });

  html += '<div class="add-sheet-btn" onclick="addSheet()" title="Add new sheet">+</div>';
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
 * Clipboard for copy/paste operations
 * @type {Object|null} clipboard - Stores copied cell data {prompt, output, type}
 */
let clipboard = null;

/**
 * Copy a cell's data to the clipboard
 * 
 * Stores the cell's prompt and output in the clipboard for pasting
 * into another cell.
 * 
 * @param {string} cellId - Cell identifier to copy
 * @returns {void}
 */
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

/**
 * Paste clipboard data into a cell
 * 
 * Copies the clipboard's prompt and output into the specified cell
 * and updates the UI textarea and output display.
 * 
 * @param {string} cellId - Cell identifier to paste into
 * @returns {void}
 */
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
 * Find and replace text across all cells
 * 
 * Searches through all cell prompts and replaces matching text. Supports
 * case-sensitive and case-insensitive matching. Updates both the cell data
 * and the UI textareas.
 * 
 * @param {string} findText - Text to find
 * @param {string} replaceText - Text to replace with
 * @param {boolean} [matchCase=false] - Whether to match case (default: false)
 * @returns {number} Number of cells where replacements were made
 * 
 * @example
 * // Replace "hello" with "hi" in all cells (case-insensitive)
 * const count = findAndReplace('hello', 'hi', false) // Returns number of replacements
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
 * 
 * Maintains history of cell states for undo/redo operations.
 * Maximum of 50 undo steps are stored.
 */
let undoStack = [];
let redoStack = [];
const MAX_UNDO_STEPS = 50;

/**
 * Save current state to undo stack
 * 
 * Creates a deep copy of the current cells and sheet index and pushes
 * it to the undo stack. Clears the redo stack when a new action is performed.
 * 
 * @returns {void}
 */
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

/**
 * Undo the last action
 * 
 * Restores the previous state from the undo stack and pushes the current
 * state to the redo stack. Re-renders the grid after restoration.
 * 
 * @returns {void}
 */
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

/**
 * Redo the last undone action
 * 
 * Restores the next state from the redo stack and pushes the current
 * state to the undo stack. Re-renders the grid after restoration.
 * 
 * @returns {void}
 */
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

// ============================================================================
// SECTION 12: MODAL FUNCTIONALITY
// ============================================================================

/**
 * Modal state variables
 * @type {string|null} currentModalCellId - Currently open modal's cell ID
 * @type {string|null} currentEditingCell - Currently editing cell ID for formatting
 */
let currentModalCellId = null;
let currentEditingCell = null;

/**
 * Open the cell editor modal
 * 
 * Displays the modal editor for the specified cell, populating it with
 * the cell's current data including prompt, output, model settings, and
 * generation history. Initializes formatting controls.
 * 
 * @param {string} cellId - Cell identifier to open in modal
 * @returns {void}
 */
function openModal(cellId) {
  currentModalCellId = cellId;
  // Opening modal for cell
  // Opening modal for cell

  // Get the default model from the main selector
  const mainModelSelect = document.getElementById('model-select');
  const defaultModel = mainModelSelect ? mainModelSelect.value : 'gpt-3.5-turbo';
  const cell = currentSheet.cells[cellId] || { prompt: '', output: '', model: defaultModel, temperature: 0.7, cellPrompt: '' };

  // Show the modal
  document.getElementById('cellModal').style.display = 'block';

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
    modalPrompt.addEventListener('input', function () {
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

  // Opening modal for cell

  if (cell.generations && cell.generations.length > 0) {

    let logsHTML = '<div class="generation-logs" style="background: #ffffff; padding: 16px; border-radius: 8px;">';
    logsHTML += '<h4 style="margin: 0 0 10px 0; color: #495057; font-size: 14px;">Generation History:</h4>';
    logsHTML += '<div style="margin-bottom: 10px; font-size: 12px; color: #6c757d; background: #e3f2fd; padding: 8px; border-radius: 4px;">';
    logsHTML += '💡 <strong>Reference generations:</strong> Use {{' + cellId + '-1}} for first generation, {{' + cellId + '-2}} for second, etc.';
    logsHTML += '</div>';

    // Show generations in reverse order (most recent first) - Facebook wall style
    const sortedGenerations = [...cell.generations].reverse();

    sortedGenerations.forEach((gen, index) => {
      const isLatest = index === 0;
      const generationNumber = cell.generations.length - index; // Actual generation number (1-based)
      const timestamp = new Date(gen.timestamp);
      const timeAgo = getTimeAgo(timestamp);
      const genType = gen.type || 'text';

      // Facebook-style post card
      logsHTML += `<div class="generation-log ${isLatest ? 'latest' : ''}" style="
        margin-bottom: 12px; 
        background: #ffffff; 
        border: 1px solid #e4e6eb; 
        border-radius: 8px; 
        box-shadow: 0 1px 2px rgba(0,0,0,0.1);
        overflow: hidden;
        transition: box-shadow 0.2s;
      " onmouseover="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.15)'" onmouseout="this.style.boxShadow='0 1px 2px rgba(0,0,0,0.1)'">`;

      // Post header (Facebook style)
      logsHTML += `<div style="padding: 12px 16px; border-bottom: 1px solid #e4e6eb; display: flex; align-items: center; justify-content: space-between;">`;
      logsHTML += `<div style="display: flex; align-items: center; gap: 8px;">`;
      // Avatar/icon placeholder
      logsHTML += `<div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px;">${genType === 'image' ? '🖼️' : genType === 'video' ? '🎥' : genType === 'audio' ? '🎵' : '🤖'}</div>`;
      logsHTML += `<div>`;
      logsHTML += `<div style="font-weight: 600; font-size: 15px; color: #050505; line-height: 1.2;">${gen.model || 'AI Model'}</div>`;
      logsHTML += `<div style="font-size: 13px; color: #65676b; margin-top: 2px;">${timeAgo} · Temp: ${gen.temperature} ${isLatest ? '· Latest' : ''}</div>`;
      logsHTML += `</div>`;
      logsHTML += `</div>`;

      // Action buttons (top right)
      logsHTML += `<div style="display: flex; align-items: center; gap: 4px;">`;
      logsHTML += `<input type="checkbox" id="gen-checkbox-${cellId}-${generationNumber}" class="generation-checkbox" style="margin: 0; cursor: pointer;" title="Select this generation">`;
      logsHTML += `<button class="delete-generation-btn" onclick="deleteGeneration('${cellId}', ${index})" title="Delete this generation" style="
        background: transparent; 
        color: #65676b; 
        border: none; 
        border-radius: 50%; 
        width: 32px; 
        height: 32px; 
        cursor: pointer; 
        display: flex; 
        align-items: center; 
        justify-content: center;
        transition: background 0.2s;
      " onmouseover="this.style.background='#f0f2f5'" onmouseout="this.style.background='transparent'">🗑️</button>`;
      logsHTML += `</div>`;
      logsHTML += `</div>`;

      // Content area (different styling based on type)
      if (genType === 'image') {
        logsHTML += `<div style="padding: 0; background: #000;">`;
        logsHTML += formatGenerationContent(gen.output, genType);
        logsHTML += `</div>`;
      } else if (genType === 'video') {
        logsHTML += `<div style="padding: 0; background: #000;">`;
        logsHTML += formatGenerationContent(gen.output, genType);
        logsHTML += `</div>`;
      } else if (genType === 'audio') {
        logsHTML += `<div style="padding: 16px; background: #f0f2f5;">`;
        logsHTML += formatGenerationContent(gen.output, genType);
        logsHTML += `</div>`;
      } else {
        // Text/HTML content
        logsHTML += `<div style="padding: 12px 16px; margin: 0;">`;
        logsHTML += formatGenerationContent(gen.output, genType);
        logsHTML += `</div>`;
      }

      logsHTML += `</div>`;
    });

    // Add action buttons for selected generations
    logsHTML += '<div style="margin-top: 15px; padding: 10px; background: #f8f9fa; border-radius: 5px; border: 1px solid #e9ecef;">';
    logsHTML += '<div style="font-size: 12px; color: #495057; margin-bottom: 8px;"><strong>Selected Generations:</strong></div>';
    logsHTML += '<button id="use-selected-generations" onclick="useSelectedGenerations()" style="background: #007bff; color: white; border: none; padding: 6px 12px; border-radius: 3px; font-size: 12px; cursor: pointer; margin-right: 8px;">Use Selected</button>';
    logsHTML += '<button id="clear-selection" onclick="clearGenerationSelection()" style="background: #6c757d; color: white; border: none; padding: 6px 12px; border-radius: 3px; font-size: 12px; cursor: pointer;">Clear Selection</button>';
    logsHTML += '</div>';

    logsHTML += '</div>';

    modalOutput.innerHTML = logsHTML;

    // Highlight selected generations if they exist
    if (cell.selectedGenerations && cell.selectedGenerations.length > 0) {
      setTimeout(() => {
        highlightSelectedGenerations(cell.selectedGenerations);
      }, 100); // Small delay to ensure DOM is updated
    }
  } else {

    const noGenerationsHTML = `
      <div style="text-align: center; padding: 20px; color: #6c757d;">
        <div style="font-size: 16px; margin-bottom: 10px;">📝 No generations yet</div>
        <div style="font-size: 12px;">Run this cell to create your first generation!</div>
        <div style="font-size: 11px; margin-top: 10px; color: #007bff;">
          💡 Once you have generations, you can reference them with {{${cellId}-1}}, {{${cellId}-2}}, etc.
        </div>
      </div>
    `;

    modalOutput.innerHTML = noGenerationsHTML;

  }

  // Set modal model to cell's model, or default to the main model selector's value
  const modalDefaultModel = mainModelSelect ? mainModelSelect.value : 'gpt-3.5-turbo';
  const modalModelEl = document.getElementById('modalModel');
  if (modalModelEl) {
    modalModelEl.value = cell.model || modalDefaultModel;
  }

  const modalTemperatureEl = document.getElementById('modalTemperature');
  if (modalTemperatureEl) {
    modalTemperatureEl.value = cell.temperature || 0.7;
  }

  const modalTempValueEl = document.getElementById('modalTempValue');
  if (modalTempValueEl) {
    modalTempValueEl.textContent = cell.temperature || 0.7;
  }

  const modalCellPromptEl = document.getElementById('modalCellPrompt');
  if (modalCellPromptEl) {
    modalCellPromptEl.value = cell.cellPrompt || '';
  }

  const modalAutoRunEl = document.getElementById('modalAutoRun');
  if (modalAutoRunEl) {
    modalAutoRunEl.checked = cell.autoRun || false;
  }

  // Opening modal for cell

  // Show modal
  document.getElementById('cellModal').style.display = 'block';

  // Update temperature display when slider changes
  const modalTempSliderEl = document.getElementById('modalTemperature');
  const modalTempValueDisplayEl = document.getElementById('modalTempValue');
  if (modalTempSliderEl && modalTempValueDisplayEl) {
    modalTempSliderEl.addEventListener('input', function () {
      modalTempValueDisplayEl.textContent = this.value;
    });
  }

  // Initialize formatting controls and load existing formatting
  initializeFormattingControls();
  loadCellFormatting(cellId);
}

/**
 * Close the cell editor modal
 * 
 * Hides the modal and clears the current modal cell ID and editing cell.
 * 
 * @returns {void}
 */
function closeModal() {
  document.getElementById('cellModal').style.display = 'none';
  currentModalCellId = null;
  currentEditingCell = null;
}

/**
 * Run the cell from the modal editor
 * 
 * Executes the cell with the current modal values (prompt, model, temperature)
 * and updates the modal output display with generation history after completion.
 * 
 * @returns {Promise<void>}
 */
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

    if (cell.generations && cell.generations.length > 0) {
      let logsHTML = '<div class="generation-logs">';
      logsHTML += '<h4 style="margin: 0 0 10px 0; color: #495057; font-size: 14px;">Generation History:</h4>';
      logsHTML += '<div style="margin-bottom: 10px; font-size: 12px; color: #6c757d; background: #e3f2fd; padding: 8px; border-radius: 4px;">';
      logsHTML += '💡 <strong>Reference generations:</strong> Use {{' + currentModalCellId + '-1}} for first generation, {{' + currentModalCellId + '-2}} for second, etc.';
      logsHTML += '</div>';

      // Show generations in reverse order (most recent first) - Facebook wall style
      const sortedGenerations = [...cell.generations].reverse();

      sortedGenerations.forEach((gen, index) => {
        const isLatest = index === 0;
        const generationNumber = cell.generations.length - index; // Actual generation number (1-based)
        const timestamp = new Date(gen.timestamp);
        const timeAgo = getTimeAgo(timestamp);
        const genType = gen.type || 'text';

        // Facebook-style post card
        logsHTML += `<div class="generation-log ${isLatest ? 'latest' : ''}" style="
          margin-bottom: 12px; 
          background: #ffffff; 
          border: 1px solid #e4e6eb; 
          border-radius: 8px; 
          box-shadow: 0 1px 2px rgba(0,0,0,0.1);
          overflow: hidden;
          transition: box-shadow 0.2s;
        " onmouseover="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.15)'" onmouseout="this.style.boxShadow='0 1px 2px rgba(0,0,0,0.1)'">`;

        // Post header (Facebook style)
        logsHTML += `<div style="padding: 12px 16px; border-bottom: 1px solid #e4e6eb; display: flex; align-items: center; justify-content: space-between;">`;
        logsHTML += `<div style="display: flex; align-items: center; gap: 8px;">`;
        // Avatar/icon placeholder
        logsHTML += `<div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px;">${genType === 'image' ? '🖼️' : genType === 'video' ? '🎥' : genType === 'audio' ? '🎵' : '🤖'}</div>`;
        logsHTML += `<div>`;
        logsHTML += `<div style="font-weight: 600; font-size: 15px; color: #050505; line-height: 1.2;">${gen.model || 'AI Model'}</div>`;
        logsHTML += `<div style="font-size: 13px; color: #65676b; margin-top: 2px;">${timeAgo} · Temp: ${gen.temperature} ${isLatest ? '· Latest' : ''}</div>`;
        logsHTML += `</div>`;
        logsHTML += `</div>`;

        // Action buttons (top right)
        logsHTML += `<div style="display: flex; align-items: center; gap: 4px;">`;
        logsHTML += `<input type="checkbox" id="gen-checkbox-${currentModalCellId}-${generationNumber}" class="generation-checkbox" style="margin: 0; cursor: pointer;" title="Select this generation">`;
        logsHTML += `<button class="delete-generation-btn" onclick="deleteGeneration('${currentModalCellId}', ${index})" title="Delete this generation" style="
          background: transparent; 
          color: #65676b; 
          border: none; 
          border-radius: 50%; 
          width: 32px; 
          height: 32px; 
          cursor: pointer; 
          display: flex; 
          align-items: center; 
          justify-content: center;
          transition: background 0.2s;
        " onmouseover="this.style.background='#f0f2f5'" onmouseout="this.style.background='transparent'">🗑️</button>`;
        logsHTML += `</div>`;
        logsHTML += `</div>`;

        // Content area (different styling based on type)
        if (genType === 'image') {
          logsHTML += `<div style="padding: 0; background: #000;">`;
          logsHTML += formatGenerationContent(gen.output, genType);
          logsHTML += `</div>`;
        } else if (genType === 'video') {
          logsHTML += `<div style="padding: 0; background: #000;">`;
          logsHTML += formatGenerationContent(gen.output, genType);
          logsHTML += `</div>`;
        } else if (genType === 'audio') {
          logsHTML += `<div style="padding: 16px; background: #f0f2f5;">`;
          logsHTML += formatGenerationContent(gen.output, genType);
          logsHTML += `</div>`;
        } else {
          // Text/HTML content
          logsHTML += `<div style="padding: 12px 16px;">`;
          logsHTML += formatGenerationContent(gen.output, genType);
          logsHTML += `</div>`;
        }

        logsHTML += `</div>`;
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

/**
 * Save the cell from the modal editor
 * 
 * Persists all cell data from the modal inputs (prompt, model, temperature,
 * cellPrompt, autoRun) to both memory and Firestore. Handles both text and
 * image outputs.
 * 
 * @returns {Promise<void>}
 */
function saveModalCell() {
  if (!currentModalCellId) return;

  const modalPromptEl = document.getElementById('modalPrompt');
  const modalModelEl = document.getElementById('modalModel');
  const modalTemperatureEl = document.getElementById('modalTemperature');
  const modalCellPromptEl = document.getElementById('modalCellPrompt');
  const modalAutoRunEl = document.getElementById('modalAutoRun');

  if (!modalPromptEl || !modalModelEl) return;

  const prompt = modalPromptEl.value;
  const model = modalModelEl.value;
  const temperature = modalTemperatureEl ? parseFloat(modalTemperatureEl.value) : 0.7;
  const cellPrompt = modalCellPromptEl ? modalCellPromptEl.value : '';
  const autoRun = modalAutoRunEl ? modalAutoRunEl.checked : false;

  // Saving modal cell

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
    const cellInterval = currentSheet.cells[currentModalCellId]?.interval || 0;
    saveCellToDatabase(currentModalCellId, prompt, output, model, temperature, cellPrompt, autoRun, cellInterval);
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

/**
 * Run the cell directly from the modal
 * 
 * Saves the current modal content first, then triggers execution,
 * and finally re-opens the modal to show results.
 * 
 * @returns {Promise<void>}
 */
async function runModalCell() {
  if (!currentModalCellId) return;

  // 1. Save changes first (without closing modal logic)
  const modalPromptEl = document.getElementById('modalPrompt');
  const modalModelEl = document.getElementById('modalModel');
  const modalTemperatureEl = document.getElementById('modalTemperature');
  const modalCellPromptEl = document.getElementById('modalCellPrompt');
  const modalAutoRunEl = document.getElementById('modalAutoRun');

  if (!modalPromptEl || !modalModelEl) return;

  // Update UI to show running state
  const runBtn = document.querySelector('.run-button');
  const originalBtnText = runBtn.textContent;
  if (runBtn) {
    runBtn.textContent = 'Running...';
    runBtn.disabled = true;
  }

  try {
    const prompt = modalPromptEl.value;
    const model = modalModelEl.value;
    const temperature = modalTemperatureEl ? parseFloat(modalTemperatureEl.value) : 0.7;
    const cellPrompt = modalCellPromptEl ? modalCellPromptEl.value : '';
    const autoRun = modalAutoRunEl ? modalAutoRunEl.checked : false;

    // Update cell data
    if (!currentSheet.cells[currentModalCellId]) {
      currentSheet.cells[currentModalCellId] = {
        prompt: '', output: '', model: model, temperature: temperature, cellPrompt: '', autoRun: false
      };
    }

    currentSheet.cells[currentModalCellId].prompt = prompt;
    currentSheet.cells[currentModalCellId].model = model;
    currentSheet.cells[currentModalCellId].temperature = temperature;
    currentSheet.cells[currentModalCellId].cellPrompt = cellPrompt;
    currentSheet.cells[currentModalCellId].autoRun = autoRun;

    // Save to database
    const cellInterval = currentSheet.cells[currentModalCellId]?.interval || 0;
    saveCellToDatabase(currentModalCellId, prompt, currentSheet.cells[currentModalCellId].output, model, temperature, cellPrompt, autoRun, cellInterval);

    // 2. Run the cell
    await runCellWithDependencies(currentModalCellId);

    // 3. Re-open modal to refresh data (simplest way to update history and output)
    openModal(currentModalCellId);

    showSuccess(`Cell ${currentModalCellId} executed successfully`);

  } catch (error) {
    console.error('Error running cell from modal:', error);
    showError('Failed to run cell: ' + error.message);
  } finally {
    // Restore button state
    if (runBtn) {
      runBtn.textContent = originalBtnText;
      runBtn.disabled = false;
    }
  }
}

// Close modal when clicking outside of it
window.onclick = function (event) {
  const modal = document.getElementById('cellModal');
  if (event.target === modal) {
    closeModal();
  }
}

// Close modal with Escape key
document.addEventListener('keydown', function (event) {
  if (event.key === 'Escape') {
    closeModal();
    closeImageModal();
  }
});

// Close image modal when clicking outside
document.addEventListener('click', function (event) {
  const imageModal = document.getElementById('imageModal');
  if (imageModal && imageModal.style.display === 'block' && event.target === imageModal) {
    closeImageModal();
  }
});

// ============================================================================
// SECTION 13: MEDIA TYPE DETECTION AND RENDERING
// ============================================================================

/**
 * Check if a text string is an image URL
 * 
 * Detects various image URL formats including data URLs, HTTP/HTTPS URLs
 * with image extensions, and provider-specific patterns (OpenAI DALL-E,
 * Firebase Storage, Replicate, Stability AI, Midjourney, Leonardo AI).
 * 
 * @param {string} text - Text to check
 * @returns {boolean} True if text appears to be an image URL
 */
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

/**
 * Check if a text string is a video URL
 * 
 * Detects various video URL formats including data URLs, HTTP/HTTPS URLs
 * with video extensions, and provider-specific patterns (Runway ML,
 * Pika Labs, Stability AI Video, Replicate, Firebase Storage).
 * 
 * @param {string} text - Text to check
 * @returns {boolean} True if text appears to be a video URL
 */
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

/**
 * Check if a text string is an audio URL
 * 
 * Detects base64-encoded audio data URLs in various formats (MP3, WAV, OGG).
 * 
 * @param {string} text - Text to check
 * @returns {boolean} True if text appears to be an audio data URL
 */
function isAudioUrl(text) {
  if (!text) return false;
  // Check if it's a base64 audio data URL
  return text.startsWith('data:audio/mp3;base64,') ||
    text.startsWith('data:audio/wav;base64,') ||
    text.startsWith('data:audio/ogg;base64,');
}

/**
 * Determine the media type of output content
 * 
 * Checks the output string against image, video, and audio detection functions
 * to determine the content type. Returns 'text' as default.
 * 
 * @param {string} output - Output content to analyze
 * @returns {string} Media type: 'image', 'video', 'audio', or 'text'
 */
function getMediaType(output) {
  if (!output) return 'text';

  if (isImageUrl(output)) return 'image';
  if (isVideoUrl(output)) return 'video';
  if (isAudioUrl(output)) return 'audio';

  return 'text';
}

/**
 * Format generation content for display in modal
 * 
 * Cleans and formats generation output based on its type:
 * - Text: Removes extra whitespace, normalizes line breaks, preserves formatting
 * - HTML: Detects HTML and renders it properly
 * - Image/Video/Audio: Returns formatted HTML for media display
 * 
 * @param {string} output - The generation output content
 * @param {string} type - The media type ('text', 'image', 'video', 'audio', 'html')
 * @returns {string} Formatted HTML string for display
 */
function formatGenerationContent(output, type) {
  if (!output) return '';

  // Handle media types (image, video, audio)
  if (type === 'image') {
    return `
      <div class="generation-content" style="position: relative; width: 100%; display: flex; justify-content: center; align-items: center; background: #000; padding: 0; margin: 0;">
        <img src="${escapeHtml(output)}" alt="Generated image" style="max-width: 100%; max-height: 600px; width: auto; height: auto; display: block; margin: 0 auto;">
        <div class="image-download-overlay" onclick="downloadImage('${escapeHtml(output)}')" title="Download image" style="
          position: absolute; 
          bottom: 12px; 
          right: 12px; 
          background: rgba(0,0,0,0.6); 
          border-radius: 50%; 
          width: 40px; 
          height: 40px; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          cursor: pointer;
          transition: background 0.2s;
        " onmouseover="this.style.background='rgba(0,0,0,0.8)'" onmouseout="this.style.background='rgba(0,0,0,0.6)'">
          <span class="download-icon" style="color: white; font-size: 18px;">⬇️</span>
        </div>
      </div>
    `;
  }

  if (type === 'video') {
    return `
      <div class="generation-content" style="position: relative; width: 100%; background: #000; padding: 0; margin: 0; display: flex; justify-content: center; align-items: center;">
        <div class="video-container" style="width: 100%; display: flex; justify-content: center; align-items: center;">
          <video controls style="max-width: 100%; max-height: 600px; width: auto; height: auto; display: block; margin: 0 auto;">
            <source src="${escapeHtml(output)}" type="video/mp4">
            Your browser does not support the video element.
          </video>
        </div>
        <div class="image-download-overlay" onclick="downloadVideo('${escapeHtml(output)}')" title="Download video" style="
          position: absolute; 
          bottom: 12px; 
          right: 12px; 
          background: rgba(0,0,0,0.6); 
          border-radius: 50%; 
          width: 40px; 
          height: 40px; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          cursor: pointer;
          transition: background 0.2s;
        " onmouseover="this.style.background='rgba(0,0,0,0.8)'" onmouseout="this.style.background='rgba(0,0,0,0.6)'">
          <span class="download-icon" style="color: white; font-size: 18px;">⬇️</span>
        </div>
      </div>
    `;
  }

  if (type === 'audio') {
    return `
      <div class="generation-content" style="position: relative; width: 100%; padding: 0; margin: 0;">
        <div class="audio-container" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; width: 100%;">
          <audio controls style="width: 100%; max-width: 100%; margin: 0 auto;">
            <source src="${escapeHtml(output)}" type="audio/mp3">
            Your browser does not support the audio element.
          </audio>
          <div class="image-download-overlay" onclick="downloadAudio('${escapeHtml(output)}')" title="Download audio" style="
            background: #1877f2; 
            color: white; 
            border: none; 
            border-radius: 6px; 
            padding: 8px 16px; 
            cursor: pointer;
            font-size: 13px;
            font-weight: 600;
            transition: background 0.2s;
            margin: 0 auto;
          " onmouseover="this.style.background='#166fe5'" onmouseout="this.style.background='#1877f2'">
            ⬇️ Download Audio
          </div>
        </div>
      </div>
    `;
  }

  // Handle text content
  const trimmedOutput = output.trim();

  // Check if it's HTML - look for HTML tags (more sophisticated check)
  const htmlTagPattern = /<\/?[a-z][\s\S]*?>/gi;
  const hasHtmlTags = htmlTagPattern.test(trimmedOutput);
  const htmlTagCount = (trimmedOutput.match(htmlTagPattern) || []).length;

  // If it has multiple HTML tags or looks like structured HTML, treat as HTML
  const looksLikeHtml = hasHtmlTags && (htmlTagCount > 1 || trimmedOutput.includes('</'));

  if (looksLikeHtml) {
    // It's HTML - render it as HTML (but sanitize to prevent XSS)
    // For now, we'll render it - in production you might want to use a sanitizer
    return `
      <div class="generation-content">
        <div style="font-size: 15px; line-height: 1.33; word-wrap: break-word; max-height: 500px; overflow-y: auto; color: #050505; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">${trimmedOutput}</div>
      </div>
    `;
  } else {
    // It's plain text - clean it up intelligently
    let cleanedText = trimmedOutput;

    // Preserve code blocks (markdown style)
    const codeBlockPattern = /```[\s\S]*?```/g;
    const codeBlocks = [];
    cleanedText = cleanedText.replace(codeBlockPattern, (match) => {
      const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
      codeBlocks.push(match);
      return placeholder;
    });

    // Preserve inline code
    const inlineCodePattern = /`[^`]+`/g;
    const inlineCodes = [];
    cleanedText = cleanedText.replace(inlineCodePattern, (match) => {
      const placeholder = `__INLINE_CODE_${inlineCodes.length}__`;
      inlineCodes.push(match);
      return placeholder;
    });

    // Clean up whitespace more aggressively
    cleanedText = cleanedText
      .replace(/\r\n/g, '\n')      // Normalize line breaks
      .replace(/\r/g, '\n')         // Normalize line breaks
      .replace(/\n{3,}/g, '\n\n')  // Max 2 consecutive newlines
      .replace(/[ \t]+/g, ' ')      // Normalize spaces/tabs (but preserve in code blocks)
      .replace(/^[ \t]+/gm, '')     // Remove leading whitespace from lines
      .replace(/[ \t]+$/gm, '')     // Remove trailing whitespace from lines
      .replace(/^\n+/, '')          // Remove leading newlines
      .replace(/\n+$/, '')          // Remove trailing newlines
      .replace(/\n /g, '\n')        // Remove spaces after newlines
      .replace(/ \n/g, '\n');       // Remove spaces before newlines

    // Restore code blocks
    codeBlocks.forEach((block, index) => {
      cleanedText = cleanedText.replace(`__CODE_BLOCK_${index}__`, block);
    });

    // Restore inline code
    inlineCodes.forEach((code, index) => {
      cleanedText = cleanedText.replace(`__INLINE_CODE_${index}__`, code);
    });

    // Escape HTML for safety, but preserve line breaks and code formatting
    cleanedText = escapeHtml(cleanedText);

    // Highlight code blocks with syntax highlighting (basic) - only if they exist
    cleanedText = cleanedText.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
      return `<pre style="background: #f4f4f4; padding: 10px; border-radius: 4px; overflow-x: auto; margin: 10px 0; border: none; border-left: none;"><code style="border: none; border-left: none; padding: 0;">${code.trim()}</code></pre>`;
    });

    // Highlight inline code - only if they exist
    cleanedText = cleanedText.replace(/`([^`]+)`/g, '<code style="background: #f4f4f4; padding: 2px 4px; border-radius: 3px; font-family: monospace; border: none; border-left: none;">$1</code>');

    return `
      <div class="generation-content" style="margin: 0; padding: 0;">
        <div style="white-space: pre-wrap; font-size: 15px; line-height: 1.33; word-wrap: break-word; color: #050505; max-height: 500px; overflow-y: auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0;">${cleanedText}</div>
      </div>
    `;
  }
}

/**
 * Escape HTML special characters
 * 
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML string
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Get time ago string (Facebook style)
 * 
 * Converts a date to a human-readable "time ago" string like "2 hours ago"
 * 
 * @param {Date} date - Date to convert
 * @returns {string} Human-readable time ago string
 */
function getTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) {
    return 'Just now';
  } else if (diffMins < 60) {
    return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
  }
}

/**
 * Render image output in a cell
 * 
 * Displays an image thumbnail in the cell's output area with click-to-view
 * functionality. The thumbnail opens a modal for full-size viewing.
 * 
 * @param {string} cellId - Cell identifier
 * @param {string} imageUrl - URL of the image to display
 * @returns {void}
 */
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

/**
 * Render text output in a cell
 * 
 * Displays plain text content in the cell's output area. Shows the output
 * div if text is present, hides it if empty.
 * 
 * @param {string} cellId - Cell identifier
 * @param {string} text - Text content to display
 * @returns {void}
 */
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

/**
 * Render audio output in a cell
 * 
 * Displays an HTML5 audio player with controls in the cell's output area.
 * Supports MP3 format with fallback message for unsupported browsers.
 * 
 * @param {string} cellId - Cell identifier
 * @param {string} audioData - Audio data URL (base64-encoded)
 * @returns {void}
 */
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

/**
 * Close the output display for a cell
 * 
 * Hides the output div for the specified cell. Prevents event bubbling
 * to avoid interfering with other click handlers.
 * 
 * @param {string} cellId - Cell identifier
 * @returns {boolean} Always returns false to prevent further event handling
 */
function closeOutput(cellId) {

  // Prevent event bubbling
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }

  const outDiv = document.getElementById('output-' + cellId);
  if (outDiv) {
    outDiv.style.display = 'none';

  } else {

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

  // Started resizing column
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

  // Started resizing row
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

  }
}

// Make admin functions available globally for console access
window.makeCurrentUserAdmin = makeCurrentUserAdmin;
window.checkAdminStatus = checkAdminStatus;
window.addAdminLink = addAdminLink;
window.forceAddAdminLink = function () {
  addAdminLink();
};

window.forceAdminStatus = function () {
  isAdmin = true;
  checkAdminStatus();
};

// Card positions storage
let cardPositions = {};

/**
 * Draw connection lines between cards based on dependencies
 */
// ============================================================================
// SECTION 9: CONNECTION MANAGEMENT
// ============================================================================

/**
 * Draw connection lines between cards based on dependencies
 * 
 * Parses dependencies from each card's prompt and draws SVG lines
 * connecting source cards (output ports) to target cards (input ports).
 * 
 * @returns {void}
 */
function drawConnectionLines() {
  // Ensure all cards have ports before drawing lines
  ensureAllCardPorts();
  const svg = document.getElementById('connection-lines');
  if (!svg) return;

  // Clear existing lines
  const existingLines = svg.querySelectorAll('line');
  existingLines.forEach(line => line.remove());

  // Update SVG dimensions
  const container = document.getElementById('cards-container');
  if (container) {
    const rect = container.getBoundingClientRect();
    svg.setAttribute('width', rect.width);
    svg.setAttribute('height', rect.height);
  }

  // Get all cards
  const cards = document.querySelectorAll('.card');

  cards.forEach(card => {
    const targetCellId = card.getAttribute('data-cell-id');
    const targetCell = currentSheet.cells[targetCellId];
    if (!targetCell || !targetCell.prompt) return;

    // Parse dependencies from prompt
    const deps = parseDependencies(targetCell.prompt);

    deps.forEach(depRef => {
      // Extract cell ID from dependency reference
      // Handle formats like: "A1", "prompt:A1", "output:A1", "A1-1", "A1:1-3", "A1:2"
      let depId = depRef;

      // Skip cross-sheet references
      if (depId.includes('!')) {
        return;
      }

      // Remove prefixes like "prompt:", "output:"
      if (depRef.includes(':')) {
        const parts = depRef.split(':');
        depId = parts[parts.length - 1];
      }

      // Remove generation suffixes like "-1", ":1-3", ":2"
      if (depId.includes('-')) {
        depId = depId.split('-')[0];
      }

      // Remove any remaining colons (for generation ranges)
      depId = depId.split(':')[0];

      const sourceCard = document.getElementById(`card-${depId}`);
      if (!sourceCard) {
        // Card doesn't exist yet, skip drawing this connection
        return;
      }

      // Get card positions
      const sourceRect = sourceCard.getBoundingClientRect();
      const targetRect = card.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      // Calculate port positions (output port on source, input port on target)
      const sourceX = sourceRect.right - containerRect.left;
      const sourceY = sourceRect.top + sourceRect.height / 2 - containerRect.top;
      const targetX = targetRect.left - containerRect.left;
      const targetY = targetRect.top + targetRect.height / 2 - containerRect.top;

      // Create line
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', sourceX);
      line.setAttribute('y1', sourceY);
      line.setAttribute('x2', targetX);
      line.setAttribute('y2', targetY);
      line.setAttribute('stroke', '#1967d2');
      line.setAttribute('stroke-width', '2');
      line.setAttribute('marker-end', 'url(#arrowhead)');
      svg.appendChild(line);
    });
  });
}

/**
 * Set up card dragging functionality
 */
function setupCardDragging() {
  let draggedCard = null;
  let offsetX = 0;
  let offsetY = 0;

  document.addEventListener('mousedown', (e) => {
    // Don't drag if clicking on ports, header actions, textarea, or controls
    if (e.target.classList.contains('card-port') ||
      e.target.closest('.card-header-actions') ||
      e.target.closest('textarea') ||
      e.target.closest('.card-controls')) return;

    const card = e.target.closest('.card');
    if (!card) return;

    draggedCard = card;
    const rect = card.getBoundingClientRect();
    const containerRect = document.getElementById('cards-container').getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    card.style.cursor = 'grabbing';
  });

  document.addEventListener('mousemove', (e) => {
    if (!draggedCard) return;

    const container = document.getElementById('cards-container');
    const containerRect = container.getBoundingClientRect();
    const x = e.clientX - containerRect.left - offsetX;
    const y = e.clientY - containerRect.top - offsetY;

    const cellId = draggedCard.getAttribute('data-cell-id');
    if (typeof window.cardPositions === 'undefined') {
      if (currentSheet && currentSheet.cardPositions) {
        window.cardPositions = { ...currentSheet.cardPositions };
      } else {
        window.cardPositions = {};
      }
    }
    window.cardPositions[cellId] = { x, y };
    draggedCard.style.left = x + 'px';
    draggedCard.style.top = y + 'px';

    drawConnectionLines();
  });

  document.addEventListener('mouseup', () => {
    if (draggedCard) {
      draggedCard.style.cursor = 'move';
      const cellId = draggedCard.getAttribute('data-cell-id');

      // Save card positions to database after dragging ends
      if (cellId && window.cardPositions && window.cardPositions[cellId]) {
        saveCardPositions();
      }

      draggedCard = null;
    }
  });
}

/**
 * Set up event delegation for card interactions
 */
function setupCardEventDelegation() {
  // Handle focus events on card textareas
  document.addEventListener('focusin', (e) => {
    if (e.target.matches('.card textarea')) {
      const card = e.target.closest('.card');
      if (card) {
        showCardControls(card.getAttribute('data-cell-id'));
      }
    }
  });

  document.addEventListener('focusout', (e) => {
    if (e.target.matches('.card textarea')) {
      setTimeout(() => {
        const card = e.target.closest('.card');
        if (card && !card.contains(document.activeElement)) {
          card.classList.remove('focused');
        }
      }, 200);
    }
  });
}

/**
 * Set up card connection functionality (drag from output port to input port)
 */
// Connection state (shared across all calls)
let connectionState = {
  draggingFromPort: null,
  previewLine: null,
  sourceCardId: null,
  isDragging: false
};

function setupCardConnections() {
  // Remove existing listeners by using a flag
  if (window.cardConnectionsSetup) return;
  window.cardConnectionsSetup = true;

  // Handle mousedown on output ports
  document.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('card-port') && e.target.classList.contains('output')) {
      e.preventDefault();
      e.stopPropagation();

      const card = e.target.closest('.card');
      if (!card) return;

      connectionState.sourceCardId = card.getAttribute('data-cell-id');
      connectionState.draggingFromPort = e.target;
      connectionState.isDragging = true;

      // Create preview line
      const container = document.getElementById('cards-container');
      if (!container) return;

      const svg = document.getElementById('connection-lines');
      if (!svg) return;

      connectionState.previewLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      connectionState.previewLine.setAttribute('stroke', '#1967d2');
      connectionState.previewLine.setAttribute('stroke-width', '2');
      connectionState.previewLine.setAttribute('stroke-dasharray', '5,5');
      connectionState.previewLine.setAttribute('opacity', '0.5');
      svg.appendChild(connectionState.previewLine);

      // Update cursor
      document.body.style.cursor = 'crosshair';
    }
  });

  // Handle mousemove to update preview line
  document.addEventListener('mousemove', (e) => {
    if (!connectionState.draggingFromPort || !connectionState.previewLine || !connectionState.isDragging) return;

    const container = document.getElementById('cards-container');
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const sourceRect = connectionState.draggingFromPort.getBoundingClientRect();

    // Calculate source port position
    const sourceX = sourceRect.right - containerRect.left;
    const sourceY = sourceRect.top + sourceRect.height / 2 - containerRect.top;

    // Calculate current mouse position
    const targetX = e.clientX - containerRect.left;
    const targetY = e.clientY - containerRect.top;

    // Update preview line
    connectionState.previewLine.setAttribute('x1', sourceX);
    connectionState.previewLine.setAttribute('y1', sourceY);
    connectionState.previewLine.setAttribute('x2', targetX);
    connectionState.previewLine.setAttribute('y2', targetY);

    // Highlight input ports on hover
    const inputPort = document.elementFromPoint(e.clientX, e.clientY);
    if (inputPort && inputPort.classList.contains('card-port') && inputPort.classList.contains('input')) {
      inputPort.style.background = '#0d47a1';
      inputPort.style.transform = 'translateY(-50%) scale(1.3)';
    } else {
      document.querySelectorAll('.card-port.input').forEach(port => {
        port.style.background = '#1967d2';
        port.style.transform = 'translateY(-50%) scale(1)';
      });
    }
  });

  // Handle mouseup to complete connection
  document.addEventListener('mouseup', (e) => {
    if (!connectionState.draggingFromPort || !connectionState.previewLine || !connectionState.isDragging) {
      // Reset input port styles
      document.querySelectorAll('.card-port.input').forEach(port => {
        port.style.background = '#1967d2';
        port.style.transform = 'translateY(-50%) scale(1)';
      });
      return;
    }

    // Use elementFromPoint to get the element under the cursor (more reliable than e.target)
    const elementUnderCursor = document.elementFromPoint(e.clientX, e.clientY);
    let targetPort = null;

    if (elementUnderCursor) {
      // Check if the element itself is an input port
      if (elementUnderCursor.classList.contains('card-port') && elementUnderCursor.classList.contains('input')) {
        targetPort = elementUnderCursor;
      } else {
        // Check if it's inside an input port
        targetPort = elementUnderCursor.closest('.card-port.input');
      }
    }

    // Fallback: check e.target
    if (!targetPort && e.target.classList.contains('card-port') && e.target.classList.contains('input')) {
      targetPort = e.target;
    }

    // Check if dropped on an input port
    if (targetPort && targetPort.classList.contains('card-port') && targetPort.classList.contains('input')) {
      const targetCard = targetPort.closest('.card');
      if (targetCard && connectionState.sourceCardId) {
        const targetCellId = targetCard.getAttribute('data-cell-id');
        if (targetCellId && connectionState.sourceCardId) {
          createCardDependency(connectionState.sourceCardId, targetCellId);
        }
      }
    }

    // Clean up
    if (connectionState.previewLine && connectionState.previewLine.parentNode) {
      connectionState.previewLine.parentNode.removeChild(connectionState.previewLine);
    }
    connectionState.previewLine = null;
    connectionState.draggingFromPort = null;
    connectionState.sourceCardId = null;
    connectionState.isDragging = false;
    document.body.style.cursor = '';

    // Reset input port styles
    document.querySelectorAll('.card-port.input').forEach(port => {
      port.style.background = '#1967d2';
      port.style.transform = 'translateY(-50%) scale(1)';
    });
  });
}

/**
 * Show card controls when card is focused/selected
 * 
 * Adds the 'focused' class to the specified card and ensures
 * both input and output ports are visible.
 * 
 * @param {string} cellId - Cell identifier of the card to focus
 * @returns {void}
 */
function showCardControls(cellId) {
  // Remove focused from all cards
  document.querySelectorAll('.card').forEach(card => {
    card.classList.remove('focused');
  });

  // Add focused to this card
  const card = document.getElementById(`card-${cellId}`);
  if (card) {
    card.classList.add('focused');

    // Ensure ports exist and are visible
    const inputPort = card.querySelector('.card-port.input');
    const outputPort = card.querySelector('.card-port.output');

    if (!inputPort) {
      const newInputPort = document.createElement('div');
      newInputPort.className = 'card-port input';
      newInputPort.title = 'Drop connection here';
      card.insertBefore(newInputPort, card.firstChild);
    }

    if (!outputPort) {
      const newOutputPort = document.createElement('div');
      newOutputPort.className = 'card-port output';
      newOutputPort.title = 'Drag to connect to another card';
      const inputPortAfter = card.querySelector('.card-port.input');
      if (inputPortAfter) {
        inputPortAfter.insertAdjacentElement('afterend', newOutputPort);
      } else {
        card.insertBefore(newOutputPort, card.firstChild);
      }
    }

    // Force ports to be visible
    if (inputPort) {
      inputPort.style.opacity = '1';
      inputPort.style.visibility = 'visible';
    }
    if (outputPort) {
      outputPort.style.opacity = '1';
      outputPort.style.visibility = 'visible';
    }
  }
}

/**
 * Create a new card
 */
function createNewCard() {
  // Ensure cards container is visible
  const cardsContainer = document.getElementById('cards-container');
  if (cardsContainer) {
    const loadingEl = document.getElementById('firebase-loading');
    if (loadingEl) {
      loadingEl.style.display = 'none';
    }
    if (cardsContainer.style.display === 'none' || !cardsContainer.style.display) {
      cardsContainer.style.display = 'block';
    }
  }

  // Generate a unique cell ID (A1, A2, B1, etc.)
  let cellId = 'A1';
  let row = 1;
  let col = 0;

  // Find the next available ID
  while (currentSheet.cells[cellId]) {
    col++;
    if (col > 25) {
      col = 0;
      row++;
    }
    cellId = String.fromCharCode(65 + col) + row;
  }

  // Create cell object - always use the main model selector's current value
  const mainModelSelect = document.getElementById('model-select');
  const activeModel = mainModelSelect && mainModelSelect.value ? mainModelSelect.value : getDefaultModel();

  currentSheet.cells[cellId] = {
    prompt: '',
    output: '',
    model: activeModel, // Use the actively selected model from the main selector
    temperature: 0.7,
    cellPrompt: '',
    autoRun: false,
    interval: 0,
    generations: []
  };

  // Save to database if sheet exists
  if (currentSheet.id) {
    saveCellToDatabase(cellId, '', '', activeModel, 0.7, '', false, 0);
  }

  // Create and render the card
  createCardForCell(cellId);

  // Focus on the new card's textarea
  setTimeout(() => {
    const textarea = document.getElementById(`prompt-${cellId}`);
    if (textarea) {
      textarea.focus();
    }
  }, 100);
}

/**
 * Create a card for a specific cell
 */
function createCardForCell(cellId) {
  const cell = currentSheet.cells[cellId];
  if (!cell) return;

  const cardsDiv = document.getElementById('cards');
  if (!cardsDiv) {
    // Ensure cards div exists
    const cardsContainer = document.getElementById('cards-container');
    if (cardsContainer) {
      const newCardsDiv = document.createElement('div');
      newCardsDiv.id = 'cards';
      newCardsDiv.style.cssText = 'position: relative; z-index: 2;';
      cardsContainer.appendChild(newCardsDiv);
    } else {
      return;
    }
  }

  const cardsDivFinal = document.getElementById('cards');
  if (!cardsDivFinal) return;

  // Check if card already exists
  if (document.getElementById(`card-${cellId}`)) {
    return;
  }

  // Ensure cardPositions exists, initialize from currentSheet if available
  if (typeof window.cardPositions === 'undefined') {
    if (currentSheet && currentSheet.cardPositions) {
      window.cardPositions = { ...currentSheet.cardPositions };
    } else {
      window.cardPositions = {};
    }
  }
  const cardPositions = window.cardPositions;

  // Initialize position if not set
  if (!cardPositions[cellId]) {
    const cardWidth = 280;
    const cardHeight = 200;
    const spacing = 40;
    let x = 40;
    let y = 40;

    // Find empty spot
    const existingPositions = Object.values(cardPositions);
    while (existingPositions.some(pos => Math.abs(pos.x - x) < cardWidth + spacing && Math.abs(pos.y - y) < cardHeight + spacing)) {
      x += cardWidth + spacing;
      if (x > 1000) {
        x = 40;
        y += cardHeight + spacing;
      }
    }

    cardPositions[cellId] = { x, y };
    // Save positions when new card is created
    saveCardPositions();
  }

  const pos = cardPositions[cellId];
  const defaultModel = getDefaultModel();
  const hasPrompt = cell.cellPrompt && cell.cellPrompt.trim() !== '';
  const hasSelectedGenerations = cell.selectedGenerations && cell.selectedGenerations.length > 0;

  const card = document.createElement('div');
  card.className = 'card';
  card.id = `card-${cellId}`;
  card.setAttribute('data-cell-id', cellId);
  card.style.left = `${pos.x}px`;
  card.style.top = `${pos.y}px`;

  // Check if card has a valid model selected
  const hasValidModel = checkCardHasModel(cellId);
  const modelIndicator = hasValidModel ? '' : '<span class="card-model-indicator" title="No AI model selected">⚠️</span>';

  card.innerHTML = `
    <div class="card-port input" title="Drop connection here"></div>
    <div class="card-port output" title="Drag to connect to another card"></div>
    <div class="card-header">
      <div class="card-header-left">
      <span class="card-id">${cellId}</span>
        ${modelIndicator}
      </div>
      <div class="card-header-actions">
        <button class="card-modal-btn" onclick="openModal('${cellId}')" title="Open in modal">📋</button>
        <button class="card-disconnect-btn" onclick="showDisconnectMenu(event, '${cellId}')" title="Disconnect cards">🔌</button>
        <button class="card-delete-btn" onclick="deleteCard('${cellId}')" title="Delete card">🗑️</button>
      </div>
    </div>
    <div class="card-content">
      <textarea id="prompt-${cellId}" oninput="updatePrompt('${cellId}')" onfocus="showCardControls('${cellId}')" placeholder="Enter prompt...">${(cell.prompt || '')}</textarea>
    </div>
    <div class="card-controls">
      <div class="cell-controls-header">
        <span>Settings</span>
        <span style="color: #5f6368; font-weight: 400;">${cellId}</span>
      </div>
      <div class="cell-controls-status" id="cell-status-${cellId}" style="display: none; padding: 6px 10px; border-bottom: 1px solid #e8eaed; background: #f8f9fa; font-size: 11px; color: #5f6368;"></div>
      <div class="cell-controls-body">
        <div class="cell-controls-main">
          <div class="cell-control-group">
            <label class="cell-control-label">AI Model</label>
            <div class="cell-model-select-wrapper">
              <button type="button" class="cell-model-button" id="model-btn-${cellId}" onclick="toggleModelDropdown('${cellId}')" title="Select AI Model">
                <span class="model-button-text" id="model-text-${cellId}">Loading...</span>
                <span class="model-button-arrow">▾</span>
              </button>
              <div class="cell-model-dropdown" id="model-dropdown-${cellId}" style="display: none;"></div>
            </div>
          </div>
          <div class="cell-control-group">
            <label class="cell-control-label">Temperature</label>
            <div class="cell-temp-control">
              <input type="range" class="cell-temp-slider" id="temp-slider-${cellId}" min="0" max="1" step="0.1" value="${(cell.temperature || 0.7)}" oninput="updateTempFromSlider('${cellId}', this.value)">
              <input type="number" class="cell-temp-input" id="temp-${cellId}" min="0" max="1" step="0.1" value="${(cell.temperature || 0.7)}" onchange="updateCellTemperature('${cellId}')" title="Temperature (0-1)">
            </div>
          </div>
          <div class="cell-control-group">
            <label class="cell-control-label">Run Interval (seconds)</label>
            <div style="display: flex; align-items: center; gap: 8px;">
              <input type="number" class="cell-interval-input" id="interval-${cellId}" min="0" step="1" value="${(cell.interval || 0)}" onchange="updateCellInterval('${cellId}')" placeholder="0 = disabled" style="width: 80px; padding: 4px 8px; border: 1px solid #dadce0; border-radius: 4px; font-size: 12px;">
              <span style="font-size: 11px; color: #5f6368;">0 = disabled</span>
            </div>
          </div>
        </div>
        <div class="cell-controls-actions">
          <label class="cell-auto-run-toggle" title="Auto-run when content changes or dependencies update">
            <input type="checkbox" class="cell-auto-run-checkbox" id="auto-run-${cellId}" ${cell.autoRun ? 'checked' : ''} onchange="updateCellAutoRun('${cellId}')">
            <span class="cell-auto-run-switch"></span>
            <span class="auto-run-label-text">Auto</span>
          </label>
          <button class="cell-run-btn" onclick="runCell('${cellId}')" title="Run this card">Run</button>
        </div>
      </div>
    </div>
  `;

  cardsDivFinal.appendChild(card);

  // Ensure ports exist (double-check)
  ensureAllCardPorts();

  // Populate model selector and ensure it uses the main selector's value
  if (typeof populateCellModelSelectors === 'function') {
    const models = availableModels || window.availableModels || [];
    if (models.length > 0) {
      // Ensure the cell uses the main model selector's value if it doesn't have a model set
      const mainModelSelect = document.getElementById('model-select');
      const mainModelValue = mainModelSelect ? mainModelSelect.value : null;
      if (mainModelValue && (!cell.model || cell.model === 'gpt-3.5-turbo')) {
        // Update cell model to match main selector
        cell.model = mainModelValue;
        // Save to database if sheet exists
        if (currentSheet.id) {
          saveCellToDatabase(cellId, cell.prompt, cell.output, cell.model, cell.temperature, cell.cellPrompt, cell.autoRun, cell.interval || 0);
        }
      }
      populateCellModelSelectors(models);

      // Explicitly update the button text for this new card
      const button = document.getElementById(`model-btn-${cellId}`);
      if (button && mainModelValue) {
        const textSpan = button.querySelector('.model-button-text');
        if (textSpan) {
          const model = models.find(m => m.id === (cell.model || mainModelValue));
          if (model) {
            textSpan.textContent = model.name;
          }
        }
      }

      // Update model indicator after models are populated
      updateCardModelIndicator(cellId);
    }
  }

  // Redraw connection lines
  if (typeof drawConnectionLines === 'function') {
    drawConnectionLines();
  }

  // Set up dragging if not already set up
  if (typeof setupCardDragging === 'function') {
    setupCardDragging();
  }

  // Set up connections if not already set up
  if (typeof setupCardConnections === 'function') {
    setupCardConnections();
  }

  // Initialize interval timer if needed
  updateCellIntervalTimer(cellId);

  // Update connections immediately after card creation
  // This ensures connections are visible right away
  setTimeout(() => {
    if (typeof drawConnectionLines === 'function') {
      drawConnectionLines();
    }
  }, 50);
}

/**
 * Ensure all cards have both input and output ports
 * This function should be called whenever cards are rendered or updated
 */
function ensureAllCardPorts() {
  document.querySelectorAll('.card').forEach(card => {
    const inputPort = card.querySelector('.card-port.input');
    const outputPort = card.querySelector('.card-port.output');

    if (!inputPort) {
      const newInputPort = document.createElement('div');
      newInputPort.className = 'card-port input';
      newInputPort.title = 'Drop connection here';
      card.insertBefore(newInputPort, card.firstChild);
    }

    if (!outputPort) {
      const newOutputPort = document.createElement('div');
      newOutputPort.className = 'card-port output';
      newOutputPort.title = 'Drag to connect to another card';
      const inputPortAfter = card.querySelector('.card-port.input');
      if (inputPortAfter) {
        inputPortAfter.insertAdjacentElement('afterend', newOutputPort);
      } else {
        card.insertBefore(newOutputPort, card.firstChild);
      }
    }
  });
}

/**
 * Show disconnect menu for a card
 */
function showDisconnectMenu(event, cellId) {
  event.stopPropagation();

  // Remove existing menu
  const existingMenu = document.querySelector('.disconnect-menu');
  if (existingMenu) {
    existingMenu.remove();
  }

  const cell = currentSheet.cells[cellId];
  if (!cell || !cell.prompt) return;

  // Parse dependencies
  const deps = parseDependencies(cell.prompt);
  if (deps.length === 0) {
    showSuccess('This card has no dependencies');
    return;
  }

  // Extract unique cell IDs from dependencies (handle formats like "A1", "prompt:A1", etc.)
  const uniqueCellIds = new Set();
  deps.forEach(depRef => {
    let cellId = depRef;
    // Skip cross-sheet references
    if (cellId.includes('!')) return;
    // Remove prefixes like "prompt:", "output:"
    if (cellId.includes(':')) {
      const parts = cellId.split(':');
      cellId = parts[parts.length - 1];
    }
    // Remove generation suffixes like "-1", ":1-3", ":2"
    if (cellId.includes('-')) {
      cellId = cellId.split('-')[0];
    }
    // Remove any remaining colons
    cellId = cellId.split(':')[0];
    if (cellId) {
      uniqueCellIds.add(cellId);
    }
  });

  if (uniqueCellIds.size === 0) {
    showSuccess('This card has no dependencies');
    return;
  }

  // Create menu
  const menu = document.createElement('div');
  menu.className = 'disconnect-menu';
  menu.style.position = 'absolute';
  menu.style.left = event.clientX + 'px';
  menu.style.top = event.clientY + 'px';

  menu.innerHTML = `
    <div style="padding: 8px 12px; font-size: 11px; font-weight: 600; color: #5f6368; border-bottom: 1px solid #e8eaed;">Disconnect from:</div>
    ${Array.from(uniqueCellIds).map(depCellId => `
      <div class="disconnect-menu-item" onclick="removeCardDependency('${cellId}', '${depCellId}'); this.closest('.disconnect-menu').remove();">
        <span>${depCellId}</span>
        <span class="disconnect-icon">✕</span>
      </div>
    `).join('')}
  `;

  document.body.appendChild(menu);

  // Close menu when clicking outside
  setTimeout(() => {
    document.addEventListener('click', function closeMenu(e) {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    });
  }, 0);
}

/**
 * Remove a dependency between two cards
 */
/**
 * Create a dependency between two cards
 * @param {string} sourceCellId The source card ID (output port)
 * @param {string} targetCellId The target card ID (input port)
 */
/**
 * Create a dependency connection between two cards
 * 
 * Adds a dependency reference ({{sourceCellId}}) to the target card's prompt
 * and creates the target card if it doesn't exist. Also saves to database
 * and redraws connection lines.
 * 
 * @param {string} sourceCellId - Source card ID (where connection starts)
 * @param {string} targetCellId - Target card ID (where connection ends)
 * @returns {void}
 */
function createCardDependency(sourceCellId, targetCellId) {
  // Don't allow self-connections
  if (sourceCellId === targetCellId) {
    showError('Cannot connect a card to itself');
    return;
  }

  // Ensure source cell exists
  if (!currentSheet.cells[sourceCellId]) {
    const defaultModel = getDefaultModel();
    currentSheet.cells[sourceCellId] = {
      prompt: '',
      output: '',
      model: defaultModel,
      temperature: 0.7,
      cellPrompt: '',
      autoRun: false,
      interval: 0,
      generations: []
    };
  }

  const targetCell = currentSheet.cells[targetCellId];
  if (!targetCell) {
    // Create the cell if it doesn't exist
    const defaultModel = getDefaultModel();
    currentSheet.cells[targetCellId] = {
      prompt: '',
      output: '',
      model: defaultModel,
      temperature: 0.7,
      cellPrompt: '',
      autoRun: false,
      interval: 0,
      generations: []
    };

    // Create the card in the DOM if it doesn't exist
    if (!document.getElementById(`card-${targetCellId}`)) {
      createCardForCell(targetCellId);
    }
  }

  // Check if dependency already exists (need to get targetCell again after potential creation)
  const finalTargetCell = currentSheet.cells[targetCellId];
  if (!finalTargetCell) {
    showError(`Failed to create target card ${targetCellId}`);
    return;
  }

  const dependencyPattern = new RegExp(`\\{\\{${sourceCellId}\\}\\}`, 'g');
  if (finalTargetCell.prompt && dependencyPattern.test(finalTargetCell.prompt)) {
    showError(`Card ${targetCellId} already depends on ${sourceCellId}`);
    return;
  }

  // Add dependency to prompt (use finalTargetCell)
  const dependency = `{{${sourceCellId}}}`;
  if (finalTargetCell.prompt) {
    finalTargetCell.prompt = finalTargetCell.prompt.trim() + ' ' + dependency;
  } else {
    finalTargetCell.prompt = dependency;
  }

  // Update the textarea if it exists
  const textarea = document.getElementById(`prompt-${targetCellId}`);
  if (textarea) {
    textarea.value = finalTargetCell.prompt;
  }

  // Save to database
  if (currentSheet.id) {
    saveCellToDatabase(targetCellId, finalTargetCell.prompt, finalTargetCell.output, finalTargetCell.model, finalTargetCell.temperature, finalTargetCell.cellPrompt, finalTargetCell.autoRun, finalTargetCell.interval);
  }

  // Redraw connection lines
  if (typeof drawConnectionLines === 'function') {
    drawConnectionLines();
  }

  // Ensure all cards have ports
  ensureAllCardPorts();

  // Show success message
  showSuccess(`Connected ${sourceCellId} to ${targetCellId}`);
}

/**
 * Delete a card and all its data
 * 
 * Removes the card from the DOM, deletes it from the database,
 * removes all connections to it, and cleans up related state.
 * 
 * @param {string} cellId - The cell ID to delete
 * @returns {Promise<void>}
 */
async function deleteCard(cellId) {
  // Find all cards that depend on this card (including cross-sheet dependencies)
  const dependentCards = [];

  // Check current sheet
  for (const [otherCellId, otherCell] of Object.entries(currentSheet.cells)) {
    if (otherCellId === cellId) continue;
    if (otherCell && otherCell.prompt) {
      const deps = parseDependencies(otherCell.prompt);
      // Check if any dependency references this cell
      const hasDependency = deps.some(depRef => {
        let depId = depRef;
        // Extract cell ID from reference
        // Skip cross-sheet references for same-sheet check
        if (depId.includes('!')) {
          // Check if it's a cross-sheet reference to this cell
          const sheetName = currentSheet.name;
          if (depId.includes(`${sheetName}!${cellId}`)) {
            return true;
          }
          return false;
        }
        if (depId.includes(':')) {
          const parts = depId.split(':');
          depId = parts[parts.length - 1];
        }
        if (depId.includes('-')) {
          depId = depId.split('-')[0];
        }
        depId = depId.split(':')[0];
        return depId === cellId;
      });

      if (hasDependency) {
        dependentCards.push(otherCellId);
      }
    }
  }

  // Check other sheets for cross-sheet dependencies
  // Use parseDependencies to catch all reference formats
  for (const sheet of sheets) {
    if (sheet.id === currentSheet.id) continue; // Skip current sheet (already checked)

    // Ensure cells are loaded for this sheet
    if (!sheet.cells || Object.keys(sheet.cells).length === 0) {
      // Try to load cells if sheet has an ID
      if (sheet.id) {
        await loadSheetCellsForSheet(sheet);
      }
    }

    for (const [id, cell] of Object.entries(sheet.cells || {})) {
      if (cell && cell.prompt) {
        // Parse all dependencies from the cell's prompt
        const deps = parseDependencies(cell.prompt);

        // Check if any dependency references this cell from the current sheet
        const sheetName = currentSheet.name;
        const hasCrossSheetDependency = deps.some(depRef => {
          // Check for cross-sheet reference format: SheetName!CellId
          if (depRef.includes('!')) {
            // Extract sheet name and cell ID from reference
            let refSheetName = '';
            let refCellId = depRef;

            // Handle type prefixes like "prompt:" or "output:"
            if (depRef.includes(':') && (depRef.startsWith('prompt:') || depRef.startsWith('output:'))) {
              const colonIndex = depRef.indexOf(':');
              refCellId = depRef.substring(colonIndex + 1);
            }

            // Extract sheet name and cell ID from "SheetName!CellId" format
            if (refCellId.includes('!')) {
              const exclamationIndex = refCellId.indexOf('!');
              refSheetName = refCellId.substring(0, exclamationIndex);
              refCellId = refCellId.substring(exclamationIndex + 1);
            }

            // Remove generation suffixes like "-1", ":1-3", ":2"
            if (refCellId.includes('-')) {
              refCellId = refCellId.split('-')[0];
            }
            if (refCellId.includes(':')) {
              refCellId = refCellId.split(':')[0];
            }

            // Check if this reference points to the cell we're trying to delete
            return refSheetName === sheetName && refCellId === cellId;
          }
          return false;
        });

        if (hasCrossSheetDependency) {
          dependentCards.push(`${sheet.name}!${id}`);
        }
      }
    }
  }

  // If there are dependent cards, prevent deletion and show error
  if (dependentCards.length > 0) {
    const dependentList = dependentCards.join(', ');
    showError(`Cannot delete card ${cellId}. It has ${dependentCards.length} dependent card(s): ${dependentList}. Please detach or delete the dependent cards first.`);
    return;
  }

  // Confirm deletion (only if no dependents)
  if (!confirm(`Are you sure you want to delete card ${cellId}?`)) {
    return;
  }

  // Clear interval timer if exists
  if (cellIntervalTimers[cellId]) {
    clearInterval(cellIntervalTimers[cellId]);
    delete cellIntervalTimers[cellId];
  }

  // Remove from currentSheet.cells
  delete currentSheet.cells[cellId];

  // Remove card position
  if (window.cardPositions && window.cardPositions[cellId]) {
    delete window.cardPositions[cellId];
  }

  // Close modal if it's open for this card
  if (currentModalCellId === cellId) {
    closeModal();
  }

  // Remove from DOM
  const cardElement = document.getElementById(`card-${cellId}`);
  if (cardElement) {
    cardElement.remove();
  }

  // Delete from database
  if (currentSheet.id && typeof firestoreService !== 'undefined' && firestoreService.deleteCell) {
    try {
      const userId = currentUser ? currentUser.uid : 'demo-user-123';
      const projectId = currentProjectId || 'default-project';
      await firestoreService.deleteCell(userId, projectId, currentSheet.id, cellId);
    } catch (error) {
      // Silently handle error - card is already removed from UI
    }
  }

  // Redraw connection lines
  if (typeof drawConnectionLines === 'function') {
    drawConnectionLines();
  }

  // Ensure all remaining cards have ports
  ensureAllCardPorts();

  // Re-render grid to update empty state if needed
  const allCellIds = Object.keys(currentSheet.cells);
  if (allCellIds.length === 0) {
    renderGrid();
  }

  // Show success message
  showSuccess(`Card ${cellId} deleted`);
}

/**
 * Remove a dependency connection between two cards
 * 
 * Removes the dependency reference from the target card's prompt,
 * handles various reference formats, and updates the UI.
 * 
 * @param {string} targetCellId - Target card ID (where dependency is removed from)
 * @param {string} sourceCellIdOrRef - Source cell ID or reference string to remove
 * @returns {void}
 */
function removeCardDependency(targetCellId, sourceCellIdOrRef) {
  const targetCell = currentSheet.cells[targetCellId];
  if (!targetCell) return;

  // Extract cell ID from reference if needed (handle formats like "A1", "prompt:A1", etc.)
  let sourceCellId = sourceCellIdOrRef;
  if (sourceCellIdOrRef.includes(':')) {
    const parts = sourceCellIdOrRef.split(':');
    sourceCellId = parts[parts.length - 1];
  }
  if (sourceCellId.includes('-')) {
    sourceCellId = sourceCellId.split('-')[0];
  }
  sourceCellId = sourceCellId.split(':')[0];

  // Remove dependency from prompt (match the exact format in the prompt)
  // Try both {{sourceCellId}} and {{prompt:sourceCellId}}, {{output:sourceCellId}}, etc.
  const patterns = [
    new RegExp(`\\{\\{${sourceCellId}\\}\\}`, 'g'),
    new RegExp(`\\{\\{prompt:${sourceCellId}\\}\\}`, 'g'),
    new RegExp(`\\{\\{output:${sourceCellId}\\}\\}`, 'g'),
    new RegExp(`\\{\\{${sourceCellIdOrRef}\\}\\}`, 'g')
  ];

  if (targetCell.prompt) {
    let updatedPrompt = targetCell.prompt;
    patterns.forEach(pattern => {
      updatedPrompt = updatedPrompt.replace(pattern, '');
    });
    targetCell.prompt = updatedPrompt.trim().replace(/\s+/g, ' '); // Clean up extra spaces
  }

  // Update the textarea if it exists
  const textarea = document.getElementById(`prompt-${targetCellId}`);
  if (textarea) {
    textarea.value = targetCell.prompt;
  }

  // Save to database
  if (currentSheet.id) {
    saveCellToDatabase(targetCellId, targetCell.prompt, targetCell.output, targetCell.model, targetCell.temperature, targetCell.cellPrompt, targetCell.autoRun, targetCell.interval);
  }

  // Redraw connection lines
  if (typeof drawConnectionLines === 'function') {
    drawConnectionLines();
  }

  // Ensure all cards have ports
  ensureAllCardPorts();

  // Show success message
  showSuccess(`Disconnected ${sourceCellId} from ${targetCellId}`);
}

// ============================================================================
// SECTION 11: GLOBAL EXPORTS
// ============================================================================

/**
 * Expose functions to global scope for inline event handlers
 * These functions are called from HTML onclick attributes
 */
window.saveTitleToFirestore = saveTitleToFirestore;
window.createNewCard = createNewCard;
window.createCardForCell = createCardForCell;
window.showCardControls = showCardControls;
window.showDisconnectMenu = showDisconnectMenu;
window.removeCardDependency = removeCardDependency;
window.createCardDependency = createCardDependency;
window.deleteCard = deleteCard;
window.drawConnectionLines = drawConnectionLines;
window.setupCardDragging = setupCardDragging;
window.setupCardEventDelegation = setupCardEventDelegation;
window.setupCardConnections = setupCardConnections;
window.updateCellInterval = updateCellInterval;
window.runCellWithDependencies = runCellWithDependencies;
window.toggleModelDropdown = toggleModelDropdown;
window.selectCellModel = selectCellModel;
window.handleProfileClick = handleProfileClick;
window.handleSettingsClick = handleSettingsClick;
window.handleUsageClick = handleUsageClick;
window.handleAdminClick = handleAdminClick;
window.handleLogoutClick = handleLogoutClick;

// Model loading is now handled in initializeApp() function