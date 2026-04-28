# ────────────────────────────────
# HUSTLEAI • VERCEL DEPLOY GUIDE
# ────────────────────────────────
# Zero-drama, copy-paste deploy from Emergent → GitHub → Vercel → hustleai.live
# Total time: ~25 minutes. Everything below runs on YOUR computer (not Emergent).
# Backend stays on Emergent — only the frontend goes to Vercel.

# ==============================================================
# STEP 1 — Download the project to your laptop (5 min)
# ==============================================================
# Option A: git clone (if you already have a GitHub repo connected)
#   git clone https://github.com/YOU/hustleai.git
# Option B: download ZIP from Emergent (look for "Download Project" in the UI)
#   → unzip it to ~/projects/hustleai

cd ~/projects/hustleai        # adjust path to wherever you unzipped

# ==============================================================
# STEP 2 — Push to GitHub (5 min)
# ==============================================================
# Create a new private repo at https://github.com/new named 'hustleai'
# Then locally:

git init
git add .
git commit -m "Initial HustleAI launch"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/hustleai.git
git push -u origin main

# ✅ Before pushing, double-check these are git-ignored:
#    .env           (contains Resend + Stripe secrets — NEVER commit)
#    node_modules/
#    dist/
#    .metro-cache/
#    frontend/.env  (contains EXPO_PACKAGER_HOSTNAME — safe-ish but skip anyway)
# Already handled by the .gitignore I added.

# ==============================================================
# STEP 3 — Deploy to Vercel (8 min)
# ==============================================================
# 1. Go to https://vercel.com/new
# 2. Click "Import Git Repository" → pick your 'hustleai' repo
# 3. ON THE CONFIGURATION SCREEN, set these EXACTLY:
#
#    Framework Preset:     Other
#    Root Directory:       frontend         ← CRITICAL — point to /frontend, not the repo root
#    Build Command:        yarn install && yarn build:web
#    Output Directory:     dist
#    Install Command:      yarn install
#
# 4. Click "Environment Variables" and add these 2 (paste values from frontend/.env.example):
#
#    EXPO_PUBLIC_BACKEND_URL = https://skill-match-hustle.preview.emergentagent.com
#    EXPO_PUBLIC_VAPID_PUBLIC_KEY = BH5ll35qZacbz5T34aVfFSHCoDpkdNEy-75RtDUdVjsFbmPCwQT7cbUlntumULKELWDUhB51-v04jswoxwQm4nw
#
# 5. Click "Deploy". Wait ~3-5 min for the build.
# 6. When it succeeds, Vercel gives you a URL like hustleai-abc123.vercel.app
#    Open it — should look identical to your Emergent preview.

# ==============================================================
# STEP 4 — Point hustleai.live at Vercel (5 min + DNS wait)
# ==============================================================
# A. In Vercel project → Settings → Domains → click "Add Domain"
#    Enter: hustleai.live
#    Also add: www.hustleai.live  (Vercel will auto-redirect www → apex)
#
# B. Vercel shows you DNS records to set. Go to Squarespace DNS:
#    Squarespace → Domains → hustleai.live → DNS Settings → Custom Records
#
#    DELETE any existing A records pointing to Squarespace parking pages.
#
#    ADD these 2 records:
#       Type: A       Host: @     Points to: 76.76.21.21
#       Type: CNAME   Host: www   Points to: cname.vercel-dns.com
#
#    Save. Wait 5-60 min for DNS propagation (check at https://dnschecker.org).
#
# C. Vercel auto-issues an SSL cert the moment DNS resolves. Refresh Vercel domains tab;
#    both rows should go green with a Let's Encrypt badge.

# ==============================================================
# STEP 5 — Update Stripe webhook (2 min, optional)
# ==============================================================
# Stripe webhook currently points to the Emergent preview URL — it works fine there.
# BUT since we added a Vercel rewrite (see vercel.json), hustleai.live/api/webhook/stripe
# also works. If you want the nicer URL:
#
# 1. Stripe Dashboard → Developers → Event Destinations → edit your endpoint
# 2. Change URL to: https://hustleai.live/api/webhook/stripe
# 3. Copy the NEW signing secret (Vercel URL might issue a fresh one)
# 4. Email me the new whsec_... OR update STRIPE_WEBHOOK_SECRET in Emergent backend.
#
# Not urgent — the Emergent-URL webhook keeps working.

# ==============================================================
# STEP 6 — Smoke test (3 min)
# ==============================================================
# 1. Open https://hustleai.live in a fresh browser (or incognito)
# 2. Verify: hero loads, "100 of 100 Founders seats left" banner shows
# 3. Click "See Founders Pricing" → pricing page loads
# 4. Click "Claim Lifetime Access — $149" → redirects to real Stripe checkout
#    (DO NOT complete unless testing with your own card, then refund)
# 5. Register a fresh account → should receive Day 1 welcome email within 1 min
#    at the address you used (if hustleai.live is verified in Resend, sender = noreply@hustleai.live)

# ==============================================================
# TROUBLESHOOTING
# ==============================================================
# "Build failed" in Vercel:
#   → Check build logs. Most common: missing Yarn install. Verify Root Directory is 'frontend'.
#
# "Blank white page after deploy":
#   → Vercel rewrites not firing. Check vercel.json was included in repo + in /frontend/.
#
# "CORS errors in browser console when loading pricing":
#   → Backend needs to allow https://hustleai.live in CORS. It's already allow_origins=["*"]
#     so this should NOT fire — but if it does, email me and I'll tighten server.py.
#
# "API calls return 404":
#   → EXPO_PUBLIC_BACKEND_URL env var wasn't set at build time. Re-deploy after fixing it
#     in Vercel Project Settings → Environment Variables.

# ==============================================================
# That's it. Collect cash. 💰
# ==============================================================
