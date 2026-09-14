import { connectToDatabase } from "@/lib/db/mongodb";
import { Encounter } from "@/lib/db/models/Encounter";
import type { EncounterPersistence } from "@/services/triage/runTriagePipeline";

export const mongoEncounterPersistence: EncounterPersistence = {
  async save(record) {
    await connectToDatabase();
    const doc = await Encounter.findOneAndUpdate(
      { encounterId: record.encounterId },
      {
        $set: {
          encounterId: record.encounterId,
          schemaVersion: record.schemaVersion,
          status: record.status,
          deviceId: record.deviceId,
          userId: record.userId,
          consentAcknowledgedAt: record.consentAcknowledgedAt,
          patientContext: record.patientContext,
          chiefComplaint: record.chiefComplaint,
          anamnesis: record.anamnesis,
          image: record.image,
          triageResult: record.triageResult,
          auditProvenance: record.auditProvenance,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();

    if (!doc) {
      throw new Error("Failed to persist encounter");
    }

    return {
      encounterId: doc.encounterId,
      status: doc.status,
      deviceId: doc.deviceId,
      userId: doc.userId ?? undefined,
      chiefComplaint: doc.chiefComplaint,
      triageResult: doc.triageResult
        ? {
            disposition: doc.triageResult.disposition,
            rationale: doc.triageResult.rationale,
            plainEnglishSummary: doc.triageResult.plainEnglishSummary,
            immediateActions: doc.triageResult.immediateActions,
            redFlagsToMonitor: doc.triageResult.redFlagsToMonitor,
            pointOfCareChecklist: doc.triageResult.pointOfCareChecklist,
            confidenceScore: doc.triageResult.confidenceScore,
            clinicalFlags: doc.triageResult.clinicalFlags,
            overriddenBySafetyArbiter:
              doc.triageResult.overriddenBySafetyArbiter,
          }
        : undefined,
      auditProvenance: {
        policyVersions: doc.auditProvenance.policyVersions,
        matchedRuleIds: doc.auditProvenance.matchedRuleIds,
        clinicalSourceIds: doc.auditProvenance.clinicalSourceIds,
        clinicalReviewStatus: doc.auditProvenance.clinicalReviewStatus,
        preflightTriggered: doc.auditProvenance.preflightTriggered,
        postflightTriggered: doc.auditProvenance.postflightTriggered,
        aiProviderUsed: doc.auditProvenance.aiProviderUsed ?? undefined,
        modelUsed: doc.auditProvenance.modelUsed ?? undefined,
        latencyMs: doc.auditProvenance.latencyMs ?? undefined,
      },
    };
  },
};
