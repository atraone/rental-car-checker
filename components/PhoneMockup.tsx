import { Platform, StyleSheet, View, ViewStyle, useWindowDimensions } from 'react-native';
import { ReactNode, useMemo } from 'react';

interface PhoneMockupProps {
  children: ReactNode;
}

const phoneBaseWidth = 375;
const phoneBaseHeight = 812;

export function PhoneMockup({ children }: PhoneMockupProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  // Calculate scale to fit viewport (like Rork does)
  const scale = useMemo(() => {
    if (Platform.OS !== 'web') return 1;
    return Math.min(
      windowHeight / phoneBaseHeight,
      windowWidth / phoneBaseWidth
    );
  }, [windowWidth, windowHeight]);

  if (Platform.OS !== 'web') {
    return <>{children}</>;
  }

  // On web, wrap in phone frame with scaling
  const scaledWidth = phoneBaseWidth * scale;
  const scaledHeight = phoneBaseHeight * scale;

  return (
    <View style={styles.phoneContainer}>
      <View 
        style={[
          styles.phoneFrame,
          {
            width: scaledWidth,
            height: scaledHeight,
            transform: [{ scale: 1 }], // Already scaled via dimensions
          }
        ]}
        nativeID="phone-frame"
      >
        <View style={styles.phoneScreen}>
          {children}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  phoneContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  phoneFrame: {
    width: phoneBaseWidth,
    height: phoneBaseHeight,
    backgroundColor: '#1a1a1a',
    borderRadius: 40,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 60,
    elevation: 10,
    position: 'relative',
  } as ViewStyle,
  phoneScreen: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 32,
    overflow: 'hidden',
  } as ViewStyle,
});

