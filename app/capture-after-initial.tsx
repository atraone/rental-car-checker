import React, { useState, useRef, useCallback } from 'react';
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
import { Camera, ArrowLeft } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { analyzeWithClaude } from '@/services/claude';

const INITIAL_PHOTO_PROMPT = `You are a vehicle inspection assistant. Analyze this photo to determine if it shows a rental vehicle and identify which sections need to be documented for RETURN inspection.

IMPORTANT: You MUST return a valid JSON object in this exact format:
{
  "isVehicle": true or false,
  "sections": ["section1", "section2", ...] or []
}

Rules:
1. If the image does NOT show a vehicle, set "isVehicle" to false and "sections" to an empty array.
2. If the image DOES show a vehicle, set "isVehicle" to true and provide a JSON array of section names in a natural walk-around sequence.
3. Arrange sections in a logical order for photographing (e.g., Front → Driver Side → Back → Passenger Side → Front Wheel → Driver Rear Wheel → Passenger Front Wheel → Passenger Rear Wheel → Interior Front → Interior Back).
4. Sections should be broad categories covering all major areas: Front, Back, Driver Side, Passenger Side, Wheels (or individual wheels), Interior Front, Interior Back, etc.
5. Return ONLY the JSON object, no markdown, no code blocks, no additional text.

Example for a vehicle:
{"isVehicle": true, "sections": ["Front", "Driver Side", "Back", "Passenger Side", "Front Wheels", "Rear Wheels", "Interior Front", "Interior Back"]}

Example for non-vehicle:
{"isVehicle": false, "sections": []}`;

export default function CaptureAfterInitialScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();
  const { historyId } = useLocalSearchParams<{ historyId: string }>();
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analysisMutation = useMutation({
    mutationFn: async ({ photoBase64, photoUri, photoMime, photoDataUri }: { 
      photoBase64: string; 
      photoUri: string; 
      photoMime: string;
      photoDataUri: string;
    }): Promise<{ sections: string[]; photoDataUri: string; isVehicle: boolean }> => {
      const analysisText = await analyzeWithClaude({
        promptText: INITIAL_PHOTO_PROMPT,
        imageBase64: photoBase64,
        imageMime: photoMime,
      });

      let sections: string[] = [];
      let isVehicle = true;
      
      try {
        let cleaned = analysisText.trim();
        cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
        let parsed: any;
        try {
          parsed = JSON.parse(cleaned);
          if (typeof parsed === 'string') {
            parsed = JSON.parse(parsed);
          }
          if (parsed && typeof parsed === 'object' && parsed.text && typeof parsed.text === 'string') {
            parsed = JSON.parse(parsed.text);
          }
        } catch (e) {
          const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
            if (typeof parsed === 'string') {
              parsed = JSON.parse(parsed);
            }
          } else {
            throw new Error('No JSON found in response');
          }
        }
        
        if (parsed && typeof parsed === 'object') {
          if (parsed.isVehicle === false) {
            isVehicle = false;
            sections = [];
          } else if (parsed.isVehicle === true && Array.isArray(parsed.sections)) {
            sections = parsed.sections;
            isVehicle = true;
          } else {
            throw new Error('Invalid response format');
          }
        } else {
          throw new Error('Response is not a valid object');
        }
        
        if (isVehicle && (!Array.isArray(sections) || sections.length === 0)) {
          throw new Error('Invalid sections array');
        }
      } catch (error) {
        console.error('Failed to parse sections:', error, 'Raw response:', analysisText);
        const lowerText = analysisText.toLowerCase();
        if (lowerText.includes("don't see") || lowerText.includes("not a vehicle") || 
            lowerText.includes("not a car") || lowerText.includes("no vehicle") ||
            lowerText.includes('"isvehicle": false') || lowerText.includes('"isvehicle":false')) {
          isVehicle = false;
          sections = [];
        } else {
          sections = ['Front', 'Back', 'Driver Side', 'Passenger Side', 'Wheels', 'Interior Front', 'Interior Back'];
        }
      }

      return { sections, photoDataUri, isVehicle };
    },
    onSuccess: (result) => {
      setIsAnalyzing(false);
      
      if (!result.isVehicle) {
        Alert.alert(
          'Not a Vehicle Detected',
          'The photo does not appear to show a vehicle. Please take a clear photo of the actual rental car.',
          [
            {
              text: 'Retake Photo',
              style: 'default',
              onPress: () => {
                setIsAnalyzing(false);
              },
            },
          ],
          { cancelable: false }
        );
        return;
      }
      
      if (result.sections.length === 0) {
        Alert.alert(
          'No Sections Found',
          'Could not identify vehicle sections. Please try taking another photo.',
          [
            {
              text: 'Retake Photo',
              onPress: () => {
                setIsAnalyzing(false);
              },
            },
          ],
          { cancelable: false }
        );
        return;
      }
      
      router.push({
        pathname: '/section-list',
        params: {
          mainPhoto: result.photoDataUri,
          sections: JSON.stringify(result.sections),
          isAfter: 'true',
          historyId: historyId || '',
        },
      });
    },
    onError: (error) => {
      console.error('Analysis error:', error);
      Alert.alert('Error', 'Failed to analyze the vehicle. Please try again.');
      setIsAnalyzing(false);
    },
  });

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current) return;
    
    setIsAnalyzing(true);
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
        
        analysisMutation.mutate({
          photoBase64: photo.base64,
          photoUri: photo.uri,
          photoMime: mimeType,
          photoDataUri: dataUri,
        });
      }
    } catch (error) {
      console.error('Capture error:', error);
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
      setIsAnalyzing(false);
    }
  }, [analysisMutation]);

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

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.title}>Return Inspection</Text>
          <View style={styles.headerSpacer} />
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
              Position the entire vehicle in frame
            </Text>
            <Text style={styles.subInstructionText}>
              This is for return inspection - no damage analysis needed
            </Text>
          </View>
        </View>
      </CameraView>

      <SafeAreaView edges={['bottom']} style={styles.bottomArea}>
        <View style={styles.captureContainer}>
          {isAnalyzing || analysisMutation.isPending ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4A90A4" />
              <Text style={styles.loadingText}>Analyzing vehicle...</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.captureButton}
              onPress={handleCapture}
              disabled={isAnalyzing || analysisMutation.isPending}
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  headerSpacer: {
    width: 40,
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
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    maxWidth: '90%',
  },
  instructionText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700' as const,
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: 8,
  },
  subInstructionText: {
    color: '#7AB8CC',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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


