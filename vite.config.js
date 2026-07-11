import {defineConfig, loadEnv} from "vite"
import tailwindcss from "@tailwindcss/vite"
import fs from "node:fs"
import path from "node:path"
import {createRequire} from "node:module"

const buildDate = new Date()
const appVersionDate = [
  buildDate.getUTCFullYear(),
  String(buildDate.getUTCMonth() + 1).padStart(2, "0"),
  String(buildDate.getUTCDate()).padStart(2, "0"),
].join("")

const injectAppVersionDate = () => ({
  name: "inject-app-version-date",
  transformIndexHtml: html => html.replaceAll("%APP_VERSION_DATE%", appVersionDate),
})

// index.html is static, so it can't `import` an icon the way src/icons.js does.
// This inlines Heroicons straight from the installed package at build time,
// keeping the package the single source of truth (no copied path data) while
// costing nothing at runtime and never flashing un-rendered icons.
//
//   <i data-heroicon="x-mark"></i>
//   <i data-heroicon="heart" data-heroicon-style="solid" data-heroicon-class="size-5"></i>
const HEROICON_TAG = /<i\s+data-heroicon="([\w-]+)"((?:\s+data-heroicon-(?:style|class)="[^"]*")*)\s*><\/i>/g
const attrOf = (attrs, name) => attrs.match(new RegExp(`data-heroicon-${name}="([^"]*)"`))?.[1]

const inlineHeroicons = () => {
  const require = createRequire(import.meta.url)
  const root = path.dirname(require.resolve("heroicons/package.json"))
  return {
    name: "inline-heroicons",
    transformIndexHtml: html =>
      html.replace(HEROICON_TAG, (_match, name, attrs) => {
        const style = attrOf(attrs, "style") ?? "outline"
        const cls = attrOf(attrs, "class") ?? "size-6 shrink-0"
        const file = path.join(root, "24", style, `${name}.svg`)
        if (!fs.existsSync(file)) throw new Error(`[inline-heroicons] unknown icon: 24/${style}/${name}`)
        return fs
          .readFileSync(file, "utf8")
          .replace(/\n\s*/g, " ")
          .trim()
          .replace(/^<svg /, `<svg class="${cls}" `)
      }),
  }
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, ".", "")
  // Only genuine standalone preview deploys are served at the domain root.
  // Production AND the staging custom environment are served under the portal
  // subpath (/hydroviewer/), so both must honor VITE_BASE_PATH. VERCEL_ENV is
  // "preview" for a custom environment, so key off VERCEL_TARGET_ENV, which
  // carries the custom environment name ("staging").
  const targetEnv = env.VERCEL_TARGET_ENV || env.VERCEL_ENV
  const servedAtRoot =
    env.VERCEL === "1" && targetEnv !== "production" && targetEnv !== "staging"

  return {
    base: servedAtRoot ? "/" : env.VITE_BASE_PATH || "/",
    plugins: [tailwindcss(), inlineHeroicons(), injectAppVersionDate()],
    worker: {
      format: "es", // Use ES modules in workers
    },
    build: {
      target: "esnext",
    },
    define: {
      global: "globalThis",
    },
  }
})
