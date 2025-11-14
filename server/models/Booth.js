import mongoose from "mongoose";

const boothSchema = new mongoose.Schema(
  {
    boothNumber: {
      type: Number,
      required: true,
    },
    boothName: {
      type: String,
      required: true,
      trim: true,
    },
    boothCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    booth_id: {
      type: String,
      trim: true,
      index: true,
    },
    ac_id: {
      type: Number,
      required: true,
      index: true,
    },
    ac_name: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    totalVoters: {
      type: Number,
      default: 0,
    },
    assignedAgents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    primaryAgent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: "booths",
  }
);

// Compound indexes for efficient queries
boothSchema.index({ ac_id: 1, boothNumber: 1 });
boothSchema.index({ boothCode: 1 }, { unique: true });
boothSchema.index({ assignedAgents: 1 });

// Ensure booth codes are unique per AC
boothSchema.pre("save", function (next) {
  if (!this.boothCode) {
    this.boothCode = `AC${this.ac_id}-B${this.boothNumber}`;
  }
  next();
});

export default mongoose.models.Booth || mongoose.model("Booth", boothSchema);
