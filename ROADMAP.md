# Adecis — Future Development Roadmap

Deferred improvements identified during the full codebase audit. Organized by priority.

---

## Phase 1 — Polish & Reliability

### Debounced search input
The search input in the dashboard fires an API call on every keystroke. Add a 300ms debounce so it only queries after the user stops typing. Reduces unnecessary API calls and improves perceived speed.

### Retry queue for failed auto-replies
If an auto-reply (email or Slack) fails, the lead is saved but the reply is lost. Add a `reply_failed` column and a cron job that retries failed replies (max 3 attempts, exponential backoff).

### Email sender verification
Validate that the user's configured `reply_from_name` and email address are verified in SendGrid before attempting to send. Show a warning in Settings if not.

### Slack token refresh monitoring
Token rotation is implemented but there's no alerting if refresh consistently fails. Add a `token_refresh_failed_count` column and notify the user after 3 consecutive failures.

---

## Phase 2 — Analytics & Insights

### Lead analytics dashboard
Show charts for: leads per day/week, intent distribution (high/medium/low), average AI confidence, reply rate, response time. Use the existing data — no new tables needed.

### Weekly summary email
The cron endpoint (`/api/cron/weekly-summary`) exists but needs the actual email template. Send a weekly digest showing: new leads count, top leads, reply stats, intent breakdown.

### Feedback loop for AI improvement
Track positive/negative feedback ratios per niche. Use this data to adjust the AI prompt dynamically (e.g., if a user consistently marks "not helpful", add their feedback patterns to `custom_instructions`).

---

## Phase 3 — Growth Features

### Multi-channel lead merging
If the same person emails AND messages on Slack, they show as two separate leads. Detect duplicates by matching `sender_identifier` (email) across sources and group them.

### Team/workspace support
Allow multiple users in one organization to share a lead inbox. Requires: `organizations` table, `org_id` on leads, role-based access (admin/member), shared Slack installation.

### Custom webhook integrations
Let users forward scored leads to their own webhook (Zapier, n8n, CRM). Add a `webhook_url` field to profiles and POST the lead JSON after scoring.

### Lead tags and notes
Let users add custom tags (e.g., "follow-up", "closed", "spam") and notes to leads. Requires: `lead_tags` junction table, UI for tag management.

### CRM export
One-click export of leads to CSV. Filter by date range, source, intent label. Include all scored fields.

---

## Phase 4 — Scale & Performance

### Database indexing
Add composite indexes for common query patterns:
- `leads(user_id, created_at DESC)` — already covered by RLS but explicit index helps
- `leads(user_id, intent_label)` — for filtered views
- `leads(user_id, source)` — for source-filtered views

### Edge caching for dashboard
Cache the leads API response at the edge (Vercel Edge Config or stale-while-revalidate) for users with many leads. Invalidate on new lead insertion via realtime.

### Batch AI scoring
If multiple messages arrive within a short window (e.g., Slack thread), batch them into a single AI call instead of scoring each individually. Reduces API costs.

---

## Phase 5 — Platform

### Mobile-responsive dashboard
The current dashboard works on desktop but needs responsive layout for mobile. Priority: lead list view, lead detail modal, settings page.

### API keys for developers
Let power users generate API keys to submit leads programmatically. Enables integration with custom forms, chatbots, or other sources beyond Slack/email.

### White-label / reseller mode
Allow agencies to use Adecis under their own brand. Custom domain, logo, colors stored per organization.
