# School / College Management System — Official User Guide

## 1. Getting Started & Setup Wizard

### 1.1 First Launch Initial Setup
When opening the application for the very first time on a new Windows installation:
1. The **Initial Setup Wizard** will display automatically.
2. Enter the **Administrator Username**, **Full Name**, and a **Strong Password**.
3. Provide your Institution's **School Name**, **School Code**, **Address**, **Phone Number**, and **Currency Symbol** (e.g., `PKR`, `USD`, `INR`).
4. Click **Complete Setup** to initialize the database and log into the administrative dashboard.

---

## 2. Institutional Configuration & Academic Structure

### 2.1 School Settings & Branding
- Navigate to **Settings** > **School Settings**.
- Upload your official institution logo (PNG/JPEG) to embed it automatically into Fee Receipts, DMCs, and Certificates.
- Update Principal name and official contact information at any time.

### 2.2 Academic Sessions
- Go to **Academic** > **Sessions**.
- Create academic sessions (e.g., `2025-2026`).
- Mark the current active academic session.

### 2.3 Classes, Sections & Subjects
- Create classes (e.g., `Class 9`, `Class 10`).
- Add sections to each class (e.g., `Section A`, `Section B`) with maximum capacity limits.
- Define curriculum subjects and allocate subjects to specific classes.

---

## 3. Student & Faculty Management

### 3.1 Student Admissions
- Navigate to **Students** > **New Student**.
- Fill in biographical details, guardian information, and emergency contact numbers.
- Assign the student to an Academic Session, Class, and Section.
- A permanent sequential ID (`STD-YYYY-XXXX`) is assigned automatically.

### 3.2 Teachers & Staff
- Navigate to **Staff / Teachers**.
- Register faculty with designations, joining dates, and qualifications.

---

## 4. Daily Attendance

1. Navigate to **Attendance**.
2. Select the **Academic Session**, **Class**, **Section**, and **Date**.
3. Mark attendance status: **Present**, **Absent**, **Late**, **Half Day**, or **Leave**.
4. Click **Save Attendance**. The system computes real-time percentages and daily summaries.

---

## 5. Fees & Invoicing

### 5.1 Fee Structures & Periods
- Define fee types (Tuition Fee, Admission Fee, Examination Fee) in **Fees** > **Fee Types**.
- Create fee structures specifying standard amounts for classes.
- Define billing periods (e.g., `September 2025`).

### 5.2 Generating Fees & Recording Payments
- Generate fee slips for entire classes with a single click.
- Search for a student in **Fee Collection**.
- Collect full or partial payments.
- Print or export official fee receipts (`REC-YYYY-XXXXXX`).

---

## 6. Examinations, Marks & Dynamic DMC

### 6.1 Creating Examinations
- Navigate to **Examinations**.
- Create an exam (e.g., `Midterm Examination 2025`).
- Configure subjects with maximum marks and passing thresholds.

### 6.2 Marks Entry & Result Calculation
- Enter subject marks per student.
- Click **Calculate Results** to evaluate total marks, percentages, grades, and pass/fail statuses according to institutional grading rules.

### 6.3 Dynamic DMC Generation
- Select any student to generate an instant Detailed Marks Certificate (DMC).
- The DMC automatically prints only the subjects assigned to that student's specific class, formatted with institutional branding and head signatures.

---

## 7. Official Documents & Reports

### 7.1 Student Certificates
- Navigate to **Documents**.
- Select a student and generate:
  - **Bonafide / Student Certificate**
  - **Character Certificate**
  - **School Leaving / Transfer Certificate**
  - **General Certificate**
- Documents are issued with unique sequential numbers (`DOC-YYYY-XXXXXX`) and recorded in the audit history.

### 7.2 Administrative Reports
- Navigate to **Reports** to view and print:
  - Student Directory and Class Demographics
  - Attendance Registers and Defaulter Lists
  - Fee Collection and Outstanding Dues Ledgers
  - Class Result Gazette Sheets

---

## 8. Student Promotion & Academic Progression

1. At the conclusion of an academic year, go to **Students** > **Student Promotion**.
2. Select the **Source Session & Class** and **Destination Session & Class**.
3. The promotion table displays each student's attendance percentage, exam result, and recommended action.
4. Set action per student: **Promote**, **Retain**, **Graduate**, **Transfer**, or **Left**.
5. Click **Confirm & Execute Promotion**.
6. The system archives the previous enrollment as inactive and creates a new enrollment, while preserving the student's permanent ID and history.

---

## 9. Backup, Disaster Recovery & Offline Licensing

### 9.1 Creating & Restoring Backups
- Navigate to **Settings** > **Backup & Restore**.
- Click **Create Backup** to generate a single-file encrypted backup package (`.smbak`).
- In case of hardware replacement or disaster recovery, select **Restore Backup** and select your `.smbak` file.
- The system automatically validates SHA-256 checksums and creates a safety snapshot before applying.

### 9.2 Offline License Activation
- Navigate to **Settings** > **License**.
- Provide the displayed **Installation ID** to your software provider.
- Paste the signed offline license key provided by your vendor and click **Activate License**.
- The system validates the Ed25519 signature and activates without requiring internet access.
