/**
 * @import {PackumentResult, Packument} from 'pacote'
 */

/**
 * @typedef {'cjs' | 'dual' | 'esm' | 'faux'} Style
 *   Style.
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
const now = new Date()
const destination = new URL(
  '../data/' +
    String(now.getUTCFullYear()).padStart(4, '0') +
    '-' +
    String(now.getUTCMonth() + 1).padStart(2, '0') +
    '-' +
    String(now.getUTCDate()).padStart(2, '0') +
    '.json',
  import.meta.url
)

/** @type {Record<string, Style | undefined>} */
const allResults = {}

console.error('fetching %s packages', npmHighImpact.length)

// eslint-disable-next-line no-constant-condition
while (true) {
  const names = npmHighImpact.slice(slice * size, (slice + 1) * size)

  if (names.length === 0) {
    break
  }

  console.error(
    'fetching page: %s, collected total: %s out of %s',
    slice,
    slice * size,
    npmHighImpact.length
  )

  const promises = names.map(async function (name) {
    /** @type {Packument & PackumentResult} */
    let result

    try {
      result = await pacote.packument(name, {
        fullMetadata: true,
        preferOffline: true,
        token
      })
    } catch (error) {
      console.error('package w/ error: %s, likely spam: %s', name, error)
      /** @type {[string, Style | undefined]} */
      const info = [name, undefined]
      return info
    }

    /** @type {[string, Style | undefined]} */
    const info = [name, analyzePackument(result)]
    return info
  })

  /** @type {Array<[string, Style | undefined]>} */
  let results

  try {
    results = await Promise.all(promises)
  } catch (error) {
    console.error(error)
    console.error('sleeping for 10s…')
    await sleep(10 * 1000)
    continue
  }

  for (const [name, style] of results) {
    allResults[name] = style
    console.error('  add: %s (%s)', name, style)
  }

  // Intermediate writes to help debugging and seeing some results early.
  setTimeout(async function () {
    await fs.writeFile(
      destination,
      JSON.stringify(allResults, undefined, 2) + '\n'
    )
  })

  slice++
}

await fs.writeFile(destination, JSON.stringify(allResults, undefined, 2) + '\n')

console.error('done!')

/**
 * @param {number} ms
 *   Miliseconds to sleep.
 * @returns {Promise<undefined>}
 *   Nothing.
 */
function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(function () {
      resolve(undefined)
    }, ms)
  })
}

/**
 * @param {Packument & PackumentResult} result
 *   Result.
 * @returns {Style | undefined}
 *   Style.
 */
function analyzePackument(result) {
  const latest = (result['dist-tags'] || {}).latest

  // Some spam packages were removed. They might still be in the list tho.
  if (!latest) {
    console.error('package w/o `latest`: %s, likely spam', result.name)
    return
  }

  const packument = (result.versions || {})[latest]
  const {exports, main, type} = packument
  /** @type {boolean | undefined} */
  let cjs
  /** @type {boolean | undefined} */
  let esm
  /** @type {boolean | undefined} */
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

        analyzeThing(value, packument.name + '#exports')
      }
    }
  }

  // Explicit `commonjs` set, with a explicit `import` or `.mjs` too.
  if (esm && type === 'commonjs') {
    cjs = true
  }

  // Explicit `module` set, with explicit `require` or `.cjs` too.
  if (cjs && type === 'module') {
    esm = true
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

  /**
   * @param {unknown} value
   *   Thing.
   * @param {string} path
   *   Path in `package.json`.
   * @returns {undefined}
   *   Nothing.
   */
  function analyzeThing(value, path) {
    if (value && typeof value === 'object') {
      if (Array.isArray(value)) {
        const values = /** @type {Array<unknown>} */ (value)
        let index = -1
        while (++index < values.length) {
          analyzeThing(values[index], path + '[' + index + ']')
        }
      } else {
        let explicit = false
        const conditionImport = Boolean('import' in value && value.import)
        const conditionRequire = Boolean('require' in value && value.require)
        const conditionDefault = Boolean('default' in value && value.default)

        if (conditionImport || conditionRequire) {
          explicit = true
        }

        if (conditionImport || (conditionRequire && conditionDefault)) {
          esm = true
        }

        if (conditionRequire || (conditionImport && conditionDefault)) {
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
    } else if (typeof value === 'string') {
      if (/\.mjs$/.test(value)) esm = true
      if (/\.cjs$/.test(value)) cjs = true
    } else if (value === null) {
      // Something explicitly not available,
      // for a particular condition,
      // or before a glob which would allow it.
    } else {
      console.error('unknown:', [value], path)
    }
  }
}
