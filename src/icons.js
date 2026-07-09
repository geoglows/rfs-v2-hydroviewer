// Heroicons (https://heroicons.com) for markup that is built as HTML strings in
// JS and therefore can't use the <i data-heroicon> placeholders that the
// inline-heroicons Vite plugin expands inside index.html.
//
// The SVG source is imported straight from the pinned `heroicons` package, so
// there is no copied path data to drift out of date. Vite inlines the file
// contents at build time via the `?raw` suffix.
import chartLineSvg from "heroicons/24/outline/presentation-chart-line.svg?raw"
import trashSvg from "heroicons/24/outline/trash.svg?raw"
import heartOutlineSvg from "heroicons/24/outline/heart.svg?raw"
import heartSolidSvg from "heroicons/24/solid/heart.svg?raw"

const withClass = (svg, cls = "size-6 shrink-0") =>
  svg
    .replace(/\n\s*/g, " ")
    .trim()
    .replace(/^<svg /, `<svg class="${cls}" `)

export const chartLine = withClass(chartLineSvg)
export const trash = withClass(trashSvg)
export const heartOutline = withClass(heartOutlineSvg)
export const heartSolid = withClass(heartSolidSvg)
