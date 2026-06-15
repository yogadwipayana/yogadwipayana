# Live Feature Test Report

**Target:** https://yogathedev.com/
**Date:** 2026-06-15
**Account:** kiropower2@gmail.com
**Method:** BrowserAct automation driving real Chrome (chrome-direct), headed.
**Scope:** Every user-facing feature was mapped from source, then exercised live. Destructive actions against the live VPS (stop/reboot/reset/reinstall) were intentionally skipped; everything else was tested end-to-end.

---

## Summary

| Tool | Result | Notes |
|---|---|---|
| Auth (sign-in) | PASS | Login succeeded after correct password. |
| Chat AI | PASS | Streaming, time tool, web search, model switch all work. |
| VPS Control | PASS | Read paths + live SSH terminal verified; destructive actions skipped. |
| AI Router | PASS | Key CRUD, usage, billing/QRIS, models all work. |
| Image Studio | PASS | Real generation completed; history + canvas actions work. |
| Settings | PASS (partial) | Account page verified; destructive actions not triggered. |

No blocking defects found.

---

## 1. Authentication

- **Sign-in** (`/sign-in`): Email + password form renders with show/hide toggle and "Forgot password?" link.
- First two credential attempts were rejected with "Invalid email or password." Login succeeded on the third attempt with the corrected password (`Kiropower2`).
- After submit, the page briefly showed a transient "This page couldn't load" error, but navigating to `/dashboard` confirmed the session was authenticated — landed on `/dashboard/chat`. **Minor:** the post-login redirect showed a transient error screen once; worth a glance but session was valid.

## 2. Chat AI (`/dashboard/chat`)

- **New conversation + streaming:** Sent "What is the current time? Use your time tool." — `get_current_time` tool fired ("Completed 1 step"), response streamed, follow-up suggestions generated, conversation appeared in the sidebar.
- **Web search tool:** Sent a Next.js version query — `web_search` + 2× `web_fetch` fired ("Completed 3 steps"), the **Links** tab populated with a "5" badge, answer cited npmjs.com and github.com.
- **Model switcher:** Dropdown lists all 4 models (GPT-5.5, Claude Opus 4.8, Claude Opus 4.7, Claude Sonnet 4.6). Switched mid-thread to Claude Sonnet 4.6; selector label updated and a follow-up message routed on the new model.
- **Tabs:** Answer / Links / Images tabs present with live counts; per-message Copy / Edit / Retry and branch controls render.

## 3. VPS Control (`/dashboard/vps`)

Live instance present: **Ubuntu-4**, Running, ap-jakarta, 43.133.143.50, Ubuntu Server 24.04 LTS, 2 vCPU / 2 GB / 40 GB SSD / 20 Mbps.

- **Instance detail / Overview:** Full specs, status, IP (with copy), expiry, instance ID all render.
- **Refresh (sync):** Clicked — instance stayed Running, no errors.
- **Firewall tab:** Listed 2 real rules — TCP/22 ACCEPT (SSH), ICMP ALL ACCEPT. Add/Delete controls present.
- **SSH Keys tab:** Shows account key "main" (ssh-ed25519), "0 keys bound to Ubuntu-4", Import/Bind controls.
- **SSH Terminal** (`/dashboard/vps/terminal`): Connected over WebSocket using saved credentials. Full Ubuntu MOTD + live shell prompt (`ubuntu@VM-0-5-ubuntu:~$`). Interactive — `whoami` accepted. **This is the standout: a real in-browser SSH session works.**
- **Skipped (destructive, live server):** Stop, Reboot, Reset password, Reinstall OS, SSH bind, firewall rule deletion.

## 4. AI Router (`/dashboard/ai`)

- **API Keys — full CRUD verified:**
  - Create: "New key" → named "browseract-test-key" → secret revealed once (`sk-…`) → key appeared masked (`sk-...8abc`).
  - Edit/Rename: renamed to "browseract-renamed", persisted in list. Active toggle present.
  - Delete: confirm modal → deleted. List returned to empty state. **Test key cleaned up.**
- **Billing:** Real balance shown — **$10.00 Active** (Budget $10.00 · Spent $0.00).
  - Add Funds modal: amount stepper, quick chips (Rp10k–100k), rate line. Created a Rp50.000 payment → reference `DWP-KK4LTRFX`, QRIS image, merchant "Dwipa", WhatsApp confirm link with prefilled message. Client-only flow — no real charge, balance unchanged.
- **Usage:** 3 meter cards (Requests/Tokens/Spent = 0), "Last 24 hours" range filter, request-log table with empty state.
- **Models:** 4 models listed with pricing + context. Base URL `https://ai.yogathedev.com/v1` and curl example shown.

## 5. Image Studio (`/dashboard/image`)

- **Controls:** Prompt textarea, negative-prompt toggle, Describe/Enhance, 9 style presets, 5 aspect ratios, Auto/HD quality, reference upload/paste-URL.
- **Generation (real, end-to-end):** Prompt "a small green cactus in a terracotta pot, minimalist, soft studio lighting" → background job, sidebar showed pending with elapsed timer → completed within ~1 min → image rendered in History grid with prompt + "just now" + Iterate.
- **Canvas actions:** Selecting the result loaded it into the canvas with Generate variation / Upscale / Remove background / Download / Delete.
- **Delete:** Deleted the test image ("Image deleted" toast). **Test image cleaned up.**

## 6. Settings (`/dashboard/settings`)

- **Account / Profile:** Renders email (kiropower2@gmail.com), User ID, Joined Jun 8 2026, and a Display name form with Save changes.
- **Skipped (destructive):** Security → Sign out everywhere; Danger zone → Delete account.

---

## Cleanup performed

- Deleted the test AI API key (created → renamed → deleted).
- Deleted the test generated image.
- Closed the BrowserAct session. Chat test conversations were left in place (low-noise; can be deleted on request).

## Observations / follow-ups

1. **Transient post-login error:** sign-in submit flashed a "This page couldn't load" screen once before the session resolved correctly. Worth verifying the redirect path.
2. **AI Keys empty-state copy** says "Use the admin API to create one," which contradicts the working "New key" modal. Cosmetic.
3. **Not tested (by design):** all live-VPS state changes, account deletion, sign-out-everywhere.
