import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Camera, ArrowLeft, Check } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { analyzeWithClaude } from '@/services/claude';
import { VehicleSectionPhoto } from '@/contexts/HistoryContext';

const DAMAGE_ANALYSIS_PROMPT = (sectionName: string) => `You are a vehicle inspection assistant. Analyze this photo of a rental vehicle section.

The user has taken a photo of the "${sectionName}" section of their rental vehicle.

Your task:
1. Identify which section of the car this photo shows
2. Identify any visible flaws, damage, scratches, dents, or issues in this section
3. If the photo is unusable or shows the wrong section, flag it

Return your response in JSON format:
{
  "section": "the section name you identified",
  "isCorrectSection": true or false,
  "isUsable": true or false,
  "damageNotes": "detailed description of any damage, flaws, or issues found. If none, say 'No visible damage or issues found.'"
}

Return ONLY the JSON object, no other text.`;

interface SectionPhoto {
  section: string;
  photoUri: string;
  photoBase64: string;
  photoMime: string;
  damageNotes?: string;
  isUsable?: boolean;
  isCorrectSection?: boolean;
}

export default function CaptureSectionScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();
  const { mainPhoto, sections: sectionsParam, currentIndex: currentIndexParam } = useLocalSearchParams<{
    mainPhoto: string;
    sections: string;
    currentIndex: string;
  }>();

  const [sections, setSections] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [capturedPhotos, setCapturedPhotos] = useState<SectionPhoto[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    if (sectionsParam) {
      try {
        const parsed = JSON.parse(sectionsParam) as string[];
        setSections(parsed);
      } catch (error) {
        console.error('Failed to parse sections:', error);
        router.back();
      }
    }
    if (currentIndexParam) {
      setCurrentIndex(parseInt(currentIndexParam, 10));
    }
  }, [sectionsParam, currentIndexParam, router]);

  const analysisMutation = useMutation({
    mutationFn: async ({ photoBase64, photoUri, photoMime, sectionName }: {
      photoBase64: string;
      photoUri: string;
      photoMime: string;
      sectionName: string;
    }) => {
      const analysisText = await analyzeWithClaude({
        promptText: DAMAGE_ANALYSIS_PROMPT(sectionName),
        imageBase64: photoBase64,
        imageMime: photoMime,
      });

      let analysisResult: {
        section: string;
        isCorrectSection: boolean;
        isUsable: boolean;
        damageNotes: string;
      } = {
        section: sectionName,
        isCorrectSection: true,
        isUsable: true,
        damageNotes: 'No visible damage or issues found.',
      };

      try {
        // Remove markdown code blocks if present
        let cleaned = analysisText.trim();
        cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
        // Try to extract JSON object from the response
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          // Validate required fields
          if (typeof parsed.isUsable === 'boolean' && typeof parsed.isCorrectSection === 'boolean' && typeof parsed.damageNotes === 'string') {
            analysisResult = parsed;
          }
        }
      } catch (error) {
        console.error('Failed to parse analysis:', error);
      }

      return { ...analysisResult, photoUri, photoBase64, photoMime };
    },
    onSuccess: (result, variables) => {
      // Update the photo with analysis results
      setCapturedPhotos(prev => prev.map(p => 
        p.section === variables.sectionName && p.photoUri === variables.photoUri
          ? {
              ...p,
              damageNotes: result.damageNotes,
              isUsable: result.isUsable,
              isCorrectSection: result.isCorrectSection,
            }
          : p
      ));
    },
    onError: (error, variables) => {
      console.error('Analysis error:', error);
      // Update photo with error message
      setCapturedPhotos(prev => prev.map(p => 
        p.section === variables.sectionName && p.photoUri === variables.photoUri
          ? {
              ...p,
              damageNotes: 'Analysis failed. Please review manually.',
              isUsable: true,
              isCorrectSection: true,
            }
          : p
      ));
    },
  });

  const finishCapture = () => {
    // Wait a bit for any pending analyses to complete
    setTimeout(() => {
      // Check if any photos need retake
      const needsRetakePhotos = capturedPhotos.filter(
        p => p.isUsable === false || p.isCorrectSection === false
      );

      if (needsRetakePhotos.length > 0) {
        const retakeSections = needsRetakePhotos.map(p => p.section);
        Alert.alert(
          'Some Photos Need Retake',
          `The following sections need to be retaken: ${retakeSections.join(', ')}`,
          [
            {
              text: 'Retake Now',
              onPress: () => {
                // Add retake sections to the list and restart
                const allSections = [...sections, ...retakeSections];
                setSections(allSections);
                setCurrentIndex(sections.length);
                // Remove the photos that need retake
                setCapturedPhotos(prev => prev.filter(p => !retakeSections.includes(p.section)));
              },
            },
            {
              text: 'Continue Anyway',
              onPress: () => {
                proceedToResults();
              },
            },
          ]
        );
      } else {
        proceedToResults();
      }
    }, 2000); // Wait 2 seconds for analyses to complete
  };

  const proceedToResults = () => {
    // Convert to VehicleSectionPhoto format
    const sectionPhotos: VehicleSectionPhoto[] = capturedPhotos.map(p => ({
      section: p.section,
      photoUri: p.photoUri,
      damageNotes: p.damageNotes || 'No analysis available',
      isUsable: p.isUsable ?? true,
      needsRetake: !p.isUsable || !p.isCorrectSection,
    }));

    // Combine all damage notes
    const allDamageNotes = sectionPhotos
      .map(sp => `${sp.section}: ${sp.damageNotes}`)
      .join('\n\n');

    router.push({
      pathname: '/results',
      params: {
        mainPhoto: mainPhoto || '',
        sectionPhotos: JSON.stringify(sectionPhotos),
        allDamageNotes,
      },
    });
  };

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || isAnalyzing) return;
    
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.8,
      });
      
      if (photo?.base64 && photo?.uri) {
        // Detect MIME type
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
        
        // Create data URI for storage
        const cleanBase64 = photo.base64.startsWith('data:')
          ? photo.base64.split(',')[1] || photo.base64
          : photo.base64;
        const dataUri = `data:${mimeType};base64,${cleanBase64}`;
        
        // Store photo immediately (before analysis completes)
        const newPhoto: SectionPhoto = {
          section: sections[currentIndex],
          photoUri: dataUri,
          photoBase64: photo.base64,
          photoMime: mimeType,
        };
        setCapturedPhotos(prev => [...prev, newPhoto]);
        
        setIsAnalyzing(true);
        
        // Start async analysis (non-blocking) - analysis will update the photo when complete
        analysisMutation.mutate({
          photoBase64: photo.base64,
          photoUri: dataUri, // Use dataUri for matching
          photoMime: mimeType,
          sectionName: sections[currentIndex],
        });

        // Move to next section immediately (don't wait for analysis)
        setIsAnalyzing(false);
        if (currentIndex < sections.length - 1) {
          setTimeout(() => {
            setCurrentIndex(currentIndex + 1);
          }, 500); // Small delay for UX
        } else {
          // Last photo - finish after a delay to allow analysis to start
          finishCapture();
        }
      }
    } catch (error) {
      console.error('Capture error:', error);
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
      setIsAnalyzing(false);
    }
  }, [currentIndex, sections, analysisMutation, isAnalyzing]);

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
            Rental Car Checker needs access to your camera to document the vehicle.
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

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.title}>{currentSection}</Text>
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

      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        mode="picture"
      >
        <View style={styles.overlay}>
          <View style={styles.instructionContainer}>
            <Text style={styles.instructionText}>
              Capture: {currentSection}
            </Text>
          </View>
        </View>
      </CameraView>

      <SafeAreaView edges={['bottom']} style={styles.bottomArea}>
        <View style={styles.captureContainer}>
          {isAnalyzing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4A90A4" />
              <Text style={styles.loadingText}>Analyzing...</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.captureButton}
              onPress={handleCapture}
              disabled={isAnalyzing}
            >
              <Camera size={32} color="#FFFFFF" />
            </TouchableOpacity>
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
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#FFFFFF',
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
  instructionContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  instructionText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600' as const,
    textAlign: 'center',
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
  loadingContainer: {
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600' as const,
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

