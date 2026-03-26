# QA Testing Checklist - Generate Clips Feature

## Setup

- [ ] Dependencies installed (`npm install`)
- [ ] Environment variable set (`NEXT_PUBLIC_API_URL`)
- [ ] Dev server running (`npm run dev`)
- [ ] Backend API available (or mock endpoint ready)

## Functional Testing

### Video Input - URL

- [ ] Can enter a valid video URL
- [ ] URL input is disabled when file is uploaded
- [ ] URL input clears when file is uploaded
- [ ] URL input accepts various formats (YouTube, Vimeo, etc.)
- [ ] Link icon displays correctly

### Video Input - File Upload

- [ ] Can click to select file
- [ ] Can drag and drop file (if browser supports)
- [ ] File upload is disabled when URL is entered
- [ ] File name displays after selection
- [ ] Only video files are accepted
- [ ] Upload icon displays correctly

### Platform Selection

- [ ] Can click TikTok card to select/deselect
- [ ] Can click Instagram card to select/deselect
- [ ] Can click YouTube card to select/deselect
- [ ] Selected platforms show checkmark
- [ ] Selected platforms have different styling
- [ ] Selected platforms list updates correctly
- [ ] Can select multiple platforms
- [ ] Can deselect all platforms

### Generate Clips Button

- [ ] Button is disabled when no video source
- [ ] Button is disabled when no platforms selected
- [ ] Button is enabled when video + platforms provided
- [ ] Sparkles icon displays correctly
- [ ] Button text is "Generate Clips" when idle
- [ ] Hover effect works on enabled button
- [ ] No hover effect on disabled button

### Form Submission

- [ ] Clicking button triggers submission
- [ ] Button shows loading state (spinner + text change)
- [ ] Button text changes to "Generating Clips..."
- [ ] Loader icon animates (spinning)
- [ ] Form inputs are disabled during submission
- [ ] Cannot submit multiple times (button disabled)
- [ ] Submission sends correct data format

### Success Flow

- [ ] Successful submission redirects to `/dashboard`
- [ ] No error message displayed on success
- [ ] Loading state clears before redirect

### Error Handling

- [ ] Network error displays error message
- [ ] API error displays error message
- [ ] Error message is user-friendly
- [ ] Error message has red styling
- [ ] Form remains editable after error
- [ ] Can resubmit after fixing error
- [ ] Loading state clears on error

### Validation Messages

- [ ] Helper text shows when form is invalid
- [ ] Helper text explains what's needed
- [ ] Helper text disappears when form is valid
- [ ] No validation errors on initial load

## UI/UX Testing

### Layout & Spacing

- [ ] Page layout is centered and readable
- [ ] Sections have proper spacing
- [ ] Form elements are properly aligned
- [ ] No overlapping elements
- [ ] Responsive on desktop (1920x1080)
- [ ] Responsive on laptop (1366x768)
- [ ] Responsive on tablet (768x1024)
- [ ] Responsive on mobile (375x667)

### Typography

- [ ] Headings are clear and readable
- [ ] Body text is legible
- [ ] Labels are properly sized
- [ ] Placeholder text is visible
- [ ] Font weights are appropriate

### Colors & Contrast

- [ ] Text has sufficient contrast
- [ ] Disabled states are visually distinct
- [ ] Error messages are clearly visible
- [ ] Selected platforms stand out
- [ ] Dark theme works correctly

### Icons

- [ ] All icons render correctly
- [ ] Icons are properly sized
- [ ] Icons align with text
- [ ] Spinner animation is smooth
- [ ] Checkmark displays on selection

## Accessibility Testing

### Keyboard Navigation

- [ ] Can tab through all form elements
- [ ] Tab order is logical
- [ ] Can select platforms with Enter/Space
- [ ] Can submit form with Enter
- [ ] Focus indicators are visible
- [ ] Can navigate without mouse

### Screen Reader

- [ ] Page title is announced
- [ ] Form labels are announced
- [ ] Button states are announced
- [ ] Error messages are announced
- [ ] Platform selection changes announced
- [ ] Loading state is announced

### ARIA Attributes

- [ ] Buttons have proper aria-labels
- [ ] Form inputs have proper labels
- [ ] Error messages have aria-live
- [ ] Disabled states are communicated
- [ ] Required fields are marked

## Browser Compatibility

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

## Performance Testing

- [ ] Page loads quickly (<2s)
- [ ] No layout shift on load
- [ ] Smooth animations
- [ ] No lag when typing
- [ ] File selection is responsive
- [ ] Platform selection is instant

## Edge Cases

### Input Validation

- [ ] Empty URL input is handled
- [ ] Invalid URL format is handled
- [ ] Very long URL is handled
- [ ] Special characters in URL work
- [ ] Large file size is handled (if limit exists)
- [ ] Unsupported file format is rejected

### State Management

- [ ] Switching between URL and file works
- [ ] Selecting/deselecting platforms works
- [ ] Form state persists during errors
- [ ] Form resets after successful submission
- [ ] No memory leaks on repeated use

### Network Issues

- [ ] Slow network shows loading state
- [ ] Network timeout is handled
- [ ] Offline state is handled
- [ ] CORS errors are handled
- [ ] 404 errors are handled
- [ ] 500 errors are handled

## Security Testing

- [ ] No sensitive data in console
- [ ] No API keys exposed
- [ ] File upload is secure
- [ ] XSS protection works
- [ ] CSRF protection (if applicable)

## Integration Testing

### API Communication

- [ ] Correct endpoint is called
- [ ] Correct HTTP method (POST)
- [ ] Correct Content-Type header
- [ ] FormData is properly formatted
- [ ] Platforms array is JSON stringified
- [ ] File is properly attached
- [ ] URL is properly sent

### Data Flow

- [ ] Form data matches API contract
- [ ] Response is properly parsed
- [ ] Success response triggers redirect
- [ ] Error response shows message
- [ ] Job ID is received (if applicable)

## Regression Testing

- [ ] Existing pages still work
- [ ] Navigation still works
- [ ] Other components unaffected
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] Build succeeds

## Documentation

- [ ] README is accurate
- [ ] API guide is complete
- [ ] Code comments are clear
- [ ] Examples work as shown

## Sign-off

- [ ] All critical tests pass
- [ ] All blockers resolved
- [ ] Ready for production

---

## Test Results

**Tester:** _______________  
**Date:** _______________  
**Environment:** _______________  
**Build Version:** _______________  

**Overall Status:** ⬜ Pass | ⬜ Fail | ⬜ Needs Review

**Notes:**
