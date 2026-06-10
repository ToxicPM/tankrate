# TankRate Deployment Guide

## 1. Supabase Project Setup

### 1.1 Create Project
1. Go to https://supabase.com/dashboard/projects
2. Click "New Project"
3. Enter project name: `TankRate`
4. Set a strong database password (save it)
5. Choose a region closest to your target audience
6. Click "Create new project"

### 1.2 Get Your Project Credentials
After project creation, go to **Project Settings → API** and note:
- `Project URL` — e.g. `https://abc123.supabase.co`
- `anon/public key` — starts with `eyJ...`
- `service_role key` — keep this SECRET, only use server-side

### 1.3 Enable Required Extensions
In the Supabase Dashboard → **SQL Editor**, run:

```sql
create extension if not exists http with schema extensions;
```

**Note:** `pgcron` requires Supabase Pro/Team plans. On the Free tier, scheduled refreshes are handled by an external cron service (see Section 1.8 below). The `http` extension is still needed for Edge Function internal calls.

### 1.4 Run Database Schema
1. Open **SQL Editor** in Supabase Dashboard
2. Paste the contents of `supabase-schema.sql` (from this project)
3. Click "Run"
4. Verify all 6 tables are created in **Table Editor**

### 1.5 Deploy Edge Functions
You need the Supabase CLI:

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref lmfnrqmxocnpebmkbahb

# Deploy all functions at once
supabase functions deploy prices
supabase functions deploy history
supabase functions deploy news
supabase functions deploy weather
supabase functions deploy currency
supabase functions deploy subscribe
```

### 1.6 Set Environment Secrets
In Supabase Dashboard → **Edge Functions → Settings → Secrets**, add:

| Secret | Value | Description |
|--------|-------|-------------|
| `OPENVAN_KEY` | your_openvan_key | Get from https://openvan.com |
| `NEWSAPI_KEY` | your_newsapi_key | Get from https://newsapi.org |
| `OPENWEATHER_KEY` | your_openweather_key | Get from https://openweathermap.org |
| `SUPABASE_URL` | https://yourproject.supabase.co | Auto-set in most cases |
| `SUPABASE_ANON_KEY` | your_anon_key | Auto-set in most cases |
| `SUPABASE_SERVICE_ROLE_KEY` | your_service_role_key | Auto-set in most cases |

**IMPORTANT:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are automatically available in Edge Functions — you typically don't need to add them manually. Only add the external API keys.

### 1.7 Verify Edge Functions
Test each function by visiting in browser:
- `https://yourproject.supabase.co/functions/v1/prices?country=GB`
- `https://yourproject.supabase.co/functions/v1/currency`
- `https://yourproject.supabase.co/functions/v1/news?country=GB`

Each should return valid JSON.

### 1.8 Set Up Scheduled Refreshes (Free Tier — No pg_cron)

`pgcron` requires Supabase Pro/Team. On the Free tier, use an external cron service.

**Recommended: [cron-job.org](https://cron-job.org) (free, reliable)**

Create 2 scheduled HTTP requests:

| Job | Schedule | URL |
|-----|----------|-----|
| Refresh prices | Every 6 hours | `https://lmfnrqmxocnpebmkbahb.supabase.co/functions/v1/prices?refresh=true` |
| Refresh news | Every 2 hours | `https://lmfnrqmxocnpebmkbahb.supabase.co/functions/v1/news?refresh=true` |

**Headers for both jobs:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtZm5ycW14b2NucGVibWtiYWhiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTA5MjIzMSwiZXhwIjoyMDk2NjY4MjMxfQ.legzxe8utUsIx3ttPFUEZcZd4rN49zgPud_DUAVIVsU
```

**Daily history snapshot** — the Edge Functions handle this automatically when the first user visits each day (the `prices` function calls `buildPricePayload` which reads from cache; the `price_history` table is populated by the frontend on first load of each day).

Alternatively, manually run this SQL once per day via the Supabase Dashboard → SQL Editor, or add it as a third cron job in cron-job.org pointing to a new `/functions/v1/snapshot-history` endpoint (see `supabase-cron-jobs.sql` for the optional function code).

### 1.9 Get API Keys
You'll need to sign up for these external APIs:

| API | URL | Free Tier |
|-----|-----|-----------|
| Collectapi | https://openvan.com | Limited free |
| NewsAPI | https://newsapi.org/register | 100 requests/day |
| OpenWeatherMap | https://openweathermap.org/api | 60 calls/min |
| ExchangeRate-API | https://open.exchangerate-api.com/sign-up | Free (USD base) |

---

## 2. Frontend Deployment

### 2.1 Update Configuration
Before deploying, update these values in your HTML files:
- Replace `https://lmfnrqmxocnpebmkbahb.supabase.co` with your actual Supabase project URL
- Replace `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtZm5ycW14b2NucGVibWtiYWhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwOTIyMzEsImV4cCI6MjA5NjY2ODIzMX0.H-QjCTBAZv_e7-bSfpLKJLcJLACvPWH5f7sOg1C0pNk` with your Supabase anon key
- Replace `YOUR_FORM_ID` in contact/index.html with your Formspree form ID
- Replace `ca-pub-XXXXXXXXXXXXXXXX` with your AdSense publisher ID
- Update all `tankrate.com` URLs to your actual domain

### 2.2 Cloudflare Pages Deployment

```bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Create Pages project (one-time)
# Go to https://dash.cloudflare.com/pages
# Click "Create a project" → "Direct Upload"
# Name it: TankRate
# Note the project name

# Build and deploy
wrangler pages project create TankRate
wrangler pages deploy . --project-name TankRate
```

**Cloudflare Pages Configuration:**
- **Build command:** (leave empty — this is a static site)
- **Build output directory:** `/` (root)
- **Root directory:** `/` (root)

### 2.3 Netlify Deployment

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Initialize (one-time)
netlify init

# Deploy
netlify deploy --prod --dir .
```

**Netlify Configuration:**
- **Publish directory:** `/` (root)
- **Build command:** (leave empty)

### 2.4 _redirects File for Cloudflare Pages
Place `_redirects` in your site root:

```
/petrol          /petrol-prices/    301
/diesel          /diesel-prices/    301
/lpg             /lpg-prices/       301
/fuel-calculator /calculator/       301
/fuel-cost       /calculator/       301
```

---

## 3. Domain & HTTPS

### 3.1 Custom Domain (Cloudflare Pages)
1. Go to Pages project → **Custom domains**
2. Add your domain (e.g. `tankrate.com`)
3. Update nameservers at your registrar to Cloudflare's nameservers
4. HTTPS is automatically provisioned via Cloudflare SSL

### 3.2 Custom Domain (Netlify)
1. Go to Site settings → **Domain management**
2. Add custom domain
3. Netlify automatically provisions Let's Encrypt SSL

---

## 4. Google Search Console

### 4.1 Verify Ownership
1. Go to https://search.google.com/search-console
2. Click "Add Property" → choose "URL prefix"
3. Enter your domain (e.g. `https://tankrate.com`)
4. Verify using HTML file upload or DNS TXT record

### 4.2 Submit Sitemap
1. In Search Console, go to **Sitemaps**
2. Paste `https://yourdomain.com/sitemap.xml`
3. Click "Submit"
4. Monitor indexing status

### 4.3 Set Up URL Inspection
- Request indexing for the homepage
- Request indexing for each price page
- Monitor Core Web Vitals in the "Experience" tab

---

## 5. Google AdSense Application Checklist

### 5.1 Pre-Application Requirements
- [ ] Site has been live for at least 4 weeks (recommended)
- [ ] All 12 pages are complete with real content (no placeholders)
- [ ] Privacy Policy at /privacy-policy/ is live
- [ ] About page explains data sources
- [ ] Contact page has working form
- [ ] Cookie consent banner is live
- [ ] Site is served over HTTPS
- [ ] No broken internal links
- [ ] Minimum 15 pages of real, useful content

### 5.2 Application Steps
1. Go to https://www.google.com/adsense/start
2. Sign in with Google account
3. Enter your site URL
4. Select your country and agree to terms
5. Provide payment information

### 5.3 Post-Approval
- Replace `ca-pub-XXXXXXXXXXXXXXXX` with your actual publisher ID
- Ad units will auto-initialize via the `loadAdSense()` function
- Monitor AdSense dashboard for revenue and policy compliance

### 5.4 AdSense Policy Compliance
- Ensure content/ad ratio is minimum 70/30
- Don't click your own ads
- Don't ask visitors to click ads
- Don't place ads on pages with no content
- Ensure cookie consent is working before AdSense loads

---

## 6. Post-Deployment Verification

### 6.1 Functional Tests
```bash
# Test all Edge Functions
curl https://yourproject.supabase.co/functions/v1/prices?country=GB
curl https://yourproject.supabase.co/functions/v1/currency
curl https://yourproject.supabase.co/functions/v1/news?country=GB

# Test static pages
curl -I https://yourdomain.com/
curl -I https://yourdomain.com/petrol-prices/
curl -I https://yourdomain.com/sitemap.xml
curl -I https://yourdomain.com/robots.txt
```

### 6.2 Verify Cookie Consent
1. Visit site in incognito
2. Cookie banner should appear
3. Click "Accept All" — AdSense should load (check Network tab)
4. Click "Reject" — AdSense should NOT load
5. Click "Cookie Settings" in footer — banner should re-appear

### 6.3 Verify Geolocation
1. Visit site in incognito
2. Geo banner should show your country
3. Check localStorage in DevTools — `userCountry` and `userGeo` should be set

### 6.4 Verify Dark Mode
1. Click dark mode toggle
2. Reload page — theme should persist
3. Check `darkMode` in localStorage

### 6.5 Verify Core Web Vitals
Use https://pagespeed.web.dev/:
- Test homepage
- Test petrol-prices page
- Target: Performance 90+, SEO 100, A11y 95+, Best Practices 100

### 6.6 Verify Mobile Responsiveness
Test on real devices:
- iPhone (Safari)
- Android (Chrome)
- Tablet view

Check:
- Hamburger menu works
- Cards stack vertically
- Ads don't push content below fold
- All buttons are tappable (min 44x44px)

---

## 7. Maintenance Schedule

| Task | Frequency | How |
|------|-----------|-----|
| Review AdSense policy compliance | Monthly | AdSense dashboard |
| Check cron job logs | Weekly | Supabase Dashboard → Edge Functions → Logs |
| Review API rate limits | Monthly | Check provider dashboards |
| Update API keys if needed | As needed | Supabase Secrets |
| Audit broken links | Monthly | Use a crawler tool |
| Review Search Console | Weekly | GSC dashboard |
| Update content | Quarterly | Blog posts, tips page |

---

## 8. Troubleshooting

### "No data available" on all pages
- Check Edge Function logs in Supabase
- Verify external API keys are set correctly
- Verify pg_cron jobs are running: `select * from cron.job_run_details order by start_time desc limit 10;`

### Prices not updating
- Manually trigger: `https://yourproject.supabase.co/functions/v1/prices?refresh=true`
- Check OpenVan key validity
- Check pg_cron schedule is active

### AdSense not loading
- Verify cookie consent === "accepted"
- Check AdSense publisher ID is correct
- Verify AdSense script is in `<head>` (check Network tab)
- Ensure domain is approved in AdSense

### Images not loading
- NewsAPI images are external URLs — they may expire
- Placeholder SVG shows when image is null
- Add fallback images for blog posts

### Geolocation not working
- ipapi.co may rate-limit — check their dashboard
- Ensure consent is "accepted" before calling ipapi
- Check CORS headers are correct
