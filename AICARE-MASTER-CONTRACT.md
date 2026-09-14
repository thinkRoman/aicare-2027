All three corrections tighten the clinical and technical surface:

1. Clinical Provenance Structure: Unverified rules or hallucinated guideline references are unacceptable in regulated health informatics. By enforcing strict metadata fields (organization, guidelineTitle, versionOrYear, identifierOrUrl, effectiveDate, and supportedRuleId) and marking unverified rules with status: 'pending_clinical_review', we eliminate agent hallucination in the clinical core.
2. Gate 4 Validation Sequencing: If Zod validation happens before the post-inference arbiter, malformed JSON can never reach that arbiter. The test sequence now correctly verifies that malformed outputs are halted at the boundary, triggering a controlled safe fallback rather than an arbiter escalation.
3. Emergency Number Resolution: Presenting multiple emergency numbers (911/112/999) on an active panic screen causes cognitive load. Introducing EmergencyNumberResolver resolves a single, definitive action for the user's locale (defaulting to 911 for US/North America, or a localized equivalent) with a clear generic fallback.

Here is the finalized, frozen Master Implementation Contract & Prompt.

aiCare 2027: Master Engineering Contract & Implementation Prompt

⚬ Project Name: aiCare 2027
⚬ Target Repository: ashdhar/projects/dharz/aicare-2027
⚬ Organization: ThinkRoman Ventures
⚬ Domain: Consumer Health Triage & Multimodal Guidance Companion (Strictly triage guidance; NOT a medical diagnosis tool)
⚬ Governing Standards: ThinkRoman Engineering Standard (TECH-STACK.md) and PRODUCT-SPEC.md

1. Core Invariants & Architectural Directives

1. Decoupled Clinical Policy Engine (src/clinical/):
  ⚬ Arbiters are pure policy execution runtimes. They contain zero hardcoded medicine.
  ⚬ All clinical rules live in declarative, versioned policy files (src/clinical/policies/).
  ⚬ src/clinical/provenance/sources.ts enforces structured provenance metadata. An AI agent is never permitted to invent a clinical citation or guideline reference. Any rule lacking an auditable clinical citation must be explicitly marked status: 'pending_clinical_review'.
2. Model-Agnostic Configuration:
  ⚬ No models are baked into .env.example, schemas, or code defaults.
  ⚬ Platform execution requires explicit environment variables: THINKROMAN_PLATFORM_PROVIDER and THINKROMAN_PLATFORM_MODEL.
  ⚬ Missing model configuration fails runtime validation at startup via Zod.
3. Strict Separation of Consumer Experience & BYOK:
  ⚬ The primary consumer flow has zero exposure to models, providers, or keys. It consumes the platform runtime automatically.
  ⚬ Advanced/Internal BYOK settings are isolated under /settings.
4. Explicit BYOK Failure Policy:
  ⚬ If an authenticated/configured user's BYOK provider fails, the system never silently falls back to the ThinkRoman organization key.
  ⚬ Failing over to an organizational key without user consent alters cost, data-processing agreements, and privacy boundaries.
  ⚬ BYOK errors fail explicitly with clear diagnostic feedback: "Configured AI provider failed. Check your settings or remove your key to use default triage."
5. Single-Action Emergency Resolution:
  ⚬ The emergency escalation modal utilizes an EmergencyNumberResolver.
  ⚬ The user is never shown a list of competing international emergency numbers. The resolver determines the single appropriate number for the locale (e.g., 911 for US), falling back to a safe generic action ("Call Local Emergency Services") if undetermined.

2. Directory Tree to Scaffold

ashdhar/projects/dharz/aicare-2027/
├── TECH-STACK.md
├── PRODUCT-SPEC.md
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.mjs
├── .env.example
├── .gitignore
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── settings/
│   │   │   └── page.tsx
│   │   └── api/
│   │       ├── triage/
│   │       │   └── route.ts
│   │       ├── upload/
│   │       │   └── presign/
│   │       │       └── route.ts
│   │       └── byok/
│   │           └── route.ts
│   ├── clinical/
│   │   ├── engine/
│   │   │   └── ClinicalPolicyEngine.ts
│   │   ├── policies/
│   │   │   ├── emergency.v1.ts
│   │   │   ├── pediatric.v1.ts
│   │   │   ├── pregnancy.v1.ts
│   │   │   └── vision.v1.ts
│   │   └── provenance/
│   │       └── sources.ts
│   ├── components/
│   │   ├── consumer/
│   │   │   ├── IntakeCanvas.tsx
│   │   │   ├── SmartTapSelectors.tsx
│   │   │   ├── CameraCapture.tsx
│   │   │   ├── TriageResultCard.tsx
│   │   │   └── EmergencyEscalationModal.tsx
│   │   ├── settings/
│   │   │   └── ByokWidget.tsx
│   │   └── ui/
│   ├── lib/
│   │   ├── db/
│   │   │   ├── mongodb.ts
│   │   │   └── models/
│   │   │       ├── Encounter.ts
│   │   │       └── UserAiConfig.ts
│   │   ├── storage/
│   │   │   └── r2.ts
│   │   ├── security/
│   │   │   ├── crypto.ts
│   │   │   └── session.ts
│   │   ├── utils/
│   │   │   └── EmergencyNumberResolver.ts
│   │   └── schemas/
│   │       ├── triage.ts
│   │       └── encounter.ts
│   └── services/
│       └── ai/
│           ├── AIService.ts
│           ├── arbiter/
│           │   ├── preInferenceArbiter.ts
│           │   └── postInferenceArbiter.ts
│           └── adapters/
│               ├── IAIProviderAdapter.ts
│               ├── OpenAIAdapter.ts
│               ├── AnthropicAdapter.ts
│               └── LocalCompatibleAdapter.ts


3. Strict Gated Execution Instructions

Follow this gated sequence. Do not write code for subsequent gates until the active gate passes validation and audit.

Gate 1 (Contracts & Policy Engine) ──► STOP & AUDIT
       │
Gate 2 (Persistence & Security)    ──► STOP & AUDIT
       │
Gate 3 (AIService & Adapters)      ──► STOP & AUDIT
       │
Gate 4 (Safety Pipeline & Tests)   ──► STOP & AUDIT
       │
Gate 5 (Consumer Interface & R2)   ──► STOP & AUDIT
       │
Gate 6 (Final Production Audit)    ──► PRODUCTION FREEZE


GATE 1: Repository Scaffold, Schemas, Clinical Policies & Arbiters

Objective: Establish core types, Zod schemas, provenance structures, declarative clinical policies, and the evaluation engine with isolated unit tests.

1. Tooling & Config:
  ⚬ Scaffold package.json, tsconfig.json (strict mode, bundler resolution), tailwind.config.ts, .gitignore.
  ⚬ Write .env.example without model assumptions:
    MONGODB_URI="mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/aicare2027?retryWrites=true&w=majority"
    R2_ACCOUNT_ID="your_r2_account_id"
    R2_ACCESS_KEY_ID="your_r2_access_key"
    R2_SECRET_ACCESS_KEY="your_r2_secret_key"
    R2_BUCKET_NAME="aicare-clinical-artifacts"
    BYOK_ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    THINKROMAN_PLATFORM_PROVIDER="openai" # openai | anthropic | local
    THINKROMAN_PLATFORM_MODEL=""          # REQUIRED: e.g. gpt-4o, claude-3-5-sonnet
    LOCAL_AI_BASE_URL="http://localhost:1234/v1"
    NEXTAUTH_URL="http://localhost:3000"
    NEXTAUTH_SECRET="minimum_32_characters_random_hash"
    
2. Schemas (src/lib/schemas/):
  ⚬ triage.ts: Zod TriageResultSchema enforcing disposition, rationale, plainEnglishSummary, immediateActions, redFlagsToMonitor, pointOfCareChecklist, confidenceScore, clinicalFlags.
  ⚬ encounter.ts: Context, Demographics, and OPQRST input schemas.
3. Clinical Policy Architecture (src/clinical/):
  ⚬ provenance/sources.ts: Define strict provenance type:
    export interface ClinicalSource {
      id: string;
      organization: string;
      guidelineTitle: string;
      versionOrYear: string;
      identifierOrUrl?: string;
      effectiveDate: string;
      status: 'verified' | 'pending_clinical_review';
    }
    
    Rule for coding agent: Never hallucinate or guess a clinical citation. Any policy rule lacking a verified citation must have status: 'pending_clinical_review'.
  ⚬ policies/emergency.v1.ts: Declarative red-flag matchers (chest pain, FAST stroke symptoms, respiratory distress/stridor, severe anaphylaxis).
  ⚬ policies/pediatric.v1.ts: Declarative age-based invariants (e.g., age < 90 days with fever \implies emergency escalation).
  ⚬ policies/pregnancy.v1.ts: Obstetric red-flag predicates.
  ⚬ policies/vision.v1.ts: Degradation predicates requiring physical examination mandates.
  ⚬ engine/ClinicalPolicyEngine.ts: Evaluates active policies against context and model output.
4. Arbiters (src/services/ai/arbiter/):
  ⚬ preInferenceArbiter.ts: Delegates evaluation to ClinicalPolicyEngine.evaluatePreInference(encounter).
  ⚬ postInferenceArbiter.ts: Delegates evaluation to ClinicalPolicyEngine.evaluatePostInference(triageResult, encounter).
5. Unit Tests (src/clinical/__tests__/):
  ⚬ Verify pre-inference emergency policy diversion against acute red flags.
  ⚬ Verify post-inference pediatric escalation (e.g., infant fever overrides routine candidate disposition to emergency).
  ⚬ Verify image degradation rules inject clinical examination mandates.

Gate 1 Verification:

npm run typecheck && npm run lint && npm test


🛑 STOP & AUDIT GATE 1 BEFORE PROCEEDING.

GATE 2: Database, Anonymous Sessions, Encryption & Cloudflare R2

Objective: Implement persistence, AES-256-GCM secret management, session tracking, and private R2 object storage.

1. src/lib/security/crypto.ts: AES-256-GCM encryptSecret and decryptSecret using process.env.BYOK_ENCRYPTION_KEY. Output format: iv:authTag:payload in hex.
2. src/lib/security/session.ts: Anonymous session resolution storing an ephemeral UUID in an HttpOnly, SameSite=Strict cookie (aicare_device_id).
3. src/lib/storage/r2.ts: S3 client for Cloudflare R2. Implement generatePresignedUploadUrl (300s TTL) and generatePresignedDownloadUrl (900s TTL). No public bucket access.
4. src/lib/db/mongodb.ts: Cached singleton Mongoose connection (global.mongooseCache).
5. src/lib/db/models/:
  ⚬ Encounter.ts: Mongoose schema matching the domain model with full audit provenance.
  ⚬ UserAiConfig.ts: Mongoose schema for encrypted BYOK credentials. No hardcoded default model.
6. Build unit tests verifying encryption/decryption round-trips and schema validation constraints.

Gate 2 Verification:

npm run typecheck && npm run lint && npm test


🛑 STOP & AUDIT GATE 2 BEFORE PROCEEDING.

GATE 3: AIService, Provider Adapters & Explicit BYOK Fallback

Objective: Provider-independent AI orchestration enforcing structured JSON schema outputs and explicit error handling on custom key failures.

1. src/services/ai/adapters/:
  ⚬ IAIProviderAdapter.ts: Contract generateTriage(payload: EncounterPayload): Promise<TriageResult>.
  ⚬ OpenAIAdapter.ts: OpenAI SDK with structured output (response_format: { type: "json_schema" }) and 15s AbortController timeout.
  ⚬ AnthropicAdapter.ts: Tool-use schema to force structured JSON output and 15s timeout.
  ⚬ LocalCompatibleAdapter.ts: Targets local base URL (LM Studio/Ollama) with 15s timeout.
2. src/services/ai/AIService.ts:
  ⚬ AIService.forUser(userId: string | null): Promise<IAIProviderAdapter>.
  ⚬ If user has configured BYOK, decrypt credentials and instantiate matching adapter.
  ⚬ No Silent Fallback: If user BYOK fails, throw a distinct BYOKExecutionError so the client receives an actionable message. Never fail over to organization keys.
  ⚬ If userId is null (anonymous consumer): read THINKROMAN_PLATFORM_PROVIDER and THINKROMAN_PLATFORM_MODEL. Fail fast if platform model is missing.
3. Unit test adapters with mocked network responses verifying schema parsing and timeout aborts.

Gate 3 Verification:

npm run typecheck && npm run lint && npm test


🛑 STOP & AUDIT GATE 3 BEFORE PROCEEDING.

GATE 4: /api/triage Safety Pipeline & Boundary Stress Tests

Objective: Connect the end-to-end API pipeline, enforce Zod validation boundaries, and stress-test the flow.

1. src/lib/utils/EmergencyNumberResolver.ts:
  ⚬ Resolves a single emergency number based on locale context (e.g., 911 for US), with a generic fallback ("Call Local Emergency Services").
2. src/app/api/triage/route.ts:
  ⚬ Step 1: Validate request body against EncounterInputSchema.
  ⚬ Step 2: Strip common PII from chief complaint text.
  ⚬ Step 3: Run preInferenceArbiter. If diverted, persist status: 'diverted_emergency' and return emergency payload immediately.
  ⚬ Step 4: Resolve AI adapter via AIService.forUser.
  ⚬ Step 5: Execute AI reasoning.
  ⚬ Step 6: Zod Validation Boundary: Validate raw output against TriageResultSchema. If malformed:
    ⚬ Halt immediately.
    ⚬ Do not allow unvalidated content to reach the consumer or the post-inference arbiter.
    ⚬ Return a controlled safe failure/retry response. Never infer reassurance from malformed output.
  ⚬ Step 7: Run postInferenceArbiter via ClinicalPolicyEngine.
  ⚬ Step 8: Persist finalized encounter to MongoDB with complete auditProvenance timings.
  ⚬ Step 9: Return structured result.
3. src/app/api/upload/presign/route.ts: Validate image MIME type and return presigned R2 upload URL with isolated object key.
4. src/app/api/byok/route.ts: Encrypt and persist BYOK configuration; return sanitized keyLast4.
5. Integration & Adversarial Tests (src/app/api/triage/__tests__/):
  ⚬ Test pre-inference emergency diversion completely bypasses AI invocation.
  ⚬ Test BYOK failure returns actionable error and does not invoke organization keys.
  ⚬ Malformed Output Test: Verify that unparseable model output triggers a Zod schema rejection, halts the pipeline before post-inference arbiters, and returns a controlled safe retry state.

Gate 4 Verification:

npm run typecheck && npm run lint && npm test


🛑 STOP & AUDIT GATE 4 BEFORE PROCEEDING.

GATE 5: Consumer Canvas, Generative Cards & Isolated BYOK Widget

Objective: Build the empathetic, mobile-first consumer experience and isolated /settings view.

1. src/components/consumer/:
  ⚬ IntakeCanvas.tsx: Speech-to-text / text chief complaint with mandatory micro-consent.
  ⚬ SmartTapSelectors.tsx: Minimum 48 \times 48\text{ px} touch targets for OPQRST inputs (Timing, Severity slider, Fever toggle, Demographics).
  ⚬ CameraCapture.tsx: Canvas check for brightness and blur. Provide fallback skip option after failed attempts without blocking intake.
  ⚬ TriageResultCard.tsx: Accessible Urgency Badge (Emergency / Urgent / Routine / Home Care), plain-English action items, and "Show Your Doctor" checklist with native mobile share (navigator.share).
  ⚬ EmergencyEscalationModal.tsx: High-contrast takeover displaying the single resolved emergency action from EmergencyNumberResolver.
2. src/components/settings/ByokWidget.tsx:
  ⚬ Isolated under /settings. Hidden from normal consumer triage flow.
  ⚬ Fields: Provider, Model, API Key, Base URL, Connection test button.
3. Pages:
  ⚬ src/app/page.tsx: Consumer triage entry point.
  ⚬ src/app/settings/page.tsx: Advanced / BYOK configuration.

Gate 5 Verification:

npm run typecheck && npm run lint && npm test


🛑 STOP & AUDIT GATE 5 BEFORE PROCEEDING.

GATE 6: Security, Clinical Audit & Production Build Freeze

Objective: End-to-end verification, type checks, linting, and production build.

1. Automated Verification:
   npm run typecheck
   npm run lint
   npm test
   npm run build
   
2. Audit Checklist:
  ⚬ [ ] Clinical policies live strictly under src/clinical/policies/; arbiters contain zero hardcoded medicine.
  ⚬ [ ] All clinical policy rules have verified provenance in src/clinical/provenance/sources.ts or are explicitly marked pending_clinical_review. No invented citations.
  ⚬ [ ] Zero hardcoded model identifiers in .env.example, schemas, or code defaults.
  ⚬ [ ] Consumer flow has zero BYOK exposure; BYOK is strictly isolated to /settings.
  ⚬ [ ] BYOK failure fails explicitly without silent fallback to organization keys.
  ⚬ [ ] Zod schema boundary halts malformed model output before post-inference arbiters.
  ⚬ [ ] Emergency modal surfaces a single resolved emergency action via EmergencyNumberResolver.
  ⚬ [ ] Cloudflare R2 uses presigned private URLs only; no public buckets.
  ⚬ [ ] BYOK secrets are stored strictly as AES-256-GCM ciphertexts.
  ⚬ [ ] Mobile touch targets meet the \ge 48 \times 48\text{ px} accessibility requirement.
  ⚬ [ ] Production build (next build) passes with zero errors or warnings.