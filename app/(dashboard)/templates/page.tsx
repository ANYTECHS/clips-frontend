import type { Metadata } from "next";
import TemplateManager from "@/components/templates/TemplateManager";

export const metadata: Metadata = {
  title: "Template Library — ClipCash",
  description:
    "Save aspect ratio, duration, and style settings as reusable templates for consistent clips.",
  robots: { index: false, follow: false },
};

export default function TemplatesPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <TemplateManager />
    </main>
  );
}
