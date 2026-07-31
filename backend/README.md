# Vault API (Node + Express + MySQL)

A small backend that lets the vault store accounts and entries in a real MySQL
database instead of browser/artifact storage.

## 1. Set up MySQL
Use a local MySQL server, or a hosted one (PlanetScale, Railway, AWS RDS, etc).
Then run the schema:

```bash
mysql -u root -p < schema.sql
```

Create a dedicated DB user instead of using root:
```sql
CREATE USER 'vault_user'@'%' IDENTIFIED BY 'a-strong-password';
GRANT ALL PRIVILEGES ON vault_db.* TO 'vault_user'@'%';
FLUSH PRIVILEGES;
```

## 2. Configure the backend
```bash
cp .env.example .env
```
Fill in `.env` with your real DB_HOST / DB_USER / DB_PASSWORD / DB_NAME, and set
JWT_SECRET to a long random string (e.g. `openssl rand -hex 32`).

## 3. Install & run
```bash
npm install
npm start
```
The API will run on `http://localhost:4000` (or whatever PORT you set).

## 4. Deploy it somewhere reachable
The vault page runs in your browser and needs to reach this API over HTTPS, so
localhost only works while testing on your own machine. To use it for real,
deploy this folder to something like Render, Railway, Fly.io, or a small VPS,
and point it at your MySQL instance (many hosts, like Railway/PlanetScale,
offer MySQL directly too).

## 5. Point the frontend at it
In `vault.html`, set the API base URL to your deployed backend's address, and
replace the `window.storage` calls with `fetch()` calls to these endpoints:

- `POST /api/register` `{ identifier, password }` → `{ token }`
- `POST /api/login` `{ identifier, password }` → `{ token }`
- `POST /api/forgot-password/verify` `{ identifier }` → `{ resetToken }`
- `POST /api/forgot-password/reset` `{ resetToken, newPassword }` → `{ token }`
- `GET /api/entries` (header `Authorization: Bearer <token>`) → list of entries
- `POST /api/entries` (same header) `{ name, category, username, password, notes }`
- `PUT /api/entries/:id` (same header) same body
- `DELETE /api/entries/:id` (same header)

Say the word and I'll wire vault.html up to call these endpoints directly.

## Security notes
- Passwords are hashed with bcrypt — never stored in plain text.
- DB credentials live only in `.env` on the server, never in the frontend.
- `/api/forgot-password/verify` currently returns the reset token directly in
  the response for demo purposes. In a real deployment, email or text that
  token to the user instead of sending it back to the browser.
