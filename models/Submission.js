// models/Submission.js
const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  submissionId: String,
  userId: String,
  userEmail: String,
  receivedAt: Date,
  originalData: mongoose.Schema.Types.Mixed,
  receivedFiles: [{
    originalName: String,
    savedPath: String,
    size: Number,
    mimetype: String
  }],
  report: {
    generated: Boolean,
    path: String,
    qualificationData: {
      qualifyingQuarters: [String],
      quarterAnalysis: [{
        quarter: String,
        revenues: {
          revenue2019: Number,
          revenue2021: Number
        },
        change: Number,
        percentDecrease: Number,
        qualifies: Boolean
      }]
    }
  },
  status: String,
  businessName: String,
  ein: String,
  location: String,
  timePeriods: [String],
  businessWebsite: String,
  naicsCode: String,
  processedQuarters: [String],
  submissionData: mongoose.Schema.Types.Mixed,
  pppData: {
    businessName: String,
    sourceLink: String,
    scrapedAt: Date,
    firstDraw: {
      amount: Number,
      date: Date,
      forgiveness: Number,
      coveredPeriodStart: Date,
      coveredPeriodEnd: Date
    },
    secondDraw: {
      amount: Number,
      date: Date,
      forgiveness: Number,
      coveredPeriodStart: Date,
      coveredPeriodEnd: Date
    },
    lender: String,
    notes: String
  }
}, { strict: false });

const Submission = mongoose.model('Submission', submissionSchema);

module.exports = Submission;