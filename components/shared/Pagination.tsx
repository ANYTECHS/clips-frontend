"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Button from "@/components/shared/Button";

interface PaginationProps {
  page: number;
  onPageChange: (page: number) => void;
  hasNextPage: boolean;
  /** Dims the controls while the next page is loading. */
  loading?: boolean;
  className?: string;
}

/** Shared previous/next controls for paged lists (page numbers are 1-based). */
export default function Pagination({
  page,
  onPageChange,
  hasNextPage,
  loading = false,
  className = "",
}: PaginationProps) {
  if (page <= 1 && !hasNextPage) return null;
  return (
    <nav
      aria-label="Pagination"
      className={`flex items-center justify-center gap-4 ${className}`}
    >
      <Button
        variant="secondary"
        size="sm"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1 || loading}
        aria-label="Previous page"
      >
        <ChevronLeft className="w-4 h-4" aria-hidden="true" />
        Previous
      </Button>
      <span className="text-[13px] font-bold text-[#90A89C]" aria-current="page">
        Page {page}
      </span>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => onPageChange(page + 1)}
        disabled={!hasNextPage || loading}
        aria-label="Next page"
      >
        Next
        <ChevronRight className="w-4 h-4" aria-hidden="true" />
      </Button>
    </nav>
  );
}
