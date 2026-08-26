import React from "react";
import Skeleton from "@/components/ui/Skeleton";

type PlatformStatus = "ACTIVE" | "NOT LINKED" | "LINKED";

interface PlatformCardProps {
  id: string;
  name: string;
  username?: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  status: PlatformStatus;
  ctaText: string;
  variant: "vertical" | "horizontal";
  onConnect?: () => void;
  onDisconnect?: () => void;
  isLoading?: boolean;
  isComingSoon?: boolean;
}

export default function PlatformCard({
  name,
  username,
  description,
  icon: Icon,
  status,
  ctaText,
  variant,
  onConnect,
  onDisconnect,
  isLoading,
  isComingSoon,
}: PlatformCardProps) {
  const getStatusColor = () => {
    if (isComingSoon) return "text-muted-foreground";
    if (status === "ACTIVE" || status === "LINKED") return "text-green-500";
    return "text-muted-foreground";
  };

  const getStatusText = () => {
    if (isComingSoon) return "Coming Soon";
    if (status === "ACTIVE" || status === "LINKED") return username || "Connected";
    return "Not Linked";
  };

  if (variant === "vertical") {
    return (
      <div className="bg-surface/40 border border-white/[0.03] rounded-[24px] p-8 flex flex-col gap-8">
        <div className="flex items-start justify-between">
          <div className="w-16 h-16 rounded-[22px] bg-white/5 flex items-center justify-center">
            <Icon className="w-8 h-8 text-white" />
          </div>
          <div className={`text-sm font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </div>
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">{name}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <button
          onClick={onConnect}
          disabled={isLoading || isComingSoon || !onConnect}
          className={`w-full h-12 rounded-xl font-medium transition-colors ${
            isComingSoon || !onConnect
              ? "bg-white/5 text-muted-foreground cursor-not-allowed"
              : "bg-brand text-white hover:bg-brand/90"
          }`}
        >
          {isLoading ? "Connecting..." : ctaText}
        </button>
      </div>
    );
  }

  // Horizontal variant for wallets
  return (
    <div className="bg-surface/40 border border-white/[0.03] rounded-[24px] p-6 flex items-center justify-between">
      <div className="flex items-center gap-5">
        <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center">
          <Icon className="w-7 h-7 text-white" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold">{name}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        {username && (
          <span className="text-sm text-muted-foreground hidden sm:block">
            {username}
          </span>
        )}
        <button
          onClick={status === "LINKED" ? onDisconnect : onConnect}
          disabled={isLoading || isComingSoon}
          className={`px-5 h-10 rounded-xl font-medium text-sm transition-colors ${
            isComingSoon
              ? "bg-white/5 text-muted-foreground cursor-not-allowed"
              : status === "LINKED"
              ? "bg-white/10 text-white hover:bg-white/20"
              : "bg-brand text-white hover:bg-brand/90"
          }`}
        >
          {isLoading ? "Connecting..." : ctaText}
        </button>
      </div>
    </div>
  );
}

export function PlatformCardSkeleton({ variant }: { variant: "vertical" | "horizontal" }) {
  if (variant === "vertical") {
    return (
      <div className="bg-surface/40 border border-white/[0.03] rounded-[24px] p-8 flex flex-col gap-8">
        <div className="flex items-start justify-between">
          <Skeleton className="w-16 h-16 rounded-[22px]" />
          <Skeleton className="w-20 h-6 rounded-lg" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <Skeleton className="w-full h-12 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="bg-surface/40 border border-white/[0.03] rounded-[24px] p-6 flex items-center justify-between">
      <div className="flex items-center gap-5">
        <Skeleton className="w-14 h-14 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
      <Skeleton className="w-28 h-10 rounded-xl" />
    </div>
  );
}
