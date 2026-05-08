import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    "carbon-site-kit": "src/global.ts"
  },
  format: ["iife"],
  globalName: "CarbonSiteKit",
  outDir: "dist",
  outExtension() {
    return {
      js: ".min.js"
    };
  },
  minify: true,
  platform: "browser",
  clean: true,
  dts: true,
  sourcemap: true
});
