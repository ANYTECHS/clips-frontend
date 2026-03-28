import React from "react";

interface BadgeProps {
  variant: "active" | "not-linked";
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant, children, className = "" }: BadgeProps) {
  const baseClasses = "inline-flex items-center px-2 py-1 text-xs font-medium rounded-md";

  const variantClasses = {
    active: "bg-[#00FF9D] text-black",
    "not-linked": "bg-[#1A1A1A] text-[#8B9EFF]",
  };

  return (
    <span className={`${baseClasses} ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
}