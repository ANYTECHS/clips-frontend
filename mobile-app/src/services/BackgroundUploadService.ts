import BackgroundUpload from 'react-native-background-upload';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UploadProgress {
  uploadId: string;
  progress: number;
  bytesUploaded: number;
  totalBytes: number;
}

export class BackgroundUploadService {
  private static instance: BackgroundUploadService;
  private uploads: Map<string, UploadProgress> = new Map();

  static getInstance(): BackgroundUploadService {
    if (!BackgroundUploadService.instance) {
      BackgroundUploadService.instance = new BackgroundUploadService();
    }
    return BackgroundUploadService.instance;
  }

  async uploadVideo(
    fileUri: string,
    fileName: string,
    apiKey: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<string> {
    try {
      const uploadId = await BackgroundUpload.startUpload({
        url: 'https://api.clipcash.ai/upload',
        file: {
          filename: fileName,
          filepath: fileUri,
          filetype: 'video/mp4',
        },
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'multipart/form-data',
        },
        notification: {
          enabled: true,
        },
      });

      // Monitor upload progress
      BackgroundUpload.addListener('progress', (data: any) => {
        if (data.id === uploadId) {
          const progress: UploadProgress = {
            uploadId: data.id,
            progress: data.progress,
            bytesUploaded: data.bytesWritten,
            totalBytes: data.totalBytesExpectedToSend,
          };
          
          this.uploads.set(uploadId, progress);
          onProgress?.(progress);
        }
      });

      BackgroundUpload.addListener('error', (data: any) => {
        if (data.id === uploadId) {
          console.error('Upload error:', data.error);
        }
      });

      BackgroundUpload.addListener('completed', (data: any) => {
        if (data.id === uploadId) {
          console.log('Upload completed:', data);
          this.uploads.delete(uploadId);
        }
      });

      // Save upload ID for tracking
      await this.saveUploadId(uploadId, fileName);

      return uploadId;
    } catch (error) {
      console.error('Failed to start upload:', error);
      throw error;
    }
  }

  async cancelUpload(uploadId: string): Promise<void> {
    try {
      await BackgroundUpload.cancelUpload(uploadId);
      this.uploads.delete(uploadId);
      await this.removeUploadId(uploadId);
    } catch (error) {
      console.error('Failed to cancel upload:', error);
      throw error;
    }
  }

  getUploadProgress(uploadId: string): UploadProgress | undefined {
    return this.uploads.get(uploadId);
  }

  getAllUploads(): UploadProgress[] {
    return Array.from(this.uploads.values());
  }

  private async saveUploadId(uploadId: string, fileName: string): Promise<void> {
    try {
      const uploads = await this.getStoredUploads();
      uploads.push({ uploadId, fileName, timestamp: Date.now() });
      await AsyncStorage.setItem('active_uploads', JSON.stringify(uploads));
    } catch (error) {
      console.error('Failed to save upload ID:', error);
    }
  }

  private async removeUploadId(uploadId: string): Promise<void> {
    try {
      const uploads = await this.getStoredUploads();
      const filtered = uploads.filter((u: any) => u.uploadId !== uploadId);
      await AsyncStorage.setItem('active_uploads', JSON.stringify(filtered));
    } catch (error) {
      console.error('Failed to remove upload ID:', error);
    }
  }

  private async getStoredUploads(): Promise<any[]> {
    try {
      const data = await AsyncStorage.getItem('active_uploads');
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to get stored uploads:', error);
      return [];
    }
  }

  async restoreUploads(): Promise<void> {
    try {
      const uploads = await this.getStoredUploads();
      // Restore any active uploads that might have been interrupted
      for (const upload of uploads) {
        // In a real implementation, you would check the upload status
        // and potentially resume it
      }
    } catch (error) {
      console.error('Failed to restore uploads:', error);
    }
  }
}