# HustleAI - Product Requirements Document

## Overview
HustleAI is an AI-powered side hustle recommendation platform that helps users discover personalized side hustle opportunities based on their skills, interests, and goals. The app generates tailored side hustle recommendations and detailed 30-day business plans with day-by-day execution calendars.

## Core Features

### 1. Authentication
- **Email/Password Registration & Login** - JWT-based custom auth with bcrypt password hashing
- **Google OAuth** - Emergent-managed Google social login
- Session management with Bearer tokens stored in AsyncStorage

### 2. Skills Assessment Questionnaire
- 10-question adaptive questionnaire covering:
  - Current profession/field
  - Top skills (multi-select)
  - Available hours per week
  - Startup budget
  - Monthly income goal
  - Interest areas (multi-select)
  - Risk tolerance
  - Work style preference
  - Technology comfort level
  - Timeline expectations
- Optional additional skills text input
- Optional resume text paste

### 3. AI Side Hustle Generation (GPT-5.2)
- Personalized side hustle recommendations based on questionnaire
- Each hustle includes: name, description, potential income, difficulty, time required, category, why it's a good fit
- Respects subscription tier limits

### 4. 30-Day Business Plan Generation
- AI-generated detailed business plans for selected hustles
- Includes: overview, daily tasks (30 days), milestones (Days 7, 14, 21, 30), resources needed, estimated costs
- Calendar view with milestone tracking

### 5. Subscription & Monetization (Stripe)
| Tier | Price | Business Plans | Launch Kits | Side Hustles |
|------|-------|---------------|-------------|-------------|
| Free | $0 | 1 trial plan | ❌ | 3-5 starter only (premium blurred) |
| Starter | $9.99/mo | 10/month | 2/month | All unlocked |
| Pro | $29.99/mo | Unlimited | 5/month | All unlocked |
| Empire | $49.99/mo | Unlimited | Unlimited | All unlocked |
| À la carte | $4.99/plan | Per plan | — | — |
| À la carte | $2.99/kit | — | Per kit | — |

**Monetization Strategy:**
- Free users discover starter hustles (low cost, $100-$500/week) with full details
- Premium hustles ($1K-$5K/week) shown with revenue potential visible but name/details blurred — creates FOMO
- Tapping locked hustle shows upgrade modal with "Unlock Premium Hustles" CTA
- First business plan is free trial, subsequent plans require upgrade or à la carte
- Hustle Launch Kit: AI-generated landing page, 5 social media posts, elevator pitch, brand colors
- Referral program: Give $5 credit / Get 1 free business plan per referral

### 6. Dashboard & Navigation
- Bottom tab navigation: Dashboard, My Hustles, Calendar, Profile
- Dashboard with stats, quick actions, recent hustles
- Hustle list with filtering (All/Active/Available)
- Calendar view for execution plans
- Profile with subscription management

## Tech Stack
- **Frontend**: Expo (React Native) with Expo Router
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **AI**: OpenAI GPT-5.2 via Emergent LLM Key
- **Payments**: Stripe via Emergent integrations
- **Auth**: Emergent Google OAuth + JWT email/password

## MongoDB Collections
- `users` - User profiles, subscription tier, questionnaire status
- `user_sessions` - Auth session tokens with expiry
- `questionnaire_responses` - Questionnaire answers, skills, resume text
- `side_hustles` - Generated side hustle recommendations
- `business_plans` - 30-day business plans
- `payment_transactions` - Stripe payment records

## API Routes
- Auth: `/api/auth/register`, `/api/auth/login`, `/api/auth/session`, `/api/auth/me`, `/api/auth/logout`
- Questionnaire: `/api/questionnaire/questions`, `/api/questionnaire/submit`
- Hustles: `/api/hustles/generate`, `/api/hustles`, `/api/hustles/{id}`, `/api/hustles/{id}/select`
- Plans: `/api/plans/generate/{hustle_id}`, `/api/plans/{hustle_id}`
- Payments: `/api/payments/create-checkout`, `/api/payments/status/{session_id}`, `/api/webhook/stripe`
- Profile: `/api/profile`, `/api/subscription/tiers`

## Design
- **Premium Dark Theme**: Deep Navy (#0F172A) with Amber/Gold (#F59E0B) accents
- Glassmorphism-inspired surfaces (#1E293B) with subtle borders
- 60-30-10 rule: Navy base, slate surfaces, gold CTAs
- Social proof on landing page (10,000+ hustles, $2.5M+ revenue, 4.9★ rating)
- Testimonial section with user quotes
- "Launch Kit Available" preview on every hustle card showing deliverables
