# Google OAuth Setup Guide

Follow these steps to get your Google OAuth credentials.

## 1. Create a Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click the project dropdown at the top → **New Project**
3. Name it `RExplain` → click **Create**
4. Make sure it's selected as the active project

## 2. Enable the Google+ API (OAuth)

1. Go to **APIs & Services → Library**
2. Search for **"Google People API"** → click **Enable**
3. (Optional but recommended) Also enable **"Google Identity"**

## 3. Configure the OAuth Consent Screen

1. Go to **APIs & Services → OAuth consent screen**
2. Select **External** → **Create**
3. Fill in:
   - App name: `RExplain`
   - User support email: your Google email
   - Developer contact email: your Google email
4. Click **Save and Continue** (skip Scopes step)
5. Under **Test users**, add your own Gmail address
6. Click **Save and Continue** → **Back to Dashboard**

## 4. Create OAuth 2.0 Credentials

1. Go to **APIs & Services → Credentials**
2. Click **+ Create Credentials → OAuth client ID**
3. Application type: **Web application**
4. Name: `RExplain Web`
5. Under **Authorized redirect URIs**, add:
   - `http://localhost:8000/auth/google/callback` (local dev)
   - `https://YOUR_RENDER_BACKEND.onrender.com/auth/google/callback` (production)
6. Click **Create**
7. Copy your **Client ID** and **Client Secret**

## 5. Add to Environment Variables

### Local (`.env` in repo root):
```
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:8000/auth/google/callback
JWT_SECRET=generate_a_64_char_random_string
FRONTEND_URL=http://localhost:3000
```

### Render (Backend) — Service → Environment:
| Key | Value |
|-----|-------|
| `GOOGLE_CLIENT_ID` | your client ID |
| `GOOGLE_CLIENT_SECRET` | your client secret |
| `GOOGLE_REDIRECT_URI` | `https://YOUR_RENDER_BACKEND.onrender.com/auth/google/callback` |
| `JWT_SECRET` | run: `python -c "import secrets; print(secrets.token_urlsafe(64))"` |
| `FRONTEND_URL` | `https://rexplain.vercel.app` (your Vercel URL) |

### Vercel (Frontend) — Settings → Environment Variables:
No new variables needed — auth is handled entirely server-side.

## 6. Generate a JWT Secret

```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

Copy the output as your `JWT_SECRET`.

## 7. Test Locally

1. Start the backend: `uvicorn app.main:app --reload`
2. Start the frontend: `npm start`
3. Go to `http://localhost:3000` → click **Sign in**
4. You should be redirected to Google → login → back to the app

---

> **Note**: When the app is in "Testing" mode on Google Cloud, only accounts in your test users list can log in. To allow anyone to sign in, you must publish the OAuth consent screen (requires app verification if using sensitive scopes — but `openid email profile` are basic scopes and usually don't require review).
