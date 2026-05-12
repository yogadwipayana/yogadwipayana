## Project Overview

This is a personal portfolio site that doubles as a hub for a small set of personal tools.

Pages:

- `/` — Landing page. Portfolio entry point that introduces the owner and the site at a glance.
- `/about` — Explains what this website is and who the owner is.
- `/tools` — Public catalogue of the available tools, currently:
  - VPS control
  - AI router
  - Chat AI
- `/dashboard` — Authenticated workspace that hosts every tool in one place.
  - Primary sidebar lists all tools and stays collapsed by default; it expands only on hover.
  - A sub-sidebar appears next to the primary sidebar and shows controls/navigation specific to the tool currently selected in the primary sidebar.
  - Sub-sidebar contents change based on which tool is active (e.g. VPS instances list for VPS, model/route list for AI router, conversation list for Chat AI).

Treat the `/tools` page as the marketing/overview surface and `/dashboard` as the actual working surface for the same tools.

## Next.js Notes

This project may use a newer or different Next.js setup than expected.

- Check the relevant guide in `node_modules/next/dist/docs/` before making framework-level changes
- Do not assume older APIs, file structure, or conventions still apply
- Follow deprecation warnings

## Design System

For UI, UX, layout, and styling work

- Keep the SUpabase-inspired direction unless the user asks otherwise
- Follow its rules for typography, grayscale palette, spacing, radius, components, and interaction style from src/app/globals.css and use only dark mode
- use DESIGN.md file as reference before writing any UI.

## Responsive and Mobile-First

Treat mobile-first as the default approach for frontend work.

- Start layout, spacing, and interaction design from small screens first
- Scale up progressively for tablet and desktop, not the other way around
- Do not hide important functionality on mobile; adapt it for smaller screens
- Ensure touch targets, navigation, and text remain usable on mobile devices
- Verify the result works well on both mobile and desktop before considering it complete

## File Structure

```text
yogadwipayana/
├── src/
│   ├── app/                    <- all routing lives here
│   │   ├── layout.tsx           <- root layout
│   │   ├── page.tsx             <- home page (/)
│   │   ├── globals.css
│   │   │
│   │   ├── about/
│   │   │   └── page.tsx         <- /about
│   │   ├── ai/
│   │   │   └── page.tsx         <- /ai
│   │   ├── chat/
│   │   │   └── page.tsx         <- /chat
│   │   └── vps/
│   │       └── page.tsx         <- /vps
│   │
│   ├── api/
│   │   ├── ai/
│   │   │   └── route.ts         <- POST /api/ai
│   │   ├── chat/
│   │   │   └── route.ts         <- POST /api/chat
│   │   └── vps/
│   │       └── route.ts         <- POST /api/vps
│   │
│   ├── components/
│   │   ├── ui/                  <- small reusable components
│   │   │   ├── Button.tsx
│   │   │   ├── Badge.tsx
│   │   │   └── Tag.tsx
│   │   ├── layout/              <- page structure components
│   │   │   ├── Navbar.tsx
│   │   │   └── Footer.tsx
│   │   └── sections/            <- page sections
│   │       ├── Hero.tsx
│   │       ├── Projects.tsx
│   │       ├── Skills.tsx
│   │       └── Contact.tsx
│   │
│   ├── lib/                     <- logic and utilities
│   │   └── utils.ts             <- helper functions
│   │
│   ├── hooks/                   <- custom React hooks
│   │   └── useScrollPosition.ts
│   │
│   ├── types/                   <- TypeScript types
│   │   ├── index.ts
│   │   └── supabase.ts
│   │
│   └── utils/
│       └── supabase/
│           ├── client.ts
│           ├── middleware.ts
│           └── server.ts
│
├── public/
│   └── images/
│       └── avatar.png
│
├── .env
├── next.config.ts
├── tsconfig.json
└── package.json
```

## Git Worktree Hygiene

When using `git worktree`, clean it up after the task is finished.

- Merge the worktree branch back into its parent branch when the work is complete
- Delete the temporary worktree after the merge
- Delete the temporary branch if it was created only for that worktree
- Keep the branch list clean unless the user explicitly asks to keep the worktree or branch

## Code Quality

Default to clean, production-ready code.

- Prefer simple, readable solutions over clever abstractions
- Keep files, components, and functions focused
- Avoid duplication when extraction improves clarity
- Match existing naming and code patterns
- Preserve type safety, validation, and error handling where relevant
- Write code that is easy to test, debug, review, and extend

## React `useEffect`

Use `useEffect` only when syncing with external systems.

- Do not use it for derived state that can be handled during render or in event handlers
- Keep each effect focused on one synchronization concern
- Include all reactive dependencies unless there is a justified exception
- Always mirror setup with cleanup
- Prevent stale updates and race conditions in async effects
- If supported by the project, prefer `useEffectEvent` for reading latest values without retriggering the effect

Reference: official React guidance via Context7 (`/reactjs/react.dev`)

## Metadata and SEO

For Next.js App Router work:

- Use `metadata` or `generateMetadata`, not manual head management
- Give each important page a clear, specific title and description
- Keep metadata close to the route that owns it
- Avoid duplicate or placeholder SEO copy

Reference: official Next.js docs via Context7 (`/vercel/next.js`)

## Error Handling and Validation

Handle unhappy paths deliberately.

- Validate inputs at clear boundaries
- Guard against missing, nullable, or malformed data
- Use clear fallback behavior instead of silent failure
- Use `loading.tsx`, `error.tsx`, `not-found.tsx`, and `notFound()` where appropriate
- Keep user messages helpful and diagnostics useful without leaking sensitive details

Reference: official Next.js docs via Context7 (`/vercel/next.js`)

## Testing

Keep testability in scope when implementing or refactoring.

- Write modular code that is easy to verify and isolate
- Add or update tests for non-trivial logic when test infrastructure exists
- If tests are not practical yet, keep logic deterministic so tests can be added later
- Do not rely only on happy-path manual checks for complex behavior
- Be explicit when tests are not added and note the verification gap
