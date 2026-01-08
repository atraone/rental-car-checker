import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PrivacyPolicyScreen() {
  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Privacy Policy</Text>
        <Text style={styles.lastUpdated}>Last Updated: January 2025</Text>

        <Text style={styles.sectionTitle}>1. Information We Collect</Text>
        <Text style={styles.paragraph}>
          Rental Car Checker stores inspection photos and damage notes locally on your device only. 
          We do not collect, store, or retain any personal information, photos, or data on our servers. 
          All photo processing occurs in real-time and is not saved to our servers.
        </Text>

        <Text style={styles.sectionTitle}>2. Third-Party Services</Text>
        <Text style={styles.paragraph}>
          This app uses third-party AI services to analyze vehicle photos. When you submit a photo for analysis, 
          it is temporarily processed by these external services. We cannot control how third-party 
          services handle data once it leaves our app. By using this app, you acknowledge and accept 
          this limitation.
        </Text>

        <Text style={styles.sectionTitle}>3. Data Storage</Text>
        <Text style={styles.paragraph}>
          All inspection photos and damage notes are stored locally on your device using secure local storage. 
          We do not store any images, analysis results, or personal data on our servers. All processing 
          is done on-demand, and no data is transmitted to our servers.
        </Text>

        <Text style={styles.sectionTitle}>4. Your Consent</Text>
        <Text style={styles.paragraph}>
          By using the inspection feature, you agree to have your photos 
          processed by external AI services for damage analysis. This consent is required for each inspection session.
        </Text>

        <Text style={styles.sectionTitle}>5. Age Restrictions</Text>
        <Text style={styles.paragraph}>
          This app is not intended for use by individuals under the age of 18. By using this app, 
          you confirm that you are at least 18 years of age.
        </Text>

        <Text style={styles.sectionTitle}>6. Contact</Text>
        <Text style={styles.paragraph}>
          If you have questions about this Privacy Policy, please contact us through the app store 
          listing.
        </Text>

        <SafeAreaView edges={['bottom']}>
          <View style={styles.bottomSpacer} />
        </SafeAreaView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a4a5c',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#4A90A4',
    marginBottom: 8,
  },
  lastUpdated: {
    fontSize: 14,
    color: '#7AB8CC',
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#4A90A4',
    marginTop: 24,
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 15,
    color: '#E8F4F8',
    lineHeight: 24,
  },
  bottomSpacer: {
    height: 24,
  },
});
