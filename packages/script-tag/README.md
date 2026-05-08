# @carbon-site-kit/script-tag

Script-tag / CDN distribution that exposes `window.CarbonSiteKit`.

## Install

```bash
pnpm add @carbon-site-kit/script-tag
```

## CDN usage

```html
<script src="https://cdn.example.com/carbon-site-kit.min.js"></script>
<script>
  window.CarbonSiteKit.init({ endpoint: "/api/carbon" });
  window.CarbonSiteKit.trackPageview({ bytesTransferred: 1823400 });
</script>
```

## Exposed global methods

- `window.CarbonSiteKit.init(config)`
- `window.CarbonSiteKit.trackPageview(options)`
- `window.CarbonSiteKit.trackAIUsage(options)`
- `window.CarbonSiteKit.explain()`
