import React, { useState, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Alert } from 'react-native';
import { RNCamera } from 'react-native-camera';
import { useNavigation } from '@react-navigation/native';

export default function CameraScreen() {
  const [isRecording, setIsRecording] = useState(false);
  const cameraRef = useRef<any>(null);
  const navigation = useNavigation();

  const handleRecordButtonPress = async () => {
    if (isRecording) {
      // Stop recording
      cameraRef.current.stopRecording();
    } else {
      // Start recording
      try {
        const data = await cameraRef.current.recordAsync({
          maxDuration: 300, // 5 minutes max
          quality: RNCamera.Constants.VideoQuality['1080p'],
        });
        
        // Navigate to upload screen with video URI
        navigation.navigate('Upload', { videoUri: data.uri });
      } catch (error) {
        Alert.alert('Error', 'Failed to record video');
      }
    }
    setIsRecording(!isRecording);
  };

  return (
    <View style={styles.container}>
      <RNCamera
        ref={cameraRef}
        style={styles.camera}
        type={RNCamera.Constants.Type.back}
        flashMode={RNCamera.Constants.FlashMode.off}
        captureAudio={true}
        onRecordingStart={() => setIsRecording(true)}
        onRecordingEnd={() => setIsRecording(false)}
      />
      
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.recordButton, isRecording && styles.recordButtonActive]}
          onPress={handleRecordButtonPress}
        >
          <View style={[styles.recordButtonInner, isRecording && styles.recordButtonInnerActive]} />
        </TouchableOpacity>
        
        <Text style={styles.recordText}>
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  camera: {
    flex: 1,
  },
  controls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  recordButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
  },
  recordButtonActive: {
    backgroundColor: 'rgba(255, 0, 0, 0.3)',
    borderColor: 'red',
  },
  recordButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'white',
  },
  recordButtonInnerActive: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'red',
  },
  recordText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 16,
  },
});