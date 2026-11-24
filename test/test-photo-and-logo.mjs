import Database from 'better-sqlite3';
import * as path from 'path';

const dbPath = path.join(process.env.APPDATA, 'school-management-system', 'school_data.sqlite');
const db = new Database(dbPath, { readonly: true });
const { getStudentPhotoDataUrl } = await import('../dist-electron/database/services/student.service.js');
const { getSchoolLogoDataUrl } = await import('../dist-electron/database/services/school.service.js');

const students = db.prepare('SELECT id, student_id, display_name, photo_path FROM students').all();
console.log('Students in DB:');
for (const s of students) {
  const pUrl = getStudentPhotoDataUrl(s.photo_path);
  console.log(`Student ${s.id} (${s.display_name}): photo_path=${s.photo_path}, hasDataUrl=${Boolean(pUrl)}, length=${pUrl?.length}`);
}

const logoUrl = getSchoolLogoDataUrl(db);
console.log('School logo hasDataUrl:', Boolean(logoUrl), 'length:', logoUrl?.length);
