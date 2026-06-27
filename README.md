# 🚚 TruckSim Logbook

A personal web app for **Euro Truck Simulator 2** and **American Truck Simulator** that
scrapes your [World of Trucks](https://www.worldoftrucks.com) profile, keeps a history of
your stats, and lets you save favorite routes.

## What it does

- **Scrapes your WoT profile** (per-game ETS2 / ATS / Global statistics) and stores a
  timestamped snapshot on every sync, so you build up a history over time.
- **Dashboard** — headline stats per game + trend sparklines (jobs, distance, mass).
- **Logs** — full sync history; a job-log table ready for per-job data once login is enabled.
- **Favorite routes** — save routes (custom or, later, from a delivered job) with cargo,
  truck and notes.

## How it works

World of Trucks has **no public API**, so this scrapes the server-rendered HTML. The site
runs on Rails: login posts to `/en/sign_in` with a CSRF `authenticity_token`, and the
session is kept in a cookie jar (`tough-cookie`). Pages are parsed with `cheerio`. Data
lives in a local **SQLite** file via **Drizzle ORM**.

> Note: ATS reports distances in **miles**, ETS2/Global in **km** — the original text
> (with units) is stored in `value_raw`; `value_num` is the unit-stripped number for charts.

## Setup

```bash
npm install
cp .env.example .env       # then edit it
npm run db:push            # create the SQLite schema
npm run dev                # http://localhost:5173
```

### Configuration (`.env`)

| Variable         | Purpose                                                  |
| ---------------- | -------------------------------------------------------- |
| `WOT_PROFILE_ID` | Your numeric id from `worldoftrucks.com/en/profile/<ID>` |
| `WOT_LOGIN`      | Your WoT username/email — _optional_                     |
| `WOT_PASSWORD`   | Your WoT password — _optional_                           |
| `DATABASE_URL`   | SQLite file path (default `./data/trucksim.db`)          |

Credentials are **optional**: leave them blank to scrape only the public profile stats.
Fill them in to also pull logged-in "My Page" data.

## Syncing

- **In the app:** click **Sync now** in the header.
- **CLI / cron:** `npm run scrape`

  ```cron
  0 */6 * * *  cd /path/to/trucksim && npm run scrape >> data/scrape.log 2>&1
  ```

## Scripts

| Command             | Description                           |
| ------------------- | ------------------------------------- |
| `npm run dev`       | Dev server                            |
| `npm run build`     | Production build (adapter-node)       |
| `npm run scrape`    | One-off scrape + store a snapshot     |
| `npm run db:push`   | Apply the Drizzle schema to SQLite    |
| `npm run db:studio` | Browse the database in Drizzle Studio |
| `npm run check`     | Type-check                            |

## Per-job Log Book

With credentials set, each sync also scrapes your **Log Book** (`/en/jobs/<id>`) and stores
every delivery (cargo, origin/destination + companies, distance, mass, completed time).
Jobs are deduped on a synthesised key, so syncing repeatedly never creates duplicates.
On the **Favorite Routes** page you can one-click ★ Save any delivery as a favorite.

> The Log Book only exposes the **most recent ~50 deliveries**, so sync regularly (e.g. the
> cron above) to capture jobs before they roll off the list and build full history over time.
> Game is inferred per job from the distance unit (km → ETS2, mi → ATS).

## Tech

SvelteKit (Svelte 5) · TypeScript · SQLite + Drizzle ORM · cheerio · tough-cookie ·
adapter-node.

_Personal-use tool: it logs into **your own** account and reads **your own** data, with
polite rate limiting._
