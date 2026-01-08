/**
 * Counter Claim Screen
 * 
 * Allows users to dispute rental car damage claims by:
 * 1. Selecting a history item
 * 2. Uploading rental company documents
 * 3. Adding optional text
 * 4. Generating a PDF counter-claim letter using AI
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Upload, FileText, Download, X, Check } from 'lucide-react-native';
import { useHistory } from '@/contexts/HistoryContext';
import { HistoryItem } from '@/contexts/HistoryContext';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { analyzeWithClaude } from '@/services/claude';
import { generateCounterClaimPDF, generateCounterClaimPDFFromText } from '@/services/pdfGenerator';

type Step = 'select-history' | 'upload-files' | 'add-text' | 'generating' | 'result';

export default function CounterClaimScreen() {
  const router = useRouter();
  const { history } = useHistory();
  
  const [currentStep, setCurrentStep] = useState<Step>('select-history');
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<HistoryItem | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<DocumentPicker.DocumentPickerAsset[]>([]);
  const [claimText, setClaimText] = useState('');
  const [generatedPDFUri, setGeneratedPDFUri] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleSelectHistory = (item: HistoryItem) => {
    setSelectedHistoryItem(item);
    setCurrentStep('upload-files');
  };

  const handleUploadFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets) {
        setUploadedFiles(prev => [...prev, ...result.assets]);
      }
    } catch (error) {
      console.error('Error picking documents:', error);
      Alert.alert('Error', 'Failed to select files');
    }
  };

  const handleRemoveFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleNextToText = () => {
    setCurrentStep('add-text');
  };

  const handleGenerate = async () => {
    if (!selectedHistoryItem) {
      Alert.alert('Error', 'Please select a history item');
      return;
    }

    setIsGenerating(true);
    setCurrentStep('generating');

    try {
      // Step 1: Generate PDF from history item
      const historyPDFUri = await generateCounterClaimPDF(selectedHistoryItem);
      
      // Step 2: Prepare files for AI
      const filesToSend: Array<{ uri: string; type: string; name: string }> = [
        { uri: historyPDFUri, type: 'application/pdf', name: 'inspection-report.pdf' },
      ];

      // Add uploaded files
      for (const file of uploadedFiles) {
        filesToSend.push({
          uri: file.uri,
          type: file.mimeType || 'application/octet-stream',
          name: file.name || 'uploaded-file',
        });
      }

      // Step 3: Read file contents as base64
      const fileContents = await Promise.all(
        filesToSend.map(async (file) => {
          const base64 = await FileSystem.readAsStringAsync(file.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          return {
            name: file.name,
            type: file.type,
            base64,
          };
        })
      );

      // Step 4: Create AI prompt
      const prompt = createCounterClaimPrompt(
        selectedHistoryItem,
        claimText,
        fileContents.map(f => f.name)
      );

      // Step 5: Send to Claude with inspection data
      // Extract base64 from main photo (remove data URI prefix if present)
      let mainPhotoBase64 = selectedHistoryItem.mainPhoto;
      let mainPhotoMime = 'image/jpeg';
      
      if (mainPhotoBase64.startsWith('data:')) {
        const match = mainPhotoBase64.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          mainPhotoMime = match[1];
          mainPhotoBase64 = match[2];
        } else {
          // Fallback: try to extract base64 part
          const parts = mainPhotoBase64.split(',');
          if (parts.length > 1) {
            mainPhotoBase64 = parts[parts.length - 1];
          }
        }
      }
      
      const analysisResult = await analyzeWithClaude({
        promptText: prompt,
        imageBase64: mainPhotoBase64,
        imageMime: mainPhotoMime,
      });

      // Step 6: Generate PDF from AI response
      const counterClaimPDFUri = await generateCounterClaimPDFFromText(
        analysisResult,
        selectedHistoryItem
      );

      setGeneratedPDFUri(counterClaimPDFUri);
      setCurrentStep('result');
    } catch (error) {
      console.error('Error generating counter claim:', error);
      Alert.alert('Error', 'Failed to generate counter claim letter');
      setCurrentStep('add-text');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!generatedPDFUri) return;

    try {
      if (Platform.OS === 'web') {
        // For web, create download link
        const link = document.createElement('a');
        link.href = generatedPDFUri;
        link.download = 'counter-claim-letter.pdf';
        link.click();
      } else {
        // For mobile, use sharing
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(generatedPDFUri);
        } else {
          Alert.alert('Error', 'Sharing is not available on this device');
        }
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      Alert.alert('Error', 'Failed to download PDF');
    }
  };

  const handleStartOver = () => {
    setSelectedHistoryItem(null);
    setUploadedFiles([]);
    setClaimText('');
    setGeneratedPDFUri(null);
    setCurrentStep('select-history');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#4A90A4" />
        </TouchableOpacity>
        <Text style={styles.title}>Dispute Damage Claim</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* Step 1: Select History Item */}
        {currentStep === 'select-history' && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Step 1: Select Inspection</Text>
            <Text style={styles.stepDescription}>
              Choose the inspection that relates to this damage claim
            </Text>
            {history.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No inspections found</Text>
                <Text style={styles.emptySubtext}>
                  Complete an inspection first to dispute a claim
                </Text>
              </View>
            ) : (
              <View style={styles.historyList}>
                {history.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.historyCard}
                    onPress={() => handleSelectHistory(item)}
                  >
                    <Image source={{ uri: item.mainPhoto }} style={styles.historyThumbnail} />
                    <View style={styles.historyInfo}>
                      <Text style={styles.historyDate}>{item.dateText}</Text>
                      <Text style={styles.historySections}>
                        {item.sectionPhotos.length} sections documented
                      </Text>
                    </View>
                    <Check size={20} color="#4A90A4" style={styles.checkIcon} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Step 2: Upload Files */}
        {currentStep === 'upload-files' && selectedHistoryItem && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Step 2: Upload Rental Company Documents</Text>
            <Text style={styles.stepDescription}>
              Upload the damage claim document(s) from the rental company
            </Text>

            {/* History Summary */}
            <View style={styles.historySummary}>
              <Text style={styles.summaryTitle}>Selected Inspection</Text>
              <Image source={{ uri: selectedHistoryItem.mainPhoto }} style={styles.summaryThumbnail} />
              <Text style={styles.summaryDate}>{selectedHistoryItem.dateText}</Text>
              <Text style={styles.summarySections}>
                {selectedHistoryItem.sectionPhotos.length} sections documented
              </Text>
            </View>

            <TouchableOpacity style={styles.uploadButton} onPress={handleUploadFiles}>
              <Upload size={24} color="#FFFFFF" />
              <Text style={styles.uploadButtonText}>Select Files</Text>
            </TouchableOpacity>

            {uploadedFiles.length > 0 && (
              <View style={styles.filesList}>
                {uploadedFiles.map((file, index) => (
                  <View key={index} style={styles.fileItem}>
                    <FileText size={20} color="#4A90A4" />
                    <Text style={styles.fileName} numberOfLines={1}>
                      {file.name}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleRemoveFile(index)}
                      style={styles.removeFileButton}
                    >
                      <X size={18} color="#FF6B6B" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setCurrentStep('select-history')}
              >
                <Text style={styles.secondaryButtonText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleNextToText}
              >
                <Text style={styles.primaryButtonText}>Next</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Step 3: Add Text */}
        {currentStep === 'add-text' && selectedHistoryItem && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Step 3: Additional Information (Optional)</Text>
            <Text style={styles.stepDescription}>
              Add any additional context or information about the dispute
            </Text>

            <TextInput
              style={styles.textInput}
              placeholder="Enter any additional information about the dispute..."
              placeholderTextColor="#7AB8CC"
              value={claimText}
              onChangeText={setClaimText}
              multiline
              numberOfLines={8}
              textAlignVertical="top"
            />

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setCurrentStep('upload-files')}
              >
                <Text style={styles.secondaryButtonText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleGenerate}
                disabled={isGenerating}
              >
                <Text style={styles.primaryButtonText}>Generate Counter Claim</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Step 4: Generating */}
        {currentStep === 'generating' && (
          <View style={styles.stepContainer}>
            <ActivityIndicator size="large" color="#4A90A4" />
            <Text style={styles.generatingText}>Generating counter claim letter...</Text>
            <Text style={styles.generatingSubtext}>
              This may take a minute. Analyzing your inspection and rental company documents.
            </Text>
          </View>
        )}

        {/* Step 5: Result */}
        {currentStep === 'result' && generatedPDFUri && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Counter Claim Letter Generated</Text>
            <Text style={styles.stepDescription}>
              Review the letter below and download or share it
            </Text>

            {/* PDF Viewer */}
            <View style={styles.pdfContainer}>
              {Platform.OS === 'web' && generatedPDFUri ? (
                <iframe
                  src={generatedPDFUri}
                  style={styles.pdfFrame}
                  title="Counter Claim Letter"
                />
              ) : (
                <View style={styles.pdfPlaceholderContainer}>
                  <FileText size={48} color="#4A90A4" />
                  <Text style={styles.pdfPlaceholder}>
                    PDF Generated Successfully
                  </Text>
                  <Text style={styles.pdfInfo}>
                    Your counter claim letter is ready to download or share.
                  </Text>
                </View>
              )}
            </View>

            <TouchableOpacity style={styles.downloadButton} onPress={handleDownload}>
              <Download size={24} color="#FFFFFF" />
              <Text style={styles.downloadButtonText}>Download Counter Claim</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={handleStartOver}>
              <Text style={styles.secondaryButtonText}>Create Another</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function createCounterClaimPrompt(
  historyItem: HistoryItem,
  additionalText: string,
  uploadedFileNames: string[]
): string {
  return `You are a legal assistant helping to dispute a rental car damage claim.

The user has provided:
1. A complete vehicle inspection report from ${historyItem.dateText}
2. Rental company claim document(s): ${uploadedFileNames.join(', ')}
3. Additional context: ${additionalText || 'None provided'}

Your task:
1. Analyze the rental company's damage claim
2. Compare it with the inspection evidence from ${historyItem.dateText}
3. Identify specific discrepancies or evidence that disputes the claim
4. Reference the exact photos and sections from the inspection
5. Create a professional, legally-sound counter-claim letter

The inspection included:
- Main vehicle photo
- ${historyItem.sectionPhotos.length} section photos with damage notes
- Detailed analysis: ${historyItem.allDamageNotes.substring(0, 500)}...

Generate a comprehensive counter-claim letter that:
- Is addressed to the rental car company
- References the specific date of inspection (${historyItem.dateText})
- Cites the relevant photos and evidence
- Disputes the claim with specific evidence
- Is professional and legally appropriate
- Includes all relevant details from the inspection

Format the response as a complete letter ready to be converted to PDF.`;
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
    borderBottomColor: '#2a5a6c',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#4A90A4',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  stepContainer: {
    marginBottom: 32,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#4A90A4',
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 16,
    color: '#7AB8CC',
    marginBottom: 24,
    lineHeight: 24,
  },
  historyList: {
    gap: 12,
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a5a6c',
    borderRadius: 12,
    padding: 16,
  },
  historyThumbnail: {
    width: 60,
    height: 60,
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
  historySections: {
    color: '#7AB8CC',
    fontSize: 14,
  },
  checkIcon: {
    marginLeft: 12,
  },
  historySummary: {
    backgroundColor: '#2a5a6c',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#4A90A4',
    marginBottom: 12,
  },
  summaryThumbnail: {
    width: 120,
    height: 120,
    borderRadius: 12,
    marginBottom: 12,
  },
  summaryDate: {
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 4,
  },
  summarySections: {
    color: '#7AB8CC',
    fontSize: 14,
  },
  uploadButton: {
    backgroundColor: '#4A90A4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 16,
  },
  uploadButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700' as const,
  },
  filesList: {
    gap: 8,
    marginBottom: 24,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a5a6c',
    borderRadius: 8,
    padding: 12,
    gap: 12,
  },
  fileName: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
  },
  removeFileButton: {
    padding: 4,
  },
  textInput: {
    backgroundColor: '#2a5a6c',
    borderRadius: 12,
    padding: 16,
    color: '#FFFFFF',
    fontSize: 16,
    minHeight: 150,
    marginBottom: 24,
    textAlignVertical: 'top',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#4A90A4',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700' as const,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#2a5a6c',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4A90A4',
  },
  secondaryButtonText: {
    color: '#4A90A4',
    fontSize: 18,
    fontWeight: '600' as const,
  },
  generatingText: {
    color: '#4A90A4',
    fontSize: 18,
    fontWeight: '600' as const,
    marginTop: 16,
    textAlign: 'center',
  },
  generatingSubtext: {
    color: '#7AB8CC',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  pdfContainer: {
    backgroundColor: '#2a5a6c',
    borderRadius: 12,
    padding: 24,
    minHeight: 400,
    marginBottom: 24,
    overflow: 'hidden',
  },
  pdfFrame: {
    width: '100%',
    height: 600,
    border: 'none',
    borderRadius: 8,
  } as any,
  pdfPlaceholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 400,
  },
  pdfPlaceholder: {
    color: '#4A90A4',
    fontSize: 20,
    fontWeight: '700' as const,
    marginTop: 16,
    marginBottom: 8,
  },
  pdfInfo: {
    color: '#7AB8CC',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  downloadButton: {
    backgroundColor: '#4A90A4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    borderRadius: 12,
    gap: 12,
    marginBottom: 12,
  },
  downloadButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700' as const,
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#4A90A4',
    fontSize: 18,
    fontWeight: '600' as const,
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#7AB8CC',
    fontSize: 14,
    textAlign: 'center',
  },
});

