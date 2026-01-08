/**
 * PDF Generator Service
 * 
 * Generates PDF documents from inspection data and AI-generated counter-claim letters.
 * Uses jsPDF for PDF creation.
 */

import { HistoryItem } from '@/contexts/HistoryContext';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

// Dynamic import for jsPDF (web) or use a React Native compatible solution
let jsPDF: any = null;

if (Platform.OS === 'web') {
  // For web, we can use jsPDF directly
  // Note: You'll need to import it properly in a web environment
}

/**
 * Generate PDF from history item inspection data
 */
export async function generateCounterClaimPDF(historyItem: HistoryItem): Promise<string> {
  try {
    // For now, create a simple text-based representation
    // In production, you'd use a proper PDF library
    
    const fileName = `inspection-report-${historyItem.id}.pdf`;
    const fileUri = `${FileSystem.documentDirectory}${fileName}`;
    
    // Create PDF content as text (placeholder - needs proper PDF generation)
    const pdfContent = createInspectionPDFContent(historyItem);
    
    // For web, create a blob URL
    if (Platform.OS === 'web') {
      const blob = new Blob([pdfContent], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      return url;
    }
    
    // For mobile, save to file system
    await FileSystem.writeAsStringAsync(fileUri, pdfContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    
    return fileUri;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
}

/**
 * Generate PDF from AI-generated counter-claim text
 */
export async function generateCounterClaimPDFFromText(
  aiText: string,
  historyItem: HistoryItem
): Promise<string> {
  try {
    const fileName = `counter-claim-${Date.now()}.pdf`;
    
    if (Platform.OS === 'web') {
      // For web, create a downloadable PDF
      const pdfContent = createCounterClaimPDFContent(aiText, historyItem);
      const blob = new Blob([pdfContent], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      return url;
    }
    
    // For mobile
    const fileUri = `${FileSystem.documentDirectory}${fileName}`;
    const pdfContent = createCounterClaimPDFContent(aiText, historyItem);
    
    await FileSystem.writeAsStringAsync(fileUri, pdfContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    
    return fileUri;
  } catch (error) {
    console.error('Error generating counter-claim PDF:', error);
    throw error;
  }
}

/**
 * Create PDF content for inspection report
 * 
 * This is a placeholder - in production, use a proper PDF library like:
 * - jsPDF (web)
 * - react-native-pdf (mobile)
 * - pdfkit (Node.js)
 */
function createInspectionPDFContent(historyItem: HistoryItem): string {
  return `
VEHICLE INSPECTION REPORT
Generated: ${new Date(historyItem.createdAt).toLocaleString()}
Inspection Date: ${historyItem.dateText}

INSPECTION SUMMARY
==================

Main Vehicle Photo: [Included in report]
Sections Documented: ${historyItem.sectionPhotos.length}

SECTION DETAILS
===============

${historyItem.sectionPhotos.map((section, index) => `
${index + 1}. ${section.section}
   Photo: [Included]
   Damage Notes: ${section.damageNotes}
   Status: ${section.isUsable ? 'Usable' : 'Needs Retake'}
`).join('\n')}

COMBINED DAMAGE NOTES
====================

${historyItem.allDamageNotes}

---
This is a placeholder PDF. In production, this would be a properly formatted PDF document.
  `.trim();
}

/**
 * Create PDF content for counter-claim letter
 */
function createCounterClaimPDFContent(aiText: string, historyItem: HistoryItem): string {
  return `
COUNTER CLAIM LETTER
====================

Date: ${new Date().toLocaleDateString()}

To: Rental Car Company
Re: Damage Claim Dispute

Dear Sir/Madam,

This letter is in response to your damage claim regarding the vehicle inspection conducted on ${historyItem.dateText}.

${aiText}

EVIDENCE REFERENCES
===================

Inspection Date: ${historyItem.dateText}
Inspection ID: ${historyItem.id}
Sections Documented: ${historyItem.sectionPhotos.length}

The following evidence supports this dispute:
${historyItem.sectionPhotos.map((section, index) => `
${index + 1}. ${section.section} - ${section.damageNotes}
`).join('')}

Please review the attached inspection report and photos which document the vehicle's condition at the time of rental.

Sincerely,
[Your Name]

---
This is a placeholder PDF. In production, this would be a properly formatted PDF document with proper styling, headers, and embedded images.
  `.trim();
}

