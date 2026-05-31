# mesh-new-year

[![pages](https://img.shields.io/badge/live-baditaflorin.github.io%2Fmesh-new-year-ff5e7a)](https://baditaflorin.github.io/mesh-new-year/)
[![version](https://img.shields.io/badge/version-0.1.1-blue)](https://github.com/baditaflorin/mesh-new-year/blob/main/package.json)
[![license](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

> Synced new-year countdown across timezones — everyone hits local 00:00 together

Live: **https://baditaflorin.github.io/mesh-new-year/**

Source: **https://github.com/baditaflorin/mesh-new-year**

Tip the dev: **https://www.paypal.com/paypalme/florinbadita**

---

## What it is

Peer-to-peer browser app, no backend of its own beyond the self-hosted WebRTC stack listed below. Built on `@baditaflorin/mesh-common`, hosted on GitHub Pages from `docs/`.

## Quickstart (local)

```bash
git clone https://github.com/baditaflorin/mesh-common
git clone https://github.com/baditaflorin/mesh-new-year
cd mesh-new-year
npm install
npm run dev
```

`mesh-common` must sit as a **sibling** directory because `package.json` references it via `file:../mesh-common`.

## Self-hosted infrastructure

| Repo                                              | Endpoint                               | Purpose                     |
| ------------------------------------------------- | -------------------------------------- | --------------------------- |
| https://github.com/baditaflorin/signaling-server  | `wss://turn.0docker.com/ws`            | y-webrtc signaling fan-out  |
| https://github.com/baditaflorin/turn-token-server | `https://turn.0docker.com/credentials` | HMAC TURN creds, 1-hour TTL |
| https://github.com/baditaflorin/coturn-hetzner    | `turn:turn.0docker.com:3479`           | TURN relay                  |

## Settings overrides (localStorage keys)

The settings drawer lets the user override signaling and TURN endpoints. Keys:

- `mesh-new-year:signalingUrl`
- `mesh-new-year:turnTokenUrl`
- `mesh-new-year:iceServers`
- `mesh-new-year:room`

If endpoints are blank or unreachable, the app falls back to STUN-only.

## Build & deploy

GitHub Pages serves the committed `docs/` directory on the `main` branch. There is **no GitHub Actions build workflow**; the Husky pre-commit + pre-push hooks gate formatting / typecheck / smoke build locally.

```bash
npm run smoke   # build + sanity-check docs/
```

## Privacy

See `docs/privacy.md` for the threat model — what other peers in the mesh see, what the self-hosted infra sees, what stays local.

## License

MIT — see `LICENSE`.
