import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Camera, Check } from 'lucide-react-native';

interface Section {
  name: string;
  completed: boolean;
  needsRetake?: boolean;
}

export default function SectionListScreen() {
  const router = useRouter();
  const { mainPhoto, sections: sectionsParam } = useLocalSearchParams<{
    mainPhoto: string;
    sections: string;
  }>();
  
  const [sections, setSections] = useState<Section[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (sectionsParam) {
      try {
        const parsed = JSON.parse(sectionsParam) as string[];
        setSections(parsed.map(name => ({ name, completed: false })));
      } catch (error) {
        console.error('Failed to parse sections:', error);
        router.back();
      }
    }
  }, [sectionsParam, router]);

  const handleStartCapture = () => {
    if (sections.length === 0) return;
    
    router.push({
      pathname: '/capture-section',
      params: {
        mainPhoto: mainPhoto || '',
        sections: JSON.stringify(sections),
        currentIndex: '0',
      },
    });
  };

  const renderSection = ({ item, index }: { item: Section; index: number }) => {
    if (!item || typeof item !== 'object' || !item.name) {
      return null;
    }
    
    return (
      <View style={[styles.sectionItem, item.completed && styles.sectionItemCompleted]}>
        <View style={styles.sectionNumber}>
          <Text style={styles.sectionNumberText}>{index + 1}</Text>
        </View>
        <Text style={[styles.sectionName, item.completed && styles.sectionNameCompleted]}>
          {String(item.name)}
        </Text>
        {item.completed && (
          <Check size={20} color="#4A90A4" style={styles.checkIcon} />
        )}
        {item.needsRetake && (
          <Text style={styles.retakeLabel}>Needs Retake</Text>
        )}
      </View>
    );
  };

  if (sections.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#4A90A4" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#4A90A4" />
        </TouchableOpacity>
        <Text style={styles.title}>Document Sections</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <Text style={styles.instruction}>
          Please take photos of each section listed below. You'll be guided through each one.
        </Text>

        <View style={styles.sectionsList}>
          {sections.map((section, index) => renderSection({ item: section, index }))}
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.startButton}
          onPress={handleStartCapture}
        >
          <Camera size={20} color="#FFFFFF" />
          <Text style={styles.startButtonText}>Start Capturing</Text>
        </TouchableOpacity>
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
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  instruction: {
    fontSize: 16,
    color: '#7AB8CC',
    marginBottom: 24,
    lineHeight: 24,
  },
  sectionsList: {
    flex: 1,
    paddingBottom: 20,
  },
  sectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a5a6c',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  sectionItemCompleted: {
    backgroundColor: '#1a6a4c',
  },
  sectionNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4A90A4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sectionNumberText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700' as const,
  },
  sectionName: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  sectionNameCompleted: {
    color: '#7AB8CC',
    textDecorationLine: 'line-through',
  },
  checkIcon: {
    marginLeft: 8,
  },
  retakeLabel: {
    fontSize: 12,
    color: '#FF6B6B',
    marginLeft: 8,
    fontWeight: '600' as const,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#2a5a6c',
  },
  startButton: {
    backgroundColor: '#4A90A4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700' as const,
  },
});

