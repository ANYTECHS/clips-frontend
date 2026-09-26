import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export class PushNotificationService {
  private static instance: PushNotificationService;
  private token: string | null = null;

  static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  async initialize(): Promise<void> {
    try {
      // Request permission
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (!enabled) {
        Alert.alert(
          'Notification Permission',
          'Failed to get notification permission. You may miss important updates.'
        );
        return;
      }

      // Get FCM token
      this.token = await messaging().getToken();
      await this.saveToken(this.token);

      // Register token with backend
      await this.registerTokenWithBackend(this.token);

      // Handle foreground messages
      this.setupForegroundMessageHandler();

      // Handle background/quit state messages
      this.setupBackgroundMessageHandler();

      // Listen for token refresh
      this.setupTokenRefreshListener();
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
    }
  }

  private setupForegroundMessageHandler(): void {
    messaging().onMessage(async (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
      // Handle message when app is in foreground
      Alert.alert(
        remoteMessage.notification?.title || 'New Notification',
        remoteMessage.notification?.body || '',
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate to relevant screen based on notification data
              if (remoteMessage.data?.type === 'clip_processed') {
                // Navigate to clips screen
              }
            },
          },
        ]
      );
    });
  }

  private setupBackgroundMessageHandler(): void {
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      // Handle message when app is in background or quit state
      console.log('Background message:', remoteMessage);
      
      // Update local storage or show local notification
      if (remoteMessage.data?.type === 'clip_processed') {
        await this.updateClipStatus(remoteMessage.data.clipId, 'completed');
      }
    });
  }

  private setupTokenRefreshListener(): void {
    messaging().onTokenRefresh(async (newToken) => {
      console.log('Token refreshed:', newToken);
      this.token = newToken;
      await this.saveToken(newToken);
      await this.registerTokenWithBackend(newToken);
    });
  }

  private async saveToken(token: string): Promise<void> {
    try {
      await AsyncStorage.setItem('fcm_token', token);
    } catch (error) {
      console.error('Failed to save FCM token:', error);
    }
  }

  private async registerTokenWithBackend(token: string): Promise<void> {
    try {
      // In a real implementation, you would send this to your backend
      const response = await fetch('https://api.clipcash.ai/push/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getApiKey()}`,
        },
        body: JSON.stringify({
          token,
          platform: Platform.OS,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to register token');
      }
    } catch (error) {
      console.error('Failed to register token with backend:', error);
    }
  }

  private async getApiKey(): Promise<string> {
    try {
      return await AsyncStorage.getItem('api_key') || '';
    } catch (error) {
      console.error('Failed to get API key:', error);
      return '';
    }
  }

  private async updateClipStatus(clipId: string, status: string): Promise<void> {
    try {
      // Update local storage with clip status
      const clips = await AsyncStorage.getItem('clips');
      const clipsData = clips ? JSON.parse(clips) : [];
      
      const updatedClips = clipsData.map((clip: any) => {
        if (clip.id === clipId) {
          return { ...clip, status };
        }
        return clip;
      });

      await AsyncStorage.setItem('clips', JSON.stringify(updatedClips));
    } catch (error) {
      console.error('Failed to update clip status:', error);
    }
  }

  async unsubscribe(): Promise<void> {
    try {
      if (this.token) {
        await fetch('https://api.clipcash.ai/push/unregister', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await this.getApiKey()}`,
          },
          body: JSON.stringify({ token: this.token }),
        });
      }
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error);
    }
  }

  getToken(): string | null {
    return this.token;
  }
}