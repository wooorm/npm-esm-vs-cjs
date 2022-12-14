/**
 * @typedef {import('pacote').Packument} Packument
 * @typedef {import('pacote').PackumentResult} PackumentResult
 *
 * @typedef {'dual'|'esm'|'faux'|'cjs'} Style
 */

import fs from 'node:fs/promises'
import process from 'node:process'
import dotenv from 'dotenv'
import {npmHighImpact} from 'npm-high-impact'
import pacote from 'pacote'

dotenv.config()

const token = process.env.NPM_TOKEN

if (!token) {
  throw new Error(
    'Expected `NPM_TOKEN` in env, please add a `.env` file with it'
  )
}

let slice = 0
const size = 20
const destination = new URL('../data/latest.json', import.meta.url)

/** @type {Record<string, Style>} */
const allResults = {}

console.log('fetching %s packages', npmHighImpact.length)

// eslint-disable-next-line no-constant-condition
while (true) {
  const names = npmHighImpact.slice(slice * size, (slice + 1) * size)

  if (names.length === 0) {
    break
  }

  console.log('fetching page: %s, collected total: %s', slice, slice * size)

  const promises = names.map(async (name) => {
    const result = await pacote.packument(name, {
      fullMetadata: true,
      token,
      preferOffline: true
    })

    /** @type {[string, Style]} */
    const info = [name, analyzePackument(result)]
    return info
  })

  /** @type {Array<[string, Style]>} */
  let results

  /* eslint-disable no-await-in-loop */
  try {
    results = await Promise.all(promises)
  } catch (error) {
    console.log(error)
    console.log('sleeping for 10s…')
    await sleep(10 * 1000)
    continue
  }
  /* eslint-enable no-await-in-loop */

  for (const [name, style] of results) {
    allResults[name] = style
    console.log('  add: %s (%s)', name, style)
  }

  // Intermediate writes to help debugging and seeing some results early.
  setTimeout(async () => {
    await fs.writeFile(destination, JSON.stringify(allResults, null, 2) + '\n')
  })

  slice++
}

await fs.writeFile(destination, JSON.stringify(allResults, null, 2) + '\n')

console.log('done!')

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), ms)
  })
}

/**
 * @param {Packument & PackumentResult} result
 * @returns {Style}
 */
// eslint-disable-next-line complexity
function analyzePackument(result) {
  const latest = (result['dist-tags'] || {}).latest
  const packument = result.versions[latest]
  const {exports, main, type} = packument
  /** @type {boolean|undefined} */
  let cjs
  /** @type {boolean|undefined} */
  let esm
  /** @type {boolean|undefined} */
  let fauxEsm

  if (packument.module) {
    fauxEsm = true
  }

  // Check exports map.
  if (exports && typeof exports === 'object') {
    for (const exportId in exports) {
      if (Object.hasOwn(exports, exportId) && typeof exportId === 'string') {
        // @ts-expect-error: indexing on object is fine.
        let value = /** @type {unknown} */ (exports[exportId])

        if (exportId.charAt(0) !== '.') {
          value = {'.': value}
        }

        if (value && typeof value === 'object') {
          let explicit = false
          // @ts-expect-error: indexing on object is fine.
          if (value.import) {
            explicit = true
            esm = true
          }

          // @ts-expect-error: indexing on object is fine.
          if (value.require) {
            explicit = true
            cjs = true
          }

          const defaults = /** @type {unknown} */ (
            // @ts-expect-error: indexing on object is fine.
            value.node || value.default
          )

          if (typeof defaults === 'string' && !explicit) {
            if (/\.mjs$/.test(defaults)) esm = true
            if (/\.cjs$/.test(defaults)) cjs = true
          }
        }
      }
    }
  }

  // If there are no explicit exports:
  if (cjs === undefined && esm === undefined) {
    if (type === 'module' || (main && /\.mjs$/.test(main))) {
      esm = true
    } else {
      cjs = true
    }
  }

  /** @type {Style} */
  const style = esm && cjs ? 'dual' : esm ? 'esm' : fauxEsm ? 'faux' : 'cjs'

  return style
}
