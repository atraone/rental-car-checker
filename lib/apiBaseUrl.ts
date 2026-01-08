/**
 * Get the API base URL for the current environment
 * 
 * IMPORTANT: ALL API calls MUST go through the backend at atra.one
 * to ensure API keys are never exposed to the frontend.
 * 
 * This applies to BOTH development/testing AND production.
 * 
 * Priority:
 * 1. EXPO_PUBLIC_API_BASE_URL (explicit override - allows localhost for local backend testing if needed)
 * 2. Default: https://atra.one (ALWAYS - for both dev and production)
 */
export function getApiBaseUrl(): string {
  // Explicit override takes highest priority (allows localhost only if explicitly set)
  if (process.env.EXPO_PUBLIC_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_API_BASE_URL;
  }

  // ALWAYS use atra.one backend for both development and production
  // This ensures API keys are never exposed to the frontend
  return 'https://atra.one';
}

