import { z } from "zod";

export const AgeGroupSchema = z.enum([
  "neonate",
  "infant",
  "pediatric",
  "adult",
  "geriatric",
]);

export const DemographicsSchema = z.object({
  ageGroup: AgeGroupSchema,
  approximateAgeYears: z.number().nonnegative().optional(),
  ageDays: z.number().nonnegative().optional(),
  temperatureC: z.number().optional(),
  feverIndicated: z.boolean().optional(),
  isPregnant: z.boolean().optional(),
  activeMedications: z.array(z.string()),
  knownAllergies: z.array(z.string()),
  immunocompromised: z.boolean().optional(),
});

export const OpqrstSchema = z.object({
  onset: z.string().optional(),
  provocation: z.string().optional(),
  quality: z.string().optional(),
  radiation: z.string().optional(),
  severity: z.number().int().min(1).max(10).optional(),
  timing: z.string().optional(),
});

export const ImageQualitySchema = z.object({
  acceptable: z.boolean(),
  issues: z.array(z.string()),
});

export const EncounterImageInputSchema = z.object({
  objectKey: z.string().min(1),
  contentType: z.string().min(1),
  capturedAt: z.coerce.date(),
  quality: ImageQualitySchema,
});

export const EncounterContextSchema = z.object({
  chiefComplaint: z.string().min(1),
  patientContext: DemographicsSchema,
  anamnesis: OpqrstSchema,
  image: EncounterImageInputSchema.optional(),
});

export const EncounterInputSchema = EncounterContextSchema;

export type AgeGroup = z.infer<typeof AgeGroupSchema>;
export type Demographics = z.infer<typeof DemographicsSchema>;
export type Opqrst = z.infer<typeof OpqrstSchema>;
export type EncounterImageInput = z.infer<typeof EncounterImageInputSchema>;
export type EncounterInput = z.infer<typeof EncounterInputSchema>;
