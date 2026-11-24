import Database from 'better-sqlite3';
import * as path from 'path';

const dbPath = path.join(process.env.APPDATA, 'school-management-system', 'school_data.sqlite');
const db = new Database(dbPath, { readonly: true });
const examId = 2;

console.log('\nTesting FIXED student demographic query:');
for (let sId = 1; sId <= 4; sId++) {
  const rows = db.prepare(`
    SELECT s.id, s.student_id, s.admission_number, s.display_name, s.father_name, s.date_of_birth,
           s.photo_path, c.id as class_id, sec.id as section_id, e.roll_number, e.status as enrollment_status
    FROM students s
    JOIN student_enrollments e ON e.student_id = s.id AND e.status = 'Active'
    JOIN examinations ex ON ex.id = ? AND ex.academic_session_id = e.academic_session_id
    JOIN classes c ON c.id = e.class_id
    LEFT JOIN sections sec ON sec.id = e.section_id
    WHERE s.id = ?
    ORDER BY e.id DESC
    LIMIT 1
  `).all(examId, sId);
  console.log(`Student ${sId}:`, rows);
}
for (let sId = 1; sId <= 4; sId++) {
  const rows = db.prepare(`
    SELECT s.id, s.student_id, s.admission_number, s.display_name, s.father_name, s.date_of_birth,
           s.photo_path, c.id as class_id, sec.id as section_id, e.roll_number
    FROM students s
    JOIN student_enrollments e ON e.student_id = s.id
    JOIN examinations ex ON ex.id = ? AND ex.academic_session_id = e.academic_session_id
    JOIN classes c ON c.id = e.class_id
    JOIN sections sec ON sec.id = e.section_id
    WHERE s.id = ?
  `).all(examId, sId);
  console.log(`Student ${sId}:`, rows);
}
