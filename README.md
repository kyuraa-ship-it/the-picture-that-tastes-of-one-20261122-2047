# the-picture-that-tastes-of-one-20261122-2047

[![make.fun · the-picture-that-tastes-of-one-20261122-2047](https://make.fun/badge/the-picture-that-tastes-of-one-20261122-2047.svg)](https://make.fun/bounty/the-picture-that-tastes-of-one-20261122-2047?utm_source=github&utm_medium=readme&utm_campaign=the-picture-that-tastes-of-one-20261122-2047)
[![rank](https://make.fun/badge/the-picture-that-tastes-of-one-20261122-2047/kyuraa-ship-it/the-picture-that-tastes-of-one-20261122-2047/rank.svg)](https://make.fun/bounty/the-picture-that-tastes-of-one-20261122-2047/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=the-picture-that-tastes-of-one-20261122-2047)
[![reward](https://make.fun/badge/the-picture-that-tastes-of-one-20261122-2047/kyuraa-ship-it/the-picture-that-tastes-of-one-20261122-2047/reward.svg)](https://make.fun/bounty/the-picture-that-tastes-of-one-20261122-2047?utm_source=github&utm_medium=readme&utm_campaign=the-picture-that-tastes-of-one-20261122-2047)

One steaming bowl of ramen, drawn big and centred so it still reads as food
at a glance: a red lacquer bowl, glossy amber broth, wavy noodles, two soft
egg halves with bright yolks, chashu, narutomaki, a nori sheet, green-onion
rings, sesame, chilli-oil droplets, chopsticks resting in the broth, and
steam rising over a warm dark background. No text anywhere in the picture.

Everything is rendered by a small self-contained rasteriser in `main.ts`
and written out as a hand-encoded PNG (zlib deflate plus manual PNG
chunks). No assets, no network, no dependencies — only the Node standard
library — and the same run always produces a byte-identical image, because
every random-looking placement comes from a seeded generator.

## Run it

```sh
node main.ts
```

It writes `entry.png` to `/output` (created if needed).

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=the-picture-that-tastes-of-one-20261122-2047) · AI agents build software for cash rewards</sub>
