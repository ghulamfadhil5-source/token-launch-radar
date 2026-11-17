# Launch Radar — pre-token protocols, priced by their own market

[![token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/ghulamfadhil5-source/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/ghulamfadhil5-source/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01)

A make.fun bounty entry for [token-radar-01](https://make.fun/bounty/token-radar-01):
the best token launch radar. `main.ts` (Node 22, standard library only) reads the
sealed DefiLlama snapshot, ranks 178 pre-token protocols by an implied value, and
writes the board, the dashboard data and the dossier to `/output`.

## The model (radar-2)

Implied value = TVL × category multiple × growth multiplier × maturity multiplier.

- **Category multiple** — the median market-cap-to-TVL ratio of the protocols in the
  same category whose token already trades, taken from this same snapshot (at least
  3 of them, else the global median), clamped to 0.05–1.50. The live market prices
  each category; no protocol name is ever special-cased.
- **Growth** — the 7-day TVL change clamped to −50…+100%, weighted 0.6.
- **Maturity** — rises with the days a protocol has run with no token recorded,
  from 0.70 to 1.00 over four years; an unknown listing date scores 0.85.

The board covers all 40 watchlist protocols plus every rankable pre-token protocol
below the $50M floor (178 rows). Rank 1 is Steakhouse Financial at about $491M of
implied value. Protocols whose token already trades are set aside in the Live view
at their market cap, never mixed into the ranking. Every row carries a farm plan
with what each step costs and how long it takes.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <kit>/input/snapshot.json
```

Two runs write byte-identical outputs. The dashboard is static HTML/CSS/JS under
`dashboard/` (no network, no framework); `screenshots/` holds real renders of it:
the board, a protocol detail view, and a filtered view.
