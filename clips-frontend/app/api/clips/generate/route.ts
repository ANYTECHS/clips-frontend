import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    const videoFile = formData.get("video") as File | null;
    const videoUrl = formData.get("videoUrl") as string | null;
    const platformsJson = formData.get("platforms") as string;
    const autoPublish = formData.get("autoPublish") === "true";

    // Validation
    if (!videoFile && !videoUrl) {
      return NextResponse.json(
        { message: "Either video file or video URL is required" },
        { status: 400 }
      );
    }

    const platforms = JSON.parse(platformsJson || "[]");
    if (!Array.isArray(platforms) || platforms.length === 0) {
      return NextResponse.json(
        { message: "At least one platform must be selected" },
        { status: 400 }
      );
    }

    // Prepare data for backend
    const backendFormData = new FormData();
    
    if (videoFile) {
      backendFormData.append("video", videoFile);
    } else if (videoUrl) {
      backendFormData.append("videoUrl", videoUrl);
    }
    
    backendFormData.append("platforms", JSON.stringify(platforms));
    backendFormData.append("autoPublish", String(autoPublish));

    // Forward to backend API
    const response = await fetch(`${API_BASE_URL}/api/clips/generate`, {
      method: "POST",
      body: backendFormData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        message: "Backend service error",
      }));
      return NextResponse.json(
        { message: errorData.message || "Failed to generate clips" },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    return NextResponse.json({
      success: true,
      jobId: data.jobId || data.id,
      message: "Clip generation started successfully",
    });
  } catch (error) {
    console.error("Error in /api/clips/generate:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
