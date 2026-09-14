import mongoose, { type InferSchemaType, type Model, Schema } from "mongoose";

export const AI_PROVIDERS = ["openai", "anthropic", "local"] as const;

export type AiProvider = (typeof AI_PROVIDERS)[number];

const ENCRYPTED_CREDENTIAL_PATTERN =
  /^[0-9a-fA-F]+:[0-9a-fA-F]+:[0-9a-fA-F]+$/;

export const UserAiConfigSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    provider: { type: String, enum: AI_PROVIDERS, required: true },
    encryptedCredential: {
      type: String,
      required: false,
      validate: {
        validator(value: string | undefined): boolean {
          if (value === undefined || value === null) {
            return true;
          }
          if (typeof value !== "string" || value.length === 0) {
            return false;
          }
          // Reject values that look like plaintext API keys (sk-..., no colons).
          if (!ENCRYPTED_CREDENTIAL_PATTERN.test(value)) {
            return false;
          }
          return value.split(":").length === 3;
        },
        message:
          "encryptedCredential must be AES-256-GCM ciphertext in iv:authTag:encryptedPayload form",
      },
    },
    keyLast4: {
      type: String,
      required: false,
      maxlength: 4,
      minlength: 4,
    },
    baseUrl: { type: String, required: false },
    selectedModel: {
      type: String,
      required: true,
      validate: {
        validator(value: string): boolean {
          return typeof value === "string" && value.trim().length > 0;
        },
        message: "selectedModel is required and must not be empty",
      },
    },
  },
  {
    timestamps: { createdAt: false, updatedAt: true },
    collection: "user_ai_configs",
  },
);

export type UserAiConfigDocument = InferSchemaType<typeof UserAiConfigSchema> & {
  _id: mongoose.Types.ObjectId;
  updatedAt: Date;
};

export type UserAiConfigModel = Model<UserAiConfigDocument>;

export const UserAiConfig: UserAiConfigModel =
  (mongoose.models.UserAiConfig as UserAiConfigModel | undefined) ??
  mongoose.model<UserAiConfigDocument>("UserAiConfig", UserAiConfigSchema);
