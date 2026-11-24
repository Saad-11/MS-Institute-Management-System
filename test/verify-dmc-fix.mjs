import Database from 'better-sqlite3';
import * as path from 'path';

const dbPath = path.join(process.env.APPDATA, 'school-management-system', 'school_data.sqlite');
const db = new Database(dbPath, { readonly: true });

console.log('--- Step 1: Test Fixed Query for Student 4 (Amjid Ali) ---');
const examId = 2; // Mid Term Examination
const classId = 2; // Class 2

const fixedStudentSql = `
  SELECT s.id, s.student_id, s.admission_number, s.display_name, s.gender, s.father_name,
         c.name as class_name, sec.name as section_name, e.id as enrollment_id, e.class_id, e.roll_number, e.status as enrollment_status
  FROM students s
  JOIN student_enrollments e ON e.student_id = s.id AND e.academic_session_id = 2
  JOIN classes c ON c.id = e.class_id
  LEFT JOIN sections sec ON sec.id = e.section_id
  WHERE s.id = 4 AND e.class_id = ?
  ORDER BY CASE WHEN e.status = 'Active' THEN 0 ELSE 1 END, e.id DESC
  LIMIT 1
`;
const student4Row = db.prepare(fixedStudentSql).get(classId);
console.log('Fixed query student 4 row:', student4Row);

// Check marks for Student 4 in Class 2 subjects
const marks = db.prepare(`
  SELECT es.id as exam_sub_id, s.name as subject_name, em.obtained_marks, es.max_marks, es.passing_marks
  FROM examination_subjects es
  JOIN subjects s ON s.id = es.subject_id
  LEFT JOIN exam_marks em ON em.examination_subject_id = es.id AND em.student_id = 4
  WHERE es.examination_id = ? AND es.class_id = ?
`).all(examId, classId);

console.log('Marks for Student 4 in Class 2:', marks);

let totalObt = 0;
let totalMax = 0;
for (const m of marks) {
  totalObt += m.obtained_marks || 0;
  totalMax += m.max_marks;
}
console.log(`Total: ${totalObt} / ${totalMax} (${(totalObt / totalMax * 100).toFixed(1)}%)`);
