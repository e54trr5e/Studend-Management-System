const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
  {
    rollNo: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    email: {
      type: String,
      required: true,
      trim: true
    },
    phone: {
      type: String,
      trim: true
    },
    department: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    year: {
      type: Number,
      required: true,
      min: 1,
      max: 4
    },
    gpa: {
      type: Number,
      required: true,
      min: 0,
      max: 10
    },
    attendance: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    dob: {
      type: Date
    },
    address: {
      type: String,
      trim: true
    },
 
    photoUrl: {
      type: String,
      trim: true
    },
    docUrl: {
      type: String,
      trim: true
    }
  },
  { timestamps: true }
);

studentSchema.index({ department: 1, gpa: -1 });

module.exports = mongoose.model("Student", studentSchema);