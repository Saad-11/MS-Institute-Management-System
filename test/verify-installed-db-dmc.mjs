import path from 'path';
import * as fs from 'fs';
import Database from 'better-sqlite3';
import {
  getClassExamResults,
  generateClassDMC,
  generateStudentDMC,
} from '../dist-electron/database/services/exam.service.js';
import { getSchoolLogoDataUrl } from '../dist-electron/database/services/school.service.js';
import { getStudentPhotoDataUrl } from '../dist-electron/database/services/student.service.js';

const appData = process.env.APPDATA || '';
const newDbPath = path.join(appData, 'MS Institute Management System', 'school_data.sqlite');
const legacyDbPath = path.join(appData, 'school-management-system', 'school_data.sqlite');
const dbPath = fs.existsSync(newDbPath) ? newDbPath : legacyDbPath;

console.log('Testing DMC Generation on Real AppData DB:', dbPath);
const db = new Database(dbPath, { readonly: true });

// 1. Check Class Exam Results for Exam 2, Class 2
console.log('\n--- 1. Testing getClassExamResults(Exam 2, Class 2) ---');
const classRes = getClassExamResults({ examinationId: 2, classId: 2 }, db);
console.log('Success:', classRes.success);
console.log('Summary Metrics:');
console.log(' - Total Students:', classRes.results.totalStudents);
console.log(' - Appeared:', classRes.results.appearedStudents, `(${classRes.results.appearancePercentage}%)`);
console.log(' - Passed:', classRes.results.passedStudents, `(${classRes.results.passPercentage}%)`);
console.log(' - Failed:', classRes.results.failedStudents);

console.log('\nStudent Results:');
classRes.results.studentResults.forEach((s) => {
  console.log(
    ` - Pos ${s.position}: [ID: ${s.studentId}] ${s.studentName} | Class: ${s.className} (${s.sectionName || 'No Sec'}) | Marks: ${s.totalObtainedMarks}/${s.totalMaxMarks} (${s.percentage}%) | Grade: ${s.overallGrade} | Result: ${s.isPassed ? 'Passed' : 'Failed'}`
  );
});

if (classRes.results.totalStudents !== 3 || classRes.results.passedStudents !== 3) {
  console.error('FAILED: Expected 3 students all passed!');
  process.exit(1);
}

// 2. Check generateClassDMC
console.log('\n--- 2. Testing generateClassDMC(Exam 2, Class 2) ---');
const classDmcRes = generateClassDMC({ examinationId: 2, classId: 2 }, db);
console.log('Success:', classDmcRes.success);
console.log('DMCs Generated:', classDmcRes.dmcs?.length);

if (!classDmcRes.dmcs || classDmcRes.dmcs.length !== 3) {
  console.error('FAILED: Expected 3 DMCs generated!');
  process.exit(1);
}

classDmcRes.dmcs.forEach((d, i) => {
  console.log(`\nDMC #${i + 1}:`);
  console.log('  Student:', d.student.displayName, `(ID: ${d.student.systemStudentId})`);
  console.log('  Class:', d.student.className, '| Section:', d.student.sectionName);
  console.log('  Exam:', d.examination.name, '| Session:', d.examination.academicSessionName);
  console.log('  Marks:', d.summary.totalObtainedMarks, '/', d.summary.totalMaxMarks, `(${d.summary.percentage}%)`);
  console.log('  Grade:', d.summary.grade, '| Result:', d.summary.result);
  console.log('  Position:', d.summary.position, 'out of', d.summary.totalStudents);
  console.log('  Subjects:', d.subjects.map((sub) => `${sub.subjectName} (${sub.obtainedMarks}/${sub.maxMarks})`).join(', '));
  console.log('  School Logo Data URL Present:', Boolean(d.school.logoDataUrl));
});

// 3. Check Single Student DMC for Student 4 (Amjid Ali - promoted to Class 2)
console.log('\n--- 3. Testing generateStudentDMC(Exam 2, Student 4) ---');
const singleDmcRes = generateStudentDMC(2, 4, db, 2);
console.log('Success:', singleDmcRes.success);
const amjidDmc = singleDmcRes.dmc;
console.log('Amjid Ali Summary Object:', amjidDmc.summary);
console.log('Amjid Ali Class:', amjidDmc.student.className);
console.log('Amjid Ali Marks:', amjidDmc.summary.totalObtainedMarks, '/', amjidDmc.summary.totalMaxMarks);
console.log('Amjid Ali Grade:', amjidDmc.summary.grade);
console.log('Amjid Ali Result:', amjidDmc.summary.result);

if (amjidDmc.student.className !== 'Class 2' || amjidDmc.summary.totalObtainedMarks !== 151 || amjidDmc.summary.result !== 'Pass') {
  console.error('FAILED: Amjid Ali DMC incorrect!');
  process.exit(1);
}

// 4. Test School Logo and Student Photo Resolvers
console.log('\n--- 4. Testing Logo & Photo Resolvers ---');
const logoUrl = getSchoolLogoDataUrl(db);
console.log('Logo Data URL resolved:', logoUrl ? `${logoUrl.slice(0, 35)}... (Length: ${logoUrl.length})` : 'None');

const studentPhotoUrl = getStudentPhotoDataUrl('student_4.jpg');
console.log('Student 4 photo lookup:', studentPhotoUrl ? 'Found' : 'None / Fallback handled safely');

console.log('\n========================================');
console.log('ALL REAL DATABASE DMC CHECKS PASSED 100%');
console.log('========================================');
