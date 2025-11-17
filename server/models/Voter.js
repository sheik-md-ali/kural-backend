import mongoose from 'mongoose';

const voterSchema = new mongoose.Schema({
  name: {
    english: String,
    tamil: String
  },
  voterID: String,
  address: String,
  DOB: Date,
  fathername: String,
  doornumber: Number,
  fatherless: Boolean,
  guardian: String,
  age: Number,
  gender: String,
  mobile: Number,
  emailid: String,
  aadhar: String,
  PAN: String,
  religion: String,
  caste: String,
  subcaste: String,
  booth_id: String,
  boothname: String,
  boothno: Number,
  status: String,
  verified: Boolean,
  verifiedAt: Date,
  surveyed: {
    type: Boolean,
    default: false,
  },
  aci_id: Number,
  aci_name: String
}, {
  timestamps: true,
  strict: false, // Allow dynamic fields for voter records
});

const Voter = mongoose.model('Voter', voterSchema, 'voters');

export default Voter;
