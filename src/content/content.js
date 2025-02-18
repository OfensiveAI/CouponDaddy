/**
 * Content Script (content.js)
 * 
 * This script is injected into supported shopping websites to:
 * 1. Detect when the user is on a checkout page
 * 2. Find coupon/promo code input fields
 * 3. Apply the best coupon code automatically (when enabled)
 * 4. Communicate with the background script
 */

// Constants for coupon field detection
const COUPON_FIELD_SELECTORS = [
    // Common selectors for coupon/promo code input fields
    'input[name*="coupon" i]',
    'input[name*="promo" i]',
    'input[name*="discount" i]',
    'input[name*="gift" i][name*="card" i]',
    'input[id*="coupon" i]',
    'input[id*="promo" i]',
    'input[id*="discount" i]',
    'input[id*="gift" i][id*="card" i]',
    'input[placeholder*="coupon" i]',
    'input[placeholder*="promo" i]',
    'input[placeholder*="discount" i]',
    'input[aria-label*="coupon" i]',
    'input[aria-label*="promo" i]',
    'input[aria-label*="discount" i]',
    'input[class*="coupon" i]',
    'input[class*="promo" i]',
    'input[class*="discount" i]'
  ];
  
  // Constants for coupon apply button detection
  const APPLY_BUTTON_SELECTORS = [
    // Common selectors for apply/submit buttons near coupon fields
    'button[type="submit"]',
    'input[type="submit"]',
    'button:not([type])',
    'button[name*="apply" i]',
    'button[id*="apply" i]',
    'button[aria-label*="apply" i]',
    'button[class*="apply" i]',
    'button[name*="coupon" i]',
    'button[id*="coupon" i]',
    'a[role="button"]',
    'a[class*="button" i]',
    'span[role="button"]',
    '[class*="btn" i]',
    '[class*="button" i]'
  ];
  
  // Store specific selectors (for major e-commerce sites)
  const STORE_SPECIFIC_SELECTORS = {
    'amazon.com': {
      couponField: '#spc-gcpromoinput, #gift-card-input, #gc-redemption-input',
      applyButton: '#spc-gcpromoapply, .a-button-input[name="gcApplyButtonSingle"]'
    },
    'walmart.com': {
      couponField: '#promotion-code-input, #gift-card-number',
      applyButton: '.button--apply'
    },
    'target.com': {
      couponField: '#promoCodeInput, #giftCardInput',
      applyButton: '.PromoCodeForm button, .GiftCardForm button'
    },
    'bestbuy.com': {
      couponField: '#gift-card-number, #promo-code-input',
      applyButton: '.btn-promo-code-apply, .btn-apply-gift-card'
    },
    'ebay.com': {
      couponField: '#redemptionCode',
      applyButton: '.redemption-code-button'
    },
    'etsy.com': {
      couponField: '#coupon_code, #promo_code_input',
      applyButton: 'button[type="submit"].coupon-box__submit'
    }
  };
  
  // Add debounce utility for performance
  const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };
  
  // Optimize checkout detection with more specific patterns
  const CHECKOUT_PATTERNS = {
    urls: ['/checkout', '/cart', '/basket', '/payment', '/order'],
    terms: ['checkout', 'cart', 'basket', 'payment', 'order'],
    selectors: [
      'form[action*="checkout"]',
      'form[action*="cart"]',
      'div[id*="checkout"]',
      '.checkout-container',
      '#cart-container'
    ]
  };
  
  // Track application state
  const state = {
    isCheckoutPage: false,
    lastCheck: 0,
    appliedCoupons: new Set(),
    pendingCheck: false
  };
  
  // Track detected elements
  let detectedElements = {
    couponField: null,
    applyButton: null,
    detected: false,
    lastChecked: 0
  };
  
  // Configuration (will be synced with user settings)
  let config = {
    autoApply: true,
    showNotification: true
  };
  
  // Floating notification element
  let notificationElement = null;
  
  /**
   * Initializes the content script
   */
  function initialize() {
    // Load configuration from storage
    loadConfig();
    
    // Add custom styles for the notification
    injectCustomStyles();
    
    // Start detection process
    detectCheckoutPage();
    
    // Set up mutation observer to detect dynamic changes
    observeDOMChanges();
    
    // Listen for messages from background/popup
    setupMessageListeners();
    
    // Log initialization (for debugging)
    console.log('CouponDaddy: Content script initialized');
  }
  
  /**
   * Loads user configuration from Chrome storage
   */
  function loadConfig() {
    chrome.storage.sync.get(['extensionState'], (result) => {
      if (result.extensionState) {
        config.autoApply = result.extensionState.autoApply !== undefined 
          ? result.extensionState.autoApply 
          : true;
        config.showNotification = result.extensionState.notifications !== undefined
          ? result.extensionState.notifications
          : true;
      }
    });
  }
  
  /**
   * Injects custom CSS for notifications and UI elements
   */
  function injectCustomStyles() {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      .coupondaddy-notification {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background-color: #4b7bec;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        z-index: 2147483647;
        display: flex;
        align-items: center;
        transition: all 0.3s ease;
        max-width: 300px;
        opacity: 0;
        transform: translateY(20px);
      }
      
      .coupondaddy-notification.show {
        opacity: 1;
        transform: translateY(0);
      }
      
      .coupondaddy-notification-icon {
        margin-right: 12px;
        flex-shrink: 0;
      }
      
      .coupondaddy-notification-content {
        flex: 1;
      }
      
      .coupondaddy-notification-title {
        font-weight: 600;
        margin-bottom: 4px;
      }
      
      .coupondaddy-notification-message {
        font-size: 14px;
        opacity: 0.9;
      }
      
      .coupondaddy-notification-close {
        background: none;
        border: none;
        color: white;
        opacity: 0.7;
        cursor: pointer;
        padding: 5px;
        margin-left: 8px;
        transition: opacity 0.2s;
      }
      
      .coupondaddy-notification-close:hover {
        opacity: 1;
      }
      
      .coupondaddy-highlight {
        outline: 2px dashed #4b7bec !important;
        outline-offset: 2px !important;
        transition: outline-color 0.3s ease !important;
      }
    `;
    document.head.appendChild(styleElement);
  }
  
  /**
   * Sets up listeners for messages from background script and popup
   */
  function setupMessageListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.action) {
        case 'checkForCouponFields':
          // Re-check for coupon fields
          const elements = findCouponElements();
          sendResponse({ 
            found: elements.couponField !== null,
            details: elements
          });
          break;
          
        case 'applyCoupon':
          // Apply the provided coupon code
          const result = applyCouponCode(message.couponCode);
          sendResponse(result);
          break;
          
        case 'highlightCouponField':
          // Highlight the coupon field for the user
          highlightCouponField();
          sendResponse({ success: true });
          break;
          
        case 'updateConfig':
          // Update configuration
          config = { ...config, ...message.config };
          sendResponse({ success: true });
          break;
      }
      return true; // Keep the message channel open for async responses
    });
  }
  
  /**
   * Enhanced checkout page detection
   */
  function detectCheckoutPage() {
    // Prevent multiple rapid checks
    if (Date.now() - state.lastCheck < 2000) return;
    state.lastCheck = Date.now();

    const hostname = window.location.hostname.replace('www.', '');
    const pathname = window.location.pathname.toLowerCase();
    
    // Check URL patterns
    const isCheckoutUrl = CHECKOUT_PATTERNS.urls.some(pattern => pathname.includes(pattern));
    
    // Check page title
    const pageTitle = document.title.toLowerCase();
    const hasCheckoutTerms = CHECKOUT_PATTERNS.terms.some(term => pageTitle.includes(term));
    
    // Check DOM elements
    const hasCheckoutElements = CHECKOUT_PATTERNS.selectors.some(selector => 
      document.querySelector(selector) !== null
    );

    state.isCheckoutPage = isCheckoutUrl || hasCheckoutTerms || hasCheckoutElements;

    if (state.isCheckoutPage) {
      // Debounced element detection
      debouncedFindElements();
      
      // Notify background script
      chrome.runtime.sendMessage({
        action: 'checkoutPageDetected',
        url: window.location.href,
        store: hostname
      });
    }
  }

  // Create debounced version of findCouponElements
  const debouncedFindElements = debounce(() => {
    if (!state.pendingCheck) {
      state.pendingCheck = true;
      requestAnimationFrame(() => {
        findCouponElements();
        state.pendingCheck = false;
      });
    }
  }, 250);
  
  /**
   * Finds coupon input fields and apply buttons on the page
   */
  function findCouponElements() {
    // Skip if we checked recently (debounce)
    const now = Date.now();
    if (now - detectedElements.lastChecked < 1000) {
      return detectedElements;
    }
    
    detectedElements.lastChecked = now;
    const hostname = window.location.hostname.replace('www.', '');
    
    // First try store-specific selectors
    for (const [domain, selectors] of Object.entries(STORE_SPECIFIC_SELECTORS)) {
      if (hostname.includes(domain)) {
        const couponField = document.querySelector(selectors.couponField);
        if (couponField) {
          const applyButton = document.querySelector(selectors.applyButton);
          detectedElements = {
            couponField,
            applyButton,
            detected: true,
            lastChecked: now
          };
          
          // Notify background script about found elements
          notifyElementsFound();
          return detectedElements;
        }
      }
    }
    
    // Try generic selectors if store-specific ones didn't work
    for (const selector of COUPON_FIELD_SELECTORS) {
      const couponFields = document.querySelectorAll(selector);
      
      for (const field of couponFields) {
        // Skip hidden fields
        if (!isElementVisible(field)) continue;
        
        // Found a visible coupon field
        detectedElements.couponField = field;
        detectedElements.detected = true;
        
        // Look for an apply button near the field
        detectedElements.applyButton = findNearbyApplyButton(field);
        
        // Notify background script about found elements
        notifyElementsFound();
        return detectedElements;
      }
    }
    
    // If still not found, look for iframes that might contain checkout forms
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      try {
        // Skip cross-origin iframes
        if (!canAccessIframe(iframe)) continue;
        
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        for (const selector of COUPON_FIELD_SELECTORS) {
          const couponField = iframeDoc.querySelector(selector);
          if (couponField && isElementVisible(couponField)) {
            detectedElements.couponField = couponField;
            detectedElements.iframe = iframe;
            detectedElements.detected = true;
            detectedElements.applyButton = findNearbyApplyButton(couponField, iframeDoc);
            
            // Notify background script about found elements
            notifyElementsFound();
            return detectedElements;
          }
        }
      } catch (e) {
        // Access to iframe denied due to same-origin policy
        console.debug('CouponDaddy: Cannot access iframe contents', e);
      }
    }
    
    return detectedElements;
  }
  
  /**
   * Checks if an iframe can be accessed (same-origin policy)
   */
  function canAccessIframe(iframe) {
    try {
      return !!iframe.contentWindow.document;
    } catch (e) {
      return false;
    }
  }
  
  /**
   * Finds an apply button near the coupon field
   */
  function findNearbyApplyButton(couponField, doc = document) {
    // First try to find a button within the same form
    if (couponField.form) {
      const formButtons = couponField.form.querySelectorAll('button, input[type="submit"], [role="button"]');
      for (const button of formButtons) {
        if (isApplyButton(button)) {
          return button;
        }
      }
    }
    
    // Try to find buttons near the coupon field
    for (const selector of APPLY_BUTTON_SELECTORS) {
      const buttons = doc.querySelectorAll(selector);
      for (const button of buttons) {
        // Skip if button is not visible
        if (!isElementVisible(button)) continue;
        
        // Check if button is near the coupon field (within 300px)
        if (isElementNearby(couponField, button, 300)) {
          return button;
        }
      }
    }
    
    // If no specific button found, try to find any button/input containing apply-related text
    const allButtons = doc.querySelectorAll('button, input[type="submit"], [role="button"]');
    for (const button of allButtons) {
      if (!isElementVisible(button)) continue;
      
      const buttonText = button.innerText || button.value || button.getAttribute('aria-label') || '';
      const applyTexts = ['apply', 'redeem', 'submit', 'use', 'validate', 'check'];
      
      if (applyTexts.some(text => buttonText.toLowerCase().includes(text)) && 
          isElementNearby(couponField, button, 300)) {
        return button;
      }
    }
    
    return null;
  }
  
  /**
   * Checks if a button is likely an "apply" button
   */
  function isApplyButton(button) {
    if (!isElementVisible(button)) return false;
    
    const buttonText = button.innerText || button.value || button.getAttribute('aria-label') || '';
    const buttonType = button.getAttribute('type');
    
    // Check button text for apply-related terms
    const applyTexts = ['apply', 'redeem', 'submit', 'use', 'validate', 'add', 'check'];
    const hasApplyText = applyTexts.some(text => buttonText.toLowerCase().includes(text));
    
    // Check if button has apply-related class or ID
    const buttonClasses = button.className || '';
    const buttonId = button.id || '';
    const hasApplyClass = 
      buttonClasses.toLowerCase().includes('apply') ||
      buttonId.toLowerCase().includes('apply') ||
      buttonClasses.toLowerCase().includes('coupon') ||
      buttonId.toLowerCase().includes('coupon') ||
      buttonClasses.toLowerCase().includes('promo') ||
      buttonId.toLowerCase().includes('promo');
    
    // It's likely an apply button if it's a submit button in a form with a coupon field
    const isSubmitInForm = buttonType === 'submit' && button.form && 
      button.form.querySelector(COUPON_FIELD_SELECTORS.join(','));
    
    return hasApplyText || hasApplyClass || isSubmitInForm;
  }
  
  /**
   * Checks if two elements are near each other
   */
  function isElementNearby(element1, element2, maxDistance = 300) {
    if (!element1 || !element2) return false;
    
    const rect1 = element1.getBoundingClientRect();
    const rect2 = element2.getBoundingClientRect();
    
    const centerX1 = rect1.left + rect1.width / 2;
    const centerY1 = rect1.top + rect1.height / 2;
    const centerX2 = rect2.left + rect2.width / 2;
    const centerY2 = rect2.top + rect2.height / 2;
    
    const distance = Math.sqrt(
      Math.pow(centerX2 - centerX1, 2) + 
      Math.pow(centerY2 - centerY1, 2)
    );
    
    return distance <= maxDistance;
  }
  
  /**
   * Checks if an element is visible on the page
   */
  function isElementVisible(element) {
    if (!element) return false;
    
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Notifies the background script that coupon elements were found
   */
  function notifyElementsFound() {
    if (detectedElements.detected) {
      chrome.runtime.sendMessage({
        action: 'couponElementsFound',
        url: window.location.href,
        store: window.location.hostname.replace('www.', '')
      });
    }
  }
  
  /**
   * Applies a coupon code to the detected input field
   */
  function applyCouponCode(couponCode) {
    try {
      if (!detectedElements.couponField) {
        // Re-find elements if not already found
        findCouponElements();
        if (!detectedElements.couponField) {
          showNotification('Could not find a coupon field', 'error');
          return { success: false, error: 'No coupon field found' };
        }
      }
      
      const field = detectedElements.couponField;
      const applyButton = detectedElements.applyButton;
      
      // Focus and clear the field
      field.focus();
      field.value = '';
      
      // Trigger input events to ensure site's JavaScript detects the change
      triggerInputEvents(field);
      
      // Set the coupon code with slight typing delay
      simulateTyping(field, couponCode, () => {
        // After typing, click the apply button if found
        if (applyButton && isElementVisible(applyButton)) {
          setTimeout(() => {
            highlightElement(applyButton);
            applyButton.click();
            
            // Show success notification
            if (config.showNotification) {
              showNotification(`Applied coupon: ${couponCode}`, 'success');
            }
          }, 500);
        } else {
          // Try to submit the form if no apply button was found
          if (field.form) {
            setTimeout(() => {
              field.form.submit();
              if (config.showNotification) {
                showNotification(`Applied coupon: ${couponCode}`, 'success');
              }
            }, 500);
          } else {
            // Press Enter key as last resort
            setTimeout(() => {
              const enterEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true,
                cancelable: true
              });
              field.dispatchEvent(enterEvent);
              
              if (config.showNotification) {
                showNotification(`Applied coupon: ${couponCode}`, 'success');
              }
            }, 500);
          }
        }
      });
      
      return { success: true };
    } catch (error) {
      console.error('CouponDaddy: Error applying coupon', error);
      if (config.showNotification) {
        showNotification('Error applying coupon', 'error');
      }
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Simulates human-like typing in an input field
   */
  function simulateTyping(element, text, callback) {
    let index = 0;
    
    function typeNextChar() {
      if (index < text.length) {
        element.value += text.charAt(index);
        triggerInputEvents(element);
        index++;
        
        // Random typing speed between 30ms and 100ms
        const typingSpeed = Math.floor(Math.random() * 70) + 30;
        setTimeout(typeNextChar, typingSpeed);
      } else {
        // Typing complete
        if (callback) callback();
      }
    }
    
    typeNextChar();
  }
  
  /**
   * Triggers necessary input events to ensure site scripts detect the change
   */
  function triggerInputEvents(element) {
    const events = [
      new Event('input', { bubbles: true }),
      new Event('change', { bubbles: true }),
      new KeyboardEvent('keydown', { bubbles: true }),
      new KeyboardEvent('keyup', { bubbles: true }),
      new KeyboardEvent('keypress', { bubbles: true })
    ];
    
    events.forEach(event => element.dispatchEvent(event));
  }
  
  /**
   * Highlights a coupon field to make it visible to the user
   */
  function highlightCouponField() {
    if (detectedElements.couponField) {
      highlightElement(detectedElements.couponField);
    } else {
      // Try to find elements if not already found
      findCouponElements();
      if (detectedElements.couponField) {
        highlightElement(detectedElements.couponField);
      }
    }
  }
  
  /**
   * Adds a highlight effect to an element
   */
  function highlightElement(element) {
    element.classList.add('coupondaddy-highlight');
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Remove highlight after 3 seconds
    setTimeout(() => {
      element.classList.remove('coupondaddy-highlight');
    }, 3000);
  }
  
  /**
   * Shows a notification to the user
   */
  function showNotification(message, type = 'info', duration = 5000) {
    if (!config.showNotification) return;
    
    // Remove existing notification if present
    if (notificationElement) {
      notificationElement.remove();
    }
    
    // Create notification element
    notificationElement = document.createElement('div');
    notificationElement.className = 'coupondaddy-notification';
    
    // Set icon based on type
    let iconClass = '';
    let title = '';
    
    switch (type) {
      case 'success':
        iconClass = 'fas fa-check-circle';
        title = 'Success';
        break;
      case 'error':
        iconClass = 'fas fa-exclamation-circle';
        title = 'Error';
        break;
      case 'info':
      default:
        iconClass = 'fas fa-info-circle';
        title = 'CouponDaddy';
    }
    
    notificationElement.innerHTML = `
      <div class="coupondaddy-notification-icon">
        <i class="${iconClass}"></i>
      </div>
      <div class="coupondaddy-notification-content">
        <div class="coupondaddy-notification-title">${title}</div>
        <div class="coupondaddy-notification-message">${message}</div>
      </div>
      <button class="coupondaddy-notification-close">
        <i class="fas fa-times"></i>
      </button>
    `;
    
    // Add notification to page
    document.body.appendChild(notificationElement);
    
    // Add close button listener
    const closeButton = notificationElement.querySelector('.coupondaddy-notification-close');
    closeButton.addEventListener('click', () => {
      notificationElement.classList.remove('show');
      setTimeout(() => notificationElement.remove(), 300);
    });
    
    // Show notification with animation
    setTimeout(() => notificationElement.classList.add('show'), 10);
    
    // Auto-hide after duration
    if (duration > 0) {
      setTimeout(() => {
        if (notificationElement) {
          notificationElement.classList.remove('show');
          setTimeout(() => {
            if (notificationElement) {
              notificationElement.remove();
              notificationElement = null;
            }
          }, 300);
        }
      }, duration);
    }
  }
  
  /**
   * Optimized DOM observer
   */
  function observeDOMChanges() {
    const observer = new MutationObserver((mutations) => {
      // Check if mutations are relevant
      const hasRelevantChanges = mutations.some(mutation => {
        return Array.from(mutation.addedNodes).some(node => {
          if (node.nodeType !== Node.ELEMENT_NODE) return false;
          const elem = node;
          return (
            elem.tagName === 'FORM' ||
            elem.matches(COUPON_FIELD_SELECTORS.join(',')) ||
            elem.matches(APPLY_BUTTON_SELECTORS.join(',')) ||
            elem.querySelector(COUPON_FIELD_SELECTORS.join(','))
          );
        });
      });

      if (hasRelevantChanges) {
        debouncedFindElements();
      }
    });

    // Optimize observation config
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false
    });
  }
  
  // Initialize the content script
  initialize();