# Eco-Xarita

A production-grade Triple-AAA Expo React Native mobile app for reporting environmental issues and finding recycling/waste disposal points across Uzbekistan. Built with Supabase, Google Maps (native), React Query, and Nunito fonts. All UI in Uzbek (O'zbekcha).

## Stack

- **Frontend**: Expo ~54 (React Native) with Expo Router (file-based routing)
- **Backend**: Express.js (TypeScript) on port 5000
- **Database & Auth**: Supabase (PostgreSQL + Auth + Storage + Realtime)
- **Maps**: Google Maps via `react-native-maps` (native), web fallback (report list)
- **Fonts**: Nunito (Google Fonts — Regular, SemiBold, Bold, ExtraBold)
- **State**: React Query v5 + React Context (AuthContext)
- **Haptics**: `expo-haptics` via `hooks/useHaptics.ts`

## Features

### Map Screen — `index.native.tsx` / `index.tsx`
- Full Google Maps integration (native) — web shows report list fallback
- 8 marker layers: reports, paper, plastic, mixed, glass, hazardous, waste bins, reverse vending machines
- Layer toggle panel with individual layer on/off
- `@gorhom/bottom-sheet` popup for each marker with full details, directions, verify button
- Verification system: `verify_point` RPC (+5 eko-ball per verification, logged in `verification_audit`)
- User location button
- Haptic feedback on verify success/error

### Reports Screen — `reports.tsx`
- Full text search by description / issue type
- Issue type filter chips (5 types + "Barchasi")
- Sort: Newest, Oldest, Most Popular
- Pull-to-refresh
- Empty state with CTA to create first report

### Report Modal — `report-modal.tsx`
- **Auth gate at start** — shows login CTA if not authenticated (with benefits list), no dead end
- 3-step wizard with progress bar
- Step 1: Issue type selection (5 types with icons + haptic selection)
- Step 2: Optional photo (camera or gallery) + description
- Step 3: GPS location confirmation (auto-detected)
- Photo upload to Supabase Storage `report-photos` bucket
- +10 eko-ball on submit
- Share after submission via native Share API
- Haptic feedback on step progression, selection, success/error

### Recycling Screen — `recycling.tsx`
- Full text search (name, address)
- Filter tabs: All, Paper, Plastic, Mixed, Glass, Hazardous, Bins, Avtomatlar
- Distance sorting via Haversine (after location permission)
- Stat chips with type counts
- Directions button per item
- Pull-to-refresh (all 3 data sources)

### Profile Screen — `profile.tsx`
- Guest view with login CTA when not authenticated
- Eco-score with level badge and progress bar
- 5 levels: Eko-boshlovchi → Eko-faol → Tabiat himoyachisi → Yashil elchi → Eko-qahramon
- 7 achievements with lock/unlock states
- Leaderboard (top 5 by eco-score)
- My recent reports (last 3)
- Stats: report count, verification count, confirmations, achievements
- Edit name inline modal
- Sign out with confirmation
- Pull-to-refresh (profile + queries)
- About section (author: Yursinaliyev Muhammadaziz)

### Auth Screen — `auth.tsx`
- Email/password login and signup toggle (segmented control)
- **Visual input focus states** (green border + green background on active field)
- **Inline field validation errors** (under each field, not just alerts)
- Password strength indicator during signup
- Forgot password flow (sends reset email)
- Uzbek-localized error messages
- Haptic feedback on success/error/validation fail

### Report Detail — `report-detail.tsx`
- Photo hero image, issue type badge
- Confirmation count + confirm button (+1 ball, haptic)
- Share button, map link (native maps)
- Real comments system with author initials avatar
- `KeyboardAvoidingView` for comment input
- Haptic feedback on confirm success/error and comment send

### Eko-Do'kon — `shop.tsx`
- **Auth gate** for guests (benefit list + CTA to login)
- Balance card showing current eko-ball count (yashil karta)
- Category filter chips: Barchasi, Transport, Oziq-ovqat, Ko'rik, Mahsulot
- 2-column product grid — emoji icon, name, price badge, "Sotib olish" button
- Disabled state ("Yetarli emas") if balance is insufficient
- Bottom sheet purchase confirmation — shows price, current balance, remaining after purchase
- Haptic feedback on success/error
- "Xaridlar tarixi" tab — paginated purchase history with emoji + name + date + balls spent
- Pull-to-refresh (items + purchases + profile balance)

### Settings Screen — `settings.tsx`
- **Auth-aware**: shows user account card + sign-out when logged in; shows login CTA when guest
- App banner with version
- 4-step how-to guide
- Mission/about section
- Feedback email link, privacy/terms links
- Author credit

## Key Environment Variables

- `EXPO_PUBLIC_SUPABASE_URL` — Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon/public key
- `EXPO_PUBLIC_DOMAIN` — set automatically by Replit

## Supabase Setup

Run `supabase-final.sql` in the Supabase Dashboard SQL Editor to create all tables, functions, RLS policies, and seed data.

**Tables:**
- `reports` — environmental reports with `issue_type`, GPS coords, photo_url
- `recycling_points` — recycling centers (paper/plastic/mixed/glass/hazardous)
- `waste_bins` — waste bin locations by bin_type
- `reverse_vending_machines` — plastic bottle return machines with reward info
- `profiles` — user eco-score, level, full_name (auto-created on signup)
- `report_comments` — comments with author_name
- `report_confirmations` — prevents duplicate confirmations
- `verification_audit` — logs all verify_point actions

**Functions:**
- `confirm_report(report_id, confirming_user_id)` — safe confirmation
- `increment_eco_score(user_id, points)` — upsert with auto-level
- `verify_point(p_point_type, p_point_id, p_user_id)` — +5 eko-ball per verification
- `handle_new_user()` — trigger to create profile on signup

**Storage:** Create bucket `report-photos` (public) in Supabase Dashboard.

## File Structure

```
app/
  _layout.tsx           # Root layout: providers, fonts, error boundary
  (tabs)/
    _layout.tsx         # Tab layout (NativeTabs iOS 26 / BlurView classic)
    index.native.tsx    # Native map screen (Google Maps, 8 layers, bottom sheet)
    index.tsx           # Web fallback (report list)
    reports.tsx         # Reports list — search, sort, filter, pull-to-refresh
    recycling.tsx       # Recycling + bins + machines — search, filter, distance, pull-to-refresh
    profile.tsx         # Profile — eco-score, achievements, leaderboard, pull-to-refresh
  auth.tsx              # Login/signup — focus states, inline validation, haptics
  report-modal.tsx      # Auth gate + 3-step report wizard, haptics
  report-detail.tsx     # Report detail — confirm, comments, keyboard, haptics
  settings.tsx          # Auth-aware settings — user card OR login CTA
components/
  ErrorBoundary.tsx     # App-level crash recovery
  NotificationHandler.tsx  # Push notification setup (native-only, safe)
context/
  AuthContext.tsx       # Supabase session + profile state
hooks/
  useHaptics.ts         # Centralized haptic feedback hook
lib/
  supabase.ts           # Client + types + RPC helpers
  query-client.ts       # React Query client
  maps-stub.web.js      # Web stub for react-native-maps (prevents bundle error)
constants/
  colors.ts             # Green theme (#2E7D32 primary)
  shadow.ts             # Cross-platform shadow presets
metro.config.cjs        # resolveRequest hook to redirect maps on web
supabase-final.sql      # Complete DB schema + functions + seed data
```

## Architecture Notes

- Web bundling: `metro.config.cjs` swaps `react-native-maps` → `lib/maps-stub.web.js` on web
- Haptics: `hooks/useHaptics.ts` wraps `expo-haptics` with dynamic import (safe on web)
- Distance sorting: client-side Haversine formula (no server needed)
- Photos: Supabase Storage `report-photos` bucket (public, no RLS on reads)
- Eco-score: managed via Supabase RPC with conflict-safe upserts
- Auth state: `AuthContext` with `onAuthStateChange` listener, profile auto-fetch
