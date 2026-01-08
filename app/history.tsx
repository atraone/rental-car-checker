import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Trash2, ArrowLeft, X } from 'lucide-react-native';
import { useHistory } from '@/contexts/HistoryContext';

export default function HistoryScreen() {
  const router = useRouter();
  const { historyId } = useLocalSearchParams<{ historyId?: string }>();
  const { history, deleteFromHistory, getHistoryItem } = useHistory();

  const item = historyId ? getHistoryItem(historyId) : null;

  const handleDelete = (id: string) => {
    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => {
          deleteFromHistory(id);
          router.back();
        }},
      ]
    );
  };

  if (item) {
    // Detail view for a specific history item
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#4A9FB8" />
          </TouchableOpacity>
          <Text style={styles.title}>Vehicle Check Details</Text>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDelete(item.id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Trash2 size={20} color="#4A9FB8" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.mainPhotoContainer}>
            <Image source={{ uri: item.mainPhoto }} style={styles.mainPhoto} />
            <Text style={styles.dateText}>{item.dateText}</Text>
          </View>

          <Text style={styles.sectionTitle}>Section Photos</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbnailsContainer}>
            {item.sectionPhotos.map((sectionPhoto, index) => (
              <View key={index} style={styles.thumbnailWrapper}>
                <Image source={{ uri: sectionPhoto.photoUri }} style={styles.thumbnail} />
                <Text style={styles.thumbnailLabel}>{sectionPhoto.section}</Text>
              </View>
            ))}
          </ScrollView>

          <Text style={styles.damageTitle}>Damage Notes</Text>
          <View style={styles.damageNotesContainer}>
            <Text style={styles.damageNotesText}>{item.allDamageNotes || 'No damage documented'}</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // List view (not used in current flow, but kept for compatibility)
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#4A9FB8" />
        </TouchableOpacity>
        <Text style={styles.title}>History</Text>
        <View style={styles.headerSpacer} />
      </View>
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>No history items</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2E5A6B',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#4A9FB8',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  deleteButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  mainPhotoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  mainPhoto: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    backgroundColor: '#2E5A6B',
    marginBottom: 12,
  },
  dateText: {
    color: '#4A9FB8',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: '#4A9FB8',
    marginBottom: 16,
  },
  thumbnailsContainer: {
    marginBottom: 24,
  },
  thumbnailWrapper: {
    marginRight: 12,
    alignItems: 'center',
  },
  thumbnail: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: '#2E5A6B',
  },
  thumbnailLabel: {
    color: '#8BB3C0',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  damageTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: '#4A9FB8',
    marginBottom: 12,
  },
  damageNotesContainer: {
    backgroundColor: '#2E5A6B',
    borderRadius: 8,
    padding: 16,
  },
  damageNotesText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  emptyText: {
    color: '#4A9FB8',
    fontSize: 18,
    fontWeight: '600' as const,
  },
});
