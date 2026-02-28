# Eco-Xarita

An Expo React Native mobile app for reporting environmental issues and finding recycling points in Uzbekistan. Built with Supabase for backend and Yandex Maps for mapping.

## Stack

- **Frontend**: Expo (React Native) with Expo Router (file-based routing)
- **Backend**: Express.js (TypeScript) on port 5000
- **Database & Auth**: Supabase (PostgreSQL + Auth + Storage)
- **Maps**: Yandex Maps API (via WebView)
- **Fonts**: Nunito (Google Fonts)
- **State**: React Query + React Context

## Features

- Interactive Yandex Map with report markers (red) and recycling point markers (colored by type)
- Report environmental issues: photo upload, description, auto-geolocation
- Confirm reports (authenticated users only)
- Recycling points list (paper=blue, plastic=purple, mixed=green)
- Supabase Auth (email/password)
- Full Uzbek language UI

## Key Environment Variables

- `EXPO_PUBLIC_SUPABASE_URL` — Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon/public key
- `EXPO_PUBLIC_YANDEX_MAPS_KEY` — Yandex Maps JS API key
- `EXPO_PUBLIC_DOMAIN` — set automatically by Replit

## Supabase Setup

Run `supabase-setup.sql` in the Supabase SQL Editor to create:
- `reports` table (id, lat, lng, description, photo_url, user_id, created_at, confirmations_count)
- `recycling_points` table (id, lat, lng, type, name, address)
- `confirm_report` RPC function
- Row Level Security policies
- Pre-seeded recycling points in Tashkent

Also create a **Storage bucket** named `report-photos` (public) in Supabase Dashboard → Storage.

## File Structure

```
app/
  _layout.tsx          # Root layout with providers (Auth, QueryClient, fonts)
  (tabs)/
    _layout.tsx        # Tab layout (NativeTabs for iOS 26, classic for others)
    index.tsx          # Map screen (Yandex Maps via WebView)
    reports.tsx        # Reports list
    recycling.tsx      # Recycling points list
    profile.tsx        # User profile
  auth.tsx             # Auth modal (login/signup)
  report-modal.tsx     # New report modal
  report-detail.tsx    # Report detail screen
context/
  AuthContext.tsx      # Supabase Auth state
lib/
  supabase.ts          # Supabase client + types
  query-client.ts      # React Query client
constants/
  colors.ts            # Green theme colors
supabase-setup.sql     # Database setup script
```

## Architecture

- Map is rendered via `react-native-webview` with injected Yandex Maps JS
- WebView ↔ React Native communication via `postMessage` for marker taps and map clicks
- Photos stored in Supabase Storage bucket `report-photos`
- confirmations_count updated via Supabase RPC function `confirm_report`
