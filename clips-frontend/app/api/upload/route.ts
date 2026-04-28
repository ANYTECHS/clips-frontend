import { NextRequest, NextResponse } from "next/server";

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
const ALLOWED_TYPES = ["video/mp4", "video/quicktime", "video/x-msvideo", "video/x-matroska"];
const ALLOWED_EXTENSIONS = [".mp4", ".mov", ".avi", ".mkv"];

function validateFile(file: File): string | null {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return `File "${file.name}" exceeds maximum size of 500MB`;
  }

  // Check file type
  const extension = "." + file.name.split(".").pop()?.toLowerCase();
  if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXTENSIONS.includes(extension)) {
    return `File "${file.name}" has unsupported format. Allowed: MP4, MOV, AVI, MKV`;
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "No files provided" },
        { status: 400 }
      );
    }

    // Validate all files
    const errors: string[] = [];
    for (const file of files) {
      const error = validateFile(file);
      if (error) {
        errors.push(error);
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { error: errors.join("; ") },
        { status: 400 }
      );
    }

    // Simulate file processing - in production, this would:
    // 1. Upload to cloud storage (S3, etc.)
    // 2. Create a processing job
    // 3. Return job ID for polling

    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Simulate processing delay
    // In production, the upload would be handled async

    return NextResponse.json({
      success: true,
      message: `Successfully uploaded ${files.length} file(s)`,
      jobId,
      files: files.map((f) => ({
        name: f.name,
        size: f.size,
        type: f.type,
      })),
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Internal server error during upload" },
      { status: 500 }
    );
  }
}
