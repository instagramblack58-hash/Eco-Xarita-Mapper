# Eco-Xarita

An Expo React Native mobile app for reporting environmental issues and finding recycling/waste points in Uzbekistan. Built with Supabase for backend and Yandex Maps for mapping.

## Stack

- **Frontend**: Expo (React Native) with Expo Router (file-based routing)
- **Backend**: Express.js (TypeScript) on port 5000
- **Database & Auth**: Supabase (PostgreSQL + Auth + Storage)
- **Maps**: Yandex Maps API (via WebView)
- **Fonts**: Nunito (Google Fonts)
- **State**: React Query + React Context

## Features

- Interactive Yandex Map centered on all of Uzbekistan (zoom 6)
- 7 marker types: reports (red), paper (blue), plastic (purple), mixed (green), glass (orange), hazardous (dark), waste bins (cyan)
- Layer filter panel to toggle specific marker types on/off
- User location button (blue dot + center-on-me)
- Clustered markers for better performance
- Multi-step report modal with 5 issue types (illegal dumping, tree cutting, water pollution, air pollution, other)
- Photo upload via camera or gallery
- Share reports after submission
- Recycling points list with search, filter by type, sort by distance (Haversine)
- Directions button on each recycling/bin item
- Waste bins as separate layer and list category
- Report list with issue type badges, time ago, confirmation count
- Report detail with issue type, share button, confirm button, map link, comments placeholder
- Supabase Auth (email/password)
- Full Uzbek language UI

## Key Environment Variables

- `EXPO_PUBLIC_SUPABASE_URL` — Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon/public key
- `EXPO_PUBLIC_YANDEX_MAPS_KEY` — Yandex Maps JS API key
- `EXPO_PUBLIC_DOMAIN` — set automatically by Replit

## Supabase Setup

Run `supabase-setup.sql` in the Supabase SQL Editor to create:
- `reports` table with `issue_type` column
- `recycling_points` table (paper/plastic/mixed/glass/hazardous types)
- `waste_bins` table
- `confirm_report` RPC function
- Row Level Security policies
- Pre-seeded data across Uzbekistan regions

Also create a **Storage bucket** named `report-photos` (public) in Supabase Dashboard → Storage.

## File Structure

```
app/
  _layout.tsx          # Root layout with providers (Auth, QueryClient, fonts)
  (tabs)/
    _layout.tsx        # Tab layout (NativeTabs for iOS 26, classic for others)
    index.tsx          # Map screen (Yandex Maps via WebView, all 7 layers)
    reports.tsx        # Reports list with issue type badges
    recycling.tsx      # Recycling + waste bins list with search/filter/distance
    profile.tsx        # User profile and stats
  auth.tsx             # Auth modal (login/signup)
  report-modal.tsx     # 3-step new report modal with issue type selection
  report-detail.tsx    # Report detail with share, confirm, map link
context/
  AuthContext.tsx      # Supabase Auth state
lib/
  supabase.ts          # Supabase client + types (Report, RecyclingPoint, WasteBin)
  query-client.ts      # React Query client
constants/
  colors.ts            # Green theme colors
supabase-setup.sql     # Database setup script (run in Supabase SQL Editor)
```

## Architecture

- Map is rendered via `react-native-webview` with injected Yandex Maps JS
- WebView ↔ React Native communication via `postMessage` for marker taps
- All 7 marker types with Yandex Maps `Clusterer` for performance
- Photos stored in Supabase Storage bucket `report-photos`
- `confirmations_count` updated via Supabase RPC `confirm_report`
- Distance sorting via Haversine formula (client-side)
