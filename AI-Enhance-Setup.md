# Junko's Custom Flowers — AI Enhance proxy (Cloudflare Worker)

This tiny Worker sits between your app and OpenAI so your API key stays
secret. The app (on GitHub Pages) calls the Worker; the Worker calls OpenAI.

## What you need
- A free Cloudflare account
- An OpenAI API key (platform.openai.com → API keys)
- Node.js installed (for the `wrangler` command)

## Deploy (about 5 minutes)

1. Put `worker.js` and `wrangler.toml` in a folder, open a terminal there.

2. Log in to Cloudflare:
   ```
   npx wrangler login
   ```

3. Store your OpenAI key as a secret (it is NOT written into any file):
   ```
   npx wrangler secret put OPENAI_KEY
   ```
   Paste your `sk-...` key when prompted.

4. Deploy:
   ```
   npx wrangler deploy
   ```
   Wrangler prints a URL like:
   `https://junko-enhance.YOURNAME.workers.dev`

## Connect it to the app

Open the app, press F12 for the console, and run (once):
```
localStorage.setItem('junko_enhance_url','https://junko-enhance.YOURNAME.workers.dev')
```
Reload. Now ✦ AI Enhance sends your snapshot through the Worker to OpenAI
and shows the enhanced result.

## Lock it down (after it works)
In `wrangler.toml` set:
```
ALLOW_ORIGIN = "https://willdeluna.github.io"
```
then `npx wrangler deploy` again, so only your site can use the Worker.

## Cost & limits
- Cloudflare Workers Free: 100,000 requests/day. The 10ms CPU limit does
  NOT apply here — waiting on OpenAI is network time, not CPU time.
- You pay OpenAI per generated image (gpt-image-1). Roughly a few US cents
  per enhance at 1024x1536. Check current pricing on OpenAI's site.

## Switching models
`gpt-image-1` is the default. To try a newer one, edit `wrangler.toml`:
```
MODEL = "gpt-image-1.5"     # or gpt-image-2
```
Note: gpt-image-2 supports arbitrary sizes (WIDTHxHEIGHT divisible by 16)
and always processes inputs at high fidelity. gpt-image-1 uses the fixed
sizes 1024x1024 / 1536x1024 / 1024x1536.

## Troubleshooting
- `openai 400` in the after-panel → usually a size or model mismatch; keep
  size at 1024x1536 for gpt-image-1.
- `openai 401` → the OPENAI_KEY secret is wrong; re-run step 3.
- CORS error in console → ALLOW_ORIGIN doesn't match your site URL.
