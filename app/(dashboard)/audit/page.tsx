import React from "react";
import type { Metadata } from "next";
import { AuditLogViewer } from "@/components/audit/AuditLogViewer";

export const metadata: Metadata = {
  title: "Security Audit Logs | Clips",
  description: "View and verify the tamper-evident security audit trail.",
};

export default function AuditPage() {
  return (
    <div className="container max-w-7xl mx-auto py-8 px-4 sm:px-6">
      <AuditLogViewer />
    </div>
  );
}
