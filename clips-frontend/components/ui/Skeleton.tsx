"use client";

import React from "react";

interface SkeletonProps {
  className?: string;
}

/**
 * Reusable Skeleton component with pulse animation
 */
export default function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div 
      className={`animate-pulse bg-white/5 rounded-md ${className}`}
      aria-hidden="true"
    />
  );
}
