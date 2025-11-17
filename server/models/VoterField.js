import mongoose from 'mongoose';

const voterFieldSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  type: {
    type: String,
    enum: ['String', 'Number', 'Boolean', 'Date', 'Object'],
    required: true,
  },
  required: {
    type: Boolean,
    default: false,
  },
  default: mongoose.Schema.Types.Mixed,
  label: String,
  description: String,
  visible: {
    type: Boolean,
    default: true, // By default, fields are visible in the frontend
  },
}, {
  timestamps: true,
});

const VoterField = mongoose.model('VoterField', voterFieldSchema, 'voterFields');

export default VoterField;

