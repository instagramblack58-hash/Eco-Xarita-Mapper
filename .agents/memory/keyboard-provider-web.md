---
name: KeyboardProvider web guard
description: Why KeyboardProvider must be native-only and which KAV to use on each screen
---

## Rule
`KeyboardProvider` from `react-native-keyboard-controller` must **not** be imported statically at the module top level in `_layout.tsx`. A static import triggers an "Invalid hook call" crash in `<RootLayout>` on web (Metro bundles the module even for web where it is not supported).

## Correct pattern in _layout.tsx
Use the conditional IIFE dynamic-require approach:

```ts
const KeyboardWrapper = Platform.OS === "web"
  ? ({ children }) => <View style={{ flex: 1 }}>{children}</View>
  : (() => {
      const { KeyboardProvider } = require("react-native-keyboard-controller");
      return ({ children }) => <KeyboardProvider>{children}</KeyboardProvider>;
    })();
```

## Downstream screens
Because `KeyboardProvider` is absent on web, any screen using `KeyboardAvoidingView` from `react-native-keyboard-controller` will emit the "Couldn't find real values for KeyboardContext" warning on web.

**Use react-native's built-in `KeyboardAvoidingView` for:**
- `app/auth.tsx` (simple login form — RN KAV works fine on iOS with behavior="padding")
- `app/report-detail.tsx` (comment form — RN KAV sufficient for this use-case)

Only introduce `react-native-keyboard-controller`'s KAV on screens where you are also certain `KeyboardProvider` is active (i.e., native-only screens or after adding a platform guard).

**Why:** Static import of `KeyboardProvider` crashes web with "Invalid hook call"; conditional dynamic require silences this but leaves KAV consumers without context on web, causing their own warning.
