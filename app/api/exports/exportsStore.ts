export type ExportFormat = "mp4" | "webm";
export type ExportAspectRatio = "9:16" | "1:1" | "16:9";
export type ExportQuality = "720p" | "1080p";
export type ExportStatus = "queued" | "processing" | "complete" | "error";

export interface ClipExport {
  id: string;
  clipId: string;
  userId: string;
  jobId: string;
  format: ExportFormat;
  aspectRatio: ExportAspectRatio;
  quality: ExportQuality;
  status: ExportStatus;
  objectKey: string;
  downloadUrl?: string;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

class ExportsStore {
  private exports: ClipExport[] = [];

  createExport(data: Omit<ClipExport, "id" | "createdAt" | "status">): ClipExport {
    const record: ClipExport = {
      ...data,
      id: `export_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      status: "queued",
      createdAt: new Date().toISOString(),
    };
    this.exports.push(record);
    return record;
  }

  getExportsForClip(clipId: string, userId: string): ClipExport[] {
    return this.exports
      .filter((e) => e.clipId === clipId && e.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getByJobId(jobId: string): ClipExport | undefined {
    return this.exports.find((e) => e.jobId === jobId);
  }

  updateById(
    id: string,
    update: Partial<Pick<ClipExport, "objectKey" | "status" | "downloadUrl" | "errorMessage" | "completedAt">>,
  ): ClipExport | undefined {
    const index = this.exports.findIndex((e) => e.id === id);
    if (index === -1) return undefined;
    this.exports[index] = { ...this.exports[index], ...update };
    return this.exports[index];
  }

  updateByJobId(
    jobId: string,
    update: Partial<Pick<ClipExport, "status" | "downloadUrl" | "errorMessage" | "completedAt" | "objectKey">>,
  ): ClipExport | undefined {
    const index = this.exports.findIndex((e) => e.jobId === jobId);
    if (index === -1) return undefined;

    this.exports[index] = { ...this.exports[index], ...update };
    return this.exports[index];
  }
}

export const exportsStore = new ExportsStore();
