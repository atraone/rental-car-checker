/**
 * Notification Service
 * 
 * Handles scheduling notifications for rental return dates.
 * Uses expo-notifications for cross-platform notification support.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIFICATION_STORAGE_KEY = 'rental_car_checker_notifications';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Request notification permissions
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.warn('Notification permissions not granted');
      return false;
    }
    
    // Configure notification channel for Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('rental-returns', {
        name: 'Rental Return Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#4A90A4',
      });
    }
    
    return true;
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return false;
  }
}

/**
 * Schedule a notification for rental return date
 * 
 * @param inspectionId - ID of the inspection
 * @param returnDate - Date when return photos should be taken
 * @param inspectionDate - Date of the original inspection (for context)
 */
export async function scheduleReturnReminder(
  inspectionId: string,
  returnDate: Date,
  inspectionDate: string
): Promise<string | null> {
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.warn('Cannot schedule notification - permissions not granted');
      return null;
    }

    // Don't schedule if return date is in the past
    if (returnDate.getTime() < Date.now()) {
      console.warn('Return date is in the past, not scheduling notification');
      return null;
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Rental Return Reminder',
        body: `Time to take return photos for your rental inspection from ${inspectionDate}`,
        data: { inspectionId, type: 'return_reminder' },
        sound: true,
      },
      trigger: {
        date: returnDate,
      },
    });

    // Store notification ID for later cancellation if needed
    await storeNotificationId(inspectionId, notificationId);

    return notificationId;
  } catch (error) {
    console.error('Error scheduling notification:', error);
    return null;
  }
}

/**
 * Cancel a scheduled notification
 */
export async function cancelReturnReminder(inspectionId: string): Promise<void> {
  try {
    const notificationId = await getNotificationId(inspectionId);
    if (notificationId) {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      await removeNotificationId(inspectionId);
    }
  } catch (error) {
    console.error('Error canceling notification:', error);
  }
}

/**
 * Store notification ID for an inspection
 */
async function storeNotificationId(inspectionId: string, notificationId: string): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(NOTIFICATION_STORAGE_KEY);
    const notifications = stored ? JSON.parse(stored) : {};
    notifications[inspectionId] = notificationId;
    await AsyncStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(notifications));
  } catch (error) {
    console.error('Error storing notification ID:', error);
  }
}

/**
 * Get notification ID for an inspection
 */
async function getNotificationId(inspectionId: string): Promise<string | null> {
  try {
    const stored = await AsyncStorage.getItem(NOTIFICATION_STORAGE_KEY);
    if (stored) {
      const notifications = JSON.parse(stored);
      return notifications[inspectionId] || null;
    }
    return null;
  } catch (error) {
    console.error('Error getting notification ID:', error);
    return null;
  }
}

/**
 * Remove notification ID for an inspection
 */
async function removeNotificationId(inspectionId: string): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(NOTIFICATION_STORAGE_KEY);
    if (stored) {
      const notifications = JSON.parse(stored);
      delete notifications[inspectionId];
      await AsyncStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(notifications));
    }
  } catch (error) {
    console.error('Error removing notification ID:', error);
  }
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await AsyncStorage.removeItem(NOTIFICATION_STORAGE_KEY);
  } catch (error) {
    console.error('Error canceling all notifications:', error);
  }
}


