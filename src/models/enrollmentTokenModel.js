import mongoose from 'mongoose';
import crypto from 'crypto';

const enrollmentTokenSchema = new mongoose.Schema({
  token: {
    type: String,
    unique: true,
    required: true
  },
  university_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'University',
    required: true
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  used_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  expires_at: {
    type: Date,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
  },
  is_active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

enrollmentTokenSchema.pre('validate', function(next) {
  if (!this.token) {
    this.token = crypto.randomBytes(4).toString('hex').toUpperCase(); // 8 character alphanumeric
  }
  next();
});

const EnrollmentToken = mongoose.model('EnrollmentToken', enrollmentTokenSchema);

export default EnrollmentToken;
