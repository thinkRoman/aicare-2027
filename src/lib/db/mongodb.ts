import mongoose from "mongoose";

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongooseCache ?? {
  conn: null,
  promise: null,
};

global.mongooseCache = cached;

function assertMongoUri(uri: string | undefined): string {
  if (uri === undefined || uri.trim() === "") {
    throw new Error("MONGODB_URI is missing or empty");
  }

  const normalized = uri.trim();
  if (
    !normalized.startsWith("mongodb://") &&
    !normalized.startsWith("mongodb+srv://")
  ) {
    throw new Error(
      "MONGODB_URI is invalid: must start with mongodb:// or mongodb+srv://",
    );
  }

  return normalized;
}

/**
 * Cached Mongoose connection for Next.js. Connects only when called —
 * never on module import — so tests and static builds stay safe.
 */
export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  const uri = assertMongoUri(process.env.MONGODB_URI);

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, {
      bufferCommands: false,
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    cached.promise = null;
    throw error;
  }

  return cached.conn;
}

/** Test/helper reset — does not disconnect active sockets. */
export function resetMongoConnectionCacheForTests(): void {
  cached.conn = null;
  cached.promise = null;
}
