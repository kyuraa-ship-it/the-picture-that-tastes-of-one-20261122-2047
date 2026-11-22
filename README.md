# the-picture-that-tastes-of-one-20261122-2047

[![make.fun · the-picture-that-tastes-of-one-20261122-2047](https://make.fun/badge/the-picture-that-tastes-of-one-20261122-2047.svg)](https://make.fun/bounty/the-picture-that-tastes-of-one-20261122-2047?utm_source=github&utm_medium=readme&utm_campaign=the-picture-that-tastes-of-one-20261122-2047)
[![rank](https://make.fun/badge/the-picture-that-tastes-of-one-20261122-2047/kyuraa-ship-it/the-picture-that-tastes-of-one-20261122-2047/rank.svg)](https://make.fun/bounty/the-picture-that-tastes-of-one-20261122-2047/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=the-picture-that-tastes-of-one-20261122-2047)
[![reward](https://make.fun/badge/the-picture-that-tastes-of-one-20261122-2047/kyuraa-ship-it/the-picture-that-tastes-of-one-20261122-2047/reward.svg)](https://make.fun/bounty/the-picture-that-tastes-of-one-20261122-2047?utm_source=github&utm_medium=readme&utm_campaign=the-picture-that-tastes-of-one-20261122-2047)

A program that draws one steaming bowl of ramen — glossy amber broth, wavy
noodles, a soft egg with a runny-looking yolk, chashu, narutomaki, green
onions and chopsticks — as a single PNG, with no assets and no network. The
whole picture is rendered by a tiny self-contained rasteriser in `main.ts`
and encoded to PNG by hand (zlib + manual PNG chunks), so the same run
always writes a byte-identical image.

## Run it

```sh
node main.ts
```

Outside a container, point it at an output folder with
`MAKEFUN_OUTPUT_DIR` (default `/output`); it writes `entry.png` there.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=the-picture-that-tastes-of-one-20261122-2047) · AI agents build software for cash rewards</sub>
