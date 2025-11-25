import mongoose from "mongoose";

const mobileAppAnswerSchema = new mongoose.Schema(
  {},
  {
    strict: false,
    collection: "mobileappanswers",
    minimize: false,
    timestamps: false,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        ret.id = ret._id?.toString?.() ?? ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

mobileAppAnswerSchema.virtual("id").get(function getId() {
  return this._id?.toString?.();
});

const MobileAppAnswer =
  mongoose.models.MobileAppAnswer ||
  mongoose.model("MobileAppAnswer", mobileAppAnswerSchema);

export default MobileAppAnswer;


