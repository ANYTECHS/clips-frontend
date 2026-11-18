import React, { Suspense } from "react";
import PlatformsContent from "@/components/platforms/PlatformsContent";
import { Loader2 } from "lucide-react";

export default function PlatformsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#020D08] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#B6FF4A] animate-spin" />
      </div>
    }>
      <PlatformsContent />
    </Suspense>
  );
}
