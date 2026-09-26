import { NextRequest, NextResponse } from "next/server";
import {
  type BrandKit,
  INITIAL_BRAND_KITS,
  validateBrandCompliance,
} from "@/app/lib/brandKit";
import { sanitize } from "@/app/lib/sanitize";

// In-memory store for brand kits
let brandKitsStore: BrandKit[] = [...INITIAL_BRAND_KITS];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspaceId") || "workspace-main";

  const workspaceKits = brandKitsStore.filter(
    (k) => k.workspaceId === workspaceId
  );
  const activeKit =
    workspaceKits.find((k) => k.isActive) ||
    workspaceKits.find((k) => k.isDefault) ||
    workspaceKits[0];

  return NextResponse.json({
    success: true,
    data: workspaceKits,
    activeKit,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      workspaceId = "workspace-main",
      palette,
      typography,
      watermark,
      guidelines,
      autoApplyToNewClips = false,
    } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { success: false, error: "Brand kit name is required." },
        { status: 400 }
      );
    }

    const newKit: BrandKit = {
      id: `kit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      workspaceId: sanitize(workspaceId),
      name: sanitize(name.trim()),
      isDefault: brandKitsStore.length === 0,
      isActive: false,
      autoApplyToNewClips: Boolean(autoApplyToNewClips),
      palette: {
        primary: palette?.primary || "#00E68A",
        secondary: palette?.secondary || "#7928CA",
        accent: palette?.accent || "#FF0080",
        background: palette?.background || "#0B0C0E",
        textColor: palette?.textColor || "#FFFFFF",
      },
      typography: {
        primaryFont: typography?.primaryFont || "Inter",
        secondaryFont: typography?.secondaryFont || "Outfit",
        minFontSizePx: typography?.minFontSizePx || 18,
      },
      watermark: {
        logoUrl: watermark?.logoUrl || "",
        position: watermark?.position || "bottom-right",
        opacity: watermark?.opacity ?? 0.8,
        scale: watermark?.scale ?? 0.15,
        marginPx: watermark?.marginPx ?? 24,
      },
      guidelines: {
        enforcePalette: guidelines?.enforcePalette ?? true,
        requireWatermark: guidelines?.requireWatermark ?? false,
        minCaptionFontSize: guidelines?.minCaptionFontSize ?? 18,
        minContrastRatio: guidelines?.minContrastRatio ?? 4.5,
      },
      assets: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    brandKitsStore.push(newKit);

    const compliance = validateBrandCompliance(newKit);

    return NextResponse.json(
      {
        success: true,
        data: newKit,
        compliance,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error creating brand kit";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, setActive, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Brand kit id is required." },
        { status: 400 }
      );
    }

    const kitIndex = brandKitsStore.findIndex((k) => k.id === id);
    if (kitIndex === -1) {
      return NextResponse.json(
        { success: false, error: "Brand kit not found." },
        { status: 404 }
      );
    }

    // If making this kit active, deactivate other kits in the workspace
    if (setActive) {
      const workspace = brandKitsStore[kitIndex].workspaceId;
      brandKitsStore = brandKitsStore.map((k) => ({
        ...k,
        isActive: k.workspaceId === workspace ? k.id === id : k.isActive,
      }));
    }

    // Merge updates
    const current = brandKitsStore[kitIndex];
    const updatedKit: BrandKit = {
      ...current,
      name: updates.name ? sanitize(updates.name.trim()) : current.name,
      autoApplyToNewClips:
        updates.autoApplyToNewClips !== undefined
          ? Boolean(updates.autoApplyToNewClips)
          : current.autoApplyToNewClips,
      palette: updates.palette ? { ...current.palette, ...updates.palette } : current.palette,
      typography: updates.typography
        ? { ...current.typography, ...updates.typography }
        : current.typography,
      watermark: updates.watermark
        ? { ...current.watermark, ...updates.watermark }
        : current.watermark,
      guidelines: updates.guidelines
        ? { ...current.guidelines, ...updates.guidelines }
        : current.guidelines,
      updatedAt: new Date().toISOString(),
    };

    brandKitsStore[kitIndex] = updatedKit;

    const compliance = validateBrandCompliance(updatedKit);

    return NextResponse.json({
      success: true,
      data: updatedKit,
      compliance,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error updating brand kit";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { success: false, error: "Brand kit id is required." },
      { status: 400 }
    );
  }

  if (brandKitsStore.length <= 1) {
    return NextResponse.json(
      { success: false, error: "Cannot delete the only remaining brand kit." },
      { status: 400 }
    );
  }

  brandKitsStore = brandKitsStore.filter((k) => k.id !== id);

  // If deleted kit was active, activate the default kit
  if (!brandKitsStore.some((k) => k.isActive)) {
    if (brandKitsStore[0]) {
      brandKitsStore[0].isActive = true;
    }
  }

  return NextResponse.json({
    success: true,
    message: "Brand kit deleted successfully.",
  });
}
