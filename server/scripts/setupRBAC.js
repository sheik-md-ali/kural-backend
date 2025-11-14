/**
 * RBAC Setup Script
 * 
 * This script sets up the Role-Based Access Control system with initial data:
 * - Creates a Super Admin (L0) user
 * - Creates sample ACIM (L1) and ACI (L2) users
 * - Creates sample Booth Agent users
 * - Creates sample booths with agent assignments
 * 
 * Run this script: node server/scripts/setupRBAC.js
 */

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, "..", ".env");

dotenv.config({
  path: fs.existsSync(envPath) ? envPath : undefined,
});

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/kuralapp";

// Define schemas inline for this script
const userSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    phone: String,
    passwordHash: String,
    password: String,
    role: String,
    assignedAC: Number,
    aci_name: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "users" }
);

const boothSchema = new mongoose.Schema(
  {
    boothNumber: Number,
    boothName: String,
    boothCode: String,
    ac_id: Number,
    ac_name: String,
    address: String,
    totalVoters: Number,
    assignedAgents: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    primaryAgent: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "booths" }
);

const User = mongoose.models.User || mongoose.model("User", userSchema);
const Booth = mongoose.models.Booth || mongoose.model("Booth", boothSchema);

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log("✅ Connected to MongoDB");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    process.exit(1);
  }
}

async function setupRBAC() {
  console.log("\n🚀 Setting up RBAC system...\n");

  try {
    // 1. Create Super Admin (L0)
    console.log("1️⃣  Creating Super Admin (L0)...");
    const superAdminPassword = await bcrypt.hash("admin123", 10);
    const superAdmin = await User.findOneAndUpdate(
      { email: "admin@kuralapp.com" },
      {
        name: "Super Administrator",
        email: "admin@kuralapp.com",
        phone: "9999999999",
        passwordHash: superAdminPassword,
        role: "L0",
        isActive: true,
      },
      { upsert: true, new: true }
    );
    console.log("   ✅ Super Admin created:", superAdmin.email);

    // 2. Create ACIM (L1) for AC 119 - Thondamuthur
    console.log("\n2️⃣  Creating ACIM (L1) for AC 119...");
    const acimPassword = await bcrypt.hash("acim123", 10);
    const acim = await User.findOneAndUpdate(
      { email: "acim119@kuralapp.com" },
      {
        name: "ACIM Thondamuthur",
        email: "acim119@kuralapp.com",
        phone: "9999999991",
        passwordHash: acimPassword,
        role: "L1",
        assignedAC: 119,
        aci_name: "Thondamuthur",
        isActive: true,
      },
      { upsert: true, new: true }
    );
    console.log("   ✅ ACIM created:", acim.email, "- AC", acim.assignedAC);

    // 3. Create ACI (L2) for AC 119
    console.log("\n3️⃣  Creating ACI (L2) for AC 119...");
    const aciPassword = await bcrypt.hash("aci123", 10);
    const aci = await User.findOneAndUpdate(
      { email: "aci119@kuralapp.com" },
      {
        name: "ACI Thondamuthur Zone 1",
        email: "aci119@kuralapp.com",
        phone: "9999999992",
        passwordHash: aciPassword,
        role: "L2",
        assignedAC: 119,
        aci_name: "Thondamuthur",
        isActive: true,
      },
      { upsert: true, new: true }
    );
    console.log("   ✅ ACI created:", aci.email, "- AC", aci.assignedAC);

    // 4. Create Booth Agents
    console.log("\n4️⃣  Creating Booth Agents...");
    const agentPassword = await bcrypt.hash("agent123", 10);
    const agents = [];

    for (let i = 1; i <= 5; i++) {
      const agent = await User.findOneAndUpdate(
        { phone: `999999900${i}` },
        {
          name: `Agent ${i}`,
          phone: `999999900${i}`,
          passwordHash: agentPassword,
          role: "BoothAgent",
          assignedAC: 119,
          aci_name: "Thondamuthur",
          isActive: true,
        },
        { upsert: true, new: true }
      );
      agents.push(agent);
      console.log(`   ✅ Agent ${i} created:`, agent.phone);
    }

    // 5. Create Sample Booths
    console.log("\n5️⃣  Creating Sample Booths...");
    const booths = [];

    for (let i = 1; i <= 5; i++) {
      const boothNumber = 100 + i;
      const booth = await Booth.findOneAndUpdate(
        { boothCode: `AC119-B${boothNumber}` },
        {
          boothNumber,
          boothName: `Government School ${i}`,
          boothCode: `AC119-B${boothNumber}`,
          ac_id: 119,
          ac_name: "Thondamuthur",
          address: `Ward ${i}, Thondamuthur`,
          totalVoters: 1200 + i * 50,
          createdBy: superAdmin._id,
          isActive: true,
        },
        { upsert: true, new: true }
      );
      booths.push(booth);
      console.log(`   ✅ Booth ${boothNumber} created:`, booth.boothName);
    }

    // 6. Assign agents to booths
    console.log("\n6️⃣  Assigning Agents to Booths...");
    for (let i = 0; i < booths.length; i++) {
      const booth = booths[i];
      const agent = agents[i % agents.length];

      booth.assignedAgents = [agent._id];
      booth.primaryAgent = agent._id;
      await booth.save();

      console.log(
        `   ✅ Assigned ${agent.name} to ${booth.boothName} (${booth.boothCode})`
      );
    }

    // Print summary
    console.log("\n" + "=".repeat(60));
    console.log("✅ RBAC Setup Complete!");
    console.log("=".repeat(60));
    console.log("\n📋 Login Credentials:\n");
    console.log("🔐 Super Admin (L0):");
    console.log("   Email: admin@kuralapp.com");
    console.log("   Password: admin123\n");
    console.log("🔐 ACIM (L1) - Thondamuthur:");
    console.log("   Email: acim119@kuralapp.com");
    console.log("   Password: acim123\n");
    console.log("🔐 ACI (L2) - Thondamuthur:");
    console.log("   Email: aci119@kuralapp.com");
    console.log("   Password: aci123\n");
    console.log("🔐 Booth Agents (BoothAgent):");
    console.log("   Phone: 9999999001 to 9999999005");
    console.log("   Password: agent123\n");
    console.log("=".repeat(60));
    console.log("\n📊 Created Data Summary:");
    console.log(`   • 1 Super Admin (L0)`);
    console.log(`   • 1 ACIM (L1) for AC 119`);
    console.log(`   • 1 ACI (L2) for AC 119`);
    console.log(`   • ${agents.length} Booth Agents`);
    console.log(`   • ${booths.length} Booths`);
    console.log(`   • ${booths.length} Agent Assignments\n`);
    console.log("🚀 Next Steps:");
    console.log("   1. Start the server: npm start");
    console.log("   2. Start the frontend: npm run dev");
    console.log("   3. Login with any of the above credentials");
    console.log("   4. Test RBAC features based on role\n");
  } catch (error) {
    console.error("\n❌ Setup failed:", error.message);
    throw error;
  }
}

async function main() {
  try {
    await connectDB();
    await setupRBAC();
    console.log("\n✅ All done! Disconnecting...\n");
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Fatal error:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

main();
