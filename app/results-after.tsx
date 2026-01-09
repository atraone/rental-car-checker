import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Save } from 'lucide-react-native';
import { useHistory } from '@/contexts/HistoryContext';
import { AfterSectionPhoto } from '@/contexts/HistoryContext';

export default function ResultsAfterScreen() {
  const router = useRouter();
  const { mainPhoto, afterSectionPhotos: afterSectionPhotosParam, historyId } = useLocalSearchParams<{
    mainPhoto: string;
    afterSectionPhotos: string;
    historyId: string;
  }>();

  const { getHistoryItem, updateHistoryItem } = useHistory();
  const [afterSectionPhotos, setAfterSectionPhotos] = useState<AfterSectionPhoto[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [mainPhotoUri, setMainPhotoUri] = useState<string>('');

  useEffect(() => {
    if (afterSectionPhotosParam) {
      try {
        const parsed = JSON.parse(afterSectionPhotosParam) as AfterSectionPhoto[];
        setAfterSectionPhotos(parsed);
        setMainPhotoUri(mainPhoto || '');
      } catch (error) {
        console.error('Failed to parse after section photos:', error);
        Alert.alert('Error', 'Failed to load results');
        router.back();
      }
    }
  }, [afterSectionPhotosParam, mainPhoto, router]);

  const handleSave = async () => {
    if (!mainPhotoUri || afterSectionPhotos.length === 0) {
      Alert.alert('Error', 'Missing required information');
      return;
    }

    if (!historyId) {
      Alert.alert('Error', 'Missing history ID');
      return;
    }

    setIsSaving(true);

    try {
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

      // Update the existing history item with after photos
      await updateHistoryItem(historyId, {
        afterMainPhoto: mainPhotoUri,
        afterSectionPhotos: afterSectionPhotos,
        afterCreatedAt: now,
        afterDateText: dateText,
        isReturned: true,
      });

      Alert.alert('Success', 'Return inspection saved', [
        {
          text: 'OK',
          onPress: () => router.replace('/'),
        },
      ]);
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', 'Failed to save return inspection');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>Return Inspection Results</Text>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Save size={20} color="#FFFFFF" />
              <Text style={styles.saveButtonText}>Save</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Photo */}
        {mainPhotoUri && (
          <View style={styles.mainPhotoSection}>
            <Text style={styles.sectionTitle}>Return Vehicle Photo</Text>
            <Image source={{ uri: mainPhotoUri }} style={styles.mainPhoto} />
          </View>
        )}

        {/* Photo Thumbnails */}
        <View style={styles.photosSection}>
          <Text style={styles.sectionTitle}>Return Section Photos</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.thumbnailsContainer}
          >
            {afterSectionPhotos.map((sp, index) => (
              <View key={`${sp.section}-${index}`} style={styles.thumbnailWrapper}>
                <Image source={{ uri: sp.photoUri }} style={styles.thumbnail} />
                <Text style={styles.thumbnailLabel} numberOfLines={1}>
                  {sp.section}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>

        <View style={styles.noteSection}>
          <Text style={styles.noteText}>
            Return inspection complete. No damage analysis performed for return photos.
          </Text>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a5a6c',
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#4A90A4',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4A90A4',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    gap: 8,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  mainPhotoSection: {
    marginBottom: 32,
  },
  mainPhoto: {
    width: '100%',
    height: 250,
    borderRadius: 12,
    backgroundColor: '#2a5a6c',
    resizeMode: 'cover',
  },
  photosSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: '#4A90A4',
    marginBottom: 16,
  },
  thumbnailsContainer: {
    gap: 12,
  },
  thumbnailWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  thumbnail: {
    width: 120,
    height: 120,
    borderRadius: 8,
    backgroundColor: '#2a5a6c',
    resizeMode: 'cover',
  },
  thumbnailLabel: {
    marginTop: 8,
    fontSize: 12,
    color: '#7AB8CC',
    textAlign: 'center',
    maxWidth: 120,
  },
  noteSection: {
    backgroundColor: '#2a5a6c',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  noteText: {
    color: '#7AB8CC',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  bottomSpacer: {
    height: 40,
  },
});


