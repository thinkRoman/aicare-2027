# aiCare 2027: Canonical Product & Engineering Specification

Document: PRODUCT-SPEC.md
Target Repository: ashdhar/projects/dharz/aicare-2027
Governing Standard: ThinkRoman Engineering & Technology Standard (TECH-STACK.md)
Domain: Consumer Health Triage & Multimodal Guidance Agent

1. System Architecture & Critical Path

The system explicitly distinguishes triage guidance from diagnosis. Model inference never directly renders to the client without passing through deterministic boundaries on both sides:

[Consumer Input: Text, Audio, or Visual]
                 │
                 ▼
┌────────────────────────────────────────────────────────┐
│ 01. PRE-INFERENCE DETERMINISTIC SAFETY ARBITER         │
│ - Lexical pattern matcher + curated red-flag taxonomy  │
│ - Instant diversion: One resolved local emergency action  │
└────────────────────────┬───────────────────────────────┘
                         │ Safe to evaluate
                         ▼
┌────────────────────────────────────────────────────────┐
│ 02. STRUCTURED CLINICAL INTAKE (Context Gathering)     │
│ - Demographics: Age group (Neonate/Pediatric/Adult/65+)│
│ - Modifiers: Pregnancy status, active medications,     │
│   allergies, immunocompromised status                  │
│ - Dynamic Anamnesis: OPQRST / SOCRATES touch selectors │
└────────────────────────┬───────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────┐
│ 03. VISION QUALITY GATE (Edge / Client-Side Pre-Check) │
│ - Quality assessment: Blur index, glare, resolution    │
│ - Direct upload: Presigned S3/R2 private object key    │
│ - Clinical uncertainty enforcement                     │
└────────────────────────┬───────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────┐
│ 04. AI CLINICAL REASONING SERVICE (Provider-Agnostic)  │
│ - ThinkRoman AIService.forUser(userId || null)         │
│ - Evaluates symptom constellation against guidelines   │
└────────────────────────┬───────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────┐
│ 05. SCHEMA-VALIDATED TRIAGE RESULT (Zod Runtime Gate)  │
│ - Strict JSON Schema validation                        │
│ - Rejects unformatted, conversational text streams     │
└────────────────────────┬───────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────┐
│ 06. POST-INFERENCE DETERMINISTIC SAFETY ARBITER        │
│ - Inconsistency detection & heuristic cross-checks     │
│ - Automatic disposition escalation on high-risk flags  │
└────────────────────────┬───────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────┐
│ 07. CONSUMER ACTION CARDS (Generative UI Primitives)   │
│ - Urgency Indicator (Emergency / Urgent / Routine /    │
│   Self-Care)                                           │
│ - Plain-English Next Steps & Red Flags to Monitor      │
│ - Point-of-Care Summary Card for Clinician Visit       │
└────────────────────────────────────────────────────────┘


2. Clinical Safety Contracts

Pre-Inference Safety Arbiter

⚬ Delegates to ClinicalPolicyEngine to evaluate input against declarative, versioned policies under src/clinical/policies/, including a red-flag taxonomy (e.g., airway compromise, acute focal neurological deficits, signs of severe anaphylaxis, acute testicular/ovarian torsion markers, severe intractable pain, active suicidal ideation).
⚬ The policy engine executes combined token matching, regular expressions, and negative assertion logic supplied by policies; arbiters contain zero hardcoded medicine.
⚬ Bypass Rule: If triggered, bypasses all LLM inference immediately, persists an emergency encounter record, and renders the Emergency Interception Screen.

Post-Inference Safety Arbiter

⚬ Evaluates the schema-validated model payload prior to client delivery.
⚬ Versioned policy requirements (clinical thresholds and source support require review; these examples are not evidence of clinical approval):
  1. Pediatric Policy: Encode the finalized contract’s infant-fever escalation example declaratively in pediatric.v1.ts, with explicit age/temperature units and verified provenance or pending_clinical_review status. Do not invent a threshold, guideline citation, or clinical approval; unresolved threshold details require clinical review.
  2. Inconsistency Escalation: If the model flags high-concern red flags in its notes but outputs routine or self_care, the arbiter overrides the disposition to urgent or emergency.
  3. Visual Uncertainty Rule: If the visual analyzer marks image quality as borderline or uncertain, the arbiter bans definitive reassurance and enforces in-person clinical inspection.

3. Data Privacy, Storage & Security

Image Handling & R2 Isolation

⚬ Patient imagery is never accessible via persistent public URLs.
⚬ Uploads use presigned upload URLs targeted to private Cloudflare R2 object keys (encounters/{encounterId}/{uuid}.{ext}).
⚬ Image viewing requires short-lived (15-minute) presigned download tokens restricted to authenticated encounter owners or explicit patient export workflows.
⚬ Retention: Images default to a 30-day lifecycle rule in R2 unless retained under active consented encounters.

BYOK Credential Storage

⚬ API keys are never stored as plaintext in MongoDB.
⚬ Secret storage uses AES-256-GCM authenticated encryption using an application-level master encryption key (BYOK_ENCRYPTION_KEY).
⚬ Responses to the client only return masked metadata (provider, selectedModel, keyLast4, updatedAt).

Anonymous Sessions, Rate Limiting & Consent

⚬ Device Identification: Anonymous users are assigned an ephemeral, cryptographically random deviceId stored in an HttpOnly, SameSite=Strict cookie.
⚬ Abuse & Rate Limiting: Enforced at Route Handlers via Redis/Upstash sliding window algorithms:
  ⚬ Anonymous: Maximum 5 complete triage encounters per IP/device per 24-hour window.
  ⚬ BYOK/Authenticated: Platform abuse limits only.
⚬ Explicit Consent: A mandatory micro-consent step precedes ingestion ("I understand aiCare provides triage guidance, not a medical diagnosis").
⚬ Data Deletion: A one-tap "Clear & Delete My Encounter" action immediately purges the encounter document and triggers an R2 deletion command for associated image artifacts.

4. Canonical Schemas & Contracts

Schema: Encounter (MongoDB / Mongoose)

import mongoose, { Schema, Document } from 'mongoose';

export interface IEncounter extends Document {
  encounterId: string;
  userId?: string;
  deviceId: string;
  schemaVersion: string;
  status: 'in-progress' | 'triaged' | 'diverted_emergency' | 'deleted';
  consentAcknowledgedAt: Date;
  patientContext: {
    ageGroup: 'neonate' | 'infant' | 'pediatric' | 'adult' | 'geriatric';
    approximateAgeYears?: number;
    ageDays?: number; // Required when evaluating day-based pediatric policies; do not infer from age group.
    temperatureC?: number; // Explicit normalized measurement when supplied.
    isPregnant?: boolean;
    activeMedications: string[];
    knownAllergies: string[];
    immunocompromised?: boolean;
  };
  chiefComplaint: string;
  anamnesis: {
    onset?: string;
    provocation?: string;
    quality?: string;
    radiation?: string;
    severity?: number; // 1-10
    timing?: string;
  };
  image?: {
    objectKey: string;
    contentType: string;
    capturedAt: Date;
    quality: {
      acceptable: boolean;
      issues: string[]; // e.g., ['low_light', 'motion_blur']
    };
  };
  triageResult?: TriageResult & {
    overriddenBySafetyArbiter: boolean;
  };
  auditProvenance: {
    policyVersions: string[];
    matchedRuleIds: string[];
    clinicalSourceIds: string[];
    clinicalReviewStatus: 'verified' | 'pending_clinical_review';
    preflightTriggered: boolean;
    postflightTriggered: boolean;
    aiProviderUsed?: string;
    modelUsed?: string;
    latencyMs?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}


Schema: UserAiConfig (Encrypted BYOK)

export interface IUserAiConfig extends Document {
  userId: string;
  provider: 'openai' | 'anthropic' | 'local';
  encryptedCredential?: string; // Format: "iv:authTag:encryptedPayload"
  keyLast4?: string;
  baseUrl?: string;
  selectedModel: string;
  updatedAt: Date;
}


Schema: TriageResult (Zod Runtime Validation)

import { z } from 'zod';

export const TriageResultSchema = z.object({
  disposition: z.enum(['emergency', 'urgent', 'routine', 'self_care']),
  rationale: z.string().min(10).max(500),
  plainEnglishSummary: z.string().min(10).max(600),
  immediateActions: z.array(z.string().min(3).max(200)).min(1).max(5),
  redFlagsToMonitor: z.array(z.string().min(3).max(200)).min(1).max(6),
  pointOfCareChecklist: z.array(z.string().min(3).max(200)).min(1).max(6),
  confidenceScore: z.number().min(0).max(1),
  clinicalFlags: z.array(z.string()),
});

export type TriageResult = z.infer<typeof TriageResultSchema>;


5. Gated Implementation Plan

The final master replaces the earlier four milestones. No gate is authorized by saving these documents.

1. Gate 1: Repository scaffold, configuration, Zod schemas, clinical policy/provenance structures, policy engine, arbiters, and isolated unit tests. STOP and audit.
2. Gate 2: Mongoose persistence, anonymous sessions, AES-256-GCM encryption, private R2 services, and tests. STOP and audit.
3. Gate 3: AIService, provider adapters, structured output handling, timeouts, and explicit BYOK errors. STOP and audit.
4. Gate 4: Complete triage pipeline, EmergencyNumberResolver, upload/BYOK routes, and adversarial boundary tests. STOP and audit.
5. Gate 5: Mobile consumer UI, voice/text, smart selectors, camera, action cards, and isolated settings. STOP and audit.
6. Gate 6: Security/privacy, clinical regression, end-to-end verification, and production build audit.

Each gate follows the detailed requirements and verification commands in AICARE-MASTER-CONTRACT.md; advancement requires explicit approval after audit. Product requirements such as rate limiting, deletion, consent, and retention remain acceptance requirements even where the master's abbreviated gate checklist does not repeat them.

6. Finalized Architecture and Reconciliation

This specification is based on the canonical product attachment from “Review aiCare Safety Architecture” (conversation 6aa707b3-a0ac-83e8-96ea-650f0b7055eb), reconciled with its latest finalized master. The master is preserved byte-for-byte from the final attachment. The attachment has 305 logical lines (304 newline characters and no trailing newline).

The following resolves superseded product text and internal omissions in the master without rewriting the frozen source:

- All medicine belongs in declarative, versioned policies under src/clinical/policies/. ClinicalPolicyEngine executes policies; pre/post arbiters delegate. Policies carry ruleId, version, trigger, disposition, rationale, source linkage, and review metadata. Provenance includes organization, guidelineTitle, versionOrYear, identifierOrUrl where applicable, effectiveDate, supportedRuleId, reviewedAt/reviewedBy when available, and verified or pending_clinical_review status. The master's illustrative ClinicalSource interface omits rule linkage/review fields mentioned in the conversation; preserve those requirements in the policy/provenance relationship. Never invent citations or review metadata. Pending rules are not clinically approved merely because tests pass.
- Configure THINKROMAN_PLATFORM_PROVIDER and THINKROMAN_PLATFORM_MODEL explicitly. No baked-in model identifiers in application defaults, schemas, or .env.example. The model names in the master's sample comment are illustrative source text, not permission to copy model identifiers into .env.example. Validate required platform configuration with Zod at startup. The sample encryption key and session secret are examples, never production credentials; configure the selected provider's actual secret server-side.
- Ordinary consumers use platform AI automatically with no provider/key/model controls. Advanced BYOK is isolated to /settings. AIService resolves configured BYOK for the authorized identity, otherwise platform configuration. BYOK failure produces BYOKExecutionError and actionable feedback; it never silently switches to the organization key. Explicitly removing BYOK allows default platform use on a subsequent request.
- EmergencyNumberResolver selects one action from configured/known region; unknown region yields “Call Local Emergency Services.” Do not infer a US location or show competing international numbers. This follows the master's normative directive rather than its broader introductory “US/North America” wording.
- The request pipeline is input validation → PII stripping → pre-inference policy evaluation → provider resolution → AI inference → Zod output validation → post-inference policy evaluation → persistence with provenance → structured response. Structured intake and optional image-quality context are gathered before relevant reasoning; evaluate newly supplied context through the safety boundary. Pre-inference emergency diversion bypasses AI entirely.
- Malformed provider output stops at schema validation before the post-inference arbiter and consumer rendering. Return a controlled safe failure/retry state with no inferred reassurance. The adapter's Promise<TriageResult> signature does not validate network data: parse unknown responses before returning a typed result, and retain the API boundary check. Do not stream unvalidated clinical text to consumers.
- Canonical disposition values are emergency, urgent, routine, self_care; “Home Care” is a display label. Persist all validated TriageResult fields alongside override and audit metadata; the older abbreviated Encounter result shape is reconciled above.
- Clinical threshold examples are policy-review inputs. Day-based infant policies need sufficiently precise age and temperature context; never substitute a broad age category for a measured threshold. Missing clinical information must not be represented as a negative finding.
- Private R2 uploads expire after 300 seconds; download links after 900 seconds. Preserve the product's 30-day image retention, consented exception, ownership checks, deletion, consent, and rate limits. Anonymous ownership is established through the server-resolved session, not a caller-supplied identity.
- Consumer touch targets are at least 48 × 48 px. Camera quality failures allow skipping capture, with policy-driven uncertainty handling. Emergency escalation uses one resolved action. Result cards show urgency, plain-English actions, monitoring flags, and a clinician-ready checklist with native sharing.

Documentation provenance: TECH-STACK.md is drawn from an existing local ThinkRoman standard; the referenced conversation did not attach a separate engineering-standard file. The target folder contained no prior documents or application files. No clinical sources were independently verified and no application code, dependencies, or gates were implemented during document preparation.
