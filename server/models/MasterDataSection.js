import mongoose from "mongoose";

const answerOptionSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: 256,
    },
    value: {
      type: String,
      required: true,
      trim: true,
      maxlength: 256,
    },
    order: {
      type: Number,
      default: 0,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  { _id: true },
);

const questionSchema = new mongoose.Schema(
  {
    prompt: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    type: {
      type: String,
      enum: [
        "short-answer",
        "long-answer",
        "multiple-choice",
        "checkboxes",
        "dropdown",
        "number",
        "date",
        "email",
        "phone",
        "rating",
      ],
      required: true,
      default: "short-answer",
    },
    isRequired: {
      type: Boolean,
      default: false,
    },
    helperText: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    order: {
      type: Number,
      default: 0,
    },
    isVisible: {
      type: Boolean,
      default: true,
    },
    options: {
      type: [answerOptionSchema],
      default: [],
      validate: {
        validator(options) {
          // Types that require options
          const optionRequiredTypes = ["multiple-choice", "checkboxes", "dropdown", "rating"];
          if (optionRequiredTypes.includes(this.type)) {
            return Array.isArray(options) && options.length > 0;
          }
          return true;
        },
        message: "This question type must have at least one answer option",
      },
    },
  },
  { _id: true, timestamps: true },
);

const masterDataSectionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    order: {
      type: Number,
      default: 0,
    },
    aci_id: {
      type: [Number],
      default: function() {
        return [];
      },
      required: false,
    },
    aci_name: {
      type: [String],
      default: function() {
        return [];
      },
      required: false,
    },
    isVisible: {
      type: Boolean,
      default: true,
    },
    questions: {
      type: [questionSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

masterDataSectionSchema.index({ order: 1, name: 1 });

const MasterDataSection = mongoose.model(
  "MasterDataSection",
  masterDataSectionSchema,
  "masterDataSections",
);

export default MasterDataSection;


