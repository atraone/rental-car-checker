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
import { Camera, ArrowLeft, Check, ArrowRight } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { analyzeWithClaude } from '@/services/claude';
import { VehicleSectionPhoto } from '@/contexts/HistoryContext';

const DAMAGE_ANALYSIS_PROMPT = (sectionName: string, isRetake: boolean, isExtra: boolean) => `You are a vehicle inspection assistant. Analyze this photo of a rental vehicle section.

The user has taken a photo of the "${sectionName}" section of their rental vehicle.
${isRetake ? '\nIMPORTANT: This is a RETAKE or ADDITIONAL photo requested after the initial inspection sequence. You MUST provide a brief 5-7 word explanation in the "retakeReason" field explaining why this additional photo is necessary.' : ''}
${isExtra ? '\nIMPORTANT: This is an EXTRA photo requested to get a better/clearer shot of serious damage identified in a previous photo. Focus on capturing the specific damage clearly.' : ''}

Your task:
1. Identify which section of the car this photo shows
2. Identify any visible flaws, damage, scratches, dents, or issues in this section
3. If the photo is unusable or shows the wrong section, flag it
${isRetake ? '4. REQUIRED: Provide a brief 5-7 word explanation of why this retake/additional photo is necessary. Examples: "Previous photo was too blurry", "Need closer view of scratch", "Wrong angle captured initially", "Lighting was insufficient", "Damage not clearly visible"' : ''}
${!isRetake && !isExtra ? '4. CRITICAL: Assess if there is SERIOUS, NOTABLE, or POTENTIALLY COSTLY damage. Only flag as serious if the damage is:\n   - Significant dents, deep scratches, or major paint damage\n   - Structural damage or broken parts\n   - Damage that would likely cost $200+ to repair\n   - NOT minor scratches, small chips, or cosmetic wear\n   DO NOT be paranoid about minor cosmetic issues. Only flag clearly serious damage.' : ''}

Return your response in JSON format:
{
  "section": "the section name you identified",
  "isCorrectSection": true or false,
  "isUsable": true or false,
  "damageNotes": "detailed description of any damage, flaws, or issues found. If none, say 'No visible damage or issues found.'"${isRetake ? ',\n  "retakeReason": "REQUIRED: brief 5-7 word explanation of why this retake/additional photo is necessary"' : ''}${!isRetake && !isExtra ? ',\n  "hasSeriousDamage": true or false,\n  "seriousDamageDescription": "if hasSeriousDamage is true, provide a brief 5-7 word description of the serious damage and its location (e.g., "Large dent on driver door", "Deep scratch on rear bumper", "Cracked headlight on passenger side")' : ''}
}

IMPORTANT: Return ONLY the JSON object, no markdown, no code blocks, no additional text. If the image does not show a vehicle section, set "isUsable" to false.${isRetake ? ' If this is a retake, the "retakeReason" field is REQUIRED.' : ''}${!isRetake && !isExtra ? ' Only set "hasSeriousDamage" to true for DEFINITELY notable, potentially costly damage. Be conservative - minor scratches or cosmetic wear should NOT trigger this.' : ''}`;

interface SectionPhoto {
  section: string;
  photoUri: string;
  photoBase64: string;
  photoMime: string;
  damageNotes?: string;
  isUsable?: boolean;
  isCorrectSection?: boolean;
  retakeReason?: string;
  isRetake?: boolean;
  isExtra?: boolean; // Extra photo triggered by serious damage
  originalSectionIndex?: number;
  originalPhotoUri?: string; // For extra photos, store the original that triggered it
  seriousDamageDescription?: string;
  hasRequestedExtra?: boolean; // Flag to prevent infinite loops
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
  const [originalSections, setOriginalSections] = useState<string[]>([]); // Track original sequence
  const [currentIndex, setCurrentIndex] = useState(0);
  const [capturedPhotos, setCapturedPhotos] = useState<SectionPhoto[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [photoTaken, setPhotoTaken] = useState(false);
  const [currentPhotoUri, setCurrentPhotoUri] = useState<string | null>(null);
  const [extraPhotoOriginal, setExtraPhotoOriginal] = useState<string | null>(null); // Original photo for extra capture

  useEffect(() => {
    if (sectionsParam) {
      try {
        const parsed = JSON.parse(sectionsParam) as string[];
        setSections(parsed);
        // Store original sections on first load
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

  // Reset photo taken state when moving to a new section
  useEffect(() => {
    setPhotoTaken(false);
    setCurrentPhotoUri(null);
    // Handle extra photo original lookup
    const currentIsExtra = sections[currentIndex]?.includes(' - Close-up');
    if (!currentIsExtra) {
      setExtraPhotoOriginal(null);
    } else {
      // Find the original photo that triggered this extra
      const originalSection = sections[currentIndex].replace(' - Close-up', '');
      const originalPhoto = capturedPhotos.find(p => 
        p.section === originalSection && 
        (p.hasRequestedExtra || p.seriousDamageDescription)
      );
      if (originalPhoto) {
        setExtraPhotoOriginal(originalPhoto.photoUri);
      }
    }
  }, [currentIndex, sections, capturedPhotos]);

  const analysisMutation = useMutation({
    mutationFn: async ({ photoBase64, photoUri, photoMime, sectionName, isRetake, isExtra }: {
      photoBase64: string;
      photoUri: string;
      photoMime: string;
      sectionName: string;
      isRetake: boolean;
      isExtra: boolean;
    }) => {
      const analysisText = await analyzeWithClaude({
        promptText: DAMAGE_ANALYSIS_PROMPT(sectionName, isRetake, isExtra),
        imageBase64: photoBase64,
        imageMime: photoMime,
      });

      let analysisResult: {
        section: string;
        isCorrectSection: boolean;
        isUsable: boolean;
        damageNotes: string;
        retakeReason?: string;
        hasSeriousDamage?: boolean;
        seriousDamageDescription?: string;
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
              retakeReason: result.retakeReason,
              seriousDamageDescription: result.seriousDamageDescription,
            }
          : p
      ));
      
      // If serious damage detected in original photo (not retake, not extra, not already requested)
      if (result.hasSeriousDamage && !variables.isRetake && !variables.isExtra) {
        const currentPhoto = capturedPhotos.find(p => p.photoUri === variables.photoUri);
        if (currentPhoto && !currentPhoto.hasRequestedExtra) {
          // Queue an extra photo for better capture
          const extraSectionName = `${variables.sectionName} - Close-up`;
          const newSections = [...sections];
          newSections.splice(currentIndex + 1, 0, extraSectionName);
          setSections(newSections);
          
          // Mark the original photo as having requested an extra
          setCapturedPhotos(prev => prev.map(p => 
            p.photoUri === variables.photoUri
              ? { ...p, hasRequestedExtra: true }
              : p
          ));
          
          // Store the original photo URI for the extra capture UI
          setExtraPhotoOriginal(variables.photoUri);
        }
      }
      
      setIsAnalyzing(false);
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
      setIsAnalyzing(false);
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
                // Mark these as retakes by storing original index
                retakeSections.forEach((section, idx) => {
                  const originalIdx = originalSections.indexOf(section);
                  if (originalIdx >= 0) {
                    // This is a retake of an original section
                  }
                });
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
        
        // Determine if this is a retake/additional photo (beyond original sequence)
        const isRetake = currentIndex >= originalSections.length;
        // Check if this is an extra photo (triggered by serious damage)
        const isExtra = extraPhotoOriginal !== null && sections[currentIndex].includes(' - Close-up');
        const originalSectionIndex = originalSections.indexOf(sections[currentIndex]);
        
        // Store photo immediately (before analysis completes)
        const newPhoto: SectionPhoto = {
          section: sections[currentIndex],
          photoUri: dataUri,
          photoBase64: photo.base64,
          photoMime: mimeType,
          isRetake,
          isExtra,
          originalSectionIndex: originalSectionIndex >= 0 ? originalSectionIndex : undefined,
          originalPhotoUri: isExtra ? extraPhotoOriginal : undefined,
        };
        setCapturedPhotos(prev => [...prev, newPhoto]);
        
        // Hide camera and show photo preview
        setPhotoTaken(true);
        setCurrentPhotoUri(dataUri);
        setIsAnalyzing(true);
        
        // Start async analysis (non-blocking) - analysis will update the photo when complete
        analysisMutation.mutate({
          photoBase64: photo.base64,
          photoUri: dataUri, // Use dataUri for matching
          photoMime: mimeType,
          sectionName: sections[currentIndex],
          isRetake,
          isExtra,
        });
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
  const hasNextSection = currentIndex < sections.length - 1;
  const isRetake = currentIndex >= originalSections.length;
  const isExtra = currentSection?.includes(' - Close-up');
  
  // Get previous and next sections for navigation context
  const previousSection = currentIndex > 0 ? sections[currentIndex - 1] : null;
  const nextSection = hasNextSection ? sections[currentIndex + 1] : null;
  
  // Get retake reason and serious damage description for current section if it exists
  const currentPhoto = capturedPhotos.find(p => p.section === currentSection);
  const retakeReason = currentPhoto?.retakeReason;
  const seriousDamageDesc = currentPhoto?.seriousDamageDescription;
  
  // Get original photo for extra captures
  const originalPhotoForExtra = isExtra ? extraPhotoOriginal : null;

  const handleNextSection = () => {
    if (hasNextSection) {
      // Clear extra photo original when moving to next section
      setExtraPhotoOriginal(null);
      setCurrentIndex(currentIndex + 1);
    } else {
      finishCapture();
    }
  };

  const handleRetakePhoto = () => {
    setPhotoTaken(false);
    setCurrentPhotoUri(null);
    // Remove the photo from capturedPhotos if it exists
    setCapturedPhotos(prev => prev.filter(p => p.section !== currentSection));
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.title, (isRetake || isExtra) && styles.titleRetake]}>
              {isExtra ? currentSection.replace(' - Close-up', '') : currentSection}
            </Text>
            <Text style={styles.progress}>
              {currentIndex + 1} of {sections.length}
              {isRetake && ' (Retake)'}
              {isExtra && ' (Extra Photo)'}
            </Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
      </SafeAreaView>

      {!photoTaken ? (
        <View style={styles.cameraContainer}>
          {/* For extra photos, show original photo above camera */}
          {isExtra && originalPhotoForExtra && (
            <View style={styles.originalPhotoContainer}>
              <Text style={styles.originalPhotoLabel}>Original Photo - {seriousDamageDesc || 'Serious Damage Detected'}</Text>
              <Image source={{ uri: originalPhotoForExtra }} style={styles.originalPhoto} />
              <Text style={styles.extraPhotoInstruction}>
                Get a closer, clearer shot of the damage shown above
              </Text>
            </View>
          )}
          
          <CameraView
            ref={cameraRef}
            style={isExtra ? styles.cameraExtra : styles.camera}
            facing="back"
            mode="picture"
          >
            <View style={styles.overlay}>
              {/* Navigation Context: Previous -> Current -> Next */}
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
                  <Text style={[styles.navSectionTextCurrent, (isRetake || isExtra) && styles.navSectionTextRetake]}>
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
                <Text style={[styles.sectionTitle, (isRetake || isExtra) && styles.sectionTitleRetake]}>
                  {isExtra ? currentSection.replace(' - Close-up', '') : currentSection}
                </Text>
                {isExtra && seriousDamageDesc && (
                  <Text style={styles.retakeReasonText}>
                    {seriousDamageDesc}
                  </Text>
                )}
                {isRetake && retakeReason && (
                  <Text style={styles.retakeReasonText}>
                    {retakeReason}
                  </Text>
                )}
                <Text style={styles.instructionText}>
                  {isExtra 
                    ? `Get a closer, clearer shot of the damage`
                    : `Position the ${currentSection.toLowerCase().replace(' - close-up', '')} in frame`}
                </Text>
              </View>
            </View>
          </CameraView>
        </View>
      ) : (
        <View style={styles.photoPreviewContainer}>
          {/* For extra photos, show original above preview */}
          {isExtra && originalPhotoForExtra && (
            <View style={styles.originalPhotoContainer}>
              <Text style={styles.originalPhotoLabel}>Original Photo - {seriousDamageDesc || 'Serious Damage Detected'}</Text>
              <Image source={{ uri: originalPhotoForExtra }} style={styles.originalPhoto} />
            </View>
          )}
          
          {currentPhotoUri && (
            <Image source={{ uri: currentPhotoUri }} style={isExtra ? styles.photoPreviewExtra : styles.photoPreview} />
          )}
          <View style={styles.photoPreviewOverlay}>
            {/* Navigation Context on Preview */}
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
                <Text style={[styles.navSectionTextCurrent, (isRetake || isExtra) && styles.navSectionTextRetake]}>
                  {isExtra ? currentSection.replace(' - Close-up', '') : currentSection}
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
            
            <View style={styles.previewInstructionContainer}>
              <Text style={styles.previewTitle}>Photo Captured</Text>
              <Text style={[styles.previewSubtitle, (isRetake || isExtra) && styles.previewSubtitleRetake]}>
                {isExtra ? currentSection.replace(' - Close-up', '') : currentSection}
              </Text>
              {isExtra && seriousDamageDesc && (
                <Text style={styles.previewRetakeReason}>{seriousDamageDesc}</Text>
              )}
              {isRetake && retakeReason && (
                <Text style={styles.previewRetakeReason}>{retakeReason}</Text>
              )}
            </View>
          </View>
        </View>
      )}

      <SafeAreaView edges={['bottom']} style={styles.bottomArea}>
        <View style={styles.captureContainer}>
          {isAnalyzing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4A90A4" />
              <Text style={styles.loadingText}>Analyzing...</Text>
            </View>
          ) : photoTaken ? (
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
                disabled={isAnalyzing}
              >
                <Camera size={32} color="#FFFFFF" />
              </TouchableOpacity>
              {capturedPhotos.length > 0 && (
                <TouchableOpacity
                  style={styles.finishButtonSmall}
                  onPress={finishCapture}
                  disabled={isAnalyzing}
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
  titleRetake: {
    color: '#FFD700', // Gold color for retakes
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
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  cameraExtra: {
    flex: 1,
    maxHeight: '60%', // Camera takes less space when showing original photo above
  },
  originalPhotoContainer: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#FFD700',
  },
  originalPhotoLabel: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '600' as const,
    marginBottom: 8,
    textAlign: 'center',
  },
  originalPhoto: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    resizeMode: 'cover',
    marginBottom: 8,
  },
  extraPhotoInstruction: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500' as const,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  sectionTitleRetake: {
    color: '#FFD700', // Gold color for retakes
  },
  retakeReasonText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '600' as const,
    textAlign: 'center',
    marginBottom: 8,
    fontStyle: 'italic',
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
    // Fade out effect using gradient-like opacity
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
  navSectionTextRetake: {
    color: '#FFD700', // Gold for retakes
  },
  navArrow: {
    marginHorizontal: 4,
    opacity: 0.6,
  },
  instructionText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600' as const,
    textAlign: 'center',
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
  photoPreviewExtra: {
    flex: 1,
    width: '100%',
    resizeMode: 'contain',
    maxHeight: '60%', // Preview takes less space when showing original above
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
  previewSubtitleRetake: {
    color: '#FFD700', // Gold for retakes
  },
  previewRetakeReason: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '600' as const,
    marginTop: 8,
    fontStyle: 'italic',
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

