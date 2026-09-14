import { connectToDatabase } from "@/lib/db/mongodb";
import { Encounter } from "@/lib/db/models/Encounter";
import type { RequestIdentity } from "@/lib/security/identity";
import { deletePrivateObject } from "@/lib/storage/r2";

export type DeleteEncounterResult =
  | {
      ok: true;
      encounterId: string;
      status: "deleted";
      imageDeleted: boolean;
    }
  | {
      ok: false;
      code: "NOT_FOUND" | "FORBIDDEN" | "ALREADY_DELETED" | "IMAGE_DELETE_FAILED";
      message: string;
    };

export type DeleteEncounterDependencies = {
  deleteObject?: typeof deletePrivateObject;
};

function ownsEncounter(
  encounter: { deviceId: string; userId?: string | null },
  identity: RequestIdentity,
): boolean {
  const ownsByDevice = encounter.deviceId === identity.deviceId;
  const ownsByUser =
    identity.userId !== null &&
    encounter.userId !== undefined &&
    encounter.userId !== null &&
    encounter.userId === identity.userId;
  return ownsByDevice || ownsByUser;
}

/**
 * Soft-deletes an encounter and removes associated private R2 image artifacts.
 * Ownership is resolved exclusively from the server identity (session/device cookies).
 */
export async function deleteEncounterWithArtifacts(
  encounterId: string,
  identity: RequestIdentity,
  dependencies: DeleteEncounterDependencies = {},
): Promise<DeleteEncounterResult> {
  const deleteObject = dependencies.deleteObject ?? deletePrivateObject;

  await connectToDatabase();
  const encounter = await Encounter.findOne({ encounterId }).lean();
  if (!encounter) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "Encounter not found",
    };
  }

  if (!ownsEncounter(encounter, identity)) {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: "Not authorized for this encounter",
    };
  }

  if (encounter.status === "deleted") {
    return {
      ok: false,
      code: "ALREADY_DELETED",
      message: "Encounter is already deleted",
    };
  }

  let imageDeleted = false;
  const objectKey = encounter.image?.objectKey;
  if (typeof objectKey === "string" && objectKey.trim() !== "") {
    try {
      await deleteObject({ objectKey });
      imageDeleted = true;
    } catch {
      return {
        ok: false,
        code: "IMAGE_DELETE_FAILED",
        message: "Failed to delete private image artifact",
      };
    }
  }

  await Encounter.findOneAndUpdate(
    { encounterId },
    {
      $set: {
        status: "deleted",
        chiefComplaint: "[deleted]",
        anamnesis: {},
      },
      $unset: {
        triageResult: 1,
        image: 1,
      },
    },
    { new: true },
  );

  return {
    ok: true,
    encounterId,
    status: "deleted",
    imageDeleted,
  };
}
