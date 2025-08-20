import mongoose from 'mongoose'

const privacyConsentSchema = new mongoose.Schema({
  // User association
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false, // Support anonymous users
  },
  sessionId: {
    type: String,
    required: true,
    index: true,
  },

  // Consent settings
  necessary: {
    type: Boolean,
    default: true,
    required: true,
  },
  functional: {
    type: Boolean,
    default: false,
    required: true,
  },
  analytics: {
    type: Boolean,
    default: false,
    required: true,
  },

  // Compliance information
  consentVersion: {
    type: String,
    required: true,
    default: '1.0',
  },
  consentSource: {
    type: String,
    enum: ['initial', 'settings', 'reconsent', 'sync'],
    required: true,
  },
  ipAddress: {
    type: String,
    required: true,
  },
  userAgent: {
    type: String,
    required: true,
  },

  // Status management
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  revokedAt: {
    type: Date,
    default: null,
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
})

// Compound indexes
privacyConsentSchema.index({ userId: 1, isActive: 1 })
privacyConsentSchema.index({ sessionId: 1, isActive: 1 })
privacyConsentSchema.index({ createdAt: -1 })

// Update timestamp middleware
privacyConsentSchema.pre('save', function (next) {
  this.updatedAt = new Date()
  next()
})

// Virtual properties
privacyConsentSchema.virtual('isExpired').get(function () {
  if (!this.createdAt) return false
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  return this.createdAt < oneYearAgo
})

// Instance methods
privacyConsentSchema.methods.toJSON = function () {
  const obj = this.toObject()
  delete obj.__v
  return obj
}

// Static methods
privacyConsentSchema.statics.findActiveByUserId = function (userId) {
  return this.findOne({ userId, isActive: true }).sort({ createdAt: -1 })
}

privacyConsentSchema.statics.findActiveBySessionId = function (sessionId) {
  return this.findOne({ sessionId, isActive: true }).sort({ createdAt: -1 })
}

export default mongoose.model('PrivacyConsent', privacyConsentSchema)
