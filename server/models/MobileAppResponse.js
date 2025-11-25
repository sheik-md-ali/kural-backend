import mongoose from "mongoose";

const mobileAppResponseSchema = new mongoose.Schema(
  {},
  {
    strict: false,
    collection: "mobileappresponses",
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

mobileAppResponseSchema.virtual("id").get(function getId() {
  return this._id?.toString?.();
});

const MobileAppResponse =
  mongoose.models.MobileAppResponse ||
  mongoose.model("MobileAppResponse", mobileAppResponseSchema);

export default MobileAppResponse;


