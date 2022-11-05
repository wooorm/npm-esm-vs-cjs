# npm-esm-vs-cjs

[![Build][build-badge]][build]

Data on the share of ESM vs CJS on the public npm registry.

## Contents

*   [What is this?](#what-is-this)
*   [When should I use this?](#when-should-i-use-this)
*   [Data](#data)
*   [Scripts](#scripts)
*   [Contribute](#contribute)
*   [Security](#security)
*   [License](#license)

## What is this?

This repository contains (historical) data on [high-impact][] (popular) packages
and what kind of code they expose:

*   ESM — such as `type: 'module'` in `package.json`
*   Dual — such as both `import` and `require` conditions in export map
*   Faux ESM — `module` field in `package.json`, supported by some old bundlers
*   CJS — anything else (except for `@types/*`)

## When should I use this?

Use this data for rough insights on how the shift to ESM is progressing.
The data isn’t perfect though.

## Data

[`index.svg`][svg]:

![][svg]

[`index.csv`][csv]:

```csv
date,total,esm,dual,faux,cjs
2021-08-24,5617,341,95,832,4349
2021-11-09,5647,411,119,809,4308
2022-01-27,5686,439,149,809,4289
2022-08-01,5734,496,207,791,4240
2022-11-04,5747,518,216,785,4228
```

> 👉 **Note**: crawls from before 2022-11-04 use the list of popular packages
> on the date of 2022-11-04, as I had the results of all packages, but not which
> of them were popular back then.
> Later dates will use a list of what’s popular on that date.

> 👉 **Note**: not all of these packages are popular.
> There are some false-positives, such that download counts can be gamed, and
> that `libraries.io` sometimes thinks that a fork of webpack or so is actually
> webpack.

> 👉 **Note**: while `@types/*` packages are filtered out in the above counts,
> it is likely that there are other packages included that aren’t really code,
> particularly in the CJS category (as that’s the default).

## Scripts

This repo includes scripts to crawl npm and analyze the results.
You need a

[`script/crawl.js`][crawl] analyzes the `package.json` files of `latest`
releases of [high-impact][] npm packages.
After running it, please rename `data/latest.json` to the current date.
This script finishes in about 5 minutes.
You should likely first contribute to `npm-high-impact`, which can take like
24 hours to complete.

[`script/analyze.js`][analyze] analyzes the data files and generates SVG and
CSV files from them.

## Contribute

Yes please!
See [How to Contribute to Open Source][contribute].

## Security

This package is safe.

## License

[MIT][license] © [Titus Wormer][author]

<!-- Definitions -->

[build-badge]: https://github.com/wooorm/npm-esm-vs-cjs/workflows/main/badge.svg

[build]: https://github.com/wooorm/npm-esm-vs-cjs/actions

[contribute]: https://opensource.guide/how-to-contribute/

[license]: license

[author]: https://wooorm.com

[high-impact]: https://github.com/wooorm/npm-high-impact

[crawl]: script/crawl.js

[analyze]: script/analyze.js

[svg]: index.svg

[csv]: index.csv
