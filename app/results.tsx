import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { X, Save, Plus, Calendar } from 'lucide-react-native';
import { useHistory } from '@/contexts/HistoryContext';
import { VehicleSectionPhoto } from '@/contexts/HistoryContext';
import { storeInspectionToSupabase } from '@/services/supabase';
import { scheduleReturnReminder } from '@/services/notifications';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

interface DamageNote {
  id: string;
  text: string;
}

export default function ResultsScreen() {
  const router = useRouter();
  const { mainPhoto, sectionPhotos: sectionPhotosParam, allDamageNotes, historyId } = useLocalSearchParams<{
    mainPhoto: string;
    sectionPhotos: string;
    allDamageNotes: string;
    historyId?: string;
  }>();

  const { addToHistory, getHistoryItem } = useHistory();
  const [sectionPhotos, setSectionPhotos] = useState<VehicleSectionPhoto[]>([]);
  const [damageNotes, setDamageNotes] = useState<DamageNote[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [mainPhotoUri, setMainPhotoUri] = useState<string>('');
  const [expectedReturnDate, setExpectedReturnDate] = useState<Date | null>(null);
  const [dateInputText, setDateInputText] = useState('');

  useEffect(() => {
    if (historyId) {
      // Loading from history
      const item = getHistoryItem(historyId);
      if (item) {
        setMainPhotoUri(item.mainPhoto);
        setSectionPhotos(item.sectionPhotos);
        // Parse damage notes from the combined text
        const notes = item.allDamageNotes
          .split('\n\n')
          .filter(note => note.trim())
          .map((note, index) => ({
            id: `note-${index}`,
            text: note,
          }));
        setDamageNotes(notes.length > 0 ? notes : []);
      } else {
        // Item not found, go back
        router.back();
      }
    } else if (sectionPhotosParam) {
      // New inspection
      try {
        const parsed = JSON.parse(sectionPhotosParam) as VehicleSectionPhoto[];
        setSectionPhotos(parsed);
        setMainPhotoUri(mainPhoto || '');
        
        // Parse damage notes from allDamageNotes
        if (allDamageNotes) {
          const notes = allDamageNotes.split('\n\n').map((note, index) => ({
            id: `note-${index}`,
            text: note,
          }));
          setDamageNotes(notes);
        } else {
          // Generate from section photos
          const notes = parsed.map((sp, index) => ({
            id: `note-${index}`,
            text: `${sp.section}: ${sp.damageNotes}`,
          }));
          setDamageNotes(notes);
        }
      } catch (error) {
        console.error('Failed to parse section photos:', error);
        Alert.alert('Error', 'Failed to load results');
        router.back();
      }
    }
  }, [historyId, sectionPhotosParam, allDamageNotes, mainPhoto, getHistoryItem, router]);

  const handleAddNote = () => {
    const newNote: DamageNote = {
      id: `note-${Date.now()}`,
      text: '',
    };
    setDamageNotes([...damageNotes, newNote]);
  };

  const handleRemoveNote = (id: string) => {
    setDamageNotes(damageNotes.filter(note => note.id !== id));
  };

  const handleUpdateNote = (id: string, text: string) => {
    setDamageNotes(damageNotes.map(note => 
      note.id === id ? { ...note, text } : note
    ));
  };

  const handleRemovePhoto = (section: string) => {
    setSectionPhotos(sectionPhotos.filter(sp => sp.section !== section));
  };

  const handleSave = async () => {
    if (!mainPhotoUri || sectionPhotos.length === 0) {
      Alert.alert('Error', 'Missing required information');
      return;
    }

    setIsSaving(true);

    try {
      // Combine all damage notes
      const combinedNotes = damageNotes
        .filter(note => note.text.trim())
        .map(note => note.text)
        .join('\n\n');

      // Add timestamp to main photo if needed
      let finalMainPhoto = mainPhotoUri;
      if (mainPhotoUri.startsWith('data:')) {
        // For data URIs, we'll use them as-is
        finalMainPhoto = mainPhotoUri;
      }

      // Format expected return date if provided
      let expectedReturnDateTimestamp: number | undefined;
      let expectedReturnDateText: string | undefined;
      if (expectedReturnDate) {
        expectedReturnDateTimestamp = expectedReturnDate.getTime();
        expectedReturnDateText = expectedReturnDate.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      }

      // Save to local history
      const historyId = await addToHistory({
        mainPhoto: finalMainPhoto,
        sectionPhotos: sectionPhotos,
        allDamageNotes: combinedNotes,
        expectedReturnDate: expectedReturnDateTimestamp,
        expectedReturnDateText,
      });

      // Save to Supabase (async, non-blocking)
      storeInspectionToSupabase({
        mainPhoto: finalMainPhoto,
        sectionPhotos: sectionPhotos,
        allDamageNotes: combinedNotes,
        expectedReturnDate: expectedReturnDateTimestamp,
        expectedReturnDateText,
      }).then(result => {
        if (result.success) {
          console.log('Inspection saved to Supabase:', result.inspectionId);
        } else {
          console.error('Failed to save to Supabase:', result.error);
          // Don't show error to user - local save succeeded
        }
      });

      // Schedule notification for return date if provided
      if (expectedReturnDate && expectedReturnDate.getTime() > Date.now()) {
        scheduleReturnReminder(historyId, expectedReturnDate, new Date().toLocaleDateString())
          .then(notificationId => {
            if (notificationId) {
              console.log('Return reminder scheduled:', notificationId);
            }
          })
          .catch(error => {
            console.error('Failed to schedule return reminder:', error);
            // Don't show error to user - inspection saved successfully
          });
      }

      Alert.alert('Success', 'Inspection saved to history', [
        {
          text: 'OK',
          onPress: () => router.replace('/'),
        },
      ]);
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', 'Failed to save inspection');
    } finally {
      setIsSaving(false);
    }
  };

  const addTimestampToPhoto = async (photoUri: string): Promise<string> => {
    // For now, return the URI as-is
    // In a production app, you'd overlay timestamp text on the image
    return photoUri;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>Inspection Results</Text>
        {!historyId && (
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
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Photo */}
        {mainPhotoUri && (
          <View style={styles.mainPhotoSection}>
            <Text style={styles.sectionTitle}>Main Vehicle Photo</Text>
            <Image source={{ uri: mainPhotoUri }} style={styles.mainPhoto} />
          </View>
        )}

        {/* Photo Thumbnails */}
        <View style={styles.photosSection}>
          <Text style={styles.sectionTitle}>Photos</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.thumbnailsContainer}
          >
            {sectionPhotos.map((sp, index) => (
              <View key={`${sp.section}-${index}`} style={styles.thumbnailWrapper}>
                <Image source={{ uri: sp.photoUri }} style={styles.thumbnail} />
                {!historyId && (
                  <TouchableOpacity
                    style={styles.removePhotoButton}
                    onPress={() => handleRemovePhoto(sp.section)}
                  >
                    <X size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                )}
                <Text style={styles.thumbnailLabel} numberOfLines={1}>
                  {sp.section}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Expected Return Date (Optional) */}
        {!historyId && (
          <View style={styles.returnDateSection}>
            <Text style={styles.sectionTitle}>Expected Return Date (Optional)</Text>
            <View style={styles.dateInputContainer}>
              <Calendar size={20} color="#4A90A4" />
              <TextInput
                style={styles.dateInput}
                placeholder="YYYY-MM-DD (Optional)"
                placeholderTextColor="#7AB8CC"
                value={dateInputText}
                onChangeText={(text) => {
                  setDateInputText(text);
                  if (text.trim()) {
                    // Try parsing as YYYY-MM-DD
                    const dateMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                    if (dateMatch) {
                      const date = new Date(parseInt(dateMatch[1]), parseInt(dateMatch[2]) - 1, parseInt(dateMatch[3]));
                      if (!isNaN(date.getTime())) {
                        setExpectedReturnDate(date);
                      } else {
                        setExpectedReturnDate(null);
                      }
                    } else {
                      // Try parsing as general date string
                      const date = new Date(text);
                      if (!isNaN(date.getTime()) && text.length > 5) {
                        setExpectedReturnDate(date);
                      } else {
                        setExpectedReturnDate(null);
                      }
                    }
                  } else {
                    setExpectedReturnDate(null);
                  }
                }}
                keyboardType="default"
              />
              {expectedReturnDate && (
                <TouchableOpacity
                  onPress={() => {
                    setExpectedReturnDate(null);
                    setDateInputText('');
                  }}
                  style={styles.clearDateButton}
                >
                  <X size={16} color="#FF6B6B" />
                </TouchableOpacity>
              )}
            </View>
            {expectedReturnDate && (
              <Text style={styles.datePreviewText}>
                Return date: {expectedReturnDate.toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </Text>
            )}
          </View>
        )}

        {/* Damage Notes */}
        <View style={styles.notesSection}>
          <View style={styles.notesHeader}>
            <Text style={styles.sectionTitle}>Damage Notes</Text>
            {!historyId && (
              <TouchableOpacity
                style={styles.addNoteButton}
                onPress={handleAddNote}
              >
                <Plus size={20} color="#4A90A4" />
              </TouchableOpacity>
            )}
          </View>

          {damageNotes.length === 0 ? (
            <View style={styles.emptyNotes}>
              <Text style={styles.emptyNotesText}>No damage notes</Text>
            </View>
          ) : (
            damageNotes.map((note) => (
              <View key={note.id} style={styles.noteItem}>
                {historyId ? (
                  <Text style={styles.noteText}>{note.text}</Text>
                ) : (
                  <>
                    <TextInput
                      style={styles.noteInput}
                      value={note.text}
                      onChangeText={(text) => handleUpdateNote(note.id, text)}
                      placeholder="Enter damage note..."
                      placeholderTextColor="#7AB8CC"
                      multiline
                    />
                    <TouchableOpacity
                      style={styles.removeNoteButton}
                      onPress={() => handleRemoveNote(note.id)}
                    >
                      <X size={18} color="#FF6B6B" />
                    </TouchableOpacity>
                  </>
                )}
              </View>
            ))
          )}
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
  removePhotoButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailLabel: {
    marginTop: 8,
    fontSize: 12,
    color: '#7AB8CC',
    textAlign: 'center',
    maxWidth: 120,
  },
  notesSection: {
    marginBottom: 20,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  addNoteButton: {
    padding: 8,
  },
  emptyNotes: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyNotesText: {
    color: '#7AB8CC',
    fontSize: 14,
  },
  noteItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#2a5a6c',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  noteInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 24,
    minHeight: 60,
  },
  noteText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 24,
  },
  removeNoteButton: {
    padding: 4,
  },
  bottomSpacer: {
    height: 40,
  },
  returnDateSection: {
    marginBottom: 32,
  },
  dateInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a5a6c',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  dateInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
  },
  datePreviewText: {
    color: '#7AB8CC',
    fontSize: 14,
    marginTop: 8,
    fontStyle: 'italic',
  },
  clearDateButton: {
    padding: 4,
  },
});

