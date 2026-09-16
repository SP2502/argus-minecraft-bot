const mongoose = require('mongoose');

/**
 * Macro Schema - User-defined compound workflows and parameterized sequences
 */
const MacroSchema = new mongoose.Schema({
  name: { type: String, unique: true, required: true, lowercase: true, trim: true },
  owner: { type: String, required: true },
  description: { type: String, default: '' },
  steps: [{ type: mongoose.Schema.Types.Mixed, required: true }],
  parameters: [
    {
      name: { type: String, required: true },
      required: { type: Boolean, default: false },
      defaultValue: { type: mongoose.Schema.Types.Mixed, default: null }
    }
  ],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  lastRunAt: { type: Date, default: null },
  runCount: { type: Number, default: 0 }
});

module.exports = mongoose.model('Macro', MacroSchema);
