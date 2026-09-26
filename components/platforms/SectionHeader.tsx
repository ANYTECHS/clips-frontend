import React from "react";

interface SectionHeaderProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
}

export default function SectionHeader({
  title,
  icon: Icon,
  description,
}: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <Icon className="w-6 h-6 text-brand" />
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  );
}
