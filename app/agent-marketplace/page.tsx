"use client";

import React, { Suspense } from "react";
import DashboardLayout from "@/components/shared/DashboardLayout";
import AgentMarketplaceContent from "@/components/agent-marketplace/AgentMarketplaceContent";
import { Loader2 } from "lucide-react";

export default function AgentMarketplacePage() {
  return (
    <DashboardLayout>
      <Suspense
        fallback={
          <div className="flex-1 flex items-center justify-center min-h-[60vh]">
            <Loader2 className="w-10 h-10 text-brand animate-spin" />
          </div>
        }
      >
        <AgentMarketplaceContent />
      </Suspense>
    </DashboardLayout>
  );
}
