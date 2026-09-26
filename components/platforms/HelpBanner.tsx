import React from "react";
import Link from "next/link";
import { HelpCircle } from "lucide-react";
import Skeleton from "@/components/ui/Skeleton";

interface HelpBannerProps {
  isLoading?: boolean;
}

export default function HelpBanner({ isLoading = false }: HelpBannerProps) {
  if (isLoading) {
    return (
      <div className="bg-gradient-to-r from-brand/20 to-brand/10 border border-brand/20 rounded-[24px] p-6">
        <Skeleton className="h-6 w-1/3 mb-2" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-brand/20 to-brand/10 border border-brand/20 rounded-[24px] p-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-brand/20 flex items-center justify-center">
          <HelpCircle className="w-6 h-6 text-brand" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold mb-1">Need help?</h3>
          <p className="text-sm text-muted-foreground">
            Check our documentation for guides on connecting platforms and troubleshooting.
          </p>
        </div>
        <Link
          href="/docs"
          className="px-5 h-10 rounded-xl bg-brand text-white font-medium text-sm hover:bg-brand/90 transition-colors"
        >
          View Docs
        </Link>
      </div>
    </div>
  );
}
