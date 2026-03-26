# Quick Reference - Form Submission Feature

## 🚀 Quick Start

```bash
cd clips-frontend
npm install
```

Create `.env.local`:
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws/progress
```

```bash
npm run dev
```

Visit: `http://localhost:3000/create`

## 📁 Key Files

| File | Purpose |
|------|---------|
| `app/create/page.tsx` | Main form component |
| `app/api/clips/generate/route.ts` | API route handler |
| `app/hooks/useProcessStore.ts` | Job state management |
| `app/hooks/useWebSocket.ts` | Real-time updates |

## 🎯 Form State

```typescript
const [videoUrl, setVideoUrl] = useState("");
const [uploadedFile, setUploadedFile] = useState<File | null>(null);
const [platforms, setPlatforms] = useState<PlatformState[]>([...]);
const [autoPublish, setAutoPublish] = useState(false);
const [isSubmitting, setIsSubmitting] = useState(false);
```

## ✅ Validation Logic

```typescript
// Has video input?
hasVideoInput = videoUrl.trim() !== "" || uploadedFile !== null

// Has selected platform?
hasSelectedPlatform = platforms.some(p => p.enabled)

// Form valid?
isFormValid = hasVideoInput && hasSelectedPlatform && !isSubmitting
```

## 🔌 API Endpoint

### Request
```typescript
POST /api/clips/generate
Content-Type: multipart/form-data

FormData {
  video?: File              // OR
  videoUrl?: string         // (mutually exclusive)
  platforms: string         // JSON: ["tiktok", "instagram", "youtube"]
  autoPublish: string       // "true" | "false"
}
```

### Response (Success)
```json
{
  "success": true,
  "jobId": "uuid-string",
  "message": "Clip generation started successfully"
}
```

### Response (Error)
```json
{
  "message": "Error description"
}
```

## 🔄 Submission Flow

```typescript
1. User fills form
2. Clicks "Generate Clips"
3. Button shows loading spinner
4. POST to /api/clips/generate
5. API forwards to backend
6. Backend returns jobId
7. startProcess(jobId, label)
8. router.push("/dashboard")
9. Dashboard shows progress via WebSocket
```

## 🎨 Button States

```typescript
// Disabled (invalid form)
<button disabled={!isFormValid}>
  <Sparkles /> Generate Clips
</button>

// Loading (submitting)
<button disabled={true}>
  <Loader2 className="animate-spin" />
  Generating Clips...
</button>

// Enabled (valid form)
<button disabled={false}>
  <Sparkles /> Generate Clips
</button>
```

## 🧪 Testing

```bash
# Run all tests
npm run test

# Run specific test
npm run test -- app/create/__tests__/page.test.tsx

# Watch mode
npm run test -- --watch
```

## 🐛 Debugging

### Check Form State
```typescript
console.log({
  hasVideoInput,
  hasSelectedPlatform,
  isFormValid,
  platforms: platforms.filter(p => p.enabled),
});
```

### Check API Request
```typescript
// In route.ts
console.log("Received:", {
  hasVideo: !!formData.get("video"),
  hasUrl: !!formData.get("videoUrl"),
  platforms: formData.get("platforms"),
  autoPublish: formData.get("autoPublish"),
});
```

### Monitor WebSocket
1. Open DevTools
2. Network tab
3. Filter: WS
4. Click connection
5. View Messages tab

## 🔧 Common Issues

### Button Always Disabled
- Check `hasVideoInput` - is URL or file provided?
- Check `hasSelectedPlatform` - is at least one platform selected?
- Check `isSubmitting` - is form stuck in submitting state?

### File Upload Not Working
- Check file input `accept` attribute
- Verify file size (max 500MB)
- Check browser console for errors
- Ensure `videoUrl` is empty

### API Request Fails
- Verify `NEXT_PUBLIC_API_URL` in `.env.local`
- Check backend is running
- Check CORS settings
- View Network tab in DevTools

### WebSocket Not Connecting
- Verify `NEXT_PUBLIC_WS_URL` in `.env.local`
- Check WebSocket server is running
- Check browser console for errors
- Verify endpoint is `/ws/progress`

## 📊 State Flow Diagram

```
User Action → State Update → Validation → Button State

Enter URL → setVideoUrl() → hasVideoInput=true → Button enabled (if platform selected)
Upload File → setUploadedFile() → hasVideoInput=true → Button enabled (if platform selected)
Select Platform → togglePlatform() → hasSelectedPlatform=true → Button enabled (if video provided)
Click Submit → setIsSubmitting(true) → isFormValid=false → Button disabled
```

## 🎯 Key Features

- ✅ Mutually exclusive URL/file input
- ✅ Multi-platform selection
- ✅ Auto-publish toggle
- ✅ Real-time validation
- ✅ Loading states
- ✅ Error handling
- ✅ Submission prevention
- ✅ Process tracking integration
- ✅ WebSocket updates
- ✅ Browser notifications

## 📚 Documentation

- `FEATURE_SUMMARY.md` - Complete overview
- `SETUP_GUIDE.md` - Setup instructions
- `FORM_SUBMISSION_IMPLEMENTATION.md` - Technical details
- `QUICK_REFERENCE.md` - This file

## 🆘 Need Help?

1. Check documentation files
2. Review test files for examples
3. Check browser console
4. Verify environment variables
5. Test backend endpoint directly

## 🔗 Useful Commands

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Run tests
npm run test

# Build for production
npm run build

# Lint code
npm run lint

# Type check
npx tsc --noEmit
```

## 🎉 Success Checklist

- [ ] Dependencies installed
- [ ] Environment variables configured
- [ ] Backend API running
- [ ] WebSocket server running
- [ ] Form loads at `/create`
- [ ] Can enter URL
- [ ] Can upload file
- [ ] Can select platforms
- [ ] Can toggle auto-publish
- [ ] Button validates correctly
- [ ] Submission works
- [ ] Redirects to dashboard
- [ ] Progress shows on dashboard
- [ ] WebSocket updates work
- [ ] Notifications work

---

**Quick Links**
- [Main README](./README.md)
- [Feature Summary](./FEATURE_SUMMARY.md)
- [Setup Guide](./SETUP_GUIDE.md)
- [Implementation Details](./FORM_SUBMISSION_IMPLEMENTATION.md)
