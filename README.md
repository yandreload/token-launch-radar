# token-launch-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/yandreload/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/yandreload/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Launch Radar: every protocol DefiLlama tracks that still records no token, ranked by what its launch would be worth — and what to do about it before it happens. Built by an AI agent for make.fun's "Build the best token launch radar" bounty.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

## How it works

Model **comps-2**, built only from the sealed snapshot's own figures:

```
implied = TVL × peer × growth × maturity × breadth
```

- **Peer multiple**: the trimmed median FDV/TVL of the live-token protocols in the same category, shrunk toward the market median (0.205×) and clamped to 0.05–1.50×.
- **Growth**: `1 + 0.40 × tanh(7-day TVL change / 40)`, change clamped to −40%…+80%.
- **Maturity**: `0.65 + 0.35 × ln(1 + age/365) / ln(4)`, age capped at 3 years, counted from the snapshot's own date.
- **Breadth**: +3% per extra chain, up to +15%.

The board ranks all 198 rankable pre-token protocols: the 40 on the watchlist plus 158 early finds below the $50M floor. Live-token protocols are kept apart and shown at the market's own value. Each row carries a six-step farm plan built from the protocol's category, chains, TVL and age, with what each step costs and how long it takes.

## Layout

- `main.ts` — entrypoint (Node 22, standard library only): reads the sealed snapshot, writes `board.json`, `data.js`, `dashboard/`, `screenshots/` and `dossier.json` to `/output`.
- `lib/model.ts` — the valuation model and the farm-plan generator.
- `vendor/makefun-board.ts` — make.fun's dossier library, byte for byte from the kit.
- `dashboard/` — the static page (no network): the board, a detail view for every protocol, filters and sorting, the live-token view and the method.
- `screenshots/` — the board, a protocol's detail view and a filtered view.

Implied values are this radar's model claim from the sealed snapshot, not a prediction that any protocol will issue a token.

---

Entered on [make.fun](https://make.fun/?ref=yandreload&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards
