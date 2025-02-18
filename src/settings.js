 /**
 * Settings Page JavaScript
 * Handles user preferences, toggles, and saving settings
 */

// DOM Elements
const autoApplyToggle = document.getElementById('autoApply');
const notificationsToggle = document.getElementById('notifications');
const darkModeToggle = document.getElementById('darkMode');
const usageStatsToggle = document.getElementById('usageStats');
const preloadCouponsToggle = document.getElementById('preloadCoupons');
const useClaudeAIToggle = document.getElementById('useClaudeAI');
const saveButton = document.getElementById('saveBtn');
const resetButton = document.getElementById('resetBtn');
const clearDataButton = document.getElementById('clearDataBtn');
const saveNotification = document.getElementById('saveNotification');

// Default settings
const DEFAULT_SETTINGS = {
  active: true,
  autoApply: true,
  notifications: true,
  darkMode: false,
  usageStats: true,
  preloadCoupons: true,
  useClaudeAI: true,
  lastUpdated: Date.now()
};

// Current extension state
let extensionState = { ...DEFAULT_SETTINGS };

/**
 * Initializes the settings page
 */
function initSettings() {
  // Load settings from storage
  loadSettings();
  
  // Set up event listeners
  setupEventListeners();
  
  // Check if URL contains any parameters
  handleUrlParameters();
}

/**
 * Loads settings from Chrome storage
 */
async function loadSettings() {
  chrome.storage.sync.get(['extensionState'], (result) => {
    if (result.extensionState) {
      // Merge with defaults in case new settings were added
      extensionState = { ...DEFAULT_SETTINGS, ...result.extensionState };
      updateToggleStates();
      applyDarkMode();
    } else {
      // No saved settings, use defaults
      saveSettings();
      updateToggleStates();
    }
  });
}

/**
 * Updates all toggle states based on loaded settings
 */
function updateToggleStates() {
  autoApplyToggle.checked = extensionState.autoApply;
  notificationsToggle.checked = extensionState.notifications;
  darkModeToggle.checked = extensionState.darkMode;
  usageStatsToggle.checked = extensionState.usageStats;
  preloadCouponsToggle.checked = extensionState.preloadCoupons;
  useClaudeAIToggle.checked = extensionState.useClaudeAI;
}

/**
 * Applies dark mode if enabled
 */
function applyDarkMode() {
  if (extensionState.darkMode) {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }
}

/**
 * Sets up event listeners for all interactive elements
 */
function setupEventListeners() {
  // Toggle state changes
  autoApplyToggle.addEventListener('change', handleToggleChange);
  notificationsToggle.addEventListener('change', handleToggleChange);
  darkModeToggle.addEventListener('change', handleDarkModeToggle);
  usageStatsToggle.addEventListener('change', handleToggleChange);
  preloadCouponsToggle.addEventListener('change', handleToggleChange);
  useClaudeAIToggle.addEventListener('change', handleToggleChange);
  
  // Button clicks
  saveButton.addEventListener('click', saveSettings);
  resetButton.addEventListener('click', resetSettings);
  clearDataButton.addEventListener('click', confirmClearData);
}

/**
 * Handles URL parameters if any are present
 */
function handleUrlParameters() {
  const urlParams = new URLSearchParams(window.location.search);
  
  // Check if opened from specific context
  const context = urlParams.get('context');
  if (context === 'onboarding') {
    // Show onboarding welcome messaging or highlight key settings
    showOnboardingHighlights();
  } else if (context === 'troubleshoot') {
    // Highlight troubleshooting options
    showTroubleshootingOptions();
  }
}

/**
 * Handles changes to toggle switches
 * @param {Event} event - The change event
 */
function handleToggleChange(event) {
  const settingName = event.target.id;
  extensionState[settingName] = event.target.checked;
  
  // Enable save button animation to indicate unsaved changes
  saveButton.classList.add('pulse');
}

/**
 * Special handler for dark mode toggle to apply changes immediately
 * @param {Event} event - The change event
 */
function handleDarkModeToggle(event) {
  extensionState.darkMode = event.target.checked;
  applyDarkMode();
  
  // Also update dark mode across the extension immediately
  updateDarkModeGlobally(event.target.checked);
  
  // Enable save button animation
  saveButton.classList.add('pulse');
}

/**
 * Updates dark mode setting across the extension without waiting for save
 * @param {boolean} isDarkMode - Whether dark mode is enabled
 */
function updateDarkModeGlobally(isDarkMode) {
  chrome.runtime.sendMessage({
    action: 'updateDarkMode',
    darkMode: isDarkMode
  });
}

/**
 * Saves settings to Chrome storage
 */
function saveSettings() {
  // Update last modified timestamp
  extensionState.lastUpdated = Date.now();
  
  // Save to Chrome storage
  chrome.storage.sync.set({ extensionState }, () => {
    // Notify background script of settings change
    chrome.runtime.sendMessage({
      action: 'settingsUpdated',
      settings: extensionState
    });
    
    // Show save confirmation
    showSaveConfirmation();
    
    // Remove pulse animation from save button
    saveButton.classList.remove('pulse');
  });
}

/**
 * Resets all settings to default values
 */
function resetSettings() {
  // Confirm reset
  if (confirm('Reset all settings to default values?')) {
    extensionState = { ...DEFAULT_SETTINGS, lastUpdated: Date.now() };
    updateToggleStates();
    applyDarkMode();
    saveSettings();
  }
}

/**
 * Shows confirmation before clearing saved data
 */
function confirmClearData() {
  if (confirm('This will clear all saved coupons and history. Continue?')) {
    clearSavedData();
  }
}

/**
 * Clears all saved coupon data and browsing history
 */
function clearSavedData() {
  chrome.runtime.sendMessage({ action: 'clearAllData' }, (response) => {
    if (response && response.success) {
      showNotification('All saved data has been cleared.');
    } else {
      showNotification('Failed to clear data. Please try again.', 'error');
    }
  });
}

/**
 * Shows a temporary notification when settings are saved
 */
function showSaveConfirmation() {
  saveNotification.classList.add('show');
  
  // Hide after 3 seconds
  setTimeout(() => {
    saveNotification.classList.remove('show');
  }, 3000);
}

/**
 * Shows a notification to the user
 * @param {string} message - The notification message
 * @param {string} type - The notification type (success/error)
 */
function showNotification(message, type = 'success') {
  const notificationElement = document.createElement('div');
  notificationElement.className = `notification ${type}`;
  notificationElement.innerHTML = `
    <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
    <span>${message}</span>
  `;
  
  document.body.appendChild(notificationElement);
  
  // Animate in
  setTimeout(() => {
    notificationElement.classList.add('show');
  }, 10);
  
  // Remove after delay
  setTimeout(() => {
    notificationElement.classList.remove('show');
    setTimeout(() => {
      notificationElement.remove();
    }, 300);
  }, 3000);
}

/**
 * Highlights key settings for new users during onboarding
 */
function showOnboardingHighlights() {
  // Add onboarding class to body
  document.body.classList.add('onboarding-mode');
  
  // Could highlight key toggle options with pulsing effect
  const keySettings = [autoApplyToggle, useClaudeAIToggle];
  keySettings.forEach(toggle => {
    toggle.parentElement.parentElement.classList.add('highlight-setting');
  });
  
  // Add welcome message
  const welcomeMessage = document.createElement('div');
  welcomeMessage.className = 'welcome-message';
  welcomeMessage.innerHTML = `
    <h3>Welcome to CouponDaddy!</h3>
    <p>Customize your settings below to get the most out of automatic coupon finding.</p>
    <button id="dismissWelcome" class="secondary-button">Got it</button>
  `;
  
  document.querySelector('.settings-main').prepend(welcomeMessage);
  
  // Add dismiss listener
  document.getElementById('dismissWelcome').addEventListener('click', () => {
    welcomeMessage.classList.add('dismiss');
    setTimeout(() => {
      welcomeMessage.remove();
      document.body.classList.remove('onboarding-mode');
    }, 300);
  });
}

/**
 * Highlights troubleshooting options
 */
function showTroubleshootingOptions() {
  // Add troubleshooting class to highlight relevant sections
  document.body.classList.add('troubleshoot-mode');
  
  // Highlight clear data button
  clearDataButton.classList.add('highlight-button');
  
  // Add troubleshooting message
  const troubleshootMessage = document.createElement('div');
  troubleshootMessage.className = 'troubleshoot-message';
  troubleshootMessage.innerHTML = `
    <h3>Troubleshooting CouponDaddy</h3>
    <p>If you're experiencing issues, try toggling these settings or clearing saved data.</p>
    <button id="dismissTroubleshoot" class="secondary-button">Dismiss</button>
  `;
  
  document.querySelector('.settings-main').prepend(troubleshootMessage);
  
  // Add dismiss listener
  document.getElementById('dismissTroubleshoot').addEventListener('click', () => {
    troubleshootMessage.classList.add('dismiss');
    setTimeout(() => {
      troubleshootMessage.remove();
      document.body.classList.remove('troubleshoot-mode');
    }, 300);
  });
}

// Initialize settings when DOM is fully loaded
document.addEventListener('DOMContentLoaded', initSettings);
