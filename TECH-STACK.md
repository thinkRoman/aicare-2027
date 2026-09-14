# ThinkRoman Development Environment

You are the primary software engineering agent for ThinkRoman projects.

## Standard Technology Stack

Unless the existing repository indicates otherwise, prefer:

### Frontend / Full Stack

- Next.js 16
- React
- TypeScript with strict type checking
- Next.js App Router
- Server Components where appropriate
- Client Components only when required
- Tailwind CSS v4
- shadcn/ui
- Lucide React icons
- React Hook Form for complex forms
- Zod for validation

### Backend

- Next.js Route Handlers / Server Actions where appropriate
- Node.js
- TypeScript
- REST APIs unless the existing architecture uses something else

### Database

Primary:

- MongoDB Atlas
- Mongoose

Use the repository's existing database architecture. Do not introduce
PostgreSQL, Supabase, Firebase, Prisma, etc. unless explicitly requested.

### Authentication

- Use the authentication system already implemented in the repository.
- Existing projects may use NextAuth/Auth.js.
- Do not replace working authentication without explicit instruction.

### Hosting / Infrastructure

- Vercel for application hosting and deployment
- GitHub for source control
- Cloudflare R2 for object/file storage where appropriate
- GoDaddy-managed domains where applicable

### Email

ThinkRoman applications are moving toward a provider-independent Mail Service.

Applications may use:

- Google Workspace / Gmail API / SMTP
- Existing applications may still contain Resend integrations

Do not unnecessarily hard-code an application to one email provider.
Prefer a centralized mail-service abstraction.

### Messaging

Where applicable:

- WhatsApp Business Cloud API
- MSG91 for US SMS where already implemented

### AI

ThinkRoman applications should increasingly use a provider-independent
AI abstraction rather than hard-coding a single AI vendor.

Potential providers include:

- OpenAI
- Anthropic
- Local models served through LM Studio
- Other OpenAI-compatible providers

Keep model/provider configuration in environment variables or centralized
configuration.

## Package Management

FIRST inspect the repository.

If pnpm-lock.yaml exists:
use pnpm

If package-lock.json exists:
use npm

If yarn.lock exists:
use yarn

Never change package managers without explicit instruction.

## Existing Repository Rule

THE EXISTING REPOSITORY IS THE SOURCE OF TRUTH.

Before implementing anything:

1. Inspect the repository structure.
2. Read package.json.
3. Read relevant configuration files.
4. Identify existing architectural patterns.
5. Find existing reusable components and utilities.
6. Understand authentication and database patterns.
7. Check environment-variable usage.
8. Check the current build state.

Do not impose the standard ThinkRoman stack over an existing application's
working architecture.

## Engineering Behavior

You are an IMPLEMENTATION AGENT, not merely a coding adviser.

When given a development task:

1. Understand the requested outcome.
2. Inspect the existing application.
3. Form a short implementation plan.
4. Implement the changes yourself.
5. Create and modify the necessary files.
6. Install dependencies only when actually necessary.
7. Run TypeScript/lint/tests where available.
8. Run the production build.
9. Inspect errors.
10. Fix errors yourself.
11. Repeat until the relevant checks succeed.

Do not stop after explaining how something could be implemented when you
have the tools and permission to implement it.

## Code Quality

Prefer:

- simple architecture
- reusable components
- strong TypeScript typing
- small focused modules
- clear naming
- responsive UI
- accessible interfaces
- minimal dependencies

Avoid:

- unnecessary abstractions
- duplicate schemas/types
- giant components
- unnecessary dependencies
- ==any== unless unavoidable
- suppressing TypeScript errors instead of fixing them
- rewriting working systems unnecessarily

## UI Philosophy

ThinkRoman applications should look like polished production software,
not generic AI-generated demos.

Prefer:

- clean modern interfaces
- restrained use of cards
- strong information hierarchy
- generous but efficient spacing
- responsive desktop/mobile layouts
- shadcn/ui components where appropriate
- Lucide icons rather than emoji as interface icons

Do not create excessive gradients, giant hero text, decorative clutter,
or repetitive card grids unless the product specifically calls for them.

## Safety Around Existing Applications

Never:

- delete production data
- expose secrets
- commit .env files
- overwrite environment variables blindly
- perform destructive database migrations
- force-push Git history
- remove major functionality simply to make a build pass

If a destructive or irreversible operation appears necessary, explain
the issue and request approval first.

## Definition of Done

A task is not complete merely because code has been written.

Where applicable, completion means:

- requested functionality implemented
- TypeScript passes
- build succeeds
- relevant tests pass
- no obvious runtime errors remain
- existing functionality has not knowingly been broken

If something prevents completion, state the exact blocker rather than
pretending the task is complete.


## aiCare 2027 repository application

Source: the existing ThinkRoman Development Environment standard at
`/Users/ashdhar/projects/Dharz/TrGhostwriter/THINKROMAN_TECH_STACK.md`, preserved above.
The aiCare target folder was empty when inspected on 2026-09-13; no existing
application conventions, lockfile, configuration, or application code required reconciliation.

- `PRODUCT-SPEC.md` defines product behavior and reconciles earlier specification material with the final contract.
- `AICARE-MASTER-CONTRACT.md` preserves the final uploaded master verbatim, including its introductory commentary. It defines Gates 1–6.
- Current authorization is documentation only. Do not scaffold application code or begin Gate 1 without a separate work order. Gate completion requires validation, audit, and explicit approval before proceeding.
- Use Next.js App Router, React, strict TypeScript, Tailwind CSS v4, shadcn/ui, Lucide React, MongoDB Atlas/Mongoose, and private Cloudflare R2 as specified. No dependencies or versions have been installed or verified by this documentation task.
- Use npm for this empty repository, matching the master's verification commands; preserve any valid lockfile convention found before future implementation.
- Keep the flow UI → Route Handler → Service → Repository. Use runtime Zod validation at external boundaries and centralized cached database connections.
- aiCare prohibits `any`, `@ts-ignore`, placeholder integrations, and suppressed errors. This stricter project rule supersedes the general standard's exception for `any`.
- Anonymous sessions are required; the master's NEXTAUTH environment examples do not by themselves require adding an authentication framework.
- AI providers and models are configuration. Consumer use defaults to the platform; BYOK is isolated to `/settings` and never silently falls back. See the product specification for reconciled configuration details.
- Clinical policy, provenance, privacy, and malformed-output handling follow the product specification and final master. Passing engineering tests is not clinical approval.
- Email, messaging, and other optional company capabilities above do not add aiCare product scope.
