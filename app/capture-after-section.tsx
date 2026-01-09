import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Camera, ArrowLeft, ArrowRight } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { AfterSectionPhoto } from '@/contexts/HistoryContext';

interface SectionPhoto {
  section: string;
  photoUri: string;
  photoBase64: string;
  photoMime: string;
}

export default function CaptureAfterSectionScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();
  const { mainPhoto, sections: sectionsParam, currentIndex: currentIndexParam, historyId } = useLocalSearchParams<{
    mainPhoto: string;
    sections: string;
    currentIndex: string;
    historyId: string;
  }>();

  const [sections, setSections] = useState<string[]>([]);
  const [originalSections, setOriginalSections] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [capturedPhotos, setCapturedPhotos] = useState<SectionPhoto[]>([]);
  const [photoTaken, setPhotoTaken] = useState(false);
  const [currentPhotoUri, setCurrentPhotoUri] = useState<string | null>(null);

  useEffect(() => {
    if (sectionsParam) {
      try {
        const parsed = JSON.parse(sectionsParam) as string[];
        setSections(parsed);
        if (originalSections.length === 0) {
          setOriginalSections(parsed);
        }
      } catch (error) {
        console.error('Failed to parse sections:', error);
        router.back();
      }
    }
    if (currentIndexParam) {
      setCurrentIndex(parseInt(currentIndexParam, 10));
    }
  }, [sectionsParam, currentIndexParam, router, originalSections.length]);

  useEffect(() => {
    setPhotoTaken(false);
    setCurrentPhotoUri(null);
  }, [currentIndex]);

  const proceedToResults = () => {
    // Convert to AfterSectionPhoto format (no damage notes)
    const afterSectionPhotos: AfterSectionPhoto[] = capturedPhotos.map(p => ({
      section: p.section,
      photoUri: p.photoUri,
    }));

    router.push({
      pathname: '/results-after',
      params: {
        mainPhoto: mainPhoto || '',
        afterSectionPhotos: JSON.stringify(afterSectionPhotos),
        historyId: historyId || '',
      },
    });
  };

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current) return;
    
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.8,
      });
      
      if (photo?.base64 && photo?.uri) {
        let mimeType = 'image/jpeg';
        try {
          const imageData = atob(photo.base64);
          const bytes = new Uint8Array(imageData.length);
          for (let i = 0; i < imageData.length; i++) {
            bytes[i] = imageData.charCodeAt(i);
          }
          
          if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
            mimeType = 'image/png';
          } else if (bytes.length >= 3 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
            mimeType = 'image/jpeg';
          }
        } catch (error) {
          console.warn('Could not detect MIME type:', error);
        }
        
        const cleanBase64 = photo.base64.startsWith('data:')
          ? photo.base64.split(',')[1] || photo.base64
          : photo.base64;
        const dataUri = `data:${mimeType};base64,${cleanBase64}`;
        
        const newPhoto: SectionPhoto = {
          section: sections[currentIndex],
          photoUri: dataUri,
          photoBase64: photo.base64,
          photoMime: mimeType,
        };
        setCapturedPhotos(prev => [...prev, newPhoto]);
        
        setPhotoTaken(true);
        setCurrentPhotoUri(dataUri);
      }
    } catch (error) {
      console.error('Capture error:', error);
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
    }
  }, [currentIndex, sections]);

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4A90A4" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionText}>
            Rental Car Checker needs access to your camera to document the vehicle return.
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentSection = sections[currentIndex];
  const progress = ((currentIndex + 1) / sections.length) * 100;
  const hasNextSection = currentIndex < sections.length - 1;

  const handleNextSection = () => {
    if (hasNextSection) {
      setCurrentIndex(currentIndex + 1);
    } else {
      proceedToResults();
    }
  };

  const handleRetakePhoto = () => {
    setPhotoTaken(false);
    setCurrentPhotoUri(null);
    setCapturedPhotos(prev => prev.filter(p => p.section !== currentSection));
  };

  // Get previous and next sections for navigation context
  const previousSection = currentIndex > 0 ? sections[currentIndex - 1] : null;
  const nextSection = hasNextSection ? sections[currentIndex + 1] : null;

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.title}>Return: {currentSection}</Text>
            <Text style={styles.progress}>
              {currentIndex + 1} of {sections.length}
            </Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
      </SafeAreaView>

      {!photoTaken ? (
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
          mode="picture"
        >
          <View style={styles.overlay}>
            {/* Navigation Context */}
            <View style={styles.navigationContext}>
              {previousSection && (
                <View style={styles.navSection}>
                  <Text style={styles.navSectionText} numberOfLines={1}>
                    {previousSection}
                  </Text>
                </View>
              )}
              {previousSection && (
                <ArrowRight size={20} color="#7AB8CC" style={styles.navArrow} />
              )}
              <View style={styles.navSectionCurrent}>
                <Text style={styles.navSectionTextCurrent}>
                  {currentSection}
                </Text>
              </View>
              {nextSection && (
                <ArrowRight size={20} color="#7AB8CC" style={styles.navArrow} />
              )}
              {nextSection && (
                <View style={styles.navSection}>
                  <Text style={styles.navSectionText} numberOfLines={1}>
                    {nextSection}
                  </Text>
                </View>
              )}
            </View>
            
            <View style={styles.instructionContainer}>
              <Text style={styles.sectionTitle}>
                {currentSection}
              </Text>
              <Text style={styles.instructionText}>
                Position the {currentSection.toLowerCase()} in frame
              </Text>
              <Text style={styles.returnNote}>
                Return inspection - no damage analysis
              </Text>
            </View>
          </View>
        </CameraView>
      ) : (
        <View style={styles.photoPreviewContainer}>
          {currentPhotoUri && (
            <Image source={{ uri: currentPhotoUri }} style={styles.photoPreview} />
          )}
          <View style={styles.photoPreviewOverlay}>
            <View style={styles.previewInstructionContainer}>
              <Text style={styles.previewTitle}>Photo Captured</Text>
              <Text style={styles.previewSubtitle}>{currentSection}</Text>
            </View>
          </View>
        </View>
      )}

      <SafeAreaView edges={['bottom']} style={styles.bottomArea}>
        <View style={styles.captureContainer}>
          {photoTaken ? (
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.retakeButton}
                onPress={handleRetakePhoto}
              >
                <Text style={styles.retakeButtonText}>Retake</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.nextButton}
                onPress={handleNextSection}
              >
                <Text style={styles.nextButtonText}>
                  {hasNextSection ? 'Next Section' : 'Finish'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.captureButtonContainer}>
              <TouchableOpacity
                style={styles.captureButton}
                onPress={handleCapture}
              >
                <Camera size={32} color="#FFFFFF" />
              </TouchableOpacity>
              {capturedPhotos.length > 0 && (
                <TouchableOpacity
                  style={styles.finishButtonSmall}
                  onPress={proceedToResults}
                >
                  <Text style={styles.finishButtonText}>Finish</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  safeArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  backButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  progress: {
    fontSize: 14,
    color: '#7AB8CC',
    marginTop: 4,
  },
  headerSpacer: {
    width: 40,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4A90A4',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navigationContext: {
    position: 'absolute',
    top: 100,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingVertical: 12,
    borderRadius: 12,
    marginHorizontal: 20,
  },
  navSection: {
    maxWidth: 100,
    overflow: 'hidden',
    position: 'relative',
  },
  navSectionText: {
    color: '#7AB8CC',
    fontSize: 14,
    fontWeight: '500' as const,
    opacity: 0.4,
    textAlign: 'center',
  },
  navSectionCurrent: {
    minWidth: 120,
    paddingHorizontal: 12,
  },
  navSectionTextCurrent: {
    color: '#4A90A4',
    fontSize: 18,
    fontWeight: '700' as const,
    textAlign: 'center',
  },
  navArrow: {
    marginHorizontal: 4,
    opacity: 0.6,
  },
  instructionContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  sectionTitle: {
    color: '#4A90A4',
    fontSize: 28,
    fontWeight: '700' as const,
    textAlign: 'center',
    marginBottom: 12,
  },
  instructionText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  returnNote: {
    color: '#7AB8CC',
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 8,
  },
  photoPreviewContainer: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative',
  },
  photoPreview: {
    flex: 1,
    width: '100%',
    resizeMode: 'contain',
  },
  photoPreviewOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewInstructionContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 32,
    paddingVertical: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  previewTitle: {
    color: '#4A90A4',
    fontSize: 20,
    fontWeight: '700' as const,
    marginBottom: 8,
  },
  previewSubtitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500' as const,
  },
  bottomArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  captureContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  captureButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 20,
    gap: 12,
  },
  finishButtonSmall: {
    backgroundColor: '#2a5a6c',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#4A90A4',
  },
  finishButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4A90A4',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  retakeButton: {
    backgroundColor: '#2a5a6c',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#FF6B6B',
    flex: 1,
    marginRight: 10,
    alignItems: 'center',
  },
  retakeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  nextButton: {
    backgroundColor: '#4A90A4',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    flex: 1,
    marginLeft: 10,
    alignItems: 'center',
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700' as const,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#4A90A4',
    marginBottom: 16,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 16,
    color: '#7AB8CC',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  permissionButton: {
    backgroundColor: '#4A90A4',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700' as const,
  },
});


