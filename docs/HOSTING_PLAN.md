# Common Threads — hosting plan

**Goal:** a public HTTPS link that judges and visitors can open on any device.

**Recommendation:** deploy to **Vercel** from the GitHub repo (free Hobby plan), and keep an **ngrok** tunnel from the laptop as a demo-day backup.

## 1. Options

| Option | Public link | Setup | Hosting cost | Decision |
| --- | --- | --- | --- | --- |
| Vercel from GitHub | `https://<project>.vercel.app` | About 10 minutes in the browser | Free (Hobby) | **Use this.** Vercel is a verified Next.js host, and every push to `main` redeploys |
| ngrok tunnel from the laptop | `https://<random>.ngrok-free.app` | About 2 minutes; ngrok is already installed | Free | **Backup.** Works only while the laptop and server run; the free plan shows a warning page first, and the link changes each run |
| Docker on Render, Railway, or Fly.io | Provider URL | 30–60 minutes | Small monthly fee | Not needed |

Hobby is meant for personal, non-commercial projects, which fits a makeathon prototype.

## 2. Risks of a public link

The API key already stays on the server: it is never sent to the browser and `.env.local` has never been committed. The main risk is cost: **anyone with the link can make Claude calls on your account.** Vercel's own password protection is not available on Hobby, and Hobby cannot restrict production to Vercel users.

| Safeguard | How | Status |
| --- | --- | --- |
| Capped key | In the Claude Console, create a workspace such as `common-threads-demo`, set a low monthly spend limit (e.g. $5), and create the deployment's API key in it. At the limit, calls stop and the app falls back to keyword matching | **Do this** (you) |
| Cheap model | `ANTHROPIC_MODEL=claude-haiku-5-5`. Estimate: under 1 cent per conversation including Create, so $5 covers several hundred conversations. Check real usage in the Console after a rehearsal | **Do this** (you) |
| Rate limit | `/api/chat` refuses more than 60 calls per 10 minutes from one IP address (`RATE_LIMIT_PER_10_MIN` changes it; raise it if many visitors share the venue Wi-Fi). In memory, so it limits casual abuse rather than a determined attacker | **Done** (`lib/guard.ts`) |
| Access code | If `DEMO_ACCESS_CODE` is set, only visitors who open a link like `https://…/?code=<value>` get Claude replies (the code is remembered in their browser). Everyone else still gets the full app, with keyword replies | **Done**, off unless the variable is set |

The `/lab` page is public too. It is harmless and can stay.

## 3. Deploy to Vercel

### Prepare

1. **Safeguards** (§2) are in place and tested.
2. **Push to GitHub:** `git push` (done when Claude deployed).
3. **Create the capped key** in the Claude Console (workspace, spend limit, API key). Copy the key; you only see it once.

### Deploy

4. Sign in at [vercel.com](https://vercel.com) with GitHub and choose the Hobby plan.
5. **Add New → Project**, then import `Judy1x4/common-threads`. Vercel detects Next.js; keep the default build settings.
6. Under **Environment Variables**, add these for Production and Preview:

   | Name | Value |
   | --- | --- |
   | `ANTHROPIC_API_KEY` | The capped key from step 3 |
   | `ANTHROPIC_MODEL` | `claude-haiku-5-5` |
   | `DEMO_ACCESS_CODE` | Optional: set it to require `?code=<value>` for Claude replies |
   | `RATE_LIMIT_PER_10_MIN` | Optional: default 60 |

7. Click **Deploy** and wait for the build (about 1–2 minutes).
8. Open the `.vercel.app` link. Optionally rename the project in **Settings → General** for a nicer subdomain.

### Check

9. Run one full conversation: Claude replies (no “AI unavailable” notice), **Create pattern** gives a card, and **View** and **Download** work.
10. Open the link on a phone using mobile data, not the venue Wi-Fi.
11. After any change, `git push` redeploys automatically. Changing an environment variable needs **Deployments → Redeploy**.

**CLI alternative:** `npx vercel login`, then `npx vercel` for a preview and `npx vercel --prod` for production. Add variables with `npx vercel env add`.

**Nothing to configure for limits:** each model call stops at 15 s, and Hobby functions may run up to 300 s. `/api/chat` must stay on the Node.js runtime (the default), because it uses Node's `dns` and `net` modules for the IPv4 fix.

## 4. Backup: ngrok tunnel on demo day

1. Start a production server: `npm run build && npm start` (port 3000).
2. One time only: create a free ngrok account, then run `ngrok config add-authtoken <token>`.
3. Run `ngrok http 3000` and share the `https://…ngrok-free.app` forwarding address.
4. Keep the laptop awake and online. The tunnel uses the key in `.env.local`, so stop it after the demo.

## 5. Before the demo

| Check | Expected result |
| --- | --- |
| Public link on a phone | Loads over mobile data; the chat fits the screen |
| Full journey | Chat → Create → View → Download works on the public link |
| Spend | The Console shows the rehearsal cost and the remaining limit |
| Fallback | If the key is removed or the limit is reached, the chat continues with keyword replies |
| Backup | `ngrok http 3000` tested once on the venue network |

## 6. Who does what

| Task | Who |
| --- | --- |
| Rate limit and access code | Done |
| `git push` | You, or Claude on request |
| Console workspace, spend limit, and API key | You (needs your Console login) |
| Vercel account, import, and environment variables | You (needs your login); or Claude via the CLI after you run `npx vercel login` |
| ngrok account and authtoken | You |

## Sources

- [Next.js deployment options](https://nextjs.org/docs/app/getting-started/deploying) (also in `node_modules/next/dist/docs/`)
- [Vercel function limits](https://vercel.com/docs/functions/limitations) and [higher defaults with Fluid compute](https://vercel.com/changelog/higher-defaults-and-limits-for-vercel-functions-running-fluid-compute)
- [Vercel Deployment Protection pricing](https://vercel.com/docs/deployment-protection/usage-and-pricing) and [Vercel Authentication](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication)
- [Claude Console workspaces](https://support.claude.com/en/articles/9796807-creating-and-managing-workspaces-in-the-claude-console) and [workspace spend limits](https://anthropic.com/news/workspaces)
