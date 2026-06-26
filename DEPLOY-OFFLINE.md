# BuildTrack Offline Deployment

## One-time preparation on the target PC

1. Install Node.js on the target PC.
2. Copy the whole `BuildTrack` folder to the target PC.
3. From the project root, run:

```powershell
npm install
cd server
npm install
cd ..
npm run build
```

4. Make sure `server/.env` is included in the copied project folder.

## Start the app

For single-server offline use, double-click:

- `start-buildtrack-offline.bat`

This starts the offline server and opens:

- `http://127.0.0.1:4000`

## Login

- Username: `admin`
- Password: `BuildTrack@2026!`

## Before handing it to the user

1. Start the app once with `start-buildtrack-offline.bat`.
2. Log in using the credentials above.
3. Go to Settings.
4. Change the admin password to the final user password.
5. Optionally update the recovery Gmail and company profile.

## Important files to keep

- `server/auth.db` for the live local database
- `server/backups/` for exported backups
