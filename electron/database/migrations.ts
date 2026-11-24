/**
 * Versioned Database Migration System
 * 
 * Manages incremental database schema updates safely using transactions.
 * Tracks applied migrations in the `schema_migrations` table so each migration
 * runs exactly once without destroying customer data.
 */

import Database from 'better-sqlite3';

interface Migration {
  version: number;
  name: string;
  up: (db: Database.Database) => void;
}

const migrations: Migration[] = [
  {
    version: 1,
    name: '001_initial_schema',
    up: (db: Database.Database) => {
      // ─── 1. Application Users ───────────────────────────────────────────────
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE COLLATE NOCASE,
          password_hash TEXT NOT NULL,
          display_name TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('admin')),
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          last_login_at TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
        CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      `);

      // ─── 2. School Settings ────────────────────────────────────────────────
      db.exec(`
        CREATE TABLE IF NOT EXISTS school_settings (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          school_name TEXT NOT NULL DEFAULT 'My School',
          address TEXT NOT NULL DEFAULT '',
          phone TEXT NOT NULL DEFAULT '',
          principal_name TEXT NOT NULL DEFAULT '',
          logo_path TEXT,
          signature_path TEXT,
          academic_session TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);

      // Insert default school settings row if not present
      const insertDefaultSettings = db.prepare(`
        INSERT OR IGNORE INTO school_settings (id, school_name, address, phone, principal_name, academic_session)
        VALUES (1, 'My School', '', '', '', '')
      `);
      insertDefaultSettings.run();

      // ─── 3. Application Metadata ───────────────────────────────────────────
      db.exec(`
        CREATE TABLE IF NOT EXISTS app_metadata (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);

      const insertMetadata = db.prepare(`
        INSERT OR IGNORE INTO app_metadata (key, value)
        VALUES ('schema_version', '1'), ('app_version', '1.0.0-phase2')
      `);
      insertMetadata.run();
    },
  },
  {
    version: 2,
    name: '002_school_settings_and_academic_structure',
    up: (db: Database.Database) => {
      // ─── 1. Extend School Settings Table ──────────────────────────────────
      // Check existing columns to add new fields cleanly without breaking Phase 2
      const columns = db.prepare("PRAGMA table_info(school_settings)").all() as { name: string }[];
      const colNames = new Set(columns.map((c) => c.name));

      if (!colNames.has('school_code')) {
        db.exec("ALTER TABLE school_settings ADD COLUMN school_code TEXT NOT NULL DEFAULT ''");
      }
      if (!colNames.has('school_type')) {
        db.exec("ALTER TABLE school_settings ADD COLUMN school_type TEXT NOT NULL DEFAULT 'School'");
      }
      if (!colNames.has('email')) {
        db.exec("ALTER TABLE school_settings ADD COLUMN email TEXT NOT NULL DEFAULT ''");
      }
      if (!colNames.has('city')) {
        db.exec("ALTER TABLE school_settings ADD COLUMN city TEXT NOT NULL DEFAULT ''");
      }
      if (!colNames.has('province')) {
        db.exec("ALTER TABLE school_settings ADD COLUMN province TEXT NOT NULL DEFAULT ''");
      }
      if (!colNames.has('country')) {
        db.exec("ALTER TABLE school_settings ADD COLUMN country TEXT NOT NULL DEFAULT 'Pakistan'");
      }

      // ─── 2. Academic Sessions Table ───────────────────────────────────────
      db.exec(`
        CREATE TABLE IF NOT EXISTS academic_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE COLLATE NOCASE,
          start_date TEXT NOT NULL,
          end_date TEXT NOT NULL,
          is_active INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_sessions_name ON academic_sessions(name);
        CREATE INDEX IF NOT EXISTS idx_sessions_active ON academic_sessions(is_active);
      `);

      // ─── 3. Classes Table ─────────────────────────────────────────────────
      db.exec(`
        CREATE TABLE IF NOT EXISTS classes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE COLLATE NOCASE,
          code TEXT NOT NULL DEFAULT '',
          display_order INTEGER NOT NULL DEFAULT 0,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_classes_name ON classes(name);
        CREATE INDEX IF NOT EXISTS idx_classes_order ON classes(display_order);
        CREATE INDEX IF NOT EXISTS idx_classes_active ON classes(is_active);
      `);

      // ─── 4. Sections Table ────────────────────────────────────────────────
      db.exec(`
        CREATE TABLE IF NOT EXISTS sections (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
          name TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE (class_id, name COLLATE NOCASE)
        );

        CREATE INDEX IF NOT EXISTS idx_sections_class ON sections(class_id);
        CREATE INDEX IF NOT EXISTS idx_sections_active ON sections(is_active);
      `);

      // ─── 5. Subjects Table ────────────────────────────────────────────────
      db.exec(`
        CREATE TABLE IF NOT EXISTS subjects (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE COLLATE NOCASE,
          code TEXT NOT NULL DEFAULT '',
          description TEXT NOT NULL DEFAULT '',
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_subjects_name ON subjects(name);
        CREATE INDEX IF NOT EXISTS idx_subjects_active ON subjects(is_active);
      `);

      // ─── 6. Class-Subject Assignments Table (Junction) ─────────────────────
      db.exec(`
        CREATE TABLE IF NOT EXISTS class_subjects (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
          subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
          display_order INTEGER NOT NULL DEFAULT 0,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE (class_id, subject_id)
        );

        CREATE INDEX IF NOT EXISTS idx_class_subjects_class ON class_subjects(class_id);
        CREATE INDEX IF NOT EXISTS idx_class_subjects_subject ON class_subjects(subject_id);
      `);

      // ─── 7. Update Metadata ───────────────────────────────────────────────
      db.prepare(`
        INSERT OR REPLACE INTO app_metadata (key, value, updated_at)
        VALUES ('schema_version', '2', datetime('now')),
               ('app_version', '1.0.0-phase3', datetime('now'))
      `).run();
    },
  },
  {
    version: 3,
    name: '003_students_and_teachers',
    up: (db: Database.Database) => {
      // ─── 1. Students Table ──────────────────────────────────────────────────
      db.exec(`
        CREATE TABLE IF NOT EXISTS students (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          student_id TEXT NOT NULL UNIQUE COLLATE NOCASE,
          admission_number TEXT UNIQUE COLLATE NOCASE,
          first_name TEXT NOT NULL,
          middle_name TEXT NOT NULL DEFAULT '',
          last_name TEXT NOT NULL,
          display_name TEXT NOT NULL,
          gender TEXT NOT NULL CHECK (gender IN ('Male', 'Female', 'Other')),
          date_of_birth TEXT NOT NULL DEFAULT '',
          photo_path TEXT,
          blood_group TEXT NOT NULL DEFAULT '',
          nationality TEXT NOT NULL DEFAULT '',
          religion TEXT NOT NULL DEFAULT '',
          father_name TEXT NOT NULL DEFAULT '',
          mother_name TEXT NOT NULL DEFAULT '',
          guardian_name TEXT NOT NULL DEFAULT '',
          guardian_relationship TEXT NOT NULL DEFAULT '',
          phone TEXT NOT NULL DEFAULT '',
          alternative_phone TEXT NOT NULL DEFAULT '',
          current_address TEXT NOT NULL DEFAULT '',
          permanent_address TEXT NOT NULL DEFAULT '',
          city TEXT NOT NULL DEFAULT '',
          province TEXT NOT NULL DEFAULT '',
          is_active INTEGER NOT NULL DEFAULT 1,
          is_deleted INTEGER NOT NULL DEFAULT 0,
          deleted_at TEXT DEFAULT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_students_student_id ON students(student_id);
        CREATE INDEX IF NOT EXISTS idx_students_admission_number ON students(admission_number);
        CREATE INDEX IF NOT EXISTS idx_students_display_name ON students(display_name);
        CREATE INDEX IF NOT EXISTS idx_students_father_name ON students(father_name);
        CREATE INDEX IF NOT EXISTS idx_students_phone ON students(phone);
        CREATE INDEX IF NOT EXISTS idx_students_is_active ON students(is_active);
        CREATE INDEX IF NOT EXISTS idx_students_is_deleted ON students(is_deleted);
      `);

      // ─── 2. Student Enrollments Table ──────────────────────────────────────
      db.exec(`
        CREATE TABLE IF NOT EXISTS student_enrollments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
          academic_session_id INTEGER NOT NULL REFERENCES academic_sessions(id) ON DELETE RESTRICT,
          class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
          section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE RESTRICT,
          admission_date TEXT NOT NULL DEFAULT (date('now')),
          status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Transferred', 'Graduated', 'Left')),
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_enrollments_student ON student_enrollments(student_id);
        CREATE INDEX IF NOT EXISTS idx_enrollments_session ON student_enrollments(academic_session_id);
        CREATE INDEX IF NOT EXISTS idx_enrollments_class ON student_enrollments(class_id);
        CREATE INDEX IF NOT EXISTS idx_enrollments_section ON student_enrollments(section_id);
        CREATE INDEX IF NOT EXISTS idx_enrollments_status ON student_enrollments(status);
        
        -- Prevent duplicate active enrollment for the same student in the same academic session
        CREATE UNIQUE INDEX IF NOT EXISTS idx_enrollments_unique_active_session 
          ON student_enrollments(student_id, academic_session_id) 
          WHERE status = 'Active';
      `);

      // ─── 3. Teachers Table ─────────────────────────────────────────────────
      db.exec(`
        CREATE TABLE IF NOT EXISTS teachers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          teacher_id TEXT NOT NULL UNIQUE COLLATE NOCASE,
          employee_id TEXT UNIQUE COLLATE NOCASE,
          first_name TEXT NOT NULL,
          middle_name TEXT NOT NULL DEFAULT '',
          last_name TEXT NOT NULL,
          display_name TEXT NOT NULL,
          gender TEXT NOT NULL CHECK (gender IN ('Male', 'Female', 'Other')),
          date_of_birth TEXT NOT NULL DEFAULT '',
          photo_path TEXT,
          phone TEXT NOT NULL DEFAULT '',
          email TEXT NOT NULL DEFAULT '',
          address TEXT NOT NULL DEFAULT '',
          city TEXT NOT NULL DEFAULT '',
          province TEXT NOT NULL DEFAULT '',
          qualification TEXT NOT NULL DEFAULT '',
          specialization TEXT NOT NULL DEFAULT '',
          joining_date TEXT NOT NULL DEFAULT '',
          designation TEXT NOT NULL DEFAULT 'Teacher',
          employment_status TEXT NOT NULL DEFAULT 'Active' CHECK (employment_status IN ('Active', 'Inactive', 'On Leave', 'Resigned')),
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_teachers_teacher_id ON teachers(teacher_id);
        CREATE INDEX IF NOT EXISTS idx_teachers_employee_id ON teachers(employee_id);
        CREATE INDEX IF NOT EXISTS idx_teachers_display_name ON teachers(display_name);
        CREATE INDEX IF NOT EXISTS idx_teachers_phone ON teachers(phone);
        CREATE INDEX IF NOT EXISTS idx_teachers_employment_status ON teachers(employment_status);
        CREATE INDEX IF NOT EXISTS idx_teachers_is_active ON teachers(is_active);
      `);

      // ─── 4. Update Metadata ────────────────────────────────────────────────
      db.prepare(`
        INSERT OR REPLACE INTO app_metadata (key, value, updated_at)
        VALUES ('schema_version', '3', datetime('now')),
               ('app_version', '1.0.0-phase4', datetime('now'))
      `).run();
    },
  },
  {
    version: 4,
    name: '004_attendance',
    up: (db: Database.Database) => {
      // ─── 1. Attendance Table ────────────────────────────────────────────────
      db.exec(`
        CREATE TABLE IF NOT EXISTS attendance (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
          enrollment_id INTEGER NOT NULL REFERENCES student_enrollments(id) ON DELETE RESTRICT,
          academic_session_id INTEGER NOT NULL REFERENCES academic_sessions(id) ON DELETE RESTRICT,
          class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
          section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE RESTRICT,
          attendance_date TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('Present', 'Absent', 'Late', 'Leave')),
          remarks TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE (student_id, attendance_date)
        );

        CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON attendance(student_id);
        CREATE INDEX IF NOT EXISTS idx_attendance_enrollment_id ON attendance(enrollment_id);
        CREATE INDEX IF NOT EXISTS idx_attendance_session_id ON attendance(academic_session_id);
        CREATE INDEX IF NOT EXISTS idx_attendance_class_id ON attendance(class_id);
        CREATE INDEX IF NOT EXISTS idx_attendance_section_id ON attendance(section_id);
        CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(attendance_date);
        CREATE INDEX IF NOT EXISTS idx_attendance_lookup ON attendance(academic_session_id, class_id, section_id, attendance_date);
      `);

      // ─── 2. Update Metadata ────────────────────────────────────────────────
      db.prepare(`
        INSERT OR REPLACE INTO app_metadata (key, value, updated_at)
        VALUES ('schema_version', '4', datetime('now')),
               ('app_version', '1.0.0-phase5', datetime('now'))
      `).run();
    },
  },
  {
    version: 5,
    name: '005_fees_and_fee_slips',
    up: (db: Database.Database) => {
      // ─── 1. Fee Types Table ────────────────────────────────────────────────
      db.exec(`
        CREATE TABLE IF NOT EXISTS fee_types (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE COLLATE NOCASE,
          code TEXT NOT NULL UNIQUE COLLATE NOCASE,
          description TEXT NOT NULL DEFAULT '',
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_fee_types_code ON fee_types(code);
        CREATE INDEX IF NOT EXISTS idx_fee_types_is_active ON fee_types(is_active);
      `);

      // ─── 2. Fee Structures Table (Class-wise) ───────────────────────────────
      db.exec(`
        CREATE TABLE IF NOT EXISTS fee_structures (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          academic_session_id INTEGER NOT NULL REFERENCES academic_sessions(id) ON DELETE RESTRICT,
          class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
          fee_type_id INTEGER NOT NULL REFERENCES fee_types(id) ON DELETE RESTRICT,
          amount INTEGER NOT NULL CHECK (amount >= 0),
          frequency TEXT NOT NULL CHECK (frequency IN ('Monthly', 'Quarterly', 'Half-Yearly', 'Yearly', 'One-Time')),
          effective_from TEXT NOT NULL DEFAULT '',
          effective_to TEXT NOT NULL DEFAULT '',
          description TEXT NOT NULL DEFAULT '',
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE (academic_session_id, class_id, fee_type_id, frequency)
        );

        CREATE INDEX IF NOT EXISTS idx_fee_struct_session ON fee_structures(academic_session_id);
        CREATE INDEX IF NOT EXISTS idx_fee_struct_class ON fee_structures(class_id);
        CREATE INDEX IF NOT EXISTS idx_fee_struct_fee_type ON fee_structures(fee_type_id);
        CREATE INDEX IF NOT EXISTS idx_fee_struct_active ON fee_structures(is_active);
      `);

      // ─── 3. Fee Periods Table ──────────────────────────────────────────────
      db.exec(`
        CREATE TABLE IF NOT EXISTS fee_periods (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          academic_session_id INTEGER NOT NULL REFERENCES academic_sessions(id) ON DELETE RESTRICT,
          name TEXT NOT NULL COLLATE NOCASE,
          start_date TEXT NOT NULL,
          end_date TEXT NOT NULL,
          due_date TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Closed')),
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE (academic_session_id, name)
        );

        CREATE INDEX IF NOT EXISTS idx_fee_periods_session ON fee_periods(academic_session_id);
        CREATE INDEX IF NOT EXISTS idx_fee_periods_status ON fee_periods(status);
        CREATE INDEX IF NOT EXISTS idx_fee_periods_due_date ON fee_periods(due_date);
      `);

      // ─── 4. Student-Specific Fee Adjustments ────────────────────────────────
      db.exec(`
        CREATE TABLE IF NOT EXISTS student_fee_adjustments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
          enrollment_id INTEGER NOT NULL REFERENCES student_enrollments(id) ON DELETE RESTRICT,
          fee_type_id INTEGER NOT NULL REFERENCES fee_types(id) ON DELETE RESTRICT,
          amount INTEGER NOT NULL CHECK (amount >= 0),
          frequency TEXT NOT NULL DEFAULT 'Monthly' CHECK (frequency IN ('Monthly', 'Quarterly', 'Half-Yearly', 'Yearly', 'One-Time')),
          effective_from TEXT NOT NULL DEFAULT '',
          effective_to TEXT NOT NULL DEFAULT '',
          description TEXT NOT NULL DEFAULT '',
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_student_adj_student ON student_fee_adjustments(student_id);
        CREATE INDEX IF NOT EXISTS idx_student_adj_enrollment ON student_fee_adjustments(enrollment_id);
        CREATE INDEX IF NOT EXISTS idx_student_adj_fee_type ON student_fee_adjustments(fee_type_id);
      `);

      // ─── 5. Fee Records Table (Invoices / Billed Fees) ──────────────────────
      db.exec(`
        CREATE TABLE IF NOT EXISTS fee_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
          enrollment_id INTEGER NOT NULL REFERENCES student_enrollments(id) ON DELETE RESTRICT,
          academic_session_id INTEGER NOT NULL REFERENCES academic_sessions(id) ON DELETE RESTRICT,
          class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
          section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE RESTRICT,
          fee_period_id INTEGER NOT NULL REFERENCES fee_periods(id) ON DELETE RESTRICT,
          fee_type_id INTEGER NOT NULL REFERENCES fee_types(id) ON DELETE RESTRICT,
          original_amount INTEGER NOT NULL CHECK (original_amount >= 0),
          discount INTEGER NOT NULL DEFAULT 0 CHECK (discount >= 0),
          fine INTEGER NOT NULL DEFAULT 0 CHECK (fine >= 0),
          net_amount INTEGER NOT NULL CHECK (net_amount >= 0),
          paid_amount INTEGER NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
          remaining_balance INTEGER NOT NULL CHECK (remaining_balance >= 0),
          due_date TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'Unpaid' CHECK (status IN ('Unpaid', 'Partially Paid', 'Paid', 'Waived', 'Cancelled')),
          remarks TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE (student_id, fee_period_id, fee_type_id)
        );

        CREATE INDEX IF NOT EXISTS idx_fee_records_student ON fee_records(student_id);
        CREATE INDEX IF NOT EXISTS idx_fee_records_enrollment ON fee_records(enrollment_id);
        CREATE INDEX IF NOT EXISTS idx_fee_records_session ON fee_records(academic_session_id);
        CREATE INDEX IF NOT EXISTS idx_fee_records_class ON fee_records(class_id);
        CREATE INDEX IF NOT EXISTS idx_fee_records_section ON fee_records(section_id);
        CREATE INDEX IF NOT EXISTS idx_fee_records_period ON fee_records(fee_period_id);
        CREATE INDEX IF NOT EXISTS idx_fee_records_fee_type ON fee_records(fee_type_id);
        CREATE INDEX IF NOT EXISTS idx_fee_records_status ON fee_records(status);
        CREATE INDEX IF NOT EXISTS idx_fee_records_due_date ON fee_records(due_date);
      `);

      // ─── 6. Fee Payments Table ─────────────────────────────────────────────
      db.exec(`
        CREATE TABLE IF NOT EXISTS fee_payments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          receipt_number TEXT NOT NULL UNIQUE COLLATE NOCASE,
          student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
          enrollment_id INTEGER NOT NULL REFERENCES student_enrollments(id) ON DELETE RESTRICT,
          fee_record_id INTEGER NOT NULL REFERENCES fee_records(id) ON DELETE RESTRICT,
          payment_date TEXT NOT NULL,
          amount INTEGER NOT NULL CHECK (amount > 0),
          payment_method TEXT NOT NULL CHECK (payment_method IN ('Cash', 'Bank Transfer', 'Cheque', 'Other')),
          reference_notes TEXT NOT NULL DEFAULT '',
          received_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_fee_payments_receipt ON fee_payments(receipt_number);
        CREATE INDEX IF NOT EXISTS idx_fee_payments_student ON fee_payments(student_id);
        CREATE INDEX IF NOT EXISTS idx_fee_payments_record ON fee_payments(fee_record_id);
        CREATE INDEX IF NOT EXISTS idx_fee_payments_date ON fee_payments(payment_date);
        CREATE INDEX IF NOT EXISTS idx_fee_payments_method ON fee_payments(payment_method);
      `);

      // ─── 7. Update Metadata ────────────────────────────────────────────────
      db.prepare(`
        INSERT OR REPLACE INTO app_metadata (key, value, updated_at)
        VALUES ('schema_version', '5', datetime('now')),
               ('app_version', '1.0.0-phase6', datetime('now'))
      `).run();
    },
  },
  {
    version: 6,
    name: '006_examinations_marks_and_results',
    up: (db) => {
      // ─── 1. Exam Types Table ───────────────────────────────────────────────
      db.exec(`
        CREATE TABLE IF NOT EXISTS exam_types (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE COLLATE NOCASE,
          code TEXT NOT NULL UNIQUE COLLATE NOCASE,
          description TEXT NOT NULL DEFAULT '',
          is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_exam_types_name ON exam_types(name);
        CREATE INDEX IF NOT EXISTS idx_exam_types_active ON exam_types(is_active);
      `);

      // ─── 2. Examinations Table ─────────────────────────────────────────────
      db.exec(`
        CREATE TABLE IF NOT EXISTS examinations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          academic_session_id INTEGER NOT NULL REFERENCES academic_sessions(id) ON DELETE RESTRICT,
          exam_type_id INTEGER NOT NULL REFERENCES exam_types(id) ON DELETE RESTRICT,
          name TEXT NOT NULL COLLATE NOCASE,
          start_date TEXT NOT NULL,
          end_date TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Open', 'Closed')),
          description TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE (academic_session_id, name)
        );

        CREATE INDEX IF NOT EXISTS idx_examinations_session ON examinations(academic_session_id);
        CREATE INDEX IF NOT EXISTS idx_examinations_type ON examinations(exam_type_id);
        CREATE INDEX IF NOT EXISTS idx_examinations_status ON examinations(status);
        CREATE INDEX IF NOT EXISTS idx_examinations_dates ON examinations(start_date, end_date);
      `);

      // ─── 3. Examination Subjects Table ──────────────────────────────────────
      // Dynamic Subject System: linked to class and subject from class_subjects
      db.exec(`
        CREATE TABLE IF NOT EXISTS examination_subjects (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          examination_id INTEGER NOT NULL REFERENCES examinations(id) ON DELETE CASCADE,
          class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
          subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
          max_marks REAL NOT NULL CHECK (max_marks > 0),
          passing_marks REAL NOT NULL CHECK (passing_marks >= 0 AND passing_marks <= max_marks),
          display_order INTEGER NOT NULL DEFAULT 0,
          exam_date TEXT,
          start_time TEXT,
          duration_minutes INTEGER CHECK (duration_minutes IS NULL OR duration_minutes > 0),
          is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE (examination_id, class_id, subject_id)
        );

        CREATE INDEX IF NOT EXISTS idx_exam_subjects_exam ON examination_subjects(examination_id);
        CREATE INDEX IF NOT EXISTS idx_exam_subjects_class ON examination_subjects(class_id);
        CREATE INDEX IF NOT EXISTS idx_exam_subjects_subject ON examination_subjects(subject_id);
        CREATE INDEX IF NOT EXISTS idx_exam_subjects_order ON examination_subjects(display_order);
      `);

      // ─── 4. Grading Rules Table ────────────────────────────────────────────
      db.exec(`
        CREATE TABLE IF NOT EXISTS grading_rules (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL COLLATE NOCASE,
          min_percentage REAL NOT NULL CHECK (min_percentage >= 0 AND min_percentage <= 100),
          max_percentage REAL NOT NULL CHECK (max_percentage >= 0 AND max_percentage <= 100 AND max_percentage >= min_percentage),
          grade TEXT NOT NULL,
          grade_point REAL DEFAULT 0,
          remarks TEXT NOT NULL DEFAULT '',
          display_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_grading_rules_percentage ON grading_rules(min_percentage, max_percentage);
        CREATE INDEX IF NOT EXISTS idx_grading_rules_order ON grading_rules(display_order);
      `);

      // Seed standard default grading system
      const existingRulesCount = db.prepare('SELECT COUNT(*) as count FROM grading_rules').get() as { count: number };
      if (!existingRulesCount || existingRulesCount.count === 0) {
        const seedRules = [
          { name: 'A+ (Outstanding)', min: 90, max: 100, grade: 'A+', gp: 4.0, remarks: 'Outstanding', order: 1 },
          { name: 'A (Excellent)', min: 80, max: 89.99, grade: 'A', gp: 3.7, remarks: 'Excellent', order: 2 },
          { name: 'B (Very Good)', min: 70, max: 79.99, grade: 'B', gp: 3.0, remarks: 'Very Good', order: 3 },
          { name: 'C (Good)', min: 60, max: 69.99, grade: 'C', gp: 2.5, remarks: 'Good', order: 4 },
          { name: 'D (Satisfactory)', min: 50, max: 59.99, grade: 'D', gp: 2.0, remarks: 'Satisfactory', order: 5 },
          { name: 'E (Pass)', min: 40, max: 49.99, grade: 'E', gp: 1.0, remarks: 'Pass', order: 6 },
          { name: 'F (Fail)', min: 0, max: 39.99, grade: 'F', gp: 0.0, remarks: 'Fail', order: 7 },
        ];

        const insertRule = db.prepare(`
          INSERT INTO grading_rules (name, min_percentage, max_percentage, grade, grade_point, remarks, display_order)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        for (const r of seedRules) {
          insertRule.run(r.name, r.min, r.max, r.grade, r.gp, r.remarks, r.order);
        }
      }

      // ─── 5. Exam Marks Table ───────────────────────────────────────────────
      // Supports both 'Entered' (with numeric marks) and 'Absent' explicitly
      db.exec(`
        CREATE TABLE IF NOT EXISTS exam_marks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          examination_id INTEGER NOT NULL REFERENCES examinations(id) ON DELETE CASCADE,
          examination_subject_id INTEGER NOT NULL REFERENCES examination_subjects(id) ON DELETE CASCADE,
          student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
          enrollment_id INTEGER NOT NULL REFERENCES student_enrollments(id) ON DELETE RESTRICT,
          obtained_marks REAL CHECK (obtained_marks IS NULL OR obtained_marks >= 0),
          status TEXT NOT NULL DEFAULT 'Entered' CHECK (status IN ('Entered', 'Absent')),
          remarks TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE (examination_id, examination_subject_id, student_id)
        );

        CREATE INDEX IF NOT EXISTS idx_exam_marks_exam ON exam_marks(examination_id);
        CREATE INDEX IF NOT EXISTS idx_exam_marks_subject ON exam_marks(examination_subject_id);
        CREATE INDEX IF NOT EXISTS idx_exam_marks_student ON exam_marks(student_id);
        CREATE INDEX IF NOT EXISTS idx_exam_marks_enrollment ON exam_marks(enrollment_id);
        CREATE INDEX IF NOT EXISTS idx_exam_marks_status ON exam_marks(status);
      `);

      // ─── 6. Update Metadata ────────────────────────────────────────────────
      db.prepare(`
        INSERT OR REPLACE INTO app_metadata (key, value, updated_at)
        VALUES ('schema_version', '6', datetime('now')),
               ('app_version', '1.0.0-phase7', datetime('now'))
      `).run();
    },
  },
  {
    version: 7,
    name: '007_documents_reports_and_promotions',
    up: (db: Database.Database) => {
      // ─── 1. Extend Student Enrollments Table ───────────────────────────────
      const enrollmentCols = db.prepare("PRAGMA table_info(student_enrollments)").all() as { name: string }[];
      const colNames = new Set(enrollmentCols.map((c) => c.name));

      if (!colNames.has('roll_number')) {
        db.exec("ALTER TABLE student_enrollments ADD COLUMN roll_number TEXT NOT NULL DEFAULT ''");
      }
      if (!colNames.has('promotion_status')) {
        db.exec("ALTER TABLE student_enrollments ADD COLUMN promotion_status TEXT NOT NULL DEFAULT 'None'");
      }
      if (!colNames.has('promotion_date')) {
        db.exec("ALTER TABLE student_enrollments ADD COLUMN promotion_date TEXT");
      }
      if (!colNames.has('remarks')) {
        db.exec("ALTER TABLE student_enrollments ADD COLUMN remarks TEXT NOT NULL DEFAULT ''");
      }

      // ─── 2. Student Documents Table ────────────────────────────────────────
      db.exec(`
        CREATE TABLE IF NOT EXISTS student_documents (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          document_number TEXT NOT NULL UNIQUE COLLATE NOCASE,
          student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
          document_type TEXT NOT NULL CHECK (document_type IN ('Bonafide', 'Character', 'Leaving', 'General')),
          title TEXT NOT NULL,
          academic_session_id INTEGER NOT NULL REFERENCES academic_sessions(id) ON DELETE RESTRICT,
          issue_date TEXT NOT NULL DEFAULT (date('now')),
          generated_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          content_json TEXT NOT NULL DEFAULT '{}',
          remarks TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_student_docs_number ON student_documents(document_number);
        CREATE INDEX IF NOT EXISTS idx_student_docs_student ON student_documents(student_id);
        CREATE INDEX IF NOT EXISTS idx_student_docs_session ON student_documents(academic_session_id);
        CREATE INDEX IF NOT EXISTS idx_student_docs_type ON student_documents(document_type);
        CREATE INDEX IF NOT EXISTS idx_student_docs_issue_date ON student_documents(issue_date);
      `);

      // ─── 3. Promotion Logs Table ───────────────────────────────────────────
      db.exec(`
        CREATE TABLE IF NOT EXISTS promotion_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
          from_session_id INTEGER NOT NULL REFERENCES academic_sessions(id) ON DELETE RESTRICT,
          to_session_id INTEGER REFERENCES academic_sessions(id) ON DELETE RESTRICT,
          from_class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
          to_class_id INTEGER REFERENCES classes(id) ON DELETE RESTRICT,
          from_section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE RESTRICT,
          to_section_id INTEGER REFERENCES sections(id) ON DELETE RESTRICT,
          action TEXT NOT NULL CHECK (action IN ('Promote', 'Retain', 'Graduate', 'Transfer', 'Left')),
          promotion_date TEXT NOT NULL DEFAULT (date('now')),
          performed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          remarks TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_promo_logs_student ON promotion_logs(student_id);
        CREATE INDEX IF NOT EXISTS idx_promo_logs_from_session ON promotion_logs(from_session_id);
        CREATE INDEX IF NOT EXISTS idx_promo_logs_to_session ON promotion_logs(to_session_id);
        CREATE INDEX IF NOT EXISTS idx_promo_logs_action ON promotion_logs(action);
      `);

      // ─── 4. Update Metadata ────────────────────────────────────────────────
      db.prepare(`
        INSERT OR REPLACE INTO app_metadata (key, value, updated_at)
        VALUES ('schema_version', '7', datetime('now')),
               ('app_version', '1.0.0-phase8', datetime('now'))
      `).run();
    },
  },
  {
    version: 8,
    name: '008_backup_superadmin_licensing',
    up: (db: Database.Database) => {
      // ─── 1. Installation Identity ──────────────────────────────────────────
      db.exec(`
        CREATE TABLE IF NOT EXISTS installation_identity (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          installation_id TEXT UNIQUE NOT NULL,
          machine_fingerprint TEXT NOT NULL,
          first_installed_at TEXT NOT NULL DEFAULT (datetime('now')),
          last_validated_timestamp TEXT NOT NULL DEFAULT (datetime('now')),
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);

      // ─── 2. License State ──────────────────────────────────────────────────
      db.exec(`
        CREATE TABLE IF NOT EXISTS license_state (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          license_token TEXT,
          license_id TEXT,
          customer_name TEXT,
          product_name TEXT DEFAULT 'School Management System',
          edition TEXT DEFAULT 'Standard',
          license_type TEXT,
          installation_binding TEXT,
          issued_at TEXT,
          starts_at TEXT,
          expires_at TEXT,
          grace_period_days INTEGER DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'Unlicensed',
          last_verified_at TEXT NOT NULL DEFAULT (datetime('now')),
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);

      // Initialize default empty license state row
      db.prepare(`
        INSERT OR IGNORE INTO license_state (id, status, last_verified_at, created_at, updated_at)
        VALUES (1, 'Unlicensed', datetime('now'), datetime('now'), datetime('now'))
      `).run();

      // ─── 3. Super Admin Accounts ───────────────────────────────────────────
      db.exec(`
        CREATE TABLE IF NOT EXISTS super_admin_accounts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE COLLATE NOCASE,
          password_hash TEXT NOT NULL,
          display_name TEXT NOT NULL,
          is_active INTEGER NOT NULL DEFAULT 1,
          last_login_at TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_super_admin_username ON super_admin_accounts(username);
      `);

      // ─── 4. Super Admin License Records (Registry of issued licenses) ──────
      db.exec(`
        CREATE TABLE IF NOT EXISTS super_admin_license_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          license_id TEXT NOT NULL UNIQUE COLLATE NOCASE,
          customer_name TEXT NOT NULL,
          product_name TEXT NOT NULL DEFAULT 'School Management System',
          edition TEXT NOT NULL DEFAULT 'Standard',
          license_type TEXT NOT NULL,
          installation_binding TEXT NOT NULL,
          starts_at TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          grace_period_days INTEGER NOT NULL DEFAULT 0,
          signed_license_token TEXT NOT NULL,
          notes TEXT NOT NULL DEFAULT '',
          created_by_super_admin_id INTEGER REFERENCES super_admin_accounts(id) ON DELETE SET NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_sa_lic_customer ON super_admin_license_records(customer_name);
        CREATE INDEX IF NOT EXISTS idx_sa_lic_binding ON super_admin_license_records(installation_binding);
      `);

      // ─── 5. Backup Metadata ────────────────────────────────────────────────
      db.exec(`
        CREATE TABLE IF NOT EXISTS backup_metadata (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          backup_name TEXT NOT NULL,
          backup_path TEXT NOT NULL,
          backup_size INTEGER NOT NULL,
          database_version INTEGER NOT NULL,
          app_version TEXT NOT NULL,
          school_name TEXT NOT NULL,
          checksum TEXT NOT NULL,
          asset_count INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'Valid',
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_backup_created_at ON backup_metadata(created_at);
      `);

      // ─── 6. System Security & Audit Logs ───────────────────────────────────
      db.exec(`
        CREATE TABLE IF NOT EXISTS system_audit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event_type TEXT NOT NULL,
          severity TEXT NOT NULL CHECK (severity IN ('INFO', 'WARN', 'ERROR', 'CRITICAL')),
          details TEXT NOT NULL,
          performed_by TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_audit_event ON system_audit_logs(event_type);
        CREATE INDEX IF NOT EXISTS idx_audit_created ON system_audit_logs(created_at);
      `);

      // ─── 7. Update Metadata ────────────────────────────────────────────────
      db.prepare(`
        INSERT OR REPLACE INTO app_metadata (key, value, updated_at)
        VALUES ('schema_version', '8', datetime('now')),
               ('app_version', '1.0.0', datetime('now'))
      `).run();
    },
  },
  {
    version: 9,
    name: '009_heal_missing_student_enrollments',
    up: (db: Database.Database) => {
      // 1. Ensure default sections exist for all classes that currently have none
      const classes = db.prepare('SELECT id FROM classes').all() as { id: number }[];
      for (const cls of classes) {
        const sec = db.prepare('SELECT id FROM sections WHERE class_id = ? LIMIT 1').get(cls.id);
        if (!sec) {
          db.prepare(`
            INSERT INTO sections (class_id, name, description, is_active, created_at, updated_at)
            VALUES (?, 'Section A', 'Default Section', 1, datetime('now'), datetime('now'))
          `).run(cls.id);
        }
      }

      // 2. Find active session or default session
      const activeSession = (db.prepare('SELECT id FROM academic_sessions WHERE is_active = 1 LIMIT 1').get() as { id: number } | undefined)
        || (db.prepare('SELECT id FROM academic_sessions ORDER BY id ASC LIMIT 1').get() as { id: number } | undefined);

      const firstClass = db.prepare('SELECT id FROM classes ORDER BY display_order ASC, id ASC LIMIT 1').get() as { id: number } | undefined;

      if (activeSession && firstClass) {
        const firstSec = db.prepare('SELECT id FROM sections WHERE class_id = ? AND is_active = 1 LIMIT 1').get(firstClass.id) as { id: number } | undefined
          || db.prepare('SELECT id FROM sections WHERE class_id = ? LIMIT 1').get(firstClass.id) as { id: number } | undefined;

        if (firstSec) {
          // Find any existing students who have no enrollment record
          const unassignedStudents = db.prepare(`
            SELECT id FROM students
            WHERE id NOT IN (SELECT DISTINCT student_id FROM student_enrollments)
          `).all() as { id: number }[];

          for (const st of unassignedStudents) {
            db.prepare(`
              INSERT INTO student_enrollments (
                student_id, academic_session_id, class_id, section_id,
                admission_date, status, created_at, updated_at
              ) VALUES (?, ?, ?, ?, date('now'), 'Active', datetime('now'), datetime('now'))
            `).run(st.id, activeSession.id, firstClass.id, firstSec.id);
          }
        }
      }

      // 3. Update Metadata
      db.prepare(`
        INSERT OR REPLACE INTO app_metadata (key, value, updated_at)
        VALUES ('schema_version', '9', datetime('now')),
               ('app_version', '1.0.0', datetime('now'))
      `).run();
    },
  },
  {
    version: 10,
    name: '010_seed_default_exam_and_fee_types',
    up: (db: Database.Database) => {
      // 1. Seed default Exam Types if none exist or ignore if exists
      const defaultExamTypes = [
        { name: 'Mid Term Examination', code: 'MID', description: 'Mid-academic term evaluation' },
        { name: 'Final Examination', code: 'FINAL', description: 'End of academic session comprehensive examination' },
        { name: 'First Term Examination', code: 'TERM1', description: 'First term assessment' },
        { name: 'Second Term Examination', code: 'TERM2', description: 'Second term assessment' },
        { name: 'Monthly Class Assessment', code: 'MNT', description: 'Monthly class performance test' },
        { name: 'Annual Examination', code: 'ANNUAL', description: 'Annual final examination' },
      ];

      const insertExamType = db.prepare(`
        INSERT OR IGNORE INTO exam_types (name, code, description, is_active, created_at, updated_at)
        VALUES (?, ?, ?, 1, datetime('now'), datetime('now'))
      `);

      for (const t of defaultExamTypes) {
        insertExamType.run(t.name, t.code, t.description);
      }

      // 2. Seed default Fee Types if none exist or ignore if exists
      const defaultFeeTypes = [
        { name: 'Tuition Fee', code: 'TUIT', description: 'Regular monthly tuition fee' },
        { name: 'Admission Fee', code: 'ADM', description: 'One-time admission processing fee' },
        { name: 'Examination Fee', code: 'EXAM', description: 'Term examination and materials fee' },
        { name: 'Sports & Activity Fee', code: 'SPRT', description: 'Annual extracurricular activities fee' },
        { name: 'Annual Charges', code: 'ANNL', description: 'Annual institutional charges' },
        { name: 'Lab Charges', code: 'LAB', description: 'Science and computer laboratory charges' },
      ];

      const insertFeeType = db.prepare(`
        INSERT OR IGNORE INTO fee_types (name, code, description, is_active, created_at, updated_at)
        VALUES (?, ?, ?, 1, datetime('now'), datetime('now'))
      `);

      for (const f of defaultFeeTypes) {
        insertFeeType.run(f.name, f.code, f.description);
      }

      // 3. Update Metadata
      db.prepare(`
        INSERT OR REPLACE INTO app_metadata (key, value, updated_at)
        VALUES ('schema_version', '10', datetime('now')),
               ('app_version', '1.0.0', datetime('now'))
      `).run();
    },
  },
  {
    version: 11,
    name: '011_seed_fee_periods_and_default_structures',
    up: (db: Database.Database) => {
      // 1. Seed 12 monthly fee periods for all existing academic sessions that have none
      const sessions = db.prepare('SELECT id, name, start_date, end_date FROM academic_sessions').all() as Array<{
        id: number;
        name: string;
        start_date: string;
        end_date: string;
      }>;

      const insertPeriod = db.prepare(`
        INSERT OR IGNORE INTO fee_periods (
          academic_session_id, name, start_date, end_date, due_date, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'Open', datetime('now'), datetime('now'))
      `);

      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];

      for (const sess of sessions) {
        const existingCount = (db.prepare('SELECT COUNT(*) as c FROM fee_periods WHERE academic_session_id = ?').get(sess.id) as { c: number }).c;
        if (existingCount === 0) {
          let startYear = parseInt(sess.start_date ? sess.start_date.substring(0, 4) : '2026', 10);
          let startMonth = parseInt(sess.start_date && sess.start_date.length >= 7 ? sess.start_date.substring(5, 7) : '8', 10) - 1;
          if (isNaN(startYear)) {
            const m = sess.name.match(/\b(20\d\d)\b/);
            startYear = m ? parseInt(m[1], 10) : 2026;
          }
          if (isNaN(startMonth) || startMonth < 0 || startMonth > 11) {
            startMonth = 7; // August default
          }

          for (let i = 0; i < 12; i++) {
            const curDate = new Date(Date.UTC(startYear, startMonth + i, 1));
            const y = curDate.getUTCFullYear();
            const mIdx = curDate.getUTCMonth();
            const mNum = (mIdx + 1).toString().padStart(2, '0');
            const name = `${monthNames[mIdx]} ${y}`;
            const startDate = `${y}-${mNum}-01`;
            const lastDay = new Date(Date.UTC(y, mIdx + 1, 0)).getUTCDate();
            const endDate = `${y}-${mNum}-${lastDay.toString().padStart(2, '0')}`;
            const dueDate = `${y}-${mNum}-10`;

            insertPeriod.run(sess.id, name, startDate, endDate, dueDate);
          }
        }
      }

      // 2. Ensure every class has at least a default Tuition Fee structure for active sessions
      const tuitionType = db.prepare("SELECT id FROM fee_types WHERE name LIKE '%tuition%' OR code = 'TUIT' LIMIT 1").get() as { id: number } | undefined;
      if (tuitionType) {
        const classes = db.prepare('SELECT id FROM classes').all() as Array<{ id: number }>;
        const activeSessions = db.prepare('SELECT id FROM academic_sessions WHERE is_active = 1').all() as Array<{ id: number }>;

        const existingStruct = db.prepare('SELECT amount FROM fee_structures WHERE fee_type_id = ? AND amount > 0 LIMIT 1').get(tuitionType.id) as { amount: number } | undefined;
        const defaultAmount = existingStruct ? existingStruct.amount : 300000; // 3000 PKR

        const insertStruct = db.prepare(`
          INSERT OR IGNORE INTO fee_structures (
            academic_session_id, class_id, fee_type_id, amount, frequency,
            effective_from, effective_to, description, is_active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, 'Monthly', '', '', 'Monthly Tuition Fee', 1, datetime('now'), datetime('now'))
        `);

        for (const s of activeSessions) {
          for (const c of classes) {
            insertStruct.run(s.id, c.id, tuitionType.id, defaultAmount);
          }
        }
      }

      // 3. Update Metadata
      db.prepare(`
        INSERT OR REPLACE INTO app_metadata (key, value, updated_at)
        VALUES ('schema_version', '11', datetime('now')),
               ('app_version', '1.0.0', datetime('now'))
      `).run();
    },
  },
  {
    version: 12,
    name: '012_add_principal_signature_to_school_settings',
    up: (db: Database.Database) => {
      // Check existing columns to add signature_path cleanly without breaking existing databases
      const columns = db.prepare("PRAGMA table_info(school_settings)").all() as { name: string }[];
      const colNames = new Set(columns.map((c) => c.name));

      if (!colNames.has('signature_path')) {
        db.exec("ALTER TABLE school_settings ADD COLUMN signature_path TEXT DEFAULT NULL");
      }

      // Update Metadata
      db.prepare(`
        INSERT OR REPLACE INTO app_metadata (key, value, updated_at)
        VALUES ('schema_version', '12', datetime('now')),
               ('app_version', '1.0.0', datetime('now'))
      `).run();
    },
  },
  {
    version: 13,
    name: '013_add_soft_delete_to_students',
    up: (db: Database.Database) => {
      // Check existing columns to add is_deleted and deleted_at cleanly
      const columns = db.prepare("PRAGMA table_info(students)").all() as { name: string }[];
      const colNames = new Set(columns.map((c) => c.name));

      if (!colNames.has('is_deleted')) {
        db.exec("ALTER TABLE students ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0");
      }
      if (!colNames.has('deleted_at')) {
        db.exec("ALTER TABLE students ADD COLUMN deleted_at TEXT DEFAULT NULL");
      }

      db.exec("CREATE INDEX IF NOT EXISTS idx_students_is_deleted ON students(is_deleted)");

      // Update Metadata
      db.prepare(`
        INSERT OR REPLACE INTO app_metadata (key, value, updated_at)
        VALUES ('schema_version', '13', datetime('now')),
               ('app_version', '1.0.0', datetime('now'))
      `).run();
    },
  },
];

/**
 * Runs all pending migrations against the provided database.
 */
export function runMigrations(db: Database.Database): { appliedCount: number; currentVersion: number } {
  // Ensure schema_migrations table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Query already applied versions
  const appliedRows = db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[];
  const appliedVersions = new Set(appliedRows.map((r) => r.version));

  let appliedCount = 0;
  let maxVersion = 0;

  for (const version of appliedVersions) {
    if (version > maxVersion) maxVersion = version;
  }

  for (const migration of migrations) {
    if (!appliedVersions.has(migration.version)) {
      console.log(`[Migrations] Applying migration ${migration.version}: ${migration.name}...`);

      // Apply migration inside a transaction for atomicity
      const runTx = db.transaction(() => {
        migration.up(db);
        db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(
          migration.version,
          migration.name
        );
      });

      runTx();
      appliedCount += 1;
      if (migration.version > maxVersion) {
        maxVersion = migration.version;
      }
      console.log(`[Migrations] Migration ${migration.version} applied successfully.`);
    }
  }

  if (appliedCount === 0) {
    console.log(`[Migrations] Database schema is up to date (version ${maxVersion}).`);
  } else {
    console.log(`[Migrations] Applied ${appliedCount} migration(s). Current schema version: ${maxVersion}.`);
  }

  return { appliedCount, currentVersion: maxVersion };
}
