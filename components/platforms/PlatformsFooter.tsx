import React from "react";
import Skeleton from "@/components/ui/Skeleton";

interface PlatformsFooterProps {
  isLoading?: boolean;
}

export default function PlatformsFooter({ isLoading = false }: PlatformsFooterProps) {
  if (isLoading) {
    return (
      <div className="space-y-2 pt-8 border-t border-white/10">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  return (
    <div className="space-y-2 pt-8 border-t border-white/10">
      <p className="text-xs text-muted-foreground">
        By connecting your accounts, you authorize Clips to access your account data
        in accordance with our{" "}
        <a href="/privacy" className="text-brand hover:underline">
          Privacy Policy
        </a>{" "}
        and{" "}
        <a href="/terms" className="text-brand hover:underline">
          Terms of Service
        </a>
        . OAuth connections are secure and can be revoked at any time.
      </p>
      <p className="text-xs text-muted-foreground">
        We do not store your passwords or share your data with third parties.
      </p>
    </div>
  );
}
