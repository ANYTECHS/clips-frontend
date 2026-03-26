# Generate Clips Feature Implementation

## Overview
This document describes the implementation of the "Generate Clips" button and form submission functionality for the AI clip generation engine.

## Files Created/Modified

### New Files
1. **`app/create/page.tsx`** - Main create page with form and submission logic

### Modified Files
1. **`app/components/SocialAccountCard.tsx`** - Added selection state support
2. **`app/components/SocialAccountCardGrid.tsx`** - Added selectedPlatforms prop
3. **`package.json`** - Added lucide-react dependency

## Features Implemented

### 1. Video Input Options
- **URL Input**: Text field for video URLs (YouTube, etc.)
- **File Upload**: Drag-and-drop or click to upload video files
- **Mutual Exclusivity**: Only one input method can be active at a time

### 2. Platform Selection
- Reuses existing `SocialAccountCardGrid` component
- Visual feedback with checkmark for selected platforms
- Toggle selection by clicking platform cards
- Displays selected platforms list

### 3. Generate Clips Button
- **Icon**: Sparkles icon from lucide-react
- **Loading State**: Shows spinner and "Generating Clips..." text during submission
- **Disabled State**: Button disabled when form is invalid or submitting
- **Validation**: Requires either URL or file + at least one platform

### 4. Form Validation
```typescript
const isFormValid = () => {
  const hasVideoSource = formData.videoUrl.trim() !== "" || formData.videoFile !== null;
  const hasPlatforms = formData.selectedPlatforms.size > 0;
  return hasVideoSource && hasPlatforms;
};
```

### 5. Submission Logic
- Prevents multiple submissions while request is pending
- Uses FormData for multipart/form-data submission
- Sends video file OR URL + selected platforms array
- Error handling with user-friendly messages
- Redirects to dashboard on success

## API Integration

### Endpoint
```
POST /api/generate-clips
```

### Request Format
```typescript
FormData {
  video?: File,              // If file upload
  videoUrl?: string,         // If URL provided
  platforms: string          // JSON array of platform names
}
```

### Example Request
```javascript
const submitData = new FormData();
submitData.append("video", videoFile);
// OR
submitData.append("videoUrl", "https://youtube.com/watch?v=...");
submitData.append("platforms", JSON.stringify(["tiktok", "youtube"]));
```

## Component State Management

```typescript
interface FormData {
  videoUrl: string;
  videoFile: File | null;
  selectedPlatforms: Set<string>;
}
```

## User Experience Flow

1. User navigates to `/create` page
2. User provides video source (URL or file upload)
3. User selects target platforms (TikTok, Instagram, YouTube)
4. "Generate Clips" button becomes enabled
5. User clicks button
6. Button shows loading state with spinner
7. Form data submitted to backend API
8. On success: Redirect to dashboard
9. On error: Display error message, allow retry

## Accessibility Features

- Keyboard navigation support
- ARIA labels for screen readers
- Focus states on interactive elements
- Disabled state properly communicated
- Error messages clearly displayed

## Validation Rules

1. **Video Source**: Must provide either URL OR file (not both, not neither)
2. **Platforms**: Must select at least one platform
3. **URL Format**: Basic URL validation via input type="url"
4. **File Type**: Accepts video/* MIME types only

## Error Handling

- Network errors caught and displayed
- API error messages shown to user
- Form remains editable after error
- Submit button re-enabled after error

## Environment Variables

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Installation

```bash
cd clips-frontend
npm install
```

## Running the Application

```bash
npm run dev
```

Navigate to `http://localhost:3000/create`

## Testing Checklist

- [ ] URL input works and disables file upload
- [ ] File upload works and disables URL input
- [ ] Platform selection toggles correctly
- [ ] Button disabled when form invalid
- [ ] Button shows loading state during submission
- [ ] Multiple submissions prevented
- [ ] Error messages display correctly
- [ ] Success redirects to dashboard
- [ ] Keyboard navigation works
- [ ] Screen reader announces states correctly

## Future Enhancements

1. Add file size validation
2. Add video preview before submission
3. Add progress bar for file upload
4. Add platform-specific settings (aspect ratio, duration)
5. Save draft functionality
6. Batch upload support
7. URL validation for specific platforms
8. Estimated processing time display

## Dependencies Added

- `lucide-react`: ^0.468.0 - Icon library for UI elements
- `zustand`: ^5.0.2 - State management (if needed for global state)
