# Eco-Xarita

A production-grade Expo React Native mobile app for reporting environmental issues and finding recycling/waste disposal points across Uzbekistan. Built with Supabase (PostgreSQL + Auth + Storage), Yandex Maps (WebView), React Query, and Nunito fonts.

## Stack

- **Frontend**: Expo ~54 (React Native) with Expo Router (file-based routing)
- **Backend**: Express.js (TypeScript) on port 5000
- **Database & Auth**: Supabase (PostgreSQL + Auth + Storage + Realtime)
- **Maps**: Yandex Maps JS API 2.1 (via WebView + postMessage)
- **Fonts**: Nunito (Google Fonts — Regular, SemiBold, Bold, ExtraBold)
- **State**: React Query v5 + React Context (AuthContext)

## Features

### Map (index.tsx)
- Interactive Yandex Map centered on all of Uzbekistan (zoom 6)
- 7 marker types: reports (red), paper (blue), plastic (purple), mixed (green), glass (orange), hazardous (dark), waste bins (cyan)
- Layer filter panel to toggle individual marker types on/off
- Glassmorphism bottom-sheet popups with slide-up animation for all markers
- User location button with re-center animation
- Clustered markers for performance
- Today's report count stats pill overlay
- Live Supabase Realtime subscriptions for new reports (non-web)
- One-tap directions from map popup
- Refresh button to pull latest data

### Reports Screen (reports.tsx)
- Full text search by description / issue type
- **Issue type filter chips** (All, Axlat, Daraxt, Suv, Havo, Boshqa) — colored active state
- Sort: Newest, Oldest, Most Popular (confirmed)
- Issue type badges with colored icons
- Time-ago display
- Pull-to-refresh
- Empty state with CTA to create first report

### Report Modal (report-modal.tsx)
- 3-step form with progress bar
- Step 1: Issue type selection (5 types with icons)
- Step 2: Optional photo (camera or gallery) + description
- Step 3: GPS location confirmation (auto-detected)
- Share after submission via native Share API
- Invalidates both map and reports query caches

### Recycling Screen (recycling.tsx)
- Full text search (name, address)
- Filter tabs: All, Paper, Plastic, Mixed, Glass, Hazardous, Bins
- Distance sorting via Haversine (after location permission)
- Stat chips with type counts
- Directions button per item

### Profile Screen (profile.tsx)
- Eco-score display with level badge and progress bar
- 5 levels: Eko-boshlovchi → Eko-faol → Tabiat himoyachisi → Yashil elchi → Eko-qahramon
- 7 achievements with lock/unlock states
- Leaderboard (top 5 by eco-score from Supabase)
- My recent reports (last 3)
- Stats: report count, confirmation count, achievements count
- Sign out with confirmation

### Auth Screen (auth.tsx)
- Email/password login and signup toggle (segmented control)
- Full name field during signup
- Forgot password flow (sends reset email via Supabase)
- Uzbek-localized error messages
- Keyboard returnKeyType navigation between fields

### Report Detail (report-detail.tsx)
- Photo hero image
- Issue type badge
- Confirmation count + one-tap confirm (with eco-score increment, +1 ball)
- Share button
- Map link (opens native maps app)
- Real comments system (add, view, with author name and time-ago)
- KeyboardAvoidingView for comment input

### Settings Screen (settings.tsx)
- App banner with version
- 4-step how-to guide
- Mission/about section
- Feedback email link, privacy policy, terms links

### Profile Screen (profile.tsx) — fully updated
- Shows full_name (not email) as display name
- Edit name inline modal with save
- Settings navigation link in header + menu
- Leaderboard shows full_name of users

## Key Environment Variables

- `EXPO_PUBLIC_SUPABASE_URL` — Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon/public key
- `EXPO_PUBLIC_YANDEX_MAPS_KEY` — Yandex Maps JS API key
- `EXPO_PUBLIC_DOMAIN` — set automatically by Replit

## Supabase Setup

Run `supabase-setup.sql` in the Supabase SQL Editor to create all tables, functions, triggers, RLS policies, and seed data.

**Tables created:**
- `reports` — environmental issue reports with `issue_type` column
- `recycling_points` — recycling centers (paper/plastic/mixed/glass/hazardous)
- `waste_bins` — waste bin locations by type
- `profiles` — user eco-score and level (auto-created on signup via trigger)
- `saved_locations` — user bookmarks
- `report_comments` — user comments on reports (with author_name)
- `report_confirmations` — prevents duplicate confirmations

**Functions:**
- `confirm_report(report_id, user_id)` — upsert-safe confirmation + count update
- `increment_eco_score(user_id, points)` — upsert with auto-level calculation
- `handle_new_user()` — trigger to create profile on signup

Also create a **Storage bucket** named `report-photos` (public) in Supabase Dashboard → Storage.

**For Realtime** (live map updates): In Supabase Dashboard → Database → Replication, add `reports` table to the `supabase_realtime` publication.

## File Structure

```
app/
  _layout.tsx          # Root layout: providers, fonts, error boundary
  (tabs)/
    _layout.tsx        # Tab layout (NativeTabs iOS 26 / BlurView classic)
    index.tsx          # Map screen — Yandex Maps, 7 layers, realtime
    reports.tsx        # Reports list — search, sort, badges
    recycling.tsx      # Recycling + bins — search, filter, distance
    profile.tsx        # Profile — eco-score, achievements, leaderboard
  auth.tsx             # Login/signup modal
  report-modal.tsx     # 3-step report creation modal
  report-detail.tsx    # Report detail — confirm, share, map link
components/
  ErrorBoundary.tsx    # App-level crash recovery
  NotificationHandler.tsx  # Push notification setup (native-only)
  KeyboardAwareScrollViewCompat.tsx
context/
  AuthContext.tsx      # Supabase session + profile state
lib/
  supabase.ts          # Client + types (Report, RecyclingPoint, WasteBin, Profile, SavedLocation)
  query-client.ts      # React Query client with default fetcher
constants/
  colors.ts            # Green theme (#2E7D32 primary)
supabase-setup.sql     # Full DB setup + seed data (run in Supabase SQL Editor)
```

## Architecture

- Map rendered via `react-native-webview` with full Yandex Maps HTML injected
- WebView ↔ React Native via `postMessage` for marker taps, directions, navigation
- All 7 marker types clustered via Yandex `Clusterer`
- Glassmorphism bottom-sheet popup with CSS cubic-bezier slide-up animation
- Photos stored in Supabase Storage `report-photos` bucket (public)
- Eco-score managed via Supabase RPC with conflict-safe upserts
- Distance sorting via client-side Haversine formula
- Supabase Realtime channel on reports table (native only, web not supported)
- NotificationHandler uses dynamic import so it's never loaded on web
