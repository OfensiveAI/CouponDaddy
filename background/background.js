// List of supported shopping websites
const SHOPPING_SITES = [
    '*://www.amazon.com/*',
    '*://www.walmart.com/*',
    '*://www.target.com/*',
    '*://www.bestbuy.com/*',
    '*://www.ebay.com/*',
    '*://www.etsy.com/*',
    '*://www.newegg.com/*',
    '*://www.homedepot.com/*',
    '*://www.lowes.com/*',
    '*://www.macys.com/*'
  ];
  
  // Checkout page patterns
  const CHECKOUT_PATTERNS = {
    'amazon.com': ['/checkout', '/buy'],
    'walmart.com': ['/checkout', '/cart'],
    'target.com': ['/checkout', '/cart'],
    'bestbuy.com': ['/checkout', '/cart.php'],
    'ebay.com': ['/checkout', '/cart'],
    'etsy.com': ['/checkout', '/cart'],
    'newegg.com': ['/checkout', '/cart'],
    'homedepot.com': ['/checkout', '/cart'],
    'lowes.com': ['/checkout', '/cart'],
    'macys.com': ['/checkout', '/bag']
  };
  
  // Extension state
  let extensionState = {
    active: true,
    autoApply: true,
    notifications: true,
    darkMode: false,
    lastUpdated: Date.now()
  };
  
  // Track active shopping tabs
  const activeShoppingTabs = new Set();
  
  // Helper: Check if URL is a shopping site
  function isShoppingSite(url) {
    try {
      const urlObj = new URL(url);
      return SHOPPING_SITES.some(pattern => {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(url);
      });
    } catch (e) {
      console.error('Invalid URL:', url);
      return false;
    }
  }
  
  // Helper: Check if URL is a checkout page
  function isCheckoutPage(url) {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.replace('www.', '');
      const pathname = urlObj.pathname;
      
      for (const [domain, patterns] of Object.entries(CHECKOUT_PATTERNS)) {
        if (hostname.includes(domain)) {
          return patterns.some(pattern => pathname.includes(pattern));
        }
      }
      return false;
    } catch (e) {
      console.error('Invalid URL:', url);
      return false;
    }
  }
  
  // Helper: Extract store name from URL
  function extractStoreName(url) {
    try {
      const hostname = new URL(url).hostname;
      return hostname.replace('www.', '').split('.')[0];
    } catch (e) {
      console.error('Error extracting store name:', e);
      return null;
    }
  }
  
  // Load extension state from storage
  async function loadExtensionState() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['extensionState'], (result) => {
        if (result.extensionState) {
          extensionState = { ...extensionState, ...result.extensionState };
        }
        resolve(extensionState);
      });
    });
  }
  
  // Save extension state to storage
  async function saveExtensionState() {
    return new Promise((resolve) => {
      chrome.storage.sync.set({ extensionState }, resolve);
    });
  }
  
  // Initialize Firebase (placeholder - will be implemented with actual Firebase integration)
  async function initFirebase() {
    console.log('Firebase initialized');
    // This will be replaced with actual Firebase initialization code
  }
  
  // Initialize Claude AI integration (placeholder)
  async function initClaudeAI() {
    console.log('Claude AI initialized');
    // This will be replaced with actual Claude AI integration code
  }
  
  // Update badge based on active shopping tabs
  function updateBadge() {
    const count = activeShoppingTabs.size;
    chrome.action.setBadgeText({ text: count > 0 ? count.toString() : '' });
    chrome.action.setBadgeBackgroundColor({ color: '#4b7bec' });
  }
  
  // Check a tab for shopping/checkout status and update active tabs
  async function checkTab(tabId, url) {
    if (!url) return;
    
    const shopping = isShoppingSite(url);
    const checkout = isCheckoutPage(url);