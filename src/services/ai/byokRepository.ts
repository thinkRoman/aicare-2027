import { connectToDatabase } from "@/lib/db/mongodb";
import { UserAiConfig } from "@/lib/db/models/UserAiConfig";
import type {
  ByokConfigRepository,
  ByokRecord,
} from "@/services/ai/AIService";

/**
 * Mongo-backed BYOK lookup for AIService.
 * Disabled configurations are treated as inactive (platform default applies).
 */
export const mongoByokRepository: ByokConfigRepository = {
  async findActiveByUserId(userId: string): Promise<ByokRecord | null> {
    await connectToDatabase();
    const doc = await UserAiConfig.findOne({ userId }).lean();
    if (!doc) {
      return null;
    }
    if (doc.disabled) {
      return null;
    }

    return {
      userId: doc.userId,
      provider: doc.provider,
      selectedModel: doc.selectedModel,
      encryptedCredential: doc.encryptedCredential ?? undefined,
      baseUrl: doc.baseUrl ?? undefined,
      disabled: Boolean(doc.disabled),
    };
  },
};
