"use client";

/**
 * TagsFilter.tsx — Multi-select tag filter component for clips.
 *
 * Features:
 * - Searchable multi-select with autocomplete
 * - Shows existing tags from user's clips
 * - Max 10 tags can be selected
 * - Visual feedback for selected tags
 * - Keyboard navigation support
 */

import React, { useState, useRef, useEffect } from "react";
import { X, Search, ChevronDown } from "lucide-react";

const TAGS_MAX_PER_CLIP = 10;

interface TagsFilterProps {
  /** Currently selected tags to filter by */
  selectedTags: string[];
  /** Callback when tags selection changes */
  onTagsChange: (tags: string[]) => void;
  /** Available tags for autocomplete/suggestions */
  availableTags: string[];
  /** Optional custom placeholder */
  placeholder?: string;
}

export function TagsFilter({
  selectedTags,
  onTagsChange,
  availableTags,
  placeholder = "Search or select tags...",
}: TagsFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter available tags based on search input and exclude already selected
  const filteredTags = availableTags.filter(
    (tag) =>
      !selectedTags.includes(tag) && tag.toLowerCase().includes(searchInput.toLowerCase())
  );

  const handleSelectTag = (tag: string) => {
    if (selectedTags.length < TAGS_MAX_PER_CLIP) {
      onTagsChange([...selectedTags, tag]);
      setSearchInput("");
      setHighlightedIndex(-1);
    }
  };

  const handleRemoveTag = (tag: string) => {
    onTagsChange(selectedTags.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredTags.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredTags[highlightedIndex]) {
          handleSelectTag(filteredTags[highlightedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        break;
      case "Backspace":
        if (searchInput === "" && selectedTags.length > 0) {
          handleRemoveTag(selectedTags[selectedTags.length - 1]);
        }
        break;
      default:
        break;
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Focus search input when opening
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Input field */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 cursor-pointer flex items-center gap-2 hover:bg-white/10 hover:border-white/20 transition-colors group"
      >
        <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />

        {/* Selected tags display */}
        <div className="flex flex-wrap gap-1 flex-1 min-h-[24px]">
          {selectedTags.length > 0 ? (
            selectedTags.map((tag) => (
              <div
                key={tag}
                className="flex items-center gap-1 px-2 py-1 bg-brand/20 text-brand text-xs rounded-md border border-brand/30 whitespace-nowrap"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveTag(tag);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" || e.key === "Delete") {
                    handleRemoveTag(tag);
                  }
                }}
              >
                <span>{tag}</span>
                <X className="w-3 h-3 cursor-pointer hover:text-brand-hover" />
              </div>
            ))
          ) : (
            <span className="text-muted-foreground text-sm">{placeholder}</span>
          )}
          {isOpen && availableTags.length > 0 && (
            <input
              ref={searchInputRef}
              type="text"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setHighlightedIndex(-1);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Type to search..."
              className="flex-1 bg-transparent outline-none text-sm text-white min-w-[100px]"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>

        {/* Indicator that shows more tags available */}
        {availableTags.length > 0 && (
          <ChevronDown
            className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        )}
      </div>

      {/* Dropdown list */}
      {isOpen && filteredTags.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-2 bg-surface border border-white/10 rounded-xl shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="max-h-64 overflow-y-auto">
            {filteredTags.map((tag, index) => (
              <button
                key={tag}
                onClick={() => handleSelectTag(tag)}
                className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors ${
                  index === highlightedIndex
                    ? "bg-brand/20 text-brand"
                    : "text-white hover:bg-white/5"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Info text when at max tags */}
      {selectedTags.length >= TAGS_MAX_PER_CLIP && (
        <p className="text-xs text-red-400/70 mt-2">Maximum {TAGS_MAX_PER_CLIP} tags selected</p>
      )}

      {/* Empty state */}
      {isOpen && filteredTags.length === 0 && availableTags.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-2 bg-surface border border-white/10 rounded-xl shadow-lg p-4 text-center text-sm text-muted-foreground">
          No tags match your search
        </div>
      )}
    </div>
  );
}

export default TagsFilter;
