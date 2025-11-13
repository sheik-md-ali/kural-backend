import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/kuralapp";

async function checkCollections() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("Connected!\n");

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    
    console.log("=== Available Collections ===");
    collections.forEach((col, index) => {
      console.log(`${index + 1}. ${col.name}`);
    });

    // Check if there's a families collection
    const hasFamilies = collections.some(c => c.name === 'families');
    console.log(`\nFamilies collection exists: ${hasFamilies}`);

    if (!hasFamilies) {
      console.log("\n⚠️  No 'families' collection found.");
      console.log("Families will need to be aggregated from voters collection.");
    }

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
  }
}

checkCollections();
