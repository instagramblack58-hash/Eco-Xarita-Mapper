# Eco-Xarita

A production-grade Triple-AAA Expo React Native mobile app for reporting environmental issues and finding recycling/waste disposal points across Uzbekistan. Built with Supabase, Google Maps (native), React Query, and Nunito fonts. All UI in Uzbek (O'zbekcha).

## Stack

- **Frontend**: Expo ~54 (React Native) with Expo Router (file-based routing)
- **Backend**: Express.js (TypeScript) on port 5000
- **Database & Auth**: Supabase (PostgreSQL + Auth + Storage + Realtime)
- **Maps**: Google Maps via `react-native-maps` 1.18.0 (native), web fallback (report list)
- **Fonts**: Nunito loaded from local `assets/fonts/*.ttf` (no CDN dependency)
- **State**: React Query v5 + React Context (AuthContext)
- **Haptics**: `expo-haptics` via `hooks/useHaptics.ts`

## Screens (6 tabs + 3 stacks)

### 1. Xarita — `index.native.tsx` / `index.tsx`
- Full Google Maps (native) with 8 marker layers: reports, paper, plastic, mixed, glass, hazardous, waste bins, reverse vending machines
- Layer toggle panel, `@gorhom/bottom-sheet` per marker, verify button (+5 eko-ball), user location
- Web fallback: report list with stat chips

### 2. Muammolar — `reports.tsx`
- Search, 5-type filter chips, sort (Yangi/Eski/Mashhur), pull-to-refresh
- Empty state with CTA, touch targets ≥44pt

### 3. Qayta ishlash — `recycling.tsx`
- Search + 8-type filter tabs, Haversine distance sort, stat chips, directions button
- Card names display fully (no truncation), pull-to-refresh

### 4. Eko-Do'kon — `shop.tsx`
- Auth gate for guests, balance card (yashil karta), 4-category filter (Transport, Oziq-ovqat, Ko'rik, Mahsulot)
- 2-column product grid, "Yetarli emas" disabled state
- Purchase confirmation bottom sheet (price + balance + remaining)
- Xaridlar tarixi tab (paginated history), haptics, pull-to-refresh

### 5. Profil — `profile.tsx`
- Guest view with login CTA; logged-in: eco-score, 5 levels, 7 achievements, leaderboard, recent reports
- Edit name modal, sign out, pull-to-refresh

### 6. Auth — `auth.tsx` (modal)
- Login/signup toggle, visual focus states, inline validation, password strength, forgot password, haptics

### 7. Hisobot qo'shish — `report-modal.tsx` (modal)
- Auth gate → 3-step wizard (type → photo+desc → GPS), +10 eko-ball, Share, haptics

### 8. Hisobot tafsiloti — `report-detail.tsx` (stack)
- Photo hero, confirm (+1 ball), comments with KeyboardAvoidingView, share, haptics

### 9. Sozlamalar — `settings.tsx` (stack)
- Auth-aware (user card OR login CTA), how-to guide, mission, author credit

## Key Environment Variables

- `EXPO_PUBLIC_SUPABASE_URL` — Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon/public key
- `EXPO_PUBLIC_DOMAIN` — set automatically by Replit

## Supabase Setup

Run `supabase-final.sql` in the Supabase Dashboard → SQL Editor.

**Tables:** `reports`, `recycling_points`, `waste_bins`, `reverse_vending_machines`, `profiles`, `report_comments`, `report_confirmations`, `verification_audit`, `shop_items`, `purchases`

**RPC Functions:**
- `confirm_report(report_id, confirming_user_id)` — +1 ball, duplicate-safe
- `increment_eco_score(user_id, points)` — upsert with auto-level
- `verify_point(p_point_type, p_point_id, p_user_id)` — +5 ball, logged
- `handle_new_user()` — trigger to create profile on signup
- `purchase_item(p_item_id, p_user_id)` — deduct balls, record purchase

**Storage:** Create bucket `report-photos` (public) in Supabase Dashboard.

**Seed data:** 35 recycling points, 15 waste bins, 5 reverse vending machines, 14 shop items across Uzbekistan.

## File Structure

```
app/
  _layout.tsx             # Root layout: local font loading, providers, error boundary
  (tabs)/
    _layout.tsx           # 5-tab layout (NativeTabs iOS 26 / BlurView classic)
    index.native.tsx      # Native map (Google Maps, 8 layers, bottom sheet)
    index.tsx             # Web fallback (report list + stat chips)
    reports.tsx           # Reports — search, filter, sort, pull-to-refresh
    recycling.tsx         # Recycling + bins + machines — full names, no truncation
    shop.tsx              # Eko-Do'kon — balance card, grid, purchase modal, history
    profile.tsx           # Profile — eco-score, achievements, leaderboard
  auth.tsx                # Login/signup modal
  report-modal.tsx        # Auth gate + 3-step wizard
  report-detail.tsx       # Detail — confirm, comments, keyboard
  settings.tsx            # Auth-aware settings
assets/
  fonts/                  # Nunito TTF files (local, no CDN)
    Nunito_400Regular.ttf
    Nunito_600SemiBold.ttf
    Nunito_700Bold.ttf
    Nunito_800ExtraBold.ttf
  images/                 # icon.png, splash-icon.png, adaptive Android icons
web/
  index.html              # Web template: font timeout suppression handler
components/
  ErrorBoundary.tsx
  NotificationHandler.tsx
context/
  AuthContext.tsx
hooks/
  useHaptics.ts
lib/
  supabase.ts             # Client + all types (ShopItem, Purchase, etc.) + RPC helpers
  query-client.ts
  maps-stub.web.js
constants/
  colors.ts               # #2E7D32 primary green
  shadow.ts
metro.config.cjs
supabase-final.sql        # Complete schema + seed + shop tables
```

## Architecture Notes

- **Fonts**: Local TTF via `Font.loadAsync` (native) / native `window.FontFace` API (web) — no CDN, no timeout
- **Web font errors**: `window.addEventListener('unhandledrejection', ...)` in `web/index.html` suppresses Metro overlay
- **Web bundling**: `metro.config.cjs` swaps `react-native-maps` → `lib/maps-stub.web.js`
- **Haptics**: `hooks/useHaptics.ts` wraps `expo-haptics` with dynamic import (safe on web)
- **Distance sorting**: client-side Haversine (no server needed)
- **Photos**: Supabase Storage `report-photos` bucket (public)
- **Eco-score**: Supabase RPC with conflict-safe upserts
- **Auth**: `AuthContext` with `onAuthStateChange`, profile auto-fetch
- **Touch targets**: All interactive elements ≥44pt (Apple HIG compliant)
- **Safe areas**: `useSafeAreaInsets()` on all screens, no hardcoded padding
- **Tab bar**: 84px height, paddingBottom 34 (home indicator safe)

## App Store Readiness

- `app.json`: bundle ID `com.ecoxarita`, version `1.0.0`, portrait only
- Google Maps API key configured (iOS + Android)
- `ITSAppUsesNonExemptEncryption: false` (no export compliance needed)
- Custom eco-leaf app icon (all sizes), green splash screen `#2E7D32`
- EAS project ID: `e26973a4-7a5d-4431-a0ec-1949f4290695`
- Owner: `uz_dev`
- Author: Yursinaliyev Muhammadaziz (yursinaliyevm@gmail.com)

## User Preferences

- All UI text in Uzbek (O'zbekcha) — no English in the app UI
- Primary color: #2E7D32 (dark green)
- Font: Nunito (Regular/SemiBold/Bold/ExtraBold)
- No emoji in file comments or code
