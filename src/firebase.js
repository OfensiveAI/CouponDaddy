 /**
 * Firebase Configuration and Service
 * 
 * This module handles the connection to Firebase/Firestore
 * and provides methods to fetch and manage coupon data.
 * 
 * Using ES6 syntax and following Manifest V3 guidelines.
 */

// Import Firebase SDK functions
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  getDocs, 
  query, 
  where,
  orderBy,
  limit,
  doc,
  getDoc,
  Timestamp 
} from "firebase/firestore";

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyClAc-5leCYsHLcpNieHioy00s-1blnalY",
  authDomain: "coupondaddy-52eda.firebaseapp.com",
  projectId: "coupondaddy-52eda",
  storageBucket: "coupondaddy-52eda.appspot.com",
  messagingSenderId: "233194683238",
  appId: "1:233194683238:web:09fc00ccedf3197aebe6a7",
  measurementId: "G-PYJ7R815H4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/**
 * Fetches coupon data for a specific store
 * @param {string} storeName - The name of the store (e.g., 'amazon', 'walmart')
 * @param {Object} options - Query options (limit, sort, etc.)
 * @returns {Promise<Array>} - Array of coupons for the specified store
 */
export const fetchCouponsForStore = async (storeName, options = {}) => {
  try {
    // Default options
    const queryOptions = {
      limit: options.limit || 20,
      sortBy: options.sortBy || 'expirationDate',
      sortDirection: options.sortDirection || 'asc',
      activeOnly: options.activeOnly !== undefined ? options.activeOnly : true,
    };
    
    // Create query
    const couponsRef = collection(db, 'coupons');
    let storeQuery;
    
    if (queryOptions.activeOnly) {
      // Only get active coupons (not expired)
      const currentDate = new Date();
      storeQuery = query(
        couponsRef,
        where('store', '==', storeName.toLowerCase()),
        where('active', '==', true),
        where('expirationDate', '>', Timestamp.fromDate(currentDate)),
        orderBy(queryOptions.sortBy, queryOptions.sortDirection),
        limit(queryOptions.limit)
      );
    } else {
      // Get all coupons including expired ones
      storeQuery = query(
        couponsRef,
        where('store', '==', storeName.toLowerCase()),
        orderBy(queryOptions.sortBy, queryOptions.sortDirection),
        limit(queryOptions.limit)
      );
    }
    
    // Execute query
    const querySnapshot = await getDocs(storeQuery);
    const coupons = [];
    
    querySnapshot.forEach((doc) => {
      const couponData = doc.data();
      coupons.push({
        id: doc.id,
        ...couponData,
        // Convert Firestore timestamps to JS Date objects
        expirationDate: couponData.expirationDate?.toDate() || null,
        createdAt: couponData.createdAt?.toDate() || null
      });
    });
    
    return coupons;
  } catch (error) {
    console.error(`Error fetching coupons for ${storeName}:`, error);
    return [];
  }
};

/**
 * Fetches a single coupon by its ID
 * @param {string} couponId - The ID of the coupon to fetch
 * @returns {Promise<Object|null>} - The coupon object or null if not found
 */
export const fetchCouponById = async (couponId) => {
  try {
    const couponRef = doc(db, 'coupons', couponId);
    const couponSnapshot = await getDoc(couponRef);
    
    if (couponSnapshot.exists()) {
      const couponData = couponSnapshot.data();
      return {
        id: couponSnapshot.id,
        ...couponData,
        expirationDate: couponData.expirationDate?.toDate() || null,
        createdAt: couponData.createdAt?.toDate() || null
      };
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching coupon ${couponId}:`, error);
    return null;
  }
};

/**
 * Fetches trending or popular coupons across all stores
 * @param {number} count - Number of coupons to fetch
 * @returns {Promise<Array>} - Array of trending coupons
 */
export const fetchTrendingCoupons = async (count = 10) => {
  try {
    const couponsRef = collection(db, 'coupons');
    const trendingQuery = query(
      couponsRef,
      where('active', '==', true),
      where('expirationDate', '>', Timestamp.fromDate(new Date())),
      orderBy('usageCount', 'desc'),
      limit(count)
    );
    
    const querySnapshot = await getDocs(trendingQuery);
    const coupons = [];
    
    querySnapshot.forEach((doc) => {
      const couponData = doc.data();
      coupons.push({
        id: doc.id,
        ...couponData,
        expirationDate: couponData.expirationDate?.toDate() || null,
        createdAt: couponData.createdAt?.toDate() || null
      });
    });
    
    return coupons;
  } catch (error) {
    console.error('Error fetching trending coupons:', error);
    return [];
  }
};

/**
 * Fetches coupons based on search criteria
 * @param {Object} criteria - Search criteria (keywords, stores, etc.)
 * @returns {Promise<Array>} - Array of matching coupons
 */
export const searchCoupons = async (criteria = {}) => {
  try {
    const couponsRef = collection(db, 'coupons');
    let searchQuery;
    
    // Start with base active coupons query
    if (criteria.includeExpired) {
      searchQuery = query(couponsRef, where('active', '==', true));
    } else {
      searchQuery = query(
        couponsRef, 
        where('active', '==', true),
        where('expirationDate', '>', Timestamp.fromDate(new Date()))
      );
    }
    
    // Apply store filter if provided
    if (criteria.stores && criteria.stores.length > 0) {
      // Note: Firestore doesn't support OR queries across fields
      // This is a limitation - for multiple stores, we need multiple queries
      // For simplicity, we'll just use the first store in the array
      searchQuery = query(
        searchQuery,
        where('store', '==', criteria.stores[0].toLowerCase())
      );
    }
    
    // Apply category filter if provided
    if (criteria.category) {
      searchQuery = query(
        searchQuery,
        where('categories', 'array-contains', criteria.category.toLowerCase())
      );
    }
    
    // Apply sorting
    const sortField = criteria.sortBy || 'expirationDate';
    const sortDirection = criteria.sortDirection || 'asc';
    searchQuery = query(searchQuery, orderBy(sortField, sortDirection));
    
    // Apply limit
    searchQuery = query(searchQuery, limit(criteria.limit || 30));
    
    // Execute query
    const querySnapshot = await getDocs(searchQuery);
    const coupons = [];
    
    querySnapshot.forEach((doc) => {
      const couponData = doc.data();
      
      // If keywords provided, perform client-side filtering
      if (criteria.keywords && criteria.keywords.length > 0) {
        const couponText = `${couponData.code} ${couponData.description} ${couponData.store}`.toLowerCase();
        const matchesKeywords = criteria.keywords.some(keyword => 
          couponText.includes(keyword.toLowerCase())
        );
        
        if (!matchesKeywords) return;
      }
      
      coupons.push({
        id: doc.id,
        ...couponData,
        expirationDate: couponData.expirationDate?.toDate() || null,
        createdAt: couponData.createdAt?.toDate() || null
      });
    });
    
    return coupons;
  } catch (error) {
    console.error('Error searching coupons:', error);
    return [];
  }
};

/**
 * Retrieves statistics about available coupons
 * @returns {Promise<Object>} - Statistics object
 */
export const getCouponStatistics = async () => {
  try {
    const now = new Date();
    const couponsRef = collection(db, 'coupons');
    
    // Get count of active coupons
    const activeQuery = query(
      couponsRef,
      where('active', '==', true),
      where('expirationDate', '>', Timestamp.fromDate(now))
    );
    const activeSnapshot = await getDocs(activeQuery);
    const activeCount = activeSnapshot.size;
    
    // Get counts by top stores (limited implementation)
    // For a full implementation, use Firestore aggregation or Cloud Functions
    const storeGroups = {};
    activeSnapshot.forEach(doc => {
      const store = doc.data().store;
      if (store) {
        storeGroups[store] = (storeGroups[store] || 0) + 1;
      }
    });
    
    // Sort stores by coupon count
    const topStores = Object.entries(storeGroups)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([store, count]) => ({ store, count }));
    
    return {
      totalActive: activeCount,
      topStores,
      lastUpdated: now.toISOString()
    };
  } catch (error) {
    console.error('Error getting coupon statistics:', error);
    return {
      totalActive: 0,
      topStores: [],
      lastUpdated: new Date().toISOString(),
      error: error.message
    };
  }
};

/**
 * Updates usage statistics for a coupon
 * @param {string} couponId - ID of the used coupon
 * @param {boolean} wasSuccessful - Whether the coupon worked
 * @returns {Promise<boolean>} - Success status
 */
export const updateCouponUsage = async (couponId, wasSuccessful) => {
  try {
    // For security reasons, this would ideally be handled by a Cloud Function
    // This is a simplified implementation
    console.log(`Coupon ${couponId} usage recorded: ${wasSuccessful ? 'successful' : 'failed'}`);
    
    // In a real implementation, you would update the document in Firestore
    // For now, we'll just return success
    return true;
  } catch (error) {
    console.error('Error updating coupon usage:', error);
    return false;
  }
};

// Export the Firestore instance
export { db };
