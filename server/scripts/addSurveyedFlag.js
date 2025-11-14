#!/usr/bin/env node
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { MongoClient } from "mongodb";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("Missing MONGODB_URI in server/.env");
  process.exit(1);
}

const client = new MongoClient(MONGODB_URI);

async function addSurveyedFlag() {
  try {
    await client.connect();
    const db = client.db();
    const voters = db.collection("voters");

    const filter = {
      $or: [
        { surveyed: { $exists: false } },
        { surveyed: { $type: "null" } },
        { surveyed: { $nin: [true, false] } },
      ],
    };

    const update = {
      $set: { surveyed: false },
    };

    const result = await voters.updateMany(filter, update);

    console.log(
      `Updated ${result.modifiedCount} voter records (matched ${result.matchedCount}).`,
    );

    if (result.upsertedCount) {
      console.log(`Upserted ${result.upsertedCount} records.`);
    }
  } catch (error) {
    console.error("Error updating voter records:", error);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

addSurveyedFlag();


