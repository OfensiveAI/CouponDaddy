 /**
 * Claude AI Integration
 * 
 * This module connects to the Claude AI API to analyze available coupons
 * and determine the best one for the current shopping scenario.
 * 
 * Uses ES6 syntax and follows Chrome Extension Manifest V3 guidelines.
 */

// API configuration
const CLAUDE_API_CONFIG = {
    baseUrl: 'https://api.anthropic.com/v1/messages',
    apiVersion: '2023-06-01',
    model: 'claude-3-haiku-20240307',
    maxTokens: 500,
    temperature: 0.2,
  };
  
  // Store your API key securely (consider using environment variables in production)
  let apiKey = ''; // Will be loaded from Chrome storage
  
  /**
   * Initializes the Claude AI service
   * @returns {Promise<void>}
   */
  export const initClaudeAI = async () => {
    return new Promise((resolve, reject) => {
      // Load API key from secure storage
      chrome.storage.local.get(['claudeApiKey'], (result) => {
        if (result.claudeApiKey) {
          apiKey = result.claudeApiKey;
          console.log('Claude AI initialized successfully');
          resolve();
        } else {
          console.warn('Claude API key not found in storage');
          // Still resolve, we'll handle missing API key in the request methods
          resolve();
        }
      });
    });
  };
  
  /**
   * Analyzes a list of coupons and returns the best one based on various factors
   * @param {Array} coupons - Array of coupon objects to analyze
   * @param {Object} context - Additional context for better recommendation
   * @returns {Promise<Object>} - The best coupon with explanation
   */
  export const findBestCoupon = async (coupons, context = {}) => {
    try {
      // If no coupons provided, return null
      if (!coupons || coupons.length === 0) {
        return { 
          success: false, 
          message: "No coupons to analyze",
          bestCoupon: null
        };
      }
      
      // If only one coupon, return it directly
      if (coupons.length === 1) {
        return {
          success: true,
          message: "Only one coupon available",
          bestCoupon: coupons[0],
          explanation: "This is the only available coupon"
        };
      }
      
      // Check if API key is available
      if (!apiKey) {
        // Fallback to simple analysis without Claude
        return simpleCouponAnalysis(coupons, context);
      }
      
      // Prepare data for Claude AI
      const promptData = preparePromptData(coupons, context);
      
      // Send request to Claude AI
      const claudeResponse = await requestClaudeAnalysis(promptData);
      
      // Parse and process Claude's response
      return processClaudeResponse(claudeResponse, coupons);
      
    } catch (error) {
      console.error('Error analyzing coupons with Claude AI:', error);
      
      // Fallback to simple analysis
      return simpleCouponAnalysis(coupons, context);
    }
  };
  
  /**
   * Prepares the prompt data for Claude AI
   * @param {Array} coupons - Coupon data to analyze
   * @param {Object} context - Shopping context
   * @returns {Object} - Formatted prompt data
   */
  function preparePromptData(coupons, context) {
    // Format coupons for the prompt
    const formattedCoupons = coupons.map((coupon, index) => {
      return `
  Coupon ${index + 1}:
  - Code: ${coupon.code}
  - Discount: ${formatDiscount(coupon.discount, coupon.discountType)}
  - Description: ${coupon.description || 'N/A'}
  - Restrictions: ${coupon.restrictions || 'None specified'}
  - Expiration: ${formatDate(coupon.expirationDate)}
  - Minimum Purchase: ${coupon.minimumPurchase ? `$${coupon.minimumPurchase}` : 'None'}
  - Usage Count: ${coupon.usageCount || 0}
  - Success Rate: ${coupon.successRate || 'Unknown'}
  `;
    }).join('\n');
  
    // Format context information
    const contextInfo = `
  Shopping Context:
  - Store: ${context.store || 'Unknown'}
  - Cart Total: ${context.cartTotal ? `$${context.cartTotal}` : 'Unknown'}
  - Items in Cart: ${context.itemCount || 'Unknown'}
  - Categories: ${context.categories ? context.categories.join(', ') : 'Unknown'}
  - Is New Customer: ${context.isNewCustomer !== undefined ? context.isNewCustomer : 'Unknown'}
  `;
  
    // Create the complete prompt
    return {
      coupons: formattedCoupons,
      context: contextInfo
    };
  }
  
  /**
   * Formats discount value based on type
   * @param {number|string} discount - The discount value
   * @param {string} type - The discount type (percent, fixed, etc.)
   * @returns {string} - Formatted discount
   */
  function formatDiscount(discount, type) {
    if (!discount) return 'Unknown';
    
    if (type === 'percent' || (typeof discount === 'number' && discount <= 1)) {
      // Assume it's a percentage if ≤ 1
      const percentValue = typeof discount === 'number' && discount <= 1 
        ? discount * 100 
        : discount;
      return `${percentValue}%`;
    } else {
      // Assume it's a fixed amount
      return `$${discount}`;
    }
  }
  
  /**
   * Formats date for display
   * @param {Date|string|null} date - Date to format
   * @returns {string} - Formatted date string
   */
  function formatDate(date) {
    if (!date) return 'No expiration';
    
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return String(date);
    }
  }
  
  /**
   * Sends analysis request to Claude AI
   * @param {Object} promptData - Formatted prompt data
   * @returns {Promise<Object>} - Claude AI response
   */
  async function requestClaudeAnalysis(promptData) {
    const prompt = `
  You are an expert coupon analyzer that helps users find the best coupon for their shopping needs. 
  Please analyze the following coupons and determine which one will save the customer the most money.
  
  ${promptData.coupons}
  
  ${promptData.context}
  
  Based on the available information, please:
  1. Identify which coupon will save the customer the most money
  2. Explain your reasoning
  3. Provide a JSON response in the following format:
  {
    "bestCouponIndex": <index of best coupon, starting from 0>,
    "estimatedSavings": <estimated dollar amount saved>,
    "explanation": "<brief explanation of why this is the best coupon>",
    "confidence": <number between 0-1 indicating confidence in this recommendation>
  }
  `;
  
    // Make API request to Claude
    const response = await fetch(CLAUDE_API_CONFIG.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': CLAUDE_API_CONFIG.apiVersion,
      },
      body: JSON.stringify({
        model: CLAUDE_API_CONFIG.model,
        max_tokens: CLAUDE_API_CONFIG.maxTokens,
        temperature: CLAUDE_API_CONFIG.temperature,
        messages: [
          { role: 'user', content: prompt }
        ]
      })
    });
  
    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status} ${response.statusText}`);
    }
  
    return await response.json();
  }
  
  /**
   * Processes Claude's response to extract the best coupon
   * @param {Object} claudeResponse - Response from Claude API
   * @param {Array} coupons - Original coupon array
   * @returns {Object} - Processed result with best coupon
   */
  function processClaudeResponse(claudeResponse, coupons) {
    try {
      // Extract Claude's message content
      const content = claudeResponse.content || 
                     (claudeResponse.messages && claudeResponse.messages[0]?.content) ||
                     '';
                     
      // Find JSON in Claude's response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not parse JSON from Claude response');
      }
      
      // Parse the JSON analysis
      const analysis = JSON.parse(jsonMatch[0]);
      
      // Get the best coupon
      const bestCouponIndex = analysis.bestCouponIndex;
      if (bestCouponIndex === undefined || bestCouponIndex < 0 || bestCouponIndex >= coupons.length) {
        throw new Error('Invalid coupon index in Claude response');
      }
      
      const bestCoupon = coupons[bestCouponIndex];
      
      return {
        success: true,
        message: "Analysis completed successfully",
        bestCoupon,
        explanation: analysis.explanation,
        estimatedSavings: analysis.estimatedSavings,
        confidence: analysis.confidence,
        analysisMethod: 'claude'
      };
      
    } catch (error) {
      console.error('Error processing Claude response:', error);
      // Fallback to simple analysis
      return simpleCouponAnalysis(coupons);
    }
  }
  
  /**
   * Simple fallback analysis for when Claude AI is unavailable
   * @param {Array} coupons - Coupons to analyze
   * @param {Object} context - Shopping context
   * @returns {Object} - Best coupon based on simple rules
   */
  function simpleCouponAnalysis(coupons, context = {}) {
    // Fallback strategy: compare expected value of each coupon
    let bestCoupon = null;
    let highestValue = -1;
    let explanation = '';
  
    for (const coupon of coupons) {
      let estimatedValue = 0;
      
      // Calculate estimated value
      if (coupon.discountType === 'percent' || coupon.discount <= 1) {
        // Percentage discount
        const percentValue = coupon.discount <= 1 ? coupon.discount : coupon.discount / 100;
        const cartTotal = context.cartTotal || 100; // Assume $100 if unknown
        estimatedValue = cartTotal * percentValue;
      } else {
        // Fixed amount discount
        estimatedValue = parseFloat(coupon.discount) || 0;
      }
      
      // Adjust for minimum purchase requirement
      if (coupon.minimumPurchase && context.cartTotal && context.cartTotal < coupon.minimumPurchase) {
        estimatedValue = 0;
      }
      
      // Adjust for expiration (prioritize coupons expiring soon)
      if (coupon.expirationDate) {
        const daysUntilExpiration = Math.max(0, (new Date(coupon.expirationDate) - new Date()) / (1000 * 60 * 60 * 24));
        if (daysUntilExpiration < 7) {
          // Give slight bonus to coupons expiring within a week
          estimatedValue *= 1.05;
        }
      }
      
      // Adjust for success rate
      if (coupon.successRate) {
        const successRateValue = parseFloat(coupon.successRate) / 100;
        if (!isNaN(successRateValue)) {
          estimatedValue *= successRateValue;
        }
      }
      
      // Compare with current best
      if (estimatedValue > highestValue) {
        highestValue = estimatedValue;
        bestCoupon = coupon;
        
        // Generate explanation
        if (coupon.discountType === 'percent' || coupon.discount <= 1) {
          const percent = coupon.discount <= 1 ? (coupon.discount * 100).toFixed(0) : coupon.discount;
          explanation = `${percent}% off is the highest available discount`;
        } else {
          explanation = `$${coupon.discount} off is the highest available discount`;
        }
      }
    }
    
    return {
      success: true,
      message: "Simple analysis completed",
      bestCoupon,
      explanation,
      estimatedSavings: highestValue.toFixed(2),
      confidence: 0.7,
      analysisMethod: 'simple'
    };
  }
  
  /**
   * Sets the Claude API key
   * @param {string} key - The API key to set
   * @returns {Promise<boolean>} - Success status
   */
  export const setApiKey = async (key) => {
    return new Promise((resolve) => {
      // Validate key format (basic check)
      if (!key || typeof key !== 'string' || key.length < 10) {
        resolve(false);
        return;
      }
      
      // Store API key securely
      chrome.storage.local.set({ claudeApiKey: key }, () => {
        apiKey = key;
        resolve(true);
      });
    });
  };
  
  /**
   * Tests the Claude AI connection
   * @returns {Promise<Object>} - Test result
   */
  export const testConnection = async () => {
    try {
      if (!apiKey) {
        return {
          success: false,
          message: 'API key not configured'
        };
      }
      
      // Simple test request
      const response = await fetch(CLAUDE_API_CONFIG.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': CLAUDE_API_CONFIG.apiVersion,
        },
        body: JSON.stringify({
          model: CLAUDE_API_CONFIG.model,
          max_tokens: 10,
          messages: [
            { role: 'user', content: 'Test connection. Reply with "connected".' }
          ]
        })
      });
      
      if (response.ok) {
        return {
          success: true,
          message: 'Successfully connected to Claude AI'
        };
      } else {
        const errorData = await response.json();
        return {
          success: false,
          message: `Connection failed: ${errorData.error?.message || response.statusText}`
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Connection error: ${error.message}`
      };
    }
  };
