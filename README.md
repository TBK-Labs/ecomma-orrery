# TEAM ECOMMA · the build, alive

A living galaxy for a two-builder hackathon build. Every commit grows the sky:
features become planets, commits become moons, sub-features and skills become
specks, and the two builders are binary stars at the centre. No narration,
no dashboards; the visuals tell the story.

Single HTML file plus one stdlib-only Node server. Zero dependencies.

## What the sky means

| body | meaning |
|---|---|
| star | a builder, one per person |
| planet | a feature you are building (commit scope or top directory) |
| ring around a planet | who is building it, split by share if both |
| moon | one commit; every commit adds one |
| speck | a sub-feature, skill or workflow touched inside the feature |
| thread | one commit that touched two features, drawn as a constellation line |
| planet size | lines added so far |
| flare | happened seconds ago |

Controls: wheel zooms, click a planet to follow it, click a star to isolate
that builder's half of the sky, Esc releases.

## Run it

Watch a real build (the real thing; two laptops pushing to one shared
remote both appear, the server fetches each poll):

    node server.cjs --watch /path/to/repo [more repos...] [--poll 5000]

Replay a repo's real git history (kiosk / proof mode):

    node server.cjs --replay /path/to/repo --last 160 --speed 3 --repeat 15000

Bundled story, no repos needed:

    node server.cjs --demo

No server at all: open `index.html` via any static host (including GitHub
Pages). When the event stream does not appear, the page replays
`demo-events.json` by itself.

## Regenerate the demo story

`scripts/make-demo.cjs` writes `demo-events.json` (deterministic seed):
170 commits by Wassim and Rabih across eight fictional Ecomma features.

## Provenance

Born as the live orrery inside TBK Labs' fleet-deck, rebuilt as a galaxy for
the Ecomma hackathon screen. The Ecomma wordmark is embedded with the brand's
blessing; the engine, art and grammar are original.
