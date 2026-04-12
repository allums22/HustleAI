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
| Tier | Price | Business Plans | Side Hustles |
|------|-------|---------------|-------------|
| Free | $0 | 1 trial plan, then locked | Unlimited discovery |
| Starter | $9.99/mo | 10/month | Unlimited |
| Pro | $29.99/mo | Unlimited | Unlimited |
| À la carte | $4.99 each | Per individual plan | N/A |

**Monetization Strategy:**
- Free users get unlimited side hustle discovery (recommendations, income estimates, categories)
- First business plan is free as a trial to demonstrate value
- After trial, business plans require either subscription or à la carte purchase
- Paywall modal appears on hustle detail page with 3 purchase options: à la carte ($4.99), Starter, Pro

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

## Design System
- 60-30-10 color rule: Elevated Neutrals (stone-50/white), Trust Blue + Growth Green, Orange CTA
- Mobile-first with 44px touch targets
- Card-based layout with consistent border-radius (12px)
