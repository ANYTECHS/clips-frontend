# ClipCash Mobile App

Mobile application for ClipCash - AI Video Clipping on the go.

## Features

- **Video Capture**: Record videos directly from camera
- **Background Uploads**: Upload videos in the background
- **Push Notifications**: Receive notifications for processing completion
- **Touch-Optimized UI**: Mobile-first design with touch interactions
- **Cross-Platform**: Available on iOS and Android

## Tech Stack

- React Native 0.72.0
- React Native Camera for video capture
- React Native Background Upload for file uploads
- Firebase Cloud Messaging for push notifications
- AsyncStorage for local data persistence

## Installation

```bash
cd mobile-app
npm install
```

## Running the App

### iOS
```bash
npm run ios
```

### Android
```bash
npm run android
```

## App Store Publishing

### iOS
1. Configure Apple Developer account
2. Set up bundle identifier and signing
3. Build for production: `react-native build-ios`
4. Upload to App Store Connect

### Android
1. Configure Google Play Developer account
2. Set up signing keys
3. Build APK/AAB: `cd android && ./gradlew assembleRelease`
4. Upload to Google Play Console

## Architecture

### Key Components

- `src/screens/` - Screen components
- `src/components/` - Reusable UI components
- `src/services/` - API and background services
- `src/hooks/` - Custom React hooks
- `src/navigation/` - Navigation configuration

### Background Upload Service

The app uses a background upload service to handle large video files without blocking the UI:

```typescript
import BackgroundUpload from 'react-native-background-upload';

const uploadVideo = async (fileUri: string) => {
  const uploadId = await BackgroundUpload.startUpload({
    url: 'https://api.clipcash.ai/upload',
    file: {
      filename: 'video.mp4',
      filepath: fileUri,
      filetype: 'video/mp4',
    },
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });
  
  return uploadId;
};
```

### Push Notifications

Push notifications are handled via Firebase Cloud Messaging:

```typescript
import messaging from '@react-native-firebase/messaging';

const setupNotifications = async () => {
  const authStatus = await messaging().requestPermission();
  const token = await messaging().getToken();
  
  // Register token with backend
  await registerPushToken(token);
  
  // Handle foreground messages
  messaging().onMessage(async remoteMessage => {
    // Show in-app notification
  });
  
  // Handle background/quit state messages
  messaging().setBackgroundMessageHandler(async remoteMessage => {
    // Handle notification when app is in background
  });
};
```

## Permissions

The app requires the following permissions:

### iOS
- Camera Usage Description
- Microphone Usage Description
- Photo Library Usage Description

### Android
- CAMERA
- RECORD_AUDIO
- READ_EXTERNAL_STORAGE
- WRITE_EXTERNAL_STORAGE
- POST_NOTIFICATIONS

## Testing

```bash
npm test
```

## Build Configuration

### Development
- Uses development API endpoints
- Debug logging enabled
- Hot reload enabled

### Production
- Uses production API endpoints
- Debug logging disabled
- Optimized builds
- Code signing configured