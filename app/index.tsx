import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useSegments } from 'expo-router';
import { Car, History } from 'lucide-react-native';
import { useHistory } from '@/contexts/HistoryContext';
import { useAuth } from '@/contexts/AuthContext';

export default function HomeScreen() {
  const router = useRouter();
  const segments = useSegments();
  const { history, isLoading } = useHistory();
  const { canAccessApp, isLoading: authLoading } = useAuth();

  // Gate access - redirect to auth if not subscribed
  useEffect(() => {
    if (!authLoading && !canAccessApp) {
      router.replace('/auth');
      return;
    }
  }, [canAccessApp, authLoading, router]);

  // Show loading while checking auth
  if (authLoading || !canAccessApp) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90A4" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const formatDate = (dateText: string) => {
    if (!dateText) return { date: '', time: '' };
    // dateText is already formatted, but we can extract just date and time for display
    const parts = dateText.split(',');
    if (parts.length >= 2) {
      return {
        date: parts.slice(0, -1).join(','),
        time: parts[parts.length - 1].trim(),
      };
    }
    return { date: dateText, time: '' };
  };

  const handleStartInspection = () => {
    router.push('/capture-initial');
  };

  const handleHistoryItemPress = (id: string) => {
    router.push({ pathname: '/results', params: { historyId: id } });
  };

  const renderHistoryItem = ({ item }: { item: typeof history[0] }) => {
    try {
      if (!item || !item.mainPhoto || !item.id) {
        return null;
      }
      
      const { date, time } = formatDate(item.dateText || '');
      return (
        <TouchableOpacity
          style={styles.historyItem}
          onPress={() => handleHistoryItemPress(item.id)}
          activeOpacity={0.7}
        >
          <Image 
            source={{ uri: item.mainPhoto }} 
            style={styles.historyThumbnail}
            onError={() => console.log('Failed to load image:', item.mainPhoto)}
          />
          <View style={styles.historyInfo}>
            <Text style={styles.historyDate}>{date}</Text>
            <Text style={styles.historyTime}>{time}</Text>
            <Text style={styles.historySections}>
              {item.sectionPhotos?.length || 0} sections documented
            </Text>
          </View>
        </TouchableOpacity>
      );
    } catch (error) {
      console.error('Error rendering history item:', error);
      return null;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>Rental Car Checker</Text>
        <Text style={styles.subtitle}>Document your rental vehicle condition</Text>
      </View>

      <View style={styles.startContainer}>
        <TouchableOpacity
          style={styles.startButton}
          onPress={handleStartInspection}
          activeOpacity={0.8}
        >
          <Car size={48} color="#1a4a5c" />
          <Text style={styles.startButtonText}>Start Inspection</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.historySection}>
        <View style={styles.historyHeader}>
          <History size={20} color="#4A90A4" />
          <Text style={styles.historyTitle}>Inspection History</Text>
        </View>
        {isLoading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Loading...</Text>
          </View>
        ) : history.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No inspections yet</Text>
            <Text style={styles.emptySubtext}>
              Start your first inspection to document a rental vehicle
            </Text>
          </View>
        ) : (
          <FlatList
            data={history.filter(item => item && item.mainPhoto)}
            renderItem={renderHistoryItem}
            keyExtractor={(item) => item.id}
            scrollEnabled={true}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.historyList}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a4a5c',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: '#4A90A4',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#7AB8CC',
    textAlign: 'center',
  },
  startContainer: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  startButton: {
    backgroundColor: '#4A90A4',
    borderRadius: 20,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  startButtonText: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  historySection: {
    flex: 1,
    paddingHorizontal: 20,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#4A90A4',
  },
  historyList: {
    paddingBottom: 20,
  },
  historyItem: {
    backgroundColor: '#2a5a6c',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#3a6a7c',
  },
  historyInfo: {
    flex: 1,
    marginLeft: 12,
  },
  historyDate: {
    color: '#4A90A4',
    fontSize: 16,
    fontWeight: '600' as const,
    marginBottom: 4,
  },
  historyTime: {
    color: '#7AB8CC',
    fontSize: 14,
    marginBottom: 4,
  },
  historySections: {
    color: '#9AC4D6',
    fontSize: 12,
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#4A90A4',
    fontSize: 16,
    fontWeight: '600' as const,
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#7AB8CC',
    fontSize: 14,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#4A90A4',
    fontSize: 16,
    marginTop: 16,
  },
});
