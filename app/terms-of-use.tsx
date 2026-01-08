import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TermsOfUseScreen() {
  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Terms of Use</Text>
        <Text style={styles.lastUpdated}>Last Updated: January 2025</Text>

        <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
        <Text style={styles.paragraph}>
          By downloading, installing, or using Rental Car Checker, you agree to be bound by these Terms 
          of Use. If you do not agree to these terms, do not use this app.
        </Text>

        <Text style={styles.sectionTitle}>2. Age Requirements</Text>
        <Text style={styles.paragraph}>
          You must be at least 18 years of age to use this app. By using this app, you represent 
          and warrant that you are at least 18 years old. Users under 18 are strictly prohibited 
          from using this service.
        </Text>

        <Text style={styles.sectionTitle}>3. Permitted Use</Text>
        <Text style={styles.paragraph}>
          This app is intended for personal use to document rental vehicle condition. You agree to use the app 
          only for lawful purposes and in accordance with these Terms.
        </Text>

        <Text style={styles.sectionTitle}>4. Prohibited Content</Text>
        <Text style={styles.paragraph}>
          You may not submit images containing:{'\n'}
          • Non-vehicle content{'\n'}
          • Illegal or harmful content{'\n'}
          • Content that violates others&apos; rights{'\n\n'}
          The AI system may refuse to process such content.
        </Text>

        <Text style={styles.sectionTitle}>5. Consent to AI Analysis</Text>
        <Text style={styles.paragraph}>
          By using the inspection feature, you explicitly consent to 
          having your photos analyzed by external AI services. You understand that this involves 
          transmitting your images to third-party servers.
        </Text>

        <Text style={styles.sectionTitle}>6. Disclaimer of Warranties</Text>
        <Text style={styles.paragraph}>
          This app is provided &quot;as is&quot; without warranties of any kind. The damage analysis provided is 
          for informational purposes only and should not be considered a substitute for professional 
          vehicle inspection. We make no guarantees about the accuracy or completeness of the 
          AI-generated analysis. Always verify damage with the rental company.
        </Text>

        <Text style={styles.sectionTitle}>7. Limitation of Liability</Text>
        <Text style={styles.paragraph}>
          We are not liable for any damages arising from your use of this app, including but not 
          limited to direct, indirect, incidental, or consequential damages. We are not responsible 
          for how third-party AI services process or handle your data.
        </Text>

        <Text style={styles.sectionTitle}>8. Third-Party Services</Text>
        <Text style={styles.paragraph}>
          This app relies on third-party AI services to function. We cannot control and are not 
          responsible for the actions, policies, or practices of these third parties. Your use of 
          this app constitutes acceptance of this limitation.
        </Text>

        <Text style={styles.sectionTitle}>9. Changes to Terms</Text>
        <Text style={styles.paragraph}>
          We reserve the right to modify these Terms at any time. Continued use of the app after 
          changes constitutes acceptance of the new Terms.
        </Text>

        <Text style={styles.sectionTitle}>10. Contact</Text>
        <Text style={styles.paragraph}>
          For questions about these Terms, please contact us through the app store listing.
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
