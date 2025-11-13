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
      type: mongoose.Schema.Types.Mixed,
      set: (value) => value,
      get: (value) => value,
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
    isActive: {
      type: Boolean,
      default: true,
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

