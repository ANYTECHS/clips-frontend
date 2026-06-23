# Wallet Connection Button - UI Preview

This document shows the visual appearance of the wallet connection button in different states.

---

## 🎨 UI States

### 1. Disconnected State (Default)

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  [G]  Continue with Google                           │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  []  Continue with Apple                            │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  [💼]  Connect Stellar Wallet                        │ │ ← NEW
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Styling:**
- Background: `bg-brand/10` (light green tint)
- Border: `border-brand/30` (green border)
- Text: `text-brand` (bright green #00E58F)
- Hover: `hover:bg-brand/20` (slightly darker green)
- Icon: Wallet icon from lucide-react

---

### 2. Connecting State (Loading)

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  [⟳]  Connecting Wallet...                          │ │ ← LOADING
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Styling:**
- Same colors as disconnected state
- Spinner icon (animated rotation)
- Button is disabled: `disabled:opacity-50 disabled:cursor-not-allowed`
- Text changes to "Connecting Wallet..."

---

### 3. Connected State (Success)

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  [✓] GTES...3456              [Disconnect]          │ │ ← CONNECTED
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Styling:**
- Background: `bg-brand/10` (light green tint)
- Border: `border-brand/30` (green border)
- Text: `text-brand` (bright green)
- Check icon on the left
- Truncated address in the middle
- Disconnect button on the right (underlined, smaller text)

**Address Format:**
- Full: `GTEST123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ123456`
- Truncated: `GTES...3456` (first 4 + last 4 characters)

---

### 4. Error State

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  [💼]  Connect Stellar Wallet                        │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  [⚠]  Freighter wallet is not installed. Please     │ │ ← ERROR
│  │       install the Freighter browser extension.       │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Styling:**
- Background: `bg-error/10` (light red tint)
- Border: `border-error/30` (red border)
- Text: `text-error` (red)
- Alert icon on the left
- Error message wraps to multiple lines if needed

**Common Error Messages:**
1. "Freighter wallet is not installed. Please install the Freighter browser extension."
2. "Connection was rejected. Please approve the connection in Freighter."
3. "Failed to connect to Freighter wallet"

---

## 🎯 Complete Auth Form Layout

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  Welcome back                                                │
│  Log in to start creating viral content                     │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  [G]  Continue with Google                             │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  []  Continue with Apple                              │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  [💼]  Connect Stellar Wallet                          │ │ ← NEW
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ─────────────────── OR EMAIL ───────────────────────      │
│                                                              │
│  Email address                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  name@company.com                                      │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Password                                    Forgot password?│
│  ┌────────────────────────────────────────────────────────┐ │
│  │  ••••••••                                              │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │           Continue with Email                          │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  New here? Sign up free                                     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 🎨 Color Palette

### Brand Colors (Wallet Button)
- **Primary**: `#00E58F` (bright green)
- **Background**: `rgba(0, 229, 143, 0.1)` (10% opacity)
- **Border**: `rgba(0, 229, 143, 0.3)` (30% opacity)
- **Hover**: `rgba(0, 229, 143, 0.2)` (20% opacity)

### Error Colors
- **Primary**: Red (from theme)
- **Background**: `rgba(red, 0.1)` (10% opacity)
- **Border**: `rgba(red, 0.3)` (30% opacity)

### Other Auth Buttons
- **Background**: `bg-surface-hover`
- **Border**: `border-border`
- **Text**: `text-white`
- **Hover**: `hover:bg-border`

---

## 📐 Dimensions

### Button Sizes
- **Width**: `w-full` (100% of container)
- **Padding**: `py-3.5` (vertical), `px-4` (horizontal for connected state)
- **Border Radius**: `rounded-[12px]`
- **Font Size**: `text-[14px]`
- **Font Weight**: `font-medium`

### Icon Sizes
- **Wallet Icon**: `w-[18px] h-[18px]`
- **Check Icon**: `w-[18px] h-[18px]`
- **Alert Icon**: `w-4 h-4`
- **Spinner**: `w-[18px] h-[18px]`

### Container
- **Width**: `w-[440px]`
- **Padding**: `p-[38px]`
- **Border Radius**: `rounded-[20px]`

---

## 🎬 Animations

### Button Hover
```css
transition-all duration-200
hover:bg-brand/20
```

### Spinner Rotation
```css
animate-spin
/* Continuous 360° rotation */
```

### State Transitions
```css
transition-all duration-300
/* Smooth fade between states */
```

---

## 📱 Responsive Behavior

### Desktop (440px container)
```
┌────────────────────────────────────────────────────────┐
│  [💼]  Connect Stellar Wallet                          │
└────────────────────────────────────────────────────────┘
```

### Mobile (full width)
```
┌──────────────────────────────────────────────────────┐
│  [💼]  Connect Stellar Wallet                        │
└──────────────────────────────────────────────────────┘
```

The button maintains the same styling across all screen sizes, using `w-full` to adapt to container width.

---

## 🔄 User Interaction Flow

### 1. Initial View
```
User sees: [💼] Connect Stellar Wallet
```

### 2. User Clicks Button
```
Button changes to: [⟳] Connecting Wallet...
Freighter popup appears
```

### 3. User Approves in Freighter
```
Button changes to: [✓] GTES...3456 [Disconnect]
Toast appears: "Wallet connected successfully!"
```

### 4. User Clicks Disconnect
```
Button changes back to: [💼] Connect Stellar Wallet
Toast appears: "Wallet disconnected"
```

### 5. Error Scenario
```
Button shows: [💼] Connect Stellar Wallet
Error box appears below: [⚠] Error message
```

---

## 🎯 Accessibility

### ARIA Labels
```tsx
<button
  aria-label="Connect Stellar Wallet"
  aria-busy={isConnecting}
  aria-disabled={isConnecting}
>
```

### Keyboard Navigation
- Tab to focus button
- Enter/Space to activate
- Tab to disconnect button when connected

### Screen Reader Announcements
- "Connect Stellar Wallet button"
- "Connecting to wallet, please wait"
- "Wallet connected, address GTES...3456"
- "Disconnect wallet button"

---

## 💡 Design Decisions

### Why Green for Wallet Button?
- Matches the brand color (#00E58F)
- Stands out from other auth options
- Indicates blockchain/crypto connection
- Positive, trustworthy color

### Why Truncate Address?
- Full addresses are too long (56 characters)
- First 4 + last 4 characters are sufficient for identification
- Maintains clean UI without horizontal scroll
- Standard practice in crypto UIs

### Why Show Network?
- Users need to know if they're on testnet or mainnet
- Prevents accidental transactions on wrong network
- Transparency builds trust

### Why Auto-reconnect?
- Better user experience
- Reduces friction on page refresh
- Standard behavior for wallet connections
- Users expect to stay connected

---

## 🎨 Visual Hierarchy

```
Priority 1: Email/Password Form (primary action)
Priority 2: OAuth Buttons (Google, Apple)
Priority 3: Wallet Connection (alternative method)
Priority 4: Mode Toggle (Login/Signup)
```

The wallet button is positioned between OAuth buttons and the email form, making it easily discoverable without overwhelming the primary authentication flow.

---

## 📊 Comparison with Other Auth Methods

| Method | Button Style | Icon | Color |
|--------|-------------|------|-------|
| Google | Gray background | Google logo | White text |
| Apple | Gray background | Apple logo | White text |
| **Wallet** | **Green tint** | **Wallet icon** | **Green text** |
| Email | Green solid | None | Black text |

The wallet button uses a unique color scheme to differentiate it from traditional OAuth methods while maintaining visual consistency with the overall design.

---

This UI implementation provides a clean, intuitive, and accessible wallet connection experience that seamlessly integrates with the existing authentication flow.
