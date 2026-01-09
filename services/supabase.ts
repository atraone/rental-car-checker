/**
 * Supabase Service
 * 
 * Handles all Supabase operations including:
 * - Storing inspection results via edge function
 * - Syncing history between local and Supabase
 * - Validating user sessions
 * 
 * Edge Function: store-inspection
 * Endpoint: POST /functions/v1/store-inspection
 * 
 * Request Format:
 * {
 *   "mainPhoto": string (data URI),
 *   "sectionPhotos": VehicleSectionPhoto[],
 *   "allDamageNotes": string
 * }
 * 
 * Response Format:
 * {
 *   "success": boolean,
 *   "inspectionId": string (uuid),
 *   "error"?: string
 * }
 */

import { supabase } from '@/lib/supabase';
import { VehicleSectionPhoto, HistoryItem } from '@/contexts/HistoryContext';
import Constants from 'expo-constants';

const SUPABASE_FUNCTIONS_URL = Constants.expoConfig?.extra?.supabaseFunctionsUrl || 
                               process.env.EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL || 
                               'https://your-project.supabase.co/functions/v1';

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

    // Call edge function
    const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/store-inspection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        main_photo: data.mainPhoto,
        section_photos: data.sectionPhotos,
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

    const { data, error } = await supabase
      .from('inspections')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching inspections:', error);
      return [];
    }

    // Convert Supabase format to HistoryItem format
    return (data || []).map((inspection): HistoryItem => ({
      id: inspection.id,
      mainPhoto: inspection.main_photo,
      sectionPhotos: inspection.section_photos || [],
      allDamageNotes: inspection.all_damage_notes || '',
      createdAt: new Date(inspection.created_at).getTime(),
      dateText: formatDateText(new Date(inspection.created_at)),
      expectedReturnDate: inspection.expected_return_date ? new Date(inspection.expected_return_date).getTime() : undefined,
      expectedReturnDateText: inspection.expected_return_date_text,
      afterMainPhoto: inspection.after_main_photo,
      afterSectionPhotos: inspection.after_section_photos || [],
      afterCreatedAt: inspection.after_created_at ? new Date(inspection.after_created_at).getTime() : undefined,
      afterDateText: inspection.after_date_text,
      isReturned: inspection.is_returned || false,
    }));
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

