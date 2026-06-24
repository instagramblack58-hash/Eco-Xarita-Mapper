---
name: Skeleton & PressableScale components
description: Reusable animated skeleton loading and press-scale components for Eco-Xarita
---

## Rule
Always use components/Skeleton.tsx and components/PressableScale.tsx for loading states and interactive cards.

## Skeleton exports
- `Skeleton` — basic shimmer block (width, height, borderRadius, style props)
- `SkeletonReportCard` — mimics report card layout (80px thumb + body lines)
- `SkeletonShopCard` — mimics shop 2-col grid card
- `SkeletonListItem` — mimics recycling list item (icon + 3 text lines)
- `SkeletonProfileStat` — mimics profile stat card

## Usage pattern
Replace `ActivityIndicator` and null `ListEmptyComponent` with skeleton arrays in FlatList ListEmptyComponent when `isLoading` is true.

## Why
Using skeletons instead of spinners dramatically improves perceived performance and makes the app feel premium.

## How to apply
When adding skeleton to a FlatList:
```jsx
ListEmptyComponent={
  isLoading ? (
    <View style={styles.skeletonWrap}>
      {[0,1,2,3,4,5].map(i => <View key={i} style={styles.skeletonItem}><SkeletonXxx /></View>)}
    </View>
  ) : <EmptyState />
}
```
Add styles: `skeletonWrap: { paddingHorizontal: 14, paddingTop: 10, gap: 10 }`, `skeletonItem: { borderRadius: 16, overflow: "hidden" }`

## CRITICAL: Never call useAnimatedStyle in .map()
The Skeleton component uses useSharedValue internally — each instance is a separate component so it's fine. But never add Reanimated hooks inside renderItem or .map() — always extract to a named component.
