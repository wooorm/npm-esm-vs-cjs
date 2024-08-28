/**
 * @import {Element} from 'hast'
 * @import {Style} from './crawl.js'
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import {csvFormat} from 'd3-dsv'
import {s} from 'hastscript'
import {toHtml} from 'hast-util-to-html'

const filesRaw = await fs.readdir(new URL('../data', import.meta.url))

/** @type {Array<string>} */
const datasets = []

for (const name of filesRaw) {
  const extension = path.extname(name)
  if (extension === '.json') {
    const base = path.basename(name, extension)

    // Only check date and `latest`.
    if (/^\d{4}-\d{2}-\d{2}/.test(base) || base === 'latest') {
      datasets.push(base)
    }
  }
}

/** @type {Array<Element | string>} */
const rows = []
const gutter = 32
const viewBox = {
  height: filesRaw.length * (32 + gutter) + gutter,
  width: 1024
}
const styles = datasets.length
const height = (viewBox.height - gutter * (styles + 1)) / styles

let accumulatedY = gutter

/** @type {Array<Record<string, number | string>>} */
const allCounts = []

for (const name of datasets) {
  /** @type {Record<string, Style>} */
  const data = JSON.parse(
    String(
      await fs.readFile(new URL('../data/' + name + '.json', import.meta.url))
    )
  )

  /** @type {Record<Style, number>} */
  // Note: sort order is important.
  const counts = {esm: 0, dual: 0, faux: 0, cjs: 0}
  let total = 0

  for (const name in data) {
    if (Object.hasOwn(data, name) && !name.startsWith('@types/')) {
      counts[data[name]]++
      total++
    }
  }

  let accumulatedX = gutter
  /** @type {Array<Element | string>} */
  const cells = []
  /** @type {Array<Element | string>} */
  const labels = []

  for (const key in counts) {
    if (Object.hasOwn(counts, key)) {
      const style = /** @type {Style} */ (key)
      const value = counts[style]
      const width = (value / total) * (viewBox.width - gutter * 2)
      cells.push(
        '\n',
        s('rect', {
          className: [style],
          height,
          width,
          x: accumulatedX,
          y: accumulatedY
        })
      )

      labels.push(
        '\n',
        s(
          'text',
          {
            textAnchor: 'middle',
            transform:
              'translate(' +
              (accumulatedX + width / 2) +
              ', ' +
              (accumulatedY + height / 2) +
              ')' +
              (width < 128 ? ' rotate(-45)' : '')
          },
          ((value / total) * 100).toFixed(1) + '%'
        )
      )

      accumulatedX += width
    }
  }

  // Add row label.
  labels.push(
    '\n',
    s(
      'text',
      {
        x: accumulatedX + gutter,
        y: accumulatedY + height / 2
      },
      name
    )
  )

  rows.push(s('g', [...cells, ...labels, '\n']))
  accumulatedY += height
  accumulatedY += gutter

  allCounts.push({date: name, total, ...counts})

  console.log()
  console.log(name)
  console.log('raw data: %j (total: %s)', counts, total)
}

const styleLabels = ['esm', 'dual', 'faux', 'cjs']
const width = 96
let accumulatedX = gutter
/** @type {Array<string | Element>} */
const cells = []
/** @type {Array<string | Element>} */
const labels = []

for (const style of styleLabels) {
  cells.push(
    '\n',
    s('rect', {
      className: [style],
      height,
      width,
      x: accumulatedX,
      y: accumulatedY
    })
  )

  labels.push(
    '\n',
    s(
      'text',
      {
        textAnchor: 'middle',
        transform:
          'translate(' +
          (accumulatedX + width / 2) +
          ', ' +
          (accumulatedY + height / 2) +
          ')'
      },
      style
    )
  )

  accumulatedX += width + gutter
}

rows.push('\n', s('g', [...cells, ...labels]), '\n')

viewBox.width += 192 // Enough space for labels of rows.
viewBox.height += gutter + height // Legend.

const tree = s(
  'svg',
  {
    viewBox: [0, 0, viewBox.width, viewBox.height].join(' '),
    xmlns: 'http://www.w3.org/2000/svg'
  },
  [
    s('title', 'ESM vs. CJS on npm'),
    '\n',
    s(
      'style',
      `
text { font-size: 24px; font-weight: bolder; font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji"; font-variant-numeric: tabular-nums; paint-order: stroke; dominant-baseline: middle; }
.b { fill: white; }
.esm { fill: white; }
.dual { fill: url(#a); }
.faux { fill: url(#b); }
.cjs { fill: url(#c); }
.esm, .dual, .faux, .cjs { stroke: #0d1117; stroke-width: 3px; }
text { fill: #0d1117; stroke: white; stroke-width: 3px; }
pattern line { stroke: #0d1117; stroke-width: 2px }
pattern rect { fill: #0d1117 }

@media (prefers-color-scheme: dark) {
  .b { fill: #0d1117; }
  .cjs, .dual, .esm, .faux { stroke: white; }
  .esm { fill: #0d1117; }
  text { fill: white; stroke: #0d1117; }
  pattern line { stroke: white; }
  pattern rect { fill: white }
}
`
    ),
    '\n',
    s('defs', [
      '\n',
      s(
        'pattern#a',
        {height: 6, patternUnits: 'userSpaceOnUse', width: 6, x: 0, y: 0},
        [s('line', {x1: 0, y1: 0, x2: 0, y2: 6})]
      ),
      '\n',
      s(
        'pattern#b',
        {height: 6, patternUnits: 'userSpaceOnUse', width: 6, x: 0, y: 0},
        [s('line', {x1: 0, y1: 0, x2: 6, y2: 0})]
      ),
      '\n',
      s(
        'pattern#c',
        {height: 6, patternUnits: 'userSpaceOnUse', width: 6, x: 0, y: 0},
        [s('rect', {height: 1, width: 1, x: 0, y: 0})]
      )
    ]),
    '\n',
    s('rect.b', {height: viewBox.height, width: viewBox.width, x: 0, y: 0}),
    '\n',
    s('g', ...rows),
    '\n'
  ]
)

const document = toHtml(tree, {space: 'svg'})

await fs.writeFile(new URL('../index.svg', import.meta.url), document + '\n')

await fs.writeFile(
  new URL('../index.csv', import.meta.url),
  csvFormat(allCounts) + '\n'
)
