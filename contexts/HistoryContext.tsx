import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

export interface VehicleSectionPhoto {
  section: string;
  photoUri: string;
  damageNotes: string;
  isUsable: boolean;
  needsRetake?: boolean;
}

export interface HistoryItem {
  id: string;
  mainPhoto: string; // Initial whole vehicle photo
  sectionPhotos: VehicleSectionPhoto[]; // All section photos with damage notes
  allDamageNotes: string; // Combined damage notes text
  createdAt: number;
  dateText: string; // Formatted date/time/day
}

const HISTORY_STORAGE_KEY = 'rental_car_checker_history';

export const [HistoryProvider, useHistory] = createContextHook(() => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const stored = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (error) {
      console.log('Failed to load history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveHistory = async (items: HistoryItem[]) => {
    try {
      // On web, AsyncStorage uses localStorage which has ~5-10MB quota
      // Store only metadata (no large base64 images) to prevent quota issues
      const itemsToStore = items.map(item => ({
        ...item,
        // On web, don't store full data URIs in AsyncStorage (they're too large)
        // Store placeholders instead
        mainPhoto: Platform.OS === 'web' && item.mainPhoto?.startsWith('data:')
          ? 'data:image/jpeg;base64,[STORED]'
          : item.mainPhoto,
        sectionPhotos: item.sectionPhotos.map(sp => ({
          ...sp,
          photoUri: Platform.OS === 'web' && sp.photoUri?.startsWith('data:')
            ? 'data:image/jpeg;base64,[STORED]'
            : sp.photoUri,
        })),
      }));
      
      await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(itemsToStore));
    } catch (error: any) {
      if (error?.name === 'QuotaExceededError' || error?.message?.includes('quota')) {
        console.warn('Storage quota exceeded, clearing old history...');
        // Clear history and try again with just the latest item
        try {
          const latestItem = items[0];
          await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify([latestItem]));
          setHistory([latestItem]);
        } catch (retryError) {
          console.error('Failed to save even after clearing:', retryError);
        }
      } else {
        console.log('Failed to save history:', error);
      }
    }
  };

  const addToHistory = useCallback(async (item: Omit<HistoryItem, 'id' | 'createdAt' | 'dateText'>) => {
    const now = Date.now();
    const date = new Date(now);
    const dateText = date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    
    // Save main photo to filesystem if needed (on native)
    let mainPhotoUri = item.mainPhoto;
    if (item.mainPhoto.startsWith('data:') && Platform.OS !== 'web') {
      try {
        const base64Data = item.mainPhoto.split(',')[1];
        const mimeMatch = item.mainPhoto.match(/data:([^;]+);/);
        const extension = mimeMatch && mimeMatch[1].includes('png') ? 'png' : 'jpg';
        const documentDir = (FileSystem as any).documentDirectory;
        const encodingType = (FileSystem as any).EncodingType;
        
        if (documentDir && encodingType) {
          const filename = `main_${now}.${extension}`;
          const fileUri = `${documentDir}${filename}`;
          await FileSystem.writeAsStringAsync(fileUri, base64Data, {
            encoding: encodingType.Base64,
          });
          mainPhotoUri = fileUri;
        }
      } catch (error) {
        console.log('Failed to save main photo to filesystem:', error);
      }
    }
    
    // Save section photos to filesystem if needed (on native)
    const sectionPhotos = await Promise.all(
      item.sectionPhotos.map(async (sp) => {
        if (sp.photoUri.startsWith('data:') && Platform.OS !== 'web') {
          try {
            const base64Data = sp.photoUri.split(',')[1];
            const mimeMatch = sp.photoUri.match(/data:([^;]+);/);
            const extension = mimeMatch && mimeMatch[1].includes('png') ? 'png' : 'jpg';
            const documentDir = (FileSystem as any).documentDirectory;
            const encodingType = (FileSystem as any).EncodingType;
            
            if (documentDir && encodingType) {
              const filename = `section_${now}_${sp.section.replace(/\s+/g, '_')}.${extension}`;
              const fileUri = `${documentDir}${filename}`;
              await FileSystem.writeAsStringAsync(fileUri, base64Data, {
                encoding: encodingType.Base64,
              });
              return { ...sp, photoUri: fileUri };
            }
          } catch (error) {
            console.log('Failed to save section photo to filesystem:', error);
          }
        }
        return sp;
      })
    );
    
    const newItem: HistoryItem = {
      ...item,
      mainPhoto: mainPhotoUri,
      sectionPhotos,
      id: now.toString(),
      createdAt: now,
      dateText,
    };
    
    // Limit history to last 20 items to prevent quota issues
    setHistory(prev => {
      const updated = [newItem, ...prev].slice(0, 20);
      saveHistory(updated);
      return updated;
    });
    return newItem.id;
  }, []);

  const deleteFromHistory = useCallback((id: string) => {
    setHistory(prev => {
      const updated = prev.filter(item => item.id !== id);
      saveHistory(updated);
      return updated;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    saveHistory([]);
  }, []);

  const getHistoryItem = useCallback((id: string) => {
    return history.find(item => item.id === id);
  }, [history]);

  return {
    history,
    isLoading,
    addToHistory,
    deleteFromHistory,
    clearHistory,
    getHistoryItem,
  };
});
