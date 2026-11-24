import Database from 'better-sqlite3';
import * as path from 'path';

const dbPath = path.join(process.env.APPDATA, 'school-management-system', 'school_data.sqlite');
const db = new Database(dbPath, { readonly: true });
const { calculateStudentExamResult } = await import('../dist-electron/database/services/exam.service.js');

console.log('Testing calculateStudentExamResult for Student 4 (Amjid Ali) in Exam 2 (Mid Term):');
const res = calculateStudentExamResult(2, 4, db);
console.log('Result for Student 4:');
console.log('Class Name:', res.result?.className);
console.log('Total Marks:', res.result?.totalObtainedMarks, '/', res.result?.totalMaxMarks);
console.log('Percentage:', res.result?.percentage);
console.log('Grade:', res.result?.grade);
console.log('isPassed:', res.result?.isPassed);
console.log('Subjects:', res.result?.subjects);
