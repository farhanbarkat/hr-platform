import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, FlatList } from 'react-native';
import * as Location from 'expo-location';
import NetInfo from '@react-native-community/netinfo';
import { offlineQueueService } from '../services/offlineQueue.service';
import { api } from '../services/api.service';

export default function AttendanceScreen() {
  const [loading, setLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [offlineItems, setOfflineItems] = useState([]);

  useEffect(() => {
    // Monitor network changes
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(Boolean(state.isConnected));
      if (state.isConnected) {
        handleAutoSync();
      }
    });

    loadOfflineQueue();
    return () => unsubscribe();
  }, []);

  const loadOfflineQueue = async () => {
    const items = await offlineQueueService.getQueue();
    setOfflineItems(items);
  };

  const handleAutoSync = async () => {
    const result = await offlineQueueService.processQueue();
    if (result.syncedCount > 0) {
      Alert.alert('Offline Sync', `Successfully synced ${result.syncedCount} queued attendance attempt(s).`);
    }
    loadOfflineQueue();
  };

  const handleCheckIn = async (type = 'CHECK_IN') => {
    setLoading(true);
    try {
      // 1. Request GPS Permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required for attendance validation.');
        setLoading(false);
        return;
      }

      // 2. Fetch High Accuracy Location
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const payload = {
        type,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: new Date().toISOString(),
      };

      // 3. Connectivity Check
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        const queuedItem = await offlineQueueService.enqueueAttendance(payload);
        Alert.alert(
          'Network Offline',
          'No network connection detected. Your check-in has been saved locally and is marked as "Pending Sync". It will automatically submit once internet is restored.'
        );
        loadOfflineQueue();
      } else {
        await api.post('/attendance/check-in', payload);
        Alert.alert('Success', `${type === 'CHECK_IN' ? 'Check-in' : 'Check-out'} recorded successfully.`);
      }
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.message || 'Failed to record attendance.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Network Status Banner */}
      {!isConnected && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>Offline Mode: Queued actions will sync automatically</Text>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={[styles.button, styles.checkInButton]}
          onPress={() => handleCheckIn('CHECK_IN')}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Punch In</Text>}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.checkOutButton]}
          onPress={() => handleCheckIn('CHECK_OUT')}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Punch Out</Text>}
        </TouchableOpacity>
      </View>

      {/* Sync Status Section */}
      {offlineItems.length > 0 && (
        <View style={styles.queueContainer}>
          <Text style={styles.sectionHeader}>Pending Sync ({offlineItems.length})</Text>
          <FlatList
            data={offlineItems}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <View style={styles.queueCard}>
                <View>
                  <Text style={styles.queueType}>{item.payload.type}</Text>
                  <Text style={styles.queueTime}>{new Date(item.timestamp).toLocaleTimeString()}</Text>
                </View>
                <View style={styles.statusBadge}>
                  <Text style={styles.badgeText}>{item.syncStatus}</Text>
                </View>
              </View>
            )}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#F9FAFB' },
  offlineBanner: { backgroundColor: '#FEF3C7', padding: 10, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#F59E0B' },
  offlineBannerText: { color: '#92400E', fontSize: 13, textAlign: 'center', fontWeight: '500' },
  actionContainer: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginVertical: 16 },
  button: { flex: 1, paddingVertical: 16, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  checkInButton: { backgroundColor: '#10B981' },
  checkOutButton: { backgroundColor: '#EF4444' },
  btnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  queueContainer: { marginTop: 24, flex: 1 },
  sectionHeader: { fontSize: 16, fontWeight: '700', color: '#374151', marginBottom: 8 },
  queueCard: { backgroundColor: '#FFFFFF', padding: 14, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  queueType: { fontSize: 15, fontWeight: '600', color: '#111827' },
  queueTime: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  statusBadge: { backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: '#D97706', fontSize: 11, fontWeight: '700' },
});