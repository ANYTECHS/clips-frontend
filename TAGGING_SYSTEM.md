# Clip Tagging System Implementation Guide

## Overview

This document describes the clip tagging system for organizing clips by topic, campaign, or style. Tags enable fast filtering and discovery of clips in large libraries.

## Data Model

### Clip Interface (Updated)

```typescript
export interface Clip {
  id: string;
  userId: string;
  projectId?: string;
  title: string;
  thumbnail: string;
  score: number;
  scoreKey: string;
  duration: string;
  style: string;
  status: string;
  resolution: string;
  videoUrl: string;
  createdAt: string;
  /** Tags for organizing clips by topic, campaign, or style. Max 10 tags per clip. */
  tags?: string[];
  deletedAt?: string | null;
  archivedAt?: string | null;
}
```

### Tag Constraints

- **Max tags per clip**: 10
- **Max characters per tag**: 30
- **Tag format**: Lowercase, trimmed, no leading/trailing whitespace
- **Uniqueness**: Duplicates are automatically removed

## API Endpoints

### 1. GET /api/clips (Updated)

**Query Parameters:**
```
?page=1&pageSize=20&tags=gaming,tutorial&status=pending&style=Bold&virality=high
```

**Tags Parameter:**
- Comma-separated list of tags to filter by
- Tags are converted to lowercase automatically
- Clips matching ANY of the specified tags are returned (OR logic)
- Empty tags parameter returns all clips

**Response:**
```json
{
  "data": [
    {
      "id": "clip-1",
      "title": "Gaming Tutorial",
      "tags": ["gaming", "tutorial", "educational"],
      "..."
    }
  ],
  "error": null
}
```

### 2. PATCH /api/clips/:id (New)

**Purpose:** Update clip metadata including tags

**Request Body:**
```json
{
  "title": "Updated Title (optional)",
  "tags": ["gaming", "tutorial", "campaign-q4"]
}
```

**Validation:**
- Tags array must have 0-10 elements
- Each tag must be 1-30 characters
- Tags are normalized (lowercase, trimmed)
- Duplicates are removed automatically

**Response:**
```json
{
  "data": {
    "id": "clip-1",
    "title": "Updated Title",
    "tags": ["gaming", "tutorial", "campaign-q4"],
    "..."
  },
  "error": null
}
```

**Error Responses:**
```json
{
  "data": null,
  "error": "At most 10 tags are allowed per clip",
  "code": "VALIDATION_ERROR"
}
```

### 3. GET /api/clips/tags/suggestions (New)

**Purpose:** Get autocomplete suggestions for tags based on existing tags in user's library

**Response:**
```json
{
  "data": [
    "tutorial",
    "product",
    "broll",
    "campaign-q4",
    "engagement",
    "reactions"
  ],
  "error": null
}
```

## Components

### TagsFilter Component

Located in `components/projects/TagsFilter.tsx`

**Features:**
- Searchable multi-select dropdown
- Autocomplete suggestions
- Keyboard navigation (arrow keys, enter, escape)
- Max 10 tags selection limit
- Visual feedback for selected tags
- Remove tag by clicking X or with backspace
- Click outside to close

**Props:**
```typescript
interface TagsFilterProps {
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  availableTags: string[];
  placeholder?: string;
}
```

**Usage:**
```tsx
<TagsFilter
  selectedTags={selectedTags}
  onTagsChange={setSelectedTags}
  availableTags={allAvailableTags}
  placeholder="Search or select tags..."
/>
```

### ProjectFilters Component (Updated)

The filters sidebar now includes a Tags section when tags are available.

**New Props:**
```typescript
selectedTags: string[];
onTagsChange: (tags: string[]) => void;
availableTags: string[];
```

## Frontend State Management

### useFilterQueryState Hook (Updated)

Tags are stored in URL query parameters for deep linking and state persistence.

```typescript
const { filters, updateFilters, resetFilters } = useFilterQueryState({
  style: "All Styles",
  virality: ["high", "medium", "low"],
  tags: [], // New
  vault: "pending",
  page: 1,
});

// Update tags
updateFilters({ tags: ["gaming", "tutorial"] });

// URL will reflect: ?tags=gaming,tutorial
```

## Database Indexing (Production)

For production databases, add indexes on the tags field:

```sql
-- PostgreSQL example
CREATE INDEX idx_clips_tags ON clips USING GIN (tags);

-- MongoDB example
db.clips.createIndex({ "tags": 1 });

-- For substring/partial matching (if needed)
CREATE INDEX idx_clips_tags_text ON clips USING GIN (to_tsvector('english', array_to_string(tags, ' ')));
```

## Mock Store Implementation

The `clipsStore` has been updated with:

1. **Mock data with tags:**
   ```typescript
   { 
     id: "1", 
     title: "Clip #01", 
     tags: ["tutorial", "hook"],
     ...
   }
   ```

2. **Tag retrieval method:**
   ```typescript
   getAllTagsForUser(userId: string): string[]
   ```
   Returns all unique tags across a user's clips, sorted alphabetically.

3. **Tag update method:**
   ```typescript
   updateClipTags(userId: string, clipId: string, tags: string[]): boolean
   ```
   Updates tags for a specific clip.

## Validation Rules (Zod Schemas)

### Tag Schema

```typescript
const tagSchema = z
  .string()
  .trim()
  .min(1, "Tag cannot be empty")
  .max(30, "Tag must be 30 characters or less")
  .transform((tag) => tag.toLowerCase());
```

### updateClipBodySchema

```typescript
export const updateClipBodySchema = z.object({
  title: z.string().min(1, "Title is required").optional(),
  tags: z
    .array(tagSchema)
    .max(10, "Maximum 10 tags per clip")
    .optional()
    .transform((tags) => (tags ? [...new Set(tags)] : undefined)), // Remove duplicates
});
```

### getClipsQuerySchema (Updated)

```typescript
tags: z
  .string()
  .optional()
  .transform((val) => (val ? val.split(",").map((t) => t.trim().toLowerCase()) : []))
  .refine((tags) => tags.every((t) => t.length > 0), "All tags must be non-empty"),
```

## Visual Design

### Tag Display on Clip Cards

Tags are displayed as chips at the bottom of clip cards:
- Shows up to 2 tags inline
- "+X" badge shows count of remaining tags
- Brand color styling (brand/20 background, brand text)
- Truncated with max-width if too long

### Tag Filter UI

- Searchable input with dropdown
- Selected tags display as removable pills
- Keyboard navigation support
- Max 10 tags validation with error message
- Visual feedback on hover

## Security & Sanitization

### Input Validation

- All tag strings are trimmed and lowercased
- Validated via Zod schemas with length constraints
- Duplicates are automatically removed
- No HTML/special characters allowed (through sanitization)

### XSS Prevention

Tag values are NOT sanitized beyond validation because:
1. Tags are created by the authenticated user
2. Tags are stored as strings, not rendered as HTML
3. When displayed, they're rendered as text content, not HTML

If tags were ever rendered with `dangerouslySetInnerHTML`, sanitization would be required.

## Migration Steps (for existing databases)

1. **Add tags column:**
   ```sql
   ALTER TABLE clips ADD COLUMN tags TEXT[] DEFAULT ARRAY[]::TEXT[];
   ```

2. **Create index:**
   ```sql
   CREATE INDEX idx_clips_tags ON clips USING GIN (tags);
   ```

3. **Populate with existing data (optional):**
   - Auto-tag based on style: `tags = ARRAY[style]`
   - Or leave empty and let users add tags going forward

4. **Update ORM/Query builders** to support tags parameter

## Testing

### Unit Tests

- Tag validation (max length, max count, empty strings)
- Tag deduplication
- Case normalization (lowercase)
- Whitespace trimming

### Component Tests

- TagsFilter: selection, removal, keyboard navigation, max limit
- ClipGrid: tag display (up to 2 inline, +X badge)
- ProjectFilters: tags section visibility, integration

### Integration Tests

- GET /api/clips?tags=gaming,tutorial returns correct clips
- PATCH /api/clips/:id with tags updates successfully
- Tags persist across page reloads
- URL query params stay in sync with component state

### Storybook Stories

- **TagsFilter**: Default, WithSelectedTags, MaxCapacity, Interactive
- **ClipGrid**: With tags, without tags, truncated tags
- **ProjectFilters**: With tags section visible/hidden

## Future Enhancements

1. **Tag Analytics**
   - Most used tags across projects
   - Tag-based performance insights
   - Tag recommendations based on ML

2. **Tag Management UI**
   - Bulk tag operations
   - Tag renaming/merging
   - Tag deletion with clip reassignment

3. **Advanced Filtering**
   - Tag combinations (AND logic, NOT logic)
   - Tag-based collections/playlists
   - Saved filter presets

4. **AI-Assisted Tagging**
   - Auto-suggest tags for new clips
   - AI analysis of clip content
   - Template-based tag suggestions

## Troubleshooting

### Tags not filtering correctly

- Check query parameter format: `?tags=tag1,tag2`
- Ensure tags are lowercase in URL
- Verify tags exist in user's library

### Max 10 tags error

- User has selected more than 10 tags
- TagsFilter component will show error message
- Clear some tags to proceed

### Tags not persisting

- Ensure PATCH endpoint is implemented
- Check that updateClipTags method is called
- Verify API response contains updated tags

### Performance issues with large tag libraries

- Implement tag pagination in autocomplete
- Add debouncing to search input
- Use database indexes (GIN for PostgreSQL)
- Consider caching top N tags

## Related Files

- `app/api/schemas/clips.schema.ts` - Tag validation schemas
- `app/api/clips/clipsStore.ts` - Mock store with tag methods
- `components/projects/ClipGrid.tsx` - Tag display on cards
- `components/projects/TagsFilter.tsx` - Filter component
- `components/projects/ProjectFilters.tsx` - Updated filters sidebar
- `app/(dashboard)/projects/page.tsx` - Integration point
