import mongoose from "mongoose";

const questionSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      trim: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      trim: true,
    },
    required: {
      type: Boolean,
      default: false,
    },
    options: {
      type: [String],
      default: undefined,
    },
  },
  {
    _id: false,
  },
);

const surveySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: ["Draft", "Active"],
      default: "Draft",
    },
    formNumber: {
      type: String,
      unique: true,
      sparse: true, // Allows multiple null values
      trim: true,
    },
    questions: {
      type: [questionSchema],
      default: [],
    },
    assignedACs: {
      type: [Number],
      default: [],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    createdByRole: {
      type: String,
      trim: true,
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: undefined,
    },
  },
  {
    timestamps: true,
    collection: "surveys",
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

surveySchema.virtual("id").get(function getId() {
  return this._id.toString();
});

export default mongoose.models.Survey || mongoose.model("Survey", surveySchema);



