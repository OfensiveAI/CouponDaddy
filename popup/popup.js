// DOM Elements
const loadingState = document.getElementById('loading');
const noCouponsState = document.getElementById('no-coupons');
const couponsFoundState = document.getElementById('coupons-found');
const couponCountElement = document.getElementById('coupon-count');
const storeNameElement = document.getElementById('store-name');
const couponListElement = document.getElementById('coupon-list');
const bestCouponCodeElement = document.getElementById('best-coupon-code');
const bestCouponDiscountElement = document.getElementById('best-coupon-discount');
const bestCouponDescriptionElement = document.getElementById('best-coupon-description');
const applyButton = document.getElementById('apply-coupon');
const settingsButton = document.getElementById('settingsBtn');
const statusIndicator = document.getElementById('status-indicator');

// Get the current active tab
async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// Extract domain from URL
function extractDomain(url) {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace('www.', '').split('.')[0];
  } catch (e) {
    console.error('Error extracting domain:', e);
    return null;
  }
}

// Format discount value
function formatDiscount(discount) {
  if (typeof discount === 'number') {
    return discount < 1 ? `${(discount * 100).toFixed(0)}%` : `$${discount.toFixed(2)}`;
  }
  return discount;
}

// Render coupon item
function createCouponItem(coupon) {
  const couponItem = document.createElement('div');
  couponItem.className = 'coupon-item';
  couponItem.dataset.code = coupon.code;
  
  const formattedDiscount = formatDiscount(coupon.discount);
  
  couponItem.innerHTML = `
    <div class="coupon-code">${coupon.code}</div>
    <div class="coupon-info">
      <div class="coupon-discount">-${formattedDiscount}</div>
      <div class="coupon-description">${coupon.description}</div>
    </div>
  `;
  
  couponItem.addEventListener('click', () => {
    selectCoupon(coupon);
  });
  
  return couponItem;
}

// Select a coupon
function selectCoupon(coupon) {
  bestCouponCodeElement.textContent = coupon.code;
  bestCouponDiscountElement.textContent = `-${formatDiscount(coupon.discount)}`;
  bestCouponDescriptionElement.textContent = coupon.description;
  
  // Highlight the selected coupon in the list
  const couponItems = couponListElement.querySelectorAll('.coupon-item');
  couponItems.forEach(item => {
    if (item.dataset.code === coupon.code) {
      item.classList.add('selected');
    } else {
      item.classList.remove('selected');
    }
  });
}

// Apply the selected coupon
async function applyCoupon() {
  const tab = await getCurrentTab();
  const couponCode = bestCouponCodeElement.textContent;
  
  // Animate the apply button
  applyButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Applying...';
  applyButton.disabled = true;
  
  // Send message to content script to apply the coupon
  chrome.tabs.sendMessage(tab.id, { 
    action: 'applyCoupon', 
    couponCode 
  }, (response) => {
    if (response && response.success) {
      applyButton.innerHTML = '<i class="fas fa-check"></i> Applied!';
      applyButton.classList.add('success');
      
      // Reset the button after 3 seconds
      setTimeout(() => {
        applyButton.innerHTML = '<i class="fas fa-magic"></i> Apply Automatically';
        applyButton.classList.remove('success');
        applyButton.disabled = false;
      }, 3000);
    } else {
      applyButton.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Try Again';
      applyButton.classList.add('error');
      
      // Reset the button after 3 seconds
      setTimeout(() => {
        applyButton.innerHTML = '<i class="fas fa-magic"></i> Apply Automatically';
        applyButton.classList.remove('error');
        applyButton.disabled = false;
      }, 3000);
    }
  });
}

// Fetch coupons from Firebase
async function fetchCoupons(store) {
  // This is a placeholder for the actual Firebase implementation
  // Will be replaced with real Firebase integration
  return new Promise((resolve) => {
    // Simulate API delay
    setTimeout(() => {
      if (store === 'amazon') {
        resolve({
          success: true,
          coupons: [
            { code: 'SAVE20NOW', discount: 20, description: '20% off your entire purchase' },
            { code: 'FREESHIP50', discount: 5.99, description: 'Free shipping on orders over $50' },
            { code: 'SUMMER10', discount: 0.1, description: '10% off summer collection' },
            { code: 'WELCOME15', discount: 0.15, description: '15% off for new customers' }
          ],
          bestCoupon: { code: 'SAVE20NOW', discount: 20, description: '20% off your entire purchase' }
        });
      } else if (store === 'walmart') {
        resolve({
          success: true,
          coupons: [
            { code: 'WMSAVE15', discount: 0.15, description: '15% off electronics' },
            { code: 'GROCERY10', discount: 0.1, description: '10% off grocery items' }
          ],
          bestCoupon: { code: 'WMSAVE15', discount: 0.15, description: '15% off electronics' }
        });
      } else {
        resolve({
          success: false,
          message: 'No coupons available for this store'
        });
      }
    }, 1500);
  });
}

// Initialize the popup
async function initPopup() {
  const tab = await getCurrentTab();
  const store = extractDomain(tab.url);
  
  if (!store) {
    showState(noCouponsState);
    return;
  }
  
  storeNameElement.textContent = store.charAt(0).toUpperCase() + store.slice(1);
  
  // Check if we're on a supported shopping site
  chrome.runtime.sendMessage({ action: 'isShoppingSite', url: tab.url }, async (response) => {
    if (response && response.isShoppingSite) {
      // We're on a shopping site, fetch coupons
      const couponsData = await fetchCoupons(store);
      
      if (couponsData.success && couponsData.coupons.length > 0) {
        // Render coupons
        couponCountElement.textContent = couponsData.coupons.length;
        
        // Populate coupon list
        couponListElement.innerHTML = '';
        couponsData.coupons.forEach(coupon => {
          const couponItem = createCouponItem(coupon);
          couponListElement.appendChild(couponItem);
        });
        
        // Set best coupon
        if (couponsData.bestCoupon) {
          selectCoupon(couponsData.bestCoupon);
        } else {
          selectCoupon(couponsData.coupons[0]);
        }
        
        showState(couponsFoundState);
      } else {
        showState(noCouponsState);
      }
    } else {
      // Not a shopping site
      showState(noCouponsState);
    }
  });
}

// Show the specified state and hide others
function showState(stateElement) {
  loadingState.classList.add('hidden');
  noCouponsState.classList.add('hidden');
  couponsFoundState.classList.add('hidden');
  
  stateElement.classList.remove('hidden');
}

// Check if dark mode is enabled
function checkDarkMode() {
  chrome.storage.sync.get(['darkMode'], (result) => {
    if (result.darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  });
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Initialize popup
  initPopup();
  
  // Check dark mode
  checkDarkMode();
  
  // Apply button
  applyButton.addEventListener('click', applyCoupon);
  
  // Settings button
  settingsButton.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
});

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateStatus') {
    const statusDot = statusIndicator.querySelector('.status-dot');
    const statusText = statusIndicator.querySelector('.status-text');
    
    if (message.active) {
      statusDot.classList.add('active');
      statusText.textContent = 'Active';
    } else {
      statusDot.classList.remove('active');
      statusText.textContent = 'Inactive';
    }
  }
  
  sendResponse({ received: true });
  return true;
});