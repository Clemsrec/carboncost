---
"carbone-cost": minor
---

Add `carbone-cost/react`, with `useCarbon()` and a `<CarbonBadge />`.

```tsx
"use client";
import { usePathname } from "next/navigation";
import { CarbonBadge } from "carbone-cost/react/badge";

export function Footer() {
  return <CarbonBadge route={usePathname()} locale="fr" href="/empreinte-carbone" />;
}
```

React is an optional peer dependency, so importing `carbone-cost` or
`carbone-cost/browser` never pulls it in.

The route is passed in rather than read from a router, so nothing here is tied
to a framework. In the App Router that is `usePathname()`.

**The React layer shares one collector across every consumer.** `observePage()`
throws on a second start, which is the right rule for the primitive — `buffered:
true` replays history, so two collectors double-count everything — but an app
with a badge in each layout would hit it immediately. The store reference-counts
subscribers, starts the collector on the first and stops it on the last, and
hands everyone the same snapshot. `getServerSnapshot` is stable and empty, so
hydration has nothing to mismatch on.

`<CarbonBadge />` ships almost no styling, and takes a render function when the
default is not wanted. A badge lives in someone else's footer, and a component
that arrives with opinions about borders gets reimplemented rather than used.
