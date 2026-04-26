import React from 'react';
import { ImageBackground, View, StyleSheet } from 'react-native';

export default function Background({ children, style }) {
  return (
    <ImageBackground
      source={require('../../assets/background_mobile.png')}
      style={[styles.bg, style]}
      resizeMode="cover"
    >
      <View style={styles.overlay} />
      {children}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg:      { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(3, 7, 18, 0.87)' },
});
