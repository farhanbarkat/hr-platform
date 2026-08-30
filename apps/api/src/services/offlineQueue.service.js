import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { api } from './api.service';

const OFFLINE_ATTENDANCE_KEY = '@offline_attendance_queue';

export const offlineQueueService = {
  /**
   * Save an attendance attempt locally when offline
   */
  async enqueueAttendance(payload) {
    const queue = await this.getQueue();
    const queueItem = {
      id: `ATT_OFFLINE_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      payload,
      timestamp: new Date().toISOString(),
      syncStatus: 'PENDING_SYNC', // 'PENDING_SYNC' | 'SYNCING' | 'FAILED'
      retryCount: 0,
    };

    queue.push(queueItem);
    await AsyncStorage.setItem(OFFLINE_ATTENDANCE_KEY, JSON.stringify(queue));
    return queueItem;
  },

  /**
   * Get all queued records
   */
  async getQueue() {
    const data = await AsyncStorage.getItem(OFFLINE_ATTENDANCE_KEY);
    return data ? JSON.parse(data) : [];
  },

  /**
   * Sync all pending items when connectivity returns
   */
  async processQueue(onSyncProgress) {
    const state = await NetInfo.fetch();
    if (!state.isConnected) return { syncedCount: 0, remaining: (await this.getQueue()).length };

    const queue = await this.getQueue();
    if (queue.length === 0) return { syncedCount: 0, remaining: 0 };

    const remainingItems = [];
    let syncedCount = 0;

    for (const item of queue) {
      try {
        if (onSyncProgress) onSyncProgress(item.id, 'SYNCING');
        
        await api.post('/attendance/check-in', item.payload);
        syncedCount++;
        
        if (onSyncProgress) onSyncProgress(item.id, 'SYNCED');
      } catch (error) {
        // If server returns error, keep item and increment retry count
        item.retryCount += 1;
        item.syncStatus = 'FAILED';
        item.lastError = error?.response?.data?.message || error.message;
        remainingItems.push(item);
        
        if (onSyncProgress) onSyncProgress(item.id, 'FAILED');
      }
    }

    await AsyncStorage.setItem(OFFLINE_ATTENDANCE_KEY, JSON.stringify(remainingItems));
    return { syncedCount, remaining: remainingItems.length };
  },

  /**
   * Remove individual item
   */
  async removeItem(id) {
    const queue = await this.getQueue();
    const updated = queue.filter(item => item.id !== id);
    await AsyncStorage.setItem(OFFLINE_ATTENDANCE_KEY, JSON.stringify(updated));
  },
};