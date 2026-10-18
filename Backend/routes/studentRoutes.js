require('dotenv').config(); 

const express = require("express");
const router = express.Router();

const Student = require("../models/student"); 
const ExcelJS = require("exceljs");
const { PDFDocument, StandardFonts } = require("pdf-lib");

router.get("/export/pdf", async (req, res) => {
  try {
    const students = await Student.find({});

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]);

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    let y = 800;

    page.drawText("EduMetrics Student Registry Ledger", {
      x: 50,
      y,
      size: 18,
      font
    });

    y -= 40;

    students.forEach((s) => {
      page.drawText(
        `Roll: ${s.rollNo} | Name: ${s.name} | Dept: ${s.department} | GPA: ${s.gpa} | Attendance: ${s.attendance}%`,
        {
          x: 50,
          y,
          size: 10,
          font
        }
      );

      y -= 20;

      if (y < 50) {
        y = 800;
      }
    });

    const pdfBytes = await pdfDoc.save();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=Students_Roster.pdf"
    );

    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

// If there no entry in database. Then
// async function seedDataIfEmpty() {
//   try {
//     const count = await Student.countDocuments();
//     if (count === 0) {
//       console.log("No student records detected. Seeding 5 Indian example profiles...");
//       const indianExamples = [
//         { rollNo: "CS2401", name: "Aarav Sharma", email: "aarav.sharma@university.edu", department: "CS", year: 3, gpa: 9.25, attendance: 94.2, phone: "9876543210", dob: new Date("2004-05-14"), address: "New Delhi, India", photoUrl: "", docUrl: "" },
//         { rollNo: "EC2408", name: "Ananya Iyer", email: "ananya.iyer@university.edu", department: "EC", year: 2, gpa: 8.10, attendance: 88.5, phone: "8123456789", dob: new Date("2005-08-21"), address: "Chennai, Tamil Nadu", photoUrl: "", docUrl: "" },
//         { rollNo: "IT2411", name: "Kabir Malhotra", email: "kabir.m@university.edu", department: "IT", year: 1, gpa: 7.45, attendance: 76.0, phone: "9112345678", dob: new Date("2006-01-10"), address: "Mumbai, Maharashtra", photoUrl: "", docUrl: "" },
//         { rollNo: "CS2419", name: "Diya Nair", email: "diya.nair@university.edu", department: "CS", year: 4, gpa: 9.80, attendance: 98.1, phone: "7012345678", dob: new Date("2003-11-30"), address: "Bengaluru, Karnataka", photoUrl: "", docUrl: "" },
//         { rollNo: "ME2403", name: "Rohan Das", email: "rohan.das@university.edu", department: "ME", year: 2, gpa: 6.90, attendance: 82.3, phone: "6012345678", dob: new Date("2005-04-05"), address: "Kolkata, West Bengal", photoUrl: "", docUrl: "" }
//       ];  
      
     
//       await Student.insertMany(indianExamples);
//       console.log("Database seeded successfully with starter profiles!");
//     }
//   } catch (err) {
//     console.error("Data seeding failure encounter:", err.message);
//   }
// }

// RESTORED MAIN ROUTES
router.get("/", async (req, res) => {
  try {
  //  await seedDataIfEmpty();

    const { search, department, year, minGPA, sortBy } = req.query;
    let queryFilter = {};

    if (search) {
      queryFilter.$or = [
        { name: { $regex: search, $options: "i" } },
        { rollNo: { $regex: search, $options: "i" } },
        { department: { $regex: search, $options: "i" } }
      ];
    }

    if (department) queryFilter.department = department;
    if (year) queryFilter.year = parseInt(year);
    if (minGPA) queryFilter.gpa = { $gte: parseFloat(minGPA) };

let sortingRules = {};
if (sortBy) {
    if (sortBy === "nameAsc") sortingRules.name = 1;         
    else if (sortBy === "nameDesc") sortingRules.name = -1;  
    else if (sortBy === "gpaHigh") sortingRules.gpa = -1;   
    else if (sortBy === "gpaLow") sortingRules.gpa = 1;     
    else if (sortBy === "attendanceHigh") sortingRules.attendance = -1; 
    else if (sortBy === "rollNo") sortingRules.rollNo = 1;   
} else {
    sortingRules.createdAt = -1;
}

    const studentsResultList = await Student.find(queryFilter).sort(sortingRules);
    const allStudentsRawData = await Student.find({}).sort({ createdAt: -1 });

    const statisticalAggregations = await Student.aggregate([
      {
        $group: {
          _id: null,
          totalCount: { $sum: 1 },
          avgGpa: { $avg: "$gpa" },
          avgAttendance: { $avg: "$attendance" }
        }
      }
    ]);

    const departmentDistributionBreakdown = await Student.aggregate([
      { $group: { _id: "$department", count: { $sum: 1 } } }
    ]);

    res.json({
      studentsList: studentsResultList,
      allStudentsRaw: allStudentsRawData,
      stats: statisticalAggregations[0] || { totalCount: 0, avgGpa: 0, avgAttendance: 0 },
      deptDistribution: departmentDistributionBreakdown
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: "Student parameter record mismatch." });
    res.json(student);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.post("/", async (req, res) => {
  try {
    console.log("Attempting to save student:", req.body.rollNo);
   const newStudent = new Student(req.body);
    await newStudent.save();
    console.log("Student saved successfully!");
    res.status(201).json(newStudent);
  } catch (err) {
    console.error("SAVING FAILED. Detailed error:", err.message);
    res.status(400).json({ message: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const updated = await Student.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (e) { res.status(400).json({ message: e.message }); }
});

router.delete("/:id", async (req, res) => {
  try {
    await Student.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.get("/export/excel", async (req, res) => {
  try {
    const students = await Student.find({});
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Students Ledger");
    worksheet.columns = [
      { header: "Roll No", key: "rollNo", width: 15 },
      { header: "Name", key: "name", width: 25 },
      { header: "Email", key: "email", width: 30 },
      { header: "Dept", key: "department", width: 15 },
      { header: "GPA", key: "gpa", width: 10 },
      { header: "Attendance %", key: "attendance", width: 15 }
    ];
    students.forEach(s => worksheet.addRow(s));
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=Students_Roster.xlsx");
    await workbook.xlsx.write(res);
    res.end();
  } catch (e) { res.status(500).send(e.message); }
});

router.get("/export/pdf", async (req, res) => {
  try {
    const students = await Student.find({});

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]);

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    let y = 800;

    page.drawText("EduMetrics Student Registry Ledger", {
      x: 50,
      y,
      size: 18,
      font
    });

    y -= 40;

    students.forEach((s) => {
      page.drawText(
        `Roll: ${s.rollNo} | Name: ${s.name} | Dept: ${s.department} | GPA: ${s.gpa} | Attendance: ${s.attendance}%`,
        {
          x: 50,
          y,
          size: 10,
          font
        }
      );

      y -= 20;

      if (y < 50) {
        y = 800;
      }
    });

    const pdfBytes = await pdfDoc.save();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=Students_Roster.pdf"
    );

    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

module.exports = router;