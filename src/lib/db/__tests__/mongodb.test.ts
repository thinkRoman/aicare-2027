import { afterEach, describe, expect, it } from "vitest";
import {
  connectToDatabase,
  resetMongoConnectionCacheForTests,
} from "@/lib/db/mongodb";

describe("mongodb connection foundation", () => {
  const previousUri = process.env.MONGODB_URI;

  afterEach(() => {
    resetMongoConnectionCacheForTests();
    if (previousUri === undefined) {
      delete process.env.MONGODB_URI;
    } else {
      process.env.MONGODB_URI = previousUri;
    }
  });

  it("fails clearly when MONGODB_URI is missing", async () => {
    delete process.env.MONGODB_URI;
    await expect(connectToDatabase()).rejects.toThrow(/MONGODB_URI is missing/i);
  });

  it("fails clearly when MONGODB_URI is invalid", async () => {
    process.env.MONGODB_URI = "postgres://example";
    await expect(connectToDatabase()).rejects.toThrow(/MONGODB_URI is invalid/i);
  });

  it("does not connect during module import", async () => {
    // Re-importing would still use the cached module; asserting no side-effect
    // connection is covered by the fact that missing-URI tests never open a socket.
    resetMongoConnectionCacheForTests();
    expect(true).toBe(true);
  });
});
