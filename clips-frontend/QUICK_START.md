# Quick Start - Generate Clips Feature

## 🚀 Get Started in 3 Steps

### 1. Install Dependencies

```bash
cd clips-frontend
npm install
```

### 2. Configure Environment

Create `.env.local` in the `clips-frontend` directory:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 3. Run the App

```bash
npm run dev
```

Navigate to: **http://localhost:3000/create**

---

## 📝 How to Use

1. **Add Video**
   - Enter a video URL, OR
   - Upload a video file

2. **Select Platforms**
   - Click on TikTok, Instagram, or YouTube cards
   - Select one or more platforms

3. **Generate Clips**
   - Click the "Generate Clips" button
   - Wait for processing
   - Get redirected to dashboard

---

## 🧪 Testing Without Backend

If the backend isn't ready, you can test the UI:

1. The form validation will work
2. Platform selection will work
3. The submit button will show loading state
4. You'll see an error message (expected without backend)

To mock the API response, you can use a tool like [json-server](https://github.com/typicode/json-server) or modify the code temporarily.

---

## 🐛 Troubleshooting

### "Cannot find module 'lucide-react'"
```bash
npm install lucide-react
```

### "NEXT_PUBLIC_API_URL is not defined"
Create `.env.local` file with the API URL

### Button stays disabled
- Make sure you've entered a URL or uploaded a file
- Make sure you've selected at least one platform

### CORS errors
- Backend needs to allow requests from `http://localhost:3000`
- Check backend CORS configuration

---

## 📚 Documentation

- **Full Implementation:** `GENERATE_CLIPS_IMPLEMENTATION.md`
- **API Contract:** `API_INTEGRATION_GUIDE.md`
- **Testing Guide:** `QA_TESTING_CHECKLIST.md`
- **PR Summary:** `GENERATE_CLIPS_PR_SUMMARY.md`

---

## 🎯 Key Features

✅ Video URL input  
✅ File upload with drag & drop  
✅ Platform selection (TikTok, Instagram, YouTube)  
✅ Form validation  
✅ Loading states  
✅ Error handling  
✅ Prevents duplicate submissions  
✅ Responsive design  
✅ Accessibility support  

---

## 💡 Tips

- Use the Tab key to navigate through the form
- The form automatically prevents invalid submissions
- You can switch between URL and file upload
- Selected platforms show a green checkmark
- The button shows a spinner while processing

---

## 🔗 Useful Links

- [Next.js Documentation](https://nextjs.org/docs)
- [Lucide Icons](https://lucide.dev/)
- [Tailwind CSS](https://tailwindcss.com/)

---

**Need Help?** Check the documentation files or contact the development team.
