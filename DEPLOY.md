# Deploy PacketVault (GitHub Pages + Render)

## Part 1 — Backend on Render

1. Push this repository to GitHub.
2. In [Render](https://render.com): **New → Web Service** → connect the repo.
3. Configure:
   - **Root Directory:** `server`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
4. **Environment variables** (Render dashboard):

   | Key | Example |
   |-----|---------|
   | `MONGO_URI` | MongoDB Atlas connection string |
   | `JWT_SECRET` | Long random string |
   | `ADMIN_USERNAME` | `admin` |
   | `ADMIN_PASSWORD` | Strong password |
   | `FRONTEND_ORIGINS` | `https://krishhhhh21.github.io` (no trailing slash; comma-separate multiple sites) |
   | `SERVE_STATIC` | `false` (API only; do not serve `/client` from Render) |

   Render injects `PORT` automatically.

5. After deploy, copy your service URL, e.g. `https://packetvault-xxxx.onrender.com`.

## Part 2 — Frontend on GitHub Pages

1. Repo **Settings → Pages**.
2. **Source:** branch `main`, folder **`/client`** (or `/ (root)` if you publish only `client` contents — match how your repo is structured).
3. Your site will be at:  
   `https://krishhhhh21.github.io/Cisco/`  
   (if the repository name is `Cisco`).

## Part 3 — Wire the API URL

1. Edit **`client/index.html`** and **`client/admin.html`**: set the meta tag to your Render URL:

   ```html
   <meta name="api-base" content="https://YOUR-SERVICE.onrender.com"/>
   ```

2. Commit and push. GitHub Pages will pick up the change after a minute.

## API endpoints (used by the frontend)

| Action | Method | Path |
|--------|--------|------|
| List files | GET | `{API}/files` |
| Download | GET | `{API}/download/:id` |
| Upload (JWT) | POST | `{API}/upload` |
| Admin login | POST | `{API}/admin/login` |
| Admin stats / delete / logs | | `{API}/admin/...` |

Uploads are limited to **20 MB** and extensions **.pkt, .html, .js, .txt, .zip** (enforced in `server/middleware/upload.js`).

## Local development (same origin)

- Run MongoDB (or Atlas) and copy `server/.env.example` to `server/.env`.
- From `server/`: `npm install` then `npm run dev` or `npm start`.
- Leave `<meta name="api-base" content=""/>` **empty** so the UI uses the same host as the Express app (`http://localhost:5000`).
- Default `SERVE_STATIC` is on when unset — the server serves `/client`.

## Checks

- Open the GitHub Pages URL → workspace loads, no console CORS errors.
- List files and download work.
- Admin login and upload work against Render.
