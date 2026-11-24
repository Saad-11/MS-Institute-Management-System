import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

const dbPath = './app-data/school_data.sqlite';
if (!fs.existsSync(dbPath)) {
  console.log('DB path does not exist:', dbPath);
  process.exit(0);
}

const db = new Database(dbPath);
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
console.log('Tables found:', tables);

if (tables.includes('classes')) {
  console.log('Classes:', db.prepare('SELECT id, name FROM classes').all());
}
if (tables.includes('subjects')) {
  console.log('Subjects:', db.prepare('SELECT id, name, code FROM subjects').all());
}
if (tables.includes('class_subjects')) {
  console.log('Class Subjects count:', db.prepare('SELECT count(*) as c FROM class_subjects').get());
  console.log('Class Subjects:', db.prepare(`
    SELECT cs.id, cs.class_id, c.name as class_name, cs.subject_id, s.name as subject_name
    FROM class_subjects cs
    JOIN classes c ON c.id = cs.class_id
    JOIN subjects s ON s.id = cs.subject_id
  `).all());
}
if (tables.includes('examinations')) {
  console.log('Examinations:', db.prepare('SELECT id, name, academic_session_id, status FROM examinations').all());
}
if (tables.includes('examination_subjects')) {
  console.log('Exam Subjects count:', db.prepare('SELECT count(*) as c FROM examination_subjects').get());
  console.log('Exam Subjects:', db.prepare(`
    SELECT es.id, es.examination_id, es.class_id, es.subject_id, s.name as subject_name
    FROM examination_subjects es
    JOIN subjects s ON s.id = es.subject_id
  `).all());
}

db.close();
