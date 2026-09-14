import mongoose, { type InferSchemaType, type Model, Schema } from "mongoose";

export const ENCOUNTER_STATUSES = [
  "in-progress",
  "triaged",
  "diverted_emergency",
  "deleted",
] as const;

export type EncounterStatus = (typeof ENCOUNTER_STATUSES)[number];

export const AGE_GROUPS = [
  "neonate",
  "infant",
  "pediatric",
  "adult",
  "geriatric",
] as const;

export const DISPOSITIONS = [
  "emergency",
  "urgent",
  "routine",
  "self_care",
] as const;

export const CLINICAL_REVIEW_STATUSES = [
  "verified",
  "pending_clinical_review",
] as const;

const ImageQualitySchema = new Schema(
  {
    acceptable: { type: Boolean, required: true },
    issues: { type: [String], required: true, default: [] },
  },
  { _id: false },
);

const EncounterImageSchema = new Schema(
  {
    objectKey: {
      type: String,
      required: true,
      validate: {
        validator(value: string): boolean {
          return (
            typeof value === "string" &&
            value.length > 0 &&
            !value.includes("://") &&
            !value.startsWith("http")
          );
        },
        message: "image.objectKey must be a private R2 object key, not a URL",
      },
    },
    contentType: { type: String, required: true },
    capturedAt: { type: Date, required: true },
    quality: { type: ImageQualitySchema, required: true },
  },
  { _id: false },
);

const TriageResultPersistenceSchema = new Schema(
  {
    disposition: { type: String, enum: DISPOSITIONS, required: true },
    rationale: { type: String, required: true, minlength: 10, maxlength: 500 },
    plainEnglishSummary: {
      type: String,
      required: true,
      minlength: 10,
      maxlength: 600,
    },
    immediateActions: {
      type: [String],
      required: true,
      validate: {
        validator(value: string[]): boolean {
          return value.length >= 1 && value.length <= 5;
        },
        message: "immediateActions must contain 1 to 5 items",
      },
    },
    redFlagsToMonitor: {
      type: [String],
      required: true,
      validate: {
        validator(value: string[]): boolean {
          return value.length >= 1 && value.length <= 6;
        },
        message: "redFlagsToMonitor must contain 1 to 6 items",
      },
    },
    pointOfCareChecklist: {
      type: [String],
      required: true,
      validate: {
        validator(value: string[]): boolean {
          return value.length >= 1 && value.length <= 6;
        },
        message: "pointOfCareChecklist must contain 1 to 6 items",
      },
    },
    confidenceScore: { type: Number, required: true, min: 0, max: 1 },
    clinicalFlags: { type: [String], required: true, default: [] },
    overriddenBySafetyArbiter: { type: Boolean, required: true },
  },
  { _id: false },
);

const AuditProvenanceSchema = new Schema(
  {
    policyVersions: { type: [String], required: true, default: [] },
    matchedRuleIds: { type: [String], required: true, default: [] },
    clinicalSourceIds: { type: [String], required: true, default: [] },
    clinicalReviewStatus: {
      type: String,
      enum: CLINICAL_REVIEW_STATUSES,
      required: true,
    },
    preflightTriggered: { type: Boolean, required: true },
    postflightTriggered: { type: Boolean, required: true },
    aiProviderUsed: { type: String, required: false },
    modelUsed: { type: String, required: false },
    latencyMs: { type: Number, required: false, min: 0 },
  },
  { _id: false },
);

const PatientContextSchema = new Schema(
  {
    ageGroup: { type: String, enum: AGE_GROUPS, required: true },
    approximateAgeYears: { type: Number, required: false, min: 0 },
    ageDays: { type: Number, required: false, min: 0 },
    temperatureC: { type: Number, required: false },
    feverIndicated: { type: Boolean, required: false },
    isPregnant: { type: Boolean, required: false },
    activeMedications: { type: [String], required: true, default: [] },
    knownAllergies: { type: [String], required: true, default: [] },
    immunocompromised: { type: Boolean, required: false },
  },
  { _id: false },
);

const AnamnesisSchema = new Schema(
  {
    onset: { type: String, required: false },
    provocation: { type: String, required: false },
    quality: { type: String, required: false },
    radiation: { type: String, required: false },
    severity: { type: Number, required: false, min: 1, max: 10 },
    timing: { type: String, required: false },
  },
  { _id: false },
);

export const EncounterSchema = new Schema(
  {
    encounterId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: false, index: true },
    deviceId: { type: String, required: true, index: true },
    schemaVersion: { type: String, required: true },
    status: {
      type: String,
      enum: ENCOUNTER_STATUSES,
      required: true,
      default: "in-progress",
    },
    consentAcknowledgedAt: { type: Date, required: true },
    patientContext: { type: PatientContextSchema, required: true },
    chiefComplaint: { type: String, required: true, minlength: 1 },
    anamnesis: { type: AnamnesisSchema, required: true, default: () => ({}) },
    image: { type: EncounterImageSchema, required: false },
    triageResult: { type: TriageResultPersistenceSchema, required: false },
    auditProvenance: { type: AuditProvenanceSchema, required: true },
  },
  {
    timestamps: true,
    collection: "encounters",
  },
);

export type EncounterDocument = InferSchemaType<typeof EncounterSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export type EncounterModel = Model<EncounterDocument>;

export const Encounter: EncounterModel =
  (mongoose.models.Encounter as EncounterModel | undefined) ??
  mongoose.model<EncounterDocument>("Encounter", EncounterSchema);
