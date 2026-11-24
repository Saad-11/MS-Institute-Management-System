# School / College Management System

A commercial, fully offline Windows desktop application for managing school and college administration.

## Overview

This application is designed for school and college administrators. It runs entirely on your local Windows PC with **zero internet or cloud connectivity** required during normal operations. Each school receives its own independent local database with full data privacy.

- **Phase 1: Application Foundation & UI Shell** — *Complete*
- **Phase 2: SQLite Database Foundation & Admin Authentication** — *Complete*
- **Phase 3: School Settings & Core Academic Structure** — *Complete*
- **Phase 4: Students & Teachers Management** — *Complete*
- **Phase 5: Attendance Management** — *Complete*
- **Phase 6: Fees & Fee Slips Management** — *Complete*
- **Phase 7: Examinations, Marks, Results & Dynamic DMC** — *Complete*
- **Phase 8: Documents, Reports, Student Promotion & Academic History** — *Complete*
- **Phase 9: Backup/Restore, Super Admin & Offline Licensing** — *Complete*

---

## Technology Stack

| Technology | Purpose |
|------------|---------|
| **Electron 33** | Secure Windows desktop application runtime |
| **React 18** | Modular UI component architecture |
| **TypeScript 5** | Strict type safety across frontend and backend |
| **Vite 5** | High-speed frontend bundler & dev workflow |
| **better-sqlite3** | Fast, reliable synchronous SQLite driver with WAL mode |
| **Node.js Crypto (scrypt)** | Memory-hard password hashing with unique salts |
| **react-router-dom** | Client-side hash routing (`file://` compatible) |
| **Lucide React** | Clean, accessible vector icons |

---

## Phase 4 Architecture & Capabilities

### 1. Database Schema & Migration 003
Phase 4 introduces normalized student and faculty tables with relational integrity and partial uniqueness:
- **`students`**: Normalized student profiles:
  - System identifiers: `student_id` (`STD-YYYY-XXXX`), `admission_number` (`ADM-...`), unique case-insensitive (`COLLATE NOCASE`).
  - Personal info: `first_name`, `middle_name`, `last_name`, `display_name`, `gender`, `date_of_birth`, `photo_path`, `blood_group`, `nationality`, `religion`.
  - Parent / Guardian details: `father_name`, `mother_name`, `guardian_name`, `guardian_relationship`.
  - Contact & Address: `phone`, `alternative_phone`, `current_address`, `permanent_address`, `city`, `province`.
  - Lifecycle: `is_active`, `created_at`, `updated_at`.
- **`student_enrollments`**: Academic session history tracking:
  - Relational links: `student_id`, `academic_session_id`, `class_id`, `section_id`, `admission_date`, `status` (`Active` | `Inactive` | `Transferred` | `Graduated` | `Left`).
  - Strict partial unique index: `UNIQUE(student_id, academic_session_id) WHERE status = 'Active'` guarantees that a student can only hold **one active enrollment per academic session**.
  - Foreign key constraints: `ON DELETE RESTRICT` protects historical educational records against accidental cascade deletions.
- **`teachers`**: Faculty and staff profiles:
  - Identifiers: `teacher_id` (`TCH-YYYY-XXXX`), `employee_id` (`EMP-...`), unique case-insensitive.
  - Personal info: `first_name`, `middle_name`, `last_name`, `display_name`, `gender`, `date_of_birth`, `photo_path`.
  - Contact & Address: `phone`, `email`, `address`, `city`, `province`.
  - Professional info: `qualification`, `specialization`, `joining_date`, `designation`, `employment_status` (`Active` | `Inactive` | `On Leave` | `Resigned`), `is_active`.

### 2. Student Management Module
- **Registration & Admissions**:
  - Auto-generated system ID (`STD-YYYY-XXXX`) distinct from school admission register number.
  - Comprehensive profile entry (basic, parent/guardian, contact, address).
  - Transactional initial enrollment into active session, class, and dependent section.
  - Verification that the selected section belongs strictly to the chosen class.
- **Student Profile & Enrollment History**:
  - Modal viewing detailed profile, parents, and contact information.
  - Complete historical log of enrollments, promotions, and transfers across academic sessions.
  - Assign to new session/class with automatic deactivation of previous active enrollment in that session.
- **Photo Upload & CSP Compliance**:
  - Main-process native dialog or browser mock upload for JPG/PNG images (< 5MB).
  - Stored locally under `%APPDATA%\school-management-system\uploads\students\`.
  - Delivered to renderer via secure base64 data URLs to satisfy strict Content Security Policy.
- **Directory Search & Multi-Filters**:
  - Full-text search across student name, student ID, admission number, father name, and phone.
  - Dropdown filters for Academic Session, Class, dependent Section, Gender, and System Status.
  - Server-side and mock-backed pagination.

### 3. Faculty & Teacher Management Module
- **Faculty Registration**:
  - Auto-generated system ID (`TCH-YYYY-XXXX`) distinct from employee payroll/staff ID.
  - Record qualifications (degrees), subject specialization, joining date, and designation.
  - Employment status tracking (`Active`, `Inactive`, `On Leave`, `Resigned`).
- **Profile Management**:
  - View full credentials, professional background, and contacts.
  - Profile editing with duplicate ID rejections.
  - Secure photo management stored under `%APPDATA%\school-management-system\uploads\teachers\`.
- **Search & Filters**:
  - Search by name, teacher ID, employee ID, phone, email, qualification, and specialization.
  - Filter by employment status, designation, and active status.

### 4. Dashboard Integration
- Live aggregated metrics from SQLite:
  - **Active Students Count**
  - **Active Teachers Count**
  - **Active Classes Count**
  - **Active Subjects Count**
- Students and Teachers modules are marked as **Ready** on the dashboard with direct quick-action shortcuts for "New Student Admission" and "Register Teacher".

---

## Security Architecture

1. **Context Isolation**: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
2. **Strict IPC Whitelisting**: React accesses backend data only via explicit channels exposed through `window.electronAPI`.
3. **No Raw SQL or Filesystem Access in Renderer**: All SQL queries, SQLite connections, and filesystem manipulations are contained entirely in the Electron main process.
4. **Parameterized SQL Queries**: 100% of SQLite queries use parameterized bindings to prevent SQL injection.
5. **Relational Constraints**: `PRAGMA foreign_keys = ON;` is enforced on every database connection.
6. **Session-Gated IPC Handlers**: Modifying students, enrollments, teachers, classes, sections, or settings requires a valid cryptographic in-memory session token.

---

## Project Structure

```
e:\School Project\
├── electron/                         # Backend main process (Node.js & SQLite)
│   ├── database/
│   │   ├── services/
│   │   │   ├── academic-session.service.ts # Sessions CRUD & single-active transactions
│   │   │   ├── auth.service.ts       # Setup, login, password checks, sessions
│   │   │   ├── class.service.ts      # Classes & sections management
│   │   │   ├── dashboard.service.ts  # Live database summary metrics (classes, subjects, students, teachers)
│   │   │   ├── school.service.ts     # School profile settings & secure logo handling
│   │   │   ├── student.service.ts    # Student profiles, ID generator, enrollments, photos
│   │   │   ├── subject.service.ts    # Subjects & class-subject mappings
│   │   │   └── teacher.service.ts    # Teacher profiles, ID generator, status, photos
### 4. Attendance Management Module (Phase 5)
- **Database Schema & Migration 004**:
  - **`attendance`**: Relational table linked to student, enrollment, academic session, class, and section.
  - Strict unique constraint: `UNIQUE(student_id, attendance_date)` ensures no student can have multiple conflicting records on the same day.
  - Controlled enum statuses: `Present`, `Absent`, `Late`, `Leave` (no arbitrary free-text or blank defaults).
  - Optional remarks up to 255 characters (e.g. medical certificates, excuse notes).
  - Relational integrity: Foreign keys with `ON DELETE RESTRICT` protect educational history from accidental deletion.
- **Transactional Bulk Save & Upsert**:
  - All records for a class section are written inside an atomic SQLite transaction.
  - If any row fails validation (e.g., student not actively enrolled in the selected session/class/section), the entire transaction rolls back cleanly.
  - Re-saving attendance for an existing date seamlessly updates statuses via `ON CONFLICT(student_id, attendance_date) DO UPDATE` without creating duplicate records.
- **Standardized Percentage Formula**:
  - `Attendance Percentage = ((Present + Late) / Total Recorded Days) * 100` rounded to 2 decimal places.
  - Days without recorded attendance are omitted from the denominator.
  - If 0 days have been recorded, the formula returns `null` (`N/A` in UI).
- **Daily Attendance Entry Interface**:
  - Select Academic Session, Class, Section, and Attendance Date (rejects future dates `> today`).
  - "Load Students" button loads enrolled students and pre-fills existing statuses if already marked.
  - Quick bulk actions: "Mark All Present", "Mark All Absent", "Mark All Late", "Mark All Leave" (updates UI form state only).
  - Unsaved changes indicator and browser `beforeunload` warning prevent accidental data loss.
- **Comprehensive Attendance History**:
  - Multi-filtering by Academic Session, Class, Section, Date From/To, Status, and Search Query (by student name, ID, or remarks).
  - Server-side and browser mock pagination and sorting.
- **Individual Student Attendance Integration**:
  - Student Details modal displays overall attendance metrics (Total Recorded, Present, Absent, Late, Leave, Attendance %) and a chronological history table.

---

## Project Structure

```
School Project/
├── electron/                         # Backend (Node.js + Electron main process)
│   ├── database/
│   │   ├── services/
│   │   │   ├── academic-session.service.ts # Sessions CRUD, active state sync
│   │   │   ├── attendance.service.ts       # Attendance CRUD, bulk upsert, stats, history
│   │   │   ├── auth.service.ts             # Admin setup, login, sessions
│   │   │   ├── class.service.ts            # Classes, sections, subjects, mappings
│   │   │   ├── dashboard.service.ts        # Aggregated stats for dashboard
│   │   │   ├── school.service.ts           # School profile, settings & branding
│   │   │   ├── student.service.ts          # Student registration & enrollments
│   │   │   └── teacher.service.ts          # Teacher registration & profiles
│   │   ├── connection.ts             # SQLite connection & PRAGMA configurations
│   │   ├── migrations.ts             # Versioned schema migrations (001, 002, 003, 004)
│   │   └── security.ts               # scrypt hashing, salts & rate limiter
│   ├── main.ts                       # Window management, security rules, IPC handlers
│   └── preload.ts                    # ContextBridge with strictly allow-listed IPC channels
├── src/                              # Frontend (React 18 + TypeScript)
│   ├── components/
│   │   ├── ErrorBoundary/            # Catches UI errors without exposing stack traces
│   │   ├── Sidebar/                  # 12-module navigation with active state
│   │   └── TopBar/                   # Page title, live SQLite status, user & logout
│   ├── context/
│   │   └── AuthContext.tsx           # React authentication state and setup gating
│   ├── layouts/
│   │   └── MainLayout/               # App layout wrapper (Sidebar + TopBar + Content)
│   ├── mock/
│   │   └── browserMock.ts            # Full in-browser mock store for localhost testing
│   ├── pages/
│   │   ├── Attendance/
│   │   │   ├── AttendancePage.tsx        # Tabs container (Daily Entry + Records History)
│   │   │   ├── AttendanceEntryTab.tsx    # Daily marking sheet with bulk actions & live stats
│   │   │   └── AttendanceHistoryTab.tsx  # Multi-filtered attendance records viewer
│   │   ├── Auth/                     # Setup & Login screens
│   │   ├── Classes/                  # Classes, Sections, Subjects, and Assignments
│   │   ├── Dashboard/                # Landing dashboard with live metrics & quick actions
│   │   ├── PlaceholderPage/          # Future phase placeholder screens
│   │   ├── Settings/                 # School settings and academic sessions
│   │   ├── Students/
│   │   │   ├── StudentsPage.tsx      # Student directory with search, filters & pagination
│   │   │   ├── StudentModal.tsx      # Student admission and profile editor
│   │   │   └── StudentDetailsModal.tsx # Profile view, enrollment and attendance history
│   │   └── Teachers/
│   │       ├── TeachersPage.tsx      # Faculty directory with search & filters
│   │       ├── TeacherModal.tsx      # Teacher registration and profile editor
│   │       └── TeacherDetailsModal.tsx # Teacher profile & background viewer
│   ├── styles/                       # CSS design system (tokens, layout, shared modules)
│   ├── types/                        # Shared TypeScript interfaces
│   ├── App.tsx                       # Root router & authentication gate
│   └── main.tsx                      # React DOM mount point
├── test/
│   ├── database-and-auth.test.mjs    # Phase 2 automated test suite (41 tests)
│   ├── phase3-school-structure.test.mjs # Phase 3 automated test suite (50 tests)
│   ├── phase4-students-and-teachers.test.mjs # Phase 4 automated test suite (38 tests)
│   └── phase5-attendance.test.mjs    # Phase 5 automated test suite (70 tests)
├── package.json                      # Scripts, dependencies, and builder config
├── tsconfig.json                     # Frontend TypeScript config
├── tsconfig.electron.json            # Electron backend TypeScript config
└── vite.config.ts                    # Vite build configuration
```

---

## Phase 6 Architecture & Capabilities: Fees & Fee Slips

### 1. Strict Monetary Architecture (Integer Minor Units)
- **Zero Floating-Point Drift**: All monetary amounts across SQLite tables, backend services, and formulas are strictly modeled as integer minor units (`paisa`, 100 paisa = 1 PKR).
- **Formatters & String Parsing**: Floating-point parsing vulnerabilities (`0.1 + 0.2 !== 0.3`) are eliminated via exact string splitting utilities (`toMinorUnits`, `toMajorUnits`, `formatMoney`). Localized presentation renders `Rs. 4,500.00`.
- **Default Currency**: Pakistan Rupee (`PKR`).

### 2. Database Schema & Migration 005
- **`fee_types`**: Universal fee catalog (e.g. Tuition, Admission, Examination, Lab, Sports). Enforces case-insensitive uniqueness (`COLLATE NOCASE`) on names and short codes. Includes active/inactive toggling.
- **`fee_structures`**: Class-level fee models linking Academic Session, Class, Fee Type, Frequency (`Monthly`, `Quarterly`, `Half-Yearly`, `Yearly`, `One-Time`), and minor unit amount.
- **`fee_periods`**: Discrete billing cycles (e.g. "August 2026", "Term 1") with `start_date`, `end_date`, `due_date`, and `status` (`Open` | `Closed`).
- **`student_fee_adjustments`**: Custom per-student fee overrides/concessions (e.g., kinship discounts, scholarships) applied during fee generation without altering general class structures.
- **`fee_records`**: Invoices generated for enrolled students. Columns: `original_amount`, `discount`, `fine`, `net_amount`, `paid_amount`, `remaining_balance`, `due_date`, and `status` (`Unpaid`, `Partially Paid`, `Paid`, `Waived`, `Cancelled`). Unique constraint `UNIQUE(student_id, fee_period_id, fee_type_id)` prevents duplicate billing.
- **`fee_payments`**: Transactional ledger of payment entries with sequential receipt numbering (`REC-YYYY-XXXXXX`), payment mode (`Cash`, `Bank Transfer`, `Cheque`, `Other`), reference notes, audit trail (`received_by_user_id`), and timestamp.

### 3. Financial Integrity & Overpayment Protection
- **Atomic ACID Payments**: Payments are executed inside SQLite transactions that verify remaining dues directly from database state before committing.
- **Overpayment Rejection**: Attempts to pay greater than `remaining_balance` trigger immediate rollback with explicit error messages.
- **Automatic Status Transitions**: Transitions smoothly from `Unpaid` to `Partially Paid` to `Paid` upon complete settlement.

### 4. Receipts & Printing
- **Professional Print View**: Dedicated `@media print` styling generates clean, school-branded receipts including school header, student particulars, fee breakdown, payment mode, cashier signature, and depositor signature.
- **Reprint Slips**: Any historical transaction can be reprinted without creating duplicate payment entries.

---

## Phase 7 Architecture & Capabilities: Examinations, Marks, Results & Dynamic DMC

### 1. Database Schema & Migration 006
- **`exam_types`**: Universal examination catalog (e.g. Mid Term, Final Exam, Quiz, Monthly Test). Unique names and short codes with active status toggling.
- **`examinations`**: Examination instances linked to Academic Session and Exam Type. Columns: `start_date`, `end_date`, `description`, `status` (`Draft`, `Open`, `Closed`). Date range validation (`start_date <= end_date`) and status lifecycle management.
- **`examination_subjects`**: Dynamic subjects configured per class for an examination. Columns: `max_marks`, `passing_marks`, `sort_order`. Strictly validated against `class_subjects` (curriculum assignments) — subjects not assigned to the class are rejected.
- **`grading_rules`**: Configurable institutional grading scale. Columns: `grade`, `min_percentage`, `max_percentage`, `grade_point`, `remarks`, `is_passing`. Seeded with standard Pakistani educational grading (`A+`, `A`, `B`, `C`, `D`, `E`, `F`). Exact decimal boundary handling (`[min, max)` with top boundary inclusive).
- **`exam_marks`**: Student marks ledger. Columns: `obtained_marks`, `status` (`Present`, `Absent`, `Exempt`), `remarks`. Unique constraint `UNIQUE(examination_subject_id, student_id)`.

### 2. Dynamic Subject System & Curriculum Integrity
- **Class-Specific Subjects**: Different classes (e.g., Grade 9 vs Grade 5) can have completely distinct subject sets.
- **Curriculum Enforcement**: The backend queries `class_subjects` to verify active assignment. Cannot inject arbitrary subjects into an exam that are not part of that class's curriculum.
- **Passing Marks Validation**: Passing marks cannot exceed maximum marks (`passing_marks <= max_marks`).

### 3. Marks Entry & Integrity Guards
- **Bounds Checking**: Enforces `0 <= obtained_marks <= max_marks` for all entries.
- **Preserved Absent Status**: When a student is absent, status is stored as `Absent` with `obtained_marks = null`. It is never converted into a fake numeric zero in database storage.
- **Transactional Bulk Save**: Entire class marks sheets are written atomically. If any record violates rules, the transaction rolls back cleanly.
- **Closed Examination Guard**: When an examination is marked `Closed`, marks entry and subject modifications are permanently rejected.

### 4. Centralized Result Calculation & Ranking
- **Overall Aggregation**: Total Maximum Marks, Total Obtained Marks (absent subjects contribute 0), and Percentage rounded to 2 decimal places.
- **Pass/Fail Criteria**: A student passes only if they achieve `>= passing_marks` in every configured subject and are not marked `Absent` in any subject.
- **Grading Scale Evaluation**: Dynamic lookup against `grading_rules` table based on calculated percentage.
- **Class Rankings / Positions**: Students are ordered by percentage descending (and total marks descending), assigning positions (1st, 2nd, 3rd, etc.).

### 5. Institutional DMC (Detailed Marks Certificate) & Print Layout
- **Institutional Branding**: School header, institution name, address, contact, and official logo.
- **Student Particulars**: Explicit "Student ID" label (`STD-YYYY-XXXX`), Admission Number, Roll Number, Student Name, Father's Name, Class, and Section.
- **Dynamic Subject Table**: Renders only the subjects assigned to the student's specific class, showing Max Marks, Passing Marks, Obtained Marks, Grade, and Remarks. Absent subjects are clearly designated as `"Absent"`.
- **Examination Summary & Signatures**: Total Marks, Percentage, Overall Grade, Pass/Fail Result, Class Position, Remarks, and official signature/stamp lines (Class Teacher, Controller of Examinations, Principal).
- **CSS `@media print`**: Optimized full-page print layout hiding navigation bars, buttons, and system controls.

---

## Phase 8 Architecture & Capabilities

### 1. Database Schema & Migration 007
Migration 007 expands the system schema with official document registry, student promotion tracking, and academic progression history:
- **`student_enrollments` Column Extensions**:
  - `roll_number`: Stored directly on enrollment for class-specific ordering.
  - `promotion_status`: (`None`, `Promoted`, `Retained`, `Graduated`, `Transferred`, `Left`).
  - `promotion_date`: ISO date when the academic transition was executed.
  - `remarks`: Progression notes, previous class transition details, or transfer comments.
- **`student_documents`**: Official student certificates and issued records:
  - `document_number`: Sequential format `DOC-YYYY-XXXXXX` (unique case-insensitive).
  - `student_id`: Relational link to `students(id)`.
  - `academic_session_id`: Session under which document was issued.
  - `document_type`: (`Bonafide`, `Character`, `School Leaving`, `Transfer`, `General Certificate`).
  - `title`: Certificate heading or custom document title.
  - `issue_date`: Date of issuance.
  - `issued_by_user_id`: Administrator/staff user ID.
  - `details_json`: Serialized JSON payload capturing conduct, reasons for leaving, fee clearance verification, and custom remarks.
- **`promotion_logs`**: Immutable audit log of all academic transitions:
  - Links: `student_id`, `from_session_id`, `to_session_id`, `from_class_id`, `to_class_id`, `from_section_id`, `to_section_id`.
  - `action`: (`Promote`, `Retain`, `Graduate`, `Transfer`, `Left`).
  - `promotion_date`: Execution date.
  - `performed_by_user_id`: Responsible administrator.
  - `remarks`: Custom notes and rationale.

### 2. Official Student Document Generator
- **Supported Certificates**:
  - **Bonafide Student Certificate**: Official proof of current enrollment, admission number, father's name, class, and active session.
  - **Character Certificate**: Testimonial of character and conduct during the student's study period.
  - **School Leaving Certificate (SLC)**: Formal discharge certificate documenting attendance, date of leaving, and reason for withdrawal.
  - **Transfer Certificate (TC)**: Official school transfer document certifying clearance of dues and academic standing.
  - **General Certificate**: Customizable institutional certificate with arbitrary subject matter, editable body text, and official signatures.
- **Dynamic Institutional Branding**: Automatically populates school name, logo, address, phone, email, and principal signature from School Settings.
- **Sequential Document Registry**: Guarantees unique sequential identifiers (`DOC-YYYY-000001`, `DOC-YYYY-000002`).
- **Preview & History Registry**: Full history table with filtering by type, session, student, and quick re-printing.
- **Print & Offline PDF Export**: Native Electron print dialog and direct PDF generation (`app:exportPDF`) with clean print CSS hiding UI controls.

### 3. Institutional Reporting Engine
Provides 8 institutional analytical reports with dynamic filters, summary calculation, and offline export:
1. **Student List Report**: Enrollment directory by session, class, section, gender, and status.
2. **Attendance Summary Report**: Total recorded days, present/absent/late/leave distribution, and individual & class attendance percentages.
3. **Fee Collection Report**: Daily/monthly fee collections, payment methods, transaction receipts, and total cash/bank breakdown.
4. **Fee Outstanding & Defaulters Report**: Unpaid and overdue balances, partial payments, defaulter counts, and outstanding balances.
5. **Exam Marks Sheet**: Subject-wise obtained marks, maximum marks, passing marks, percentage, and grade by examination.
6. **Class Results Summary**: Class-wide academic rankings, pass/fail percentages, GPA/grades, and subject failure counts.
7. **Class Strength & Capacity Report**: Enrollment counts per class and section, capacity analysis, and vacant seat count.
8. **Faculty & Teacher Directory Report**: Active faculty directory, qualifications, specializations, designations, and contact details.

### 4. Student Promotion & Academic History Engine
- **Session Rollover & Candidate Determination**:
  - Determines promotion eligibility based on academic session, class, section, attendance percentage, and exam marks.
  - Automatically calculates pass/fail status and recommends action (`Promote` or `Retain`).
  - Detects if a student is already enrolled in the destination session to prevent duplicate enrollments.
- **Supported Progression Actions**:
  - `Promote`: Marks previous enrollment inactive with `Promote` status, and creates an active enrollment in the target class of the next session.
  - `Retain`: Marks previous enrollment inactive with `Retain` status, and enrolls student in the same class in the next session.
  - `Graduate`: Marks enrollment as `Graduated` and sets `is_active = 0` on student profile.
  - `Transfer`: Marks enrollment as `Transferred` and sets `is_active = 0`.
  - `Left`: Marks enrollment as `Left` and sets `is_active = 0`.
- **Permanent Student Identity Continuity**: Permanent `student_id` (`STD-YYYY-XXXX`) and `admission_number` remain unchanged forever across all academic years.
- **Atomic Bulk Promotions**: All candidate promotions in a batch execute inside an atomic SQLite transaction. If any error or duplicate occurs, the entire batch rolls back with zero partial writes.
- **Comprehensive Academic Progression Timeline**: Viewable in student details, presenting the entire progression history from admission to graduation across sessions with class, section, roll number, attendance %, and exam grades.

---

## Phase 9 Architecture & Capabilities

### 1. Database Schema & Migration 008
Phase 9 adds critical tables for backup tracking, seller governance, and cryptographically verified offline licensing:
- **`installation_identity`**: Stable local installation fingerprinting:
  - `installation_id`: Hardware and OS bound identifier formatted as `INST-XXXX-XXXX-XXXX`.
  - `machine_fingerprint`: SHA-256 hash combining CPU architecture, platform, hostname, network interface MACs, and home directory.
  - `first_installed_at`, `last_validated_timestamp`: Protects against system clock rollback attacks.
- **`license_state`**: Local offline license activation records:
  - `license_id`, `customer_name`, `product`, `edition`, `license_type` (`Trial`, `Term`, `Perpetual`).
  - `starts_at`, `expires_at`, `grace_period_days`, `signed_token`, `status`.
  - Enforces atomic state transitions (`Unlicensed`, `Valid`, `GracePeriod`, `Expired`, `Revoked`, `Invalid`).
- **`super_admin_accounts`**: Isolated vendor seller portal accounts:
  - Separate credentials from local school administrators.
  - Salted and scrypt-hashed passwords (`scrypt(password, salt, 64)`).
  - Protected session tokens with in-memory timeout expiry.
- **`super_admin_license_records`**: Local vendor registry of generated customer licenses.
- **`backup_metadata`**: Full catalog of `.smbak` backup archives with SHA-256 integrity checksums.
- **`system_audit_logs`**: Tamper-evident operational audit logs recording installation, backups, restores, and license validations.

### 2. Backup & Restore System
- **Database-Consistent WAL Checkpointing**: Executes SQLite WAL checkpoints followed by online `database.backup()` snapshots, ensuring zero lost transactions or in-flight locks.
- **`.smbak` Compressed Archive Package**:
  - Gzip-compressed bundle with magic header `SMBAK_V1\n`.
  - Bundles the full SQLite database along with all uploaded school assets (`uploads/logos`, `uploads/students`, `uploads/teachers`).
  - Embedded JSON manifest with SHA-256 database checksums, schema version, timestamp, and school name.
- **Tamper Detection & Verification**: Full pre-restore verification verifying magic headers, JSON manifests, and SHA-256 database hashes.
- **Safety Snapshot & Rollback Guarantee**:
  - Automatically creates a timestamped safety backup in `backups/safety/PreRestore_*.smbak` prior to overwriting the database.
  - If a restore fails or violates SQLite integrity checks, the system automatically rolls back to the safety snapshot.

### 3. Asymmetric Offline Licensing Engine (Ed25519)
- **High-Security Cryptography**: Uses Node.js native Ed25519 digital signatures.
- **Strict Key Separation**: The client application contains **only the public key** for signature verification. The vendor private key is isolated to the Super Admin portal and never distributed to client installations.
- **Machine Hardware Binding**: Licenses are cryptographically bound to the target machine's `INST-XXXX-XXXX-XXXX` ID. If a backup is restored to another machine, the license reports a machine mismatch while protecting all school data.
- **Clock Tampering Protection**: Detects and flags backwards manipulation of system clocks.
- **Absolute Data Safety Guarantee**: In accordance with enterprise requirements, **school records and financial data are NEVER deleted or corrupted upon license expiration**. Administrators retain read access and can restore backups or enter a new renewal license key.

### 4. Super Admin Vendor Portal
- **Isolated Vendor Access**: Completely segregated from school staff and teacher logins (`/super-admin`).
- **Offline License Key Generator**: Instantly issues signed `.lic` tokens for any customer name, edition, duration (Trial, Monthly, Yearly, Lifetime), and installation binding ID.
- **Export & Management**: One-click copying and `.lic` file export for customer delivery.

---

## Verification & Testing

### 1. Run Complete Automated Test Suite (476+ Tests)
```powershell
npm test
```
*Runs all 41 Phase 2 authentication/security tests, 50 Phase 3 structural and schema tests, 38 Phase 4 student and teacher management tests, 70 Phase 5 attendance management tests, 76 Phase 6 fees and fee slip tests, 80 Phase 7 examination and DMC tests, 51 Phase 8 document, report, and promotion tests, and 70 Phase 9 backup, super admin, and licensing tests. All 476+ tests pass with 0 failures.*

### 2. Run Individual Test Suites
```powershell
npm run test:phase2
npm run test:phase3
npm run test:phase4
npm run test:phase5
npm run test:phase6
npm run test:phase7
npm run test:phase8
npm run test:phase9
```

### 3. Run Type Checking
```powershell
npm run typecheck
```
*Verifies both frontend and backend TypeScript compilation with 0 errors.*

### 4. Run Production Build
```powershell
npm run build:all
```
*Bundles the React frontend via Vite and compiles the Electron backend via TypeScript.*

### 5. Run Application in Desktop Mode
```powershell
npm run start
```
*Launches the native Windows Electron application.*

---

## Available Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `npm test` | `npm run build:electron && node test/...` | Run all 476+ automated tests (Phases 2 through 9) |
| `npm run test:phase2` | `node test/database-and-auth.test.mjs` | Run 41 Phase 2 database & auth tests |
| `npm run test:phase3` | `node test/phase3-school-structure.test.mjs` | Run 50 Phase 3 school & academic structure tests |
| `npm run test:phase4` | `node test/phase4-students-and-teachers.test.mjs` | Run 38 Phase 4 student & teacher management tests |
| `npm run test:phase5` | `node test/phase5-attendance.test.mjs` | Run 70 Phase 5 attendance management tests |
| `npm run test:phase6` | `node test/phase6-fees.test.mjs` | Run 76 Phase 6 fees & fee slips tests |
| `npm run test:phase7` | `node test/phase7-exams.test.mjs` | Run 80 Phase 7 examinations, marks & DMC tests |
| `npm run test:phase8` | `node test/phase8-documents-reports-promotions.test.mjs` | Run 51 Phase 8 documents, reports & promotion tests |
| `npm run test:phase9` | `node test/phase9-backup-superadmin-licensing.test.mjs` | Run 70 Phase 9 backup, super admin & licensing tests |
| `npm run start` | `npm run build:all && electron .` | Build & launch the Windows desktop application |
| `npm run dev:electron` | `concurrently "vite" ...` | Live development with Electron hot reloading |
| `npm run typecheck` | `tsc --noEmit && ...` | Full TypeScript type check (0 errors) |
| `npm run build:all` | `npm run build && ...` | Compile frontend (Vite) and backend (tsc) |
| `npm run dist` | `electron-builder --win` | Build Windows NSIS installer `.exe` |

---

## License

Commercial proprietary software. All rights reserved.
