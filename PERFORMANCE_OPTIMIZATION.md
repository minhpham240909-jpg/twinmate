# Performance Optimization Guide

## Problem
The app became slow after adding reactbits.dev components because:
1. **ElectricBorder** uses expensive SVG filters that run continuously
2. Too many animations running simultaneously
3. Animations running even when elements aren't visible
4. No performance optimizations (lazy loading, intersection observer, etc.)

## Solution

### 1. Optimized Components Created
- `ElectricBorderOptimized` - Only renders when visible, respects reduced motion
- `FadeInOptimized` - Uses Intersection Observer
- `PulseOptimized` - Only animates when visible
- `BounceOptimized` - Only animates when visible

### 2. Optimization Strategy

#### ElectricBorder Usage
- **Before**: Used on every card/item in lists
- **After**: Only use on:
  - Highlighted/important items (high match scores >80%, high engagement >30 interactions)
  - Hero sections and key CTAs
  - Maximum 2-3 per page

#### Animation Optimization
- Use `FadeInOptimized` instead of `FadeIn` (lazy loads)
- Use `PulseOptimized` instead of `Pulse` (only when visible)
- Use `BounceOptimized` instead of `Bounce` (only when visible)
- Reduce animation delays (max 0.3s instead of unlimited)
- Reduce stagger delays (0.02-0.03s instead of 0.05s)

#### Performance Features
- Intersection Observer: Animations only start when elements are visible
- Reduced Motion: Respects user's `prefers-reduced-motion` setting
- Lazy SVG: ElectricBorder SVG only created when visible
- Reduced complexity: Lower chaos values, slower speeds

### 3. Pages Optimized
- ✅ `search/page.tsx` - Only ElectricBorder on match scores >80%
- ✅ `community/page.tsx` - Only ElectricBorder on high engagement posts (>30 interactions)

### 4. Pages Still Needing Optimization
- `dashboard/partners/page.tsx` - Many partner cards
- `groups/page.tsx` - Many group cards
- `connections/page.tsx` - Many connection cards
- `chat/partners/page.tsx` - Many conversation cards
- `chat/groups/page.tsx` - Many group conversation cards

### 5. Best Practices
1. **ElectricBorder**: Use sparingly - max 2-3 per page, only on highlighted items
2. **Animations**: Use optimized versions with `onlyWhenVisible={true}`
3. **Delays**: Keep delays minimal (0.02-0.03s for stagger, max 0.3s total)
4. **Lists**: Use simple CSS borders for regular cards, ElectricBorder only for special ones
5. **Performance**: Test with many items (50+) to ensure smooth scrolling

## Migration Guide

### Replace Imports
```tsx
// Old
import ElectricBorder from '@/components/landing/ElectricBorder'
import Pulse from '@/components/ui/Pulse'
import FadeIn from '@/components/ui/FadeIn'
import Bounce from '@/components/ui/Bounce'

// New
import ElectricBorderOptimized from '@/components/landing/ElectricBorderOptimized'
import PulseOptimized from '@/components/ui/PulseOptimized'
import FadeInOptimized from '@/components/ui/FadeInOptimized'
import BounceOptimized from '@/components/ui/BounceOptimized'
```

### Update Usage
```tsx
// Old - ElectricBorder on every item
{items.map((item, index) => (
  <FadeIn delay={index * 0.05}>
    <ElectricBorder>
      <Card>{item.content}</Card>
    </ElectricBorder>
  </FadeIn>
))}

// New - ElectricBorder only on highlighted items
{items.map((item, index) => {
  const cardContent = <Card>{item.content}</Card>
  return (
    <FadeInOptimized delay={Math.min(index * 0.02, 0.2)}>
      {item.isHighlighted ? (
        <ElectricBorderOptimized onlyWhenVisible={true}>
          {cardContent}
        </ElectricBorderOptimized>
      ) : (
        cardContent
      )}
    </FadeInOptimized>
  )
})}
```

### Update Pulse
```tsx
// Old
<Pulse>
  <Badge>{count}</Badge>
</Pulse>

// New
<PulseOptimized onlyWhenVisible={true}>
  <Badge>{count}</Badge>
</PulseOptimized>
```

