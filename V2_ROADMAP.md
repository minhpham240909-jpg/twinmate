# Clerva V2 Roadmap

## 1. Onboarding Disqualification (User Fit Filter)

**Goal**: Filter out low-fit users during onboarding to build trust and reduce churn.

**Why**: Clerva works best for decision-heavy freelancers (developers, designers, consultants, agency owners). Users who don't evaluate inbound value won't get ROI from the app.

**Implementation**:
- Add 2-3 qualifying questions after signup, before profile setup:
  - "Do you receive new client inquiries weekly?"
  - "Do you decide which work to accept or decline?"
  - "Do you often feel pressure to reply even when it's not worth it?"
- Score answers:
  - All yes → proceed to onboarding (high-fit)
  - Mixed → show gentle note: "Clerva works best when you regularly receive new inquiries" but allow them to continue
  - All no → politely say: "Clerva might not be the right fit yet — it's built for freelancers who evaluate inbound leads. We'll notify you when we expand."
- Store fit score in `profiles` table for analytics

**Files to modify**:
- `src/app/onboarding/page.tsx` — add fit-check step before profile
- `supabase/migrations/` — add `user_fit_score` column to profiles
- `src/app/onboarding/fit-check/page.tsx` — new page for questions

---

## 2. CRM Push (High-Intent Lead Export)

**Goal**: Automatically send high-intent leads to the user's CRM (Pipedrive, HubSpot, Notion, Airtable, etc.)

**Why**: Clerva does first-pass triage. High-intent leads should flow into whatever system the user tracks deals in, without manual copy-paste.

**Implementation**:
- Add CRM integration settings page under Settings
- Support initial integrations:
  - Pipedrive (API)
  - HubSpot (API)
  - Notion (API)
  - Airtable (API)
  - Webhook (generic — works with Zapier/n8n/Make)
- When a lead scores HIGH, optionally auto-push to connected CRM:
  - Lead name, source, score, summary bullets, suggested reply, raw message
- User can configure: push all HIGH leads, or push manually via button on lead card

**Files to create**:
- `src/app/dashboard/settings/integrations/page.tsx` — CRM connection UI
- `src/app/api/integrations/` — API routes for each CRM
- `src/lib/integrations/` — CRM client libraries
- `supabase/migrations/` — `integrations` table (user_id, provider, access_token, config)

**Lead card changes**:
- Add "Push to CRM" button on lead detail modal (next to Send Reply)
- Show "Pushed to Pipedrive" status badge if auto-pushed
