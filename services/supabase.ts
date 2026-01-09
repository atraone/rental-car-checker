/**
 * Supabase Service
 * 
 * Handles all Supabase operations including:
 * - Storing inspection results via edge function (with Supabase Storage)
 * - Syncing history between local and Supabase
 * - Validating user sessions
 * - Managing subscriptions
 * 
 * Edge Functions:
 * - rental-car-store-inspection: POST /functions/v1/rental-car-store-inspection
 * - rental-car-get-inspections: GET /functions/v1/rental-car-get-inspections
 * - rental-car-manage-subscription: POST /functions/v1/rental-car-manage-subscription
 * 
 * Database Tables:
 * - rental_car_users: User profiles linked to auth.users
 * - rental_car_subscriptions: Subscription records
 * - rental_car_inspections: Main inspection records
 * - rental_car_section_photos: Individual section photos
 * 
 * Storage:
 * - Bucket: rental-car-images
 * - Path structure: {user_id}/{inspection_id}/{filename}
 */

import { supabase } from '@/lib/supabase';
import { VehicleSectionPhoto, HistoryItem } from '@/contexts/HistoryContext';
import { getApiBaseUrl } from '@/lib/apiBaseUrl';
import Constants from 'expo-constants';

const SUPABASE_FUNCTIONS_URL = Constants.expoConfig?.extra?.supabaseFunctionsUrl || 
                               process.env.EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL || 
                               'https://vottxjcqffropoyeqtbo.supabase.co/functions/v1';

export interface StoreInspectionRequest {
  mainPhoto: string;
  sectionPhotos: VehicleSectionPhoto[];
  allDamageNotes: string;
  expectedReturnDate?: number;
  expectedReturnDateText?: string;
  afterMainPhoto?: string;
  afterSectionPhotos?: any[];
  afterCreatedAt?: number;
  afterDateText?: string;
  isReturned?: boolean;
}

export interface StoreInspectionResponse {
  success: boolean;
  inspectionId?: string;
  error?: string;
}

/**
 * Store inspection results to Supabase via edge function
 * 
 * This function:
 * 1. Validates user session
 * 2. Calls Supabase edge function with inspection data
 * 3. Returns the stored inspection ID
 * 
 * @param data - Inspection data to store
 * @returns Promise with success status and inspection ID
 */
export async function storeInspectionToSupabase(
  data: StoreInspectionRequest
): Promise<StoreInspectionResponse> {
  try {
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return {
        success: false,
        error: 'User not authenticated',
      };
    }

    // Call edge function - it will handle Base64 to Storage conversion
    const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/rental-car-store-inspection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        main_photo: data.mainPhoto, // Base64 data URI - edge function will upload to Storage
        section_photos: data.sectionPhotos, // Array with Base64 photos - edge function will upload each
        all_damage_notes: data.allDamageNotes,
        expected_return_date: data.expectedReturnDate ? new Date(data.expectedReturnDate).toISOString() : null,
        expected_return_date_text: data.expectedReturnDateText,
        after_main_photo: data.afterMainPhoto,
        after_section_photos: data.afterSectionPhotos,
        after_created_at: data.afterCreatedAt ? new Date(data.afterCreatedAt).toISOString() : null,
        after_date_text: data.afterDateText,
        is_returned: data.isReturned || false,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: result.error || 'Failed to store inspection',
      };
    }

    return {
      success: true,
      inspectionId: result.inspection_id,
    };
  } catch (error) {
    console.error('Error storing inspection to Supabase:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Fetch all inspections from Supabase for the current user
 * 
 * Returns inspections in HistoryItem format for compatibility
 * 
 * @returns Promise with array of HistoryItem objects
 */
export async function fetchInspectionsFromSupabase(): Promise<HistoryItem[]> {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return [];
    }

    // Use edge function to get inspections (it handles the complex join with section photos)
    const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/rental-car-get-inspections`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) {
      console.error('Error fetching inspections:', response.status);
      return [];
    }

    const result = await response.json();
    
    if (!result.inspections || !Array.isArray(result.inspections)) {
      return [];
    }

    const data = result.inspections;

    if (error) {
      console.error('Error fetching inspections:', error);
      return [];
    }

    // Convert edge function response format to HistoryItem format
    // Edge function returns inspections with section_photos as array of objects with photo_url
    return (data || []).map((inspection): HistoryItem => {
      // Convert section photos from edge function format to app format
      const sectionPhotos = (inspection.section_photos || []).map((photo: any) => ({
        section: photo.section,
        photoUri: photo.photo_url || photo.photo_uri, // URL from Storage
        damageNotes: photo.damage_notes || '',
        isUsable: photo.is_usable !== false,
        needsRetake: photo.needs_retake || false,
      }));

      return {
        id: inspection.id,
        mainPhoto: inspection.main_photo_url || inspection.main_photo, // URL from Storage
        sectionPhotos,
        allDamageNotes: inspection.all_damage_notes || '',
        createdAt: new Date(inspection.created_at).getTime(),
        dateText: formatDateText(new Date(inspection.created_at)),
        expectedReturnDate: inspection.expected_return_date ? new Date(inspection.expected_return_date).getTime() : undefined,
        expectedReturnDateText: inspection.expected_return_date_text,
        afterMainPhoto: inspection.after_main_photo_url || inspection.after_main_photo,
        afterSectionPhotos: (inspection.after_section_photos || []).map((photo: any) => ({
          section: photo.section,
          photoUri: photo.photo_url || photo.photo_uri,
        })),
        afterCreatedAt: inspection.after_created_at ? new Date(inspection.after_created_at).getTime() : undefined,
        afterDateText: inspection.after_date_text,
        isReturned: inspection.is_returned || false,
      };
    });
  } catch (error) {
    console.error('Error fetching inspections from Supabase:', error);
    return [];
  }
}

/**
 * Sync local history with Supabase
 * 
 * This function:
 * 1. Fetches all inspections from Supabase
 * 2. Compares with local history
 * 3. Returns merged list (Supabase takes precedence for conflicts)
 * 
 * @param localHistory - Current local history
 * @returns Promise with merged history
 */
export async function syncHistoryWithSupabase(
  localHistory: HistoryItem[]
): Promise<HistoryItem[]> {
  try {
    const supabaseHistory = await fetchInspectionsFromSupabase();
    
    // Create a map of Supabase inspections by ID
    const supabaseMap = new Map(supabaseHistory.map(item => [item.id, item]));
    
    // Create a map of local inspections by ID
    const localMap = new Map(localHistory.map(item => [item.id, item]));
    
    // Merge: Supabase takes precedence, then add local items not in Supabase
    const merged: HistoryItem[] = [];
    
    // Add all Supabase items
    supabaseHistory.forEach(item => merged.push(item));
    
    // Add local items that don't exist in Supabase
    localHistory.forEach(item => {
      if (!supabaseMap.has(item.id)) {
        merged.push(item);
      }
    });
    
    // Sort by creation date (newest first)
    merged.sort((a, b) => b.createdAt - a.createdAt);
    
    return merged;
  } catch (error) {
    console.error('Error syncing history:', error);
    // Return local history if sync fails
    return localHistory;
  }
}

/**
 * Manage user subscription
 * 
 * Creates or updates a subscription record in rental_car_subscriptions table.
 * 
 * Note: For production, this should include server-side validation of receipts
 * with Apple or Google to prevent fraud. Current implementation trusts the client
 * for initial development and testing.
 * 
 * @param subscriptionData - Subscription details from client
 * @returns Promise with success status
 */
export async function manageSubscription(subscriptionData: {
  platform: 'google_play' | 'app_store';
  productId: string;
  purchaseToken: string;
  expiresAt?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return {
        success: false,
        error: 'User not authenticated',
      };
    }

    const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/rental-car-manage-subscription`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        platform: subscriptionData.platform,
        product_id: subscriptionData.productId,
        purchase_token: subscriptionData.purchaseToken,
        expires_at: subscriptionData.expiresAt || null,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: result.error || 'Failed to manage subscription',
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error('Error managing subscription:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Validate authentication and subscription status
 * 
 * Calls the /api/rental-car/validate-auth endpoint (per Authentication Integration Guide)
 * to check:
 * - User authentication status
 * - Subscription status  
 * - Testing user flag
 * 
 * All current users have is_testing_user = TRUE for development.
 * 
 * @returns Promise with validation result
 */
export async function validateAuth(): Promise<{
  valid: boolean;
  hasSubscription: boolean;
  isTestingUser: boolean;
  error?: string;
}> {
  try {
    // Get current session (per Authentication Integration Guide)
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return {
        valid: false,
        hasSubscription: false,
        isTestingUser: false,
        error: 'User not authenticated',
      };
    }

    // Call validate-auth endpoint with JWT token
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/rental-car/validate-auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        valid: false,
        hasSubscription: false,
        isTestingUser: false,
        error: result.error || 'Validation failed',
      };
    }

    // Return validation result (per Authentication Integration Guide)
    return {
      valid: result.valid || false,
      hasSubscription: result.has_subscription || false,
      isTestingUser: result.is_testing_user || false,
    };
  } catch (error) {
    console.error('Error validating auth:', error);
    return {
      valid: false,
      hasSubscription: false,
      isTestingUser: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Format date for display
 */
function formatDateText(date: Date): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const dayName = days[date.getDay()];
  const month = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  
  return `${dayName}, ${month} ${day}, ${year}, ${hours}:${minutes}`;
}

