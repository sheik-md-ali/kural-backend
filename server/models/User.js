import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      trim: true,
      lowercase: true,
      index: true,
    },
    phone: {
      type: String,
      set: (value) => {
        if (!value) return value;
        // Normalize phone: remove all non-digit characters
        const normalized = String(value).replace(/\D/g, '');
        return normalized || value; // Return original if normalization results in empty
      },
      trim: true,
    },
    name: {
      type: String,
      trim: true,
    },
    passwordHash: {
      type: String,
    },
    password: {
      type: String,
    },
    role: {
      type: String,
      required: true,
    },
    assignedAC: {
      type: Number,
    },
    aci_name: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    assignedBoothId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booth",
    },
    booth_id: {
      type: String,
      trim: true,
    },
    booth_agent_id: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    aci_id: {
      type: Number,
    },
    status: {
      type: String,
      enum: ["Active", "Inactive", "Pending"],
      default: "Active",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Mobile app fields
    emailVerified: {
      type: Boolean,
      default: false,
    },
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lastLogin: {
      type: Date,
    },
  },
  {
    timestamps: true,
    collection: "users",
  },
);

userSchema.methods.verifyPassword = async function verifyPassword(password) {
  if (!password) {
    return false;
  }

  if (this.passwordHash) {
    return bcrypt.compare(password, this.passwordHash);
  }

  if (this.password) {
    if (this.password.startsWith("$2a$") || this.password.startsWith("$2b$")) {
      return bcrypt.compare(password, this.password);
    }

    const hashedInput = crypto
      .createHash("sha256")
      .update(password)
      .digest("hex");

    const stored = String(this.password).toLowerCase();
    if (stored.length !== hashedInput.length) {
      return false;
    }

    try {
      const hashedBuffer = Buffer.from(hashedInput, "hex");
      const storedBuffer = Buffer.from(stored, "hex");

      if (hashedBuffer.length !== storedBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(hashedBuffer, storedBuffer);
    } catch (error) {
      return false;
    }
  }

  return false;
};

userSchema.index(
  { email: 1, phone: 1 },
  { name: "user_auth_lookup", partialFilterExpression: { isActive: true } },
);

export default mongoose.models.User || mongoose.model("User", userSchema);

