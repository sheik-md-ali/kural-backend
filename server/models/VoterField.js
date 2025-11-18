import mongoose from 'mongoose';

const voterFieldSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    validate: {
      validator: function(name) {
        // Explicitly allow any field name - NO reserved field restrictions
        // Only validate format: must start with letter/underscore and contain only alphanumeric/underscore
        return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
      },
      message: 'Field name must start with a letter or underscore and contain only letters, numbers, and underscores'
    }
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

