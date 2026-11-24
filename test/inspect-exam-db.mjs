import Database from 'better-sqlite3';
import * as path from 'path';

const appData = process.env.APPDATA;
const dbPath = path.join(appData, 'school-management-system', 'school_data.sqlite');
const db = new Database(dbPath, { readonly: true });

console.log('--- Examinations ---');
console.log(db.prepare('SELECT id, name, academic_session_id, exam_type_id, status FROM examinations').all());

console.log('\n--- Classes & Sections ---');
console.log(db.prepare('SELECT * FROM classes').all());
console.log(db.prepare('SELECT * FROM sections').all());

console.log('\n--- Enrollments for Class 2 ---');
console.log(db.prepare('SELECT * FROM student_enrollments WHERE class_id = 2').all());

console.log('\n--- Examination Subjects ---');
console.log(db.prepare('SELECT * FROM examination_subjects').all());

console.log('\n--- Exam Marks ---');
console.log(db.prepare('SELECT * FROM exam_marks').all());

console.log('\n--- Testing generateClassDMC with dist-electron/database/services/exam.service.js ---');
const { generateClassDMC, generateStudentDMC, getClassExamResults, calculateStudentExamResult } = await import('../dist-electron/database/services/exam.service.js');

const exams = db.prepare('SELECT id, name FROM examinations').all();
for (const ex of exams) {
  console.log(`\nTesting for Exam ID: ${ex.id} (${ex.name}), Class 2:`);
  try {
    const classResults = getClassExamResults({ examinationId: ex.id, classId: 2 }, db);
    console.log('getClassExamResults success:', classResults.success, 'totalStudents:', classResults.results?.totalStudents, 'studentResults count:', classResults.results?.studentResults?.length);
    if (!classResults.success) {
      console.log('getClassExamResults error:', classResults.error);
    } else {
      for (const sr of classResults.results.studentResults) {
        console.log(`  Student ${sr.studentId} (${sr.studentName}): total=${sr.totalObtainedMarks}/${sr.totalMaxMarks}, pct=${sr.percentage}%, grade=${sr.grade}, status=${sr.resultStatus}`);
        const singleDMC = generateStudentDMC(ex.id, sr.studentId, db);
        console.log(`    generateStudentDMC: success=${singleDMC.success}, error=${singleDMC.error}`);
        if (!singleDMC.success) {
          console.log(`    FAILURE DETAILS:`, singleDMC);
        }
      }
    }

    const classDmcRes = generateClassDMC({ examinationId: ex.id, classId: 2 }, db);
    console.log('generateClassDMC result:', {
      success: classDmcRes.success,
      dmcsCount: classDmcRes.dmcs?.length,
      error: classDmcRes.error,
    });
    if (classDmcRes.dmcs && classDmcRes.dmcs.length > 0) {
      console.log('First DMC sample:', JSON.stringify(classDmcRes.dmcs[0], null, 2));
    }
  } catch (err) {
    console.error('Error during test:', err);
  }
}
