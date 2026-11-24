import Database from 'better-sqlite3';
import { runMigrations } from '../dist-electron/database/migrations.js';
import { createInitialAdmin, login } from '../dist-electron/database/services/auth.service.js';
import {
  getAllGradingRules,
  saveGradingRule,
  deleteGradingRule,
  evaluateGrade,
} from '../dist-electron/database/services/exam.service.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function runSettingsTestSuite() {
  console.log('\n===============================================================');
  console.log(' RESULT & GRADING SETTINGS: COMPREHENSIVE VERIFICATION SUITE');
  console.log('===============================================================\n');

  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');

  // 1. Database Migrations
  const migrationRes = runMigrations(db);
  assert(migrationRes.appliedCount >= 6, 'Database migrations applied successfully');

  // 2. Auth Setup
  createInitialAdmin({ username: 'admin', displayName: 'System Admin', password: 'Password123!' }, db);
  const loginRes = login({ username: 'admin', password: 'Password123!' }, db);
  assert(loginRes.success && Boolean(loginRes.sessionToken), 'Admin authentication verified');
  const token = loginRes.sessionToken;

  // 3. Initial Rules from Migrations
  const initialRules = getAllGradingRules(db);
  assert(initialRules.length === 7, `Initial grading scale contains 7 default levels (Found: ${initialRules.length})`);

  // Verify A+ rule
  const ruleAPlus = initialRules.find((r) => r.grade === 'A+');
  assert(ruleAPlus && ruleAPlus.minPercentage === 90 && ruleAPlus.maxPercentage === 100, 'A+ rule correctly spans 90%–100%');

  // 4. Test evaluateGrade with existing scale
  const res100 = evaluateGrade(100, undefined, db);
  assert(res100.grade === 'A+' && res100.gradePoint === 4.0, '100% correctly evaluates to A+ (4.0)');

  const res85 = evaluateGrade(85.5, undefined, db);
  assert(res85.grade === 'A' && res85.gradePoint === 3.7, '85.5% correctly evaluates to A (3.7)');

  const res72 = evaluateGrade(72.0, undefined, db);
  assert(res72.grade === 'B' && res72.gradePoint === 3.0, '72.0% correctly evaluates to B (3.0)');

  const res45 = evaluateGrade(45.0, undefined, db);
  assert(res45.grade === 'E' && res45.gradePoint === 1.0, '45.0% correctly evaluates to E (1.0)');

  const res25 = evaluateGrade(25.0, undefined, db);
  assert(res25.grade === 'F' && res25.gradePoint === 0.0, '25.0% correctly evaluates to F (0.0)');

  // 5. Validation Rejections: Invalid Inputs
  const invalidMinMax = saveGradingRule({
    sessionToken: token,
    name: 'Invalid Test',
    minPercentage: 90,
    maxPercentage: 80,
    grade: 'INV',
    gradePoint: 2.0,
  }, db);
  assert(!invalidMinMax.success, 'Rejected rule where minPercentage > maxPercentage');

  const invalidNegative = saveGradingRule({
    sessionToken: token,
    name: 'Negative Test',
    minPercentage: -5,
    maxPercentage: 50,
    grade: 'NEG',
    gradePoint: 1.0,
  }, db);
  assert(!invalidNegative.success, 'Rejected rule where minPercentage is negative');

  const invalidOver100 = saveGradingRule({
    sessionToken: token,
    name: 'Over 100 Test',
    minPercentage: 50,
    maxPercentage: 105,
    grade: 'OVR',
    gradePoint: 1.0,
  }, db);
  assert(!invalidOver100.success, 'Rejected rule where maxPercentage exceeds 100');

  const missingGrade = saveGradingRule({
    sessionToken: token,
    name: 'No Grade',
    minPercentage: 50,
    maxPercentage: 60,
    grade: '',
    gradePoint: 1.0,
  }, db);
  assert(!missingGrade.success, 'Rejected rule with empty grade symbol');

  // 6. Overlap Detection Logic (as implemented in ResultSettingsTab)
  function checkOverlap(minPct, maxPct, rules, currentId) {
    for (const other of rules) {
      if (other.id === currentId) continue;
      const overlapStart = Math.max(minPct, other.minPercentage);
      const overlapEnd = Math.min(maxPct, other.maxPercentage);
      if (overlapStart < overlapEnd) {
        return { overlaps: true, conflictingRule: other.name };
      }
    }
    return { overlaps: false };
  }

  const overlapCheck1 = checkOverlap(85, 95, initialRules);
  assert(overlapCheck1.overlaps, `Detected overlap for [85, 95] with existing rules (conflicts with: ${overlapCheck1.conflictingRule})`);

  const overlapCheck2 = checkOverlap(80, 89.99, initialRules, 2); // Rule 2 is A (80-89.99), editing itself
  assert(!overlapCheck2.overlaps, 'Editing rule does not falsely report overlap against itself');

  // 7. Edit Existing Grade Rule
  const updateRes = saveGradingRule({
    sessionToken: token,
    id: 1, // A+
    name: 'A+ (Super Outstanding)',
    minPercentage: 90,
    maxPercentage: 100,
    grade: 'A+',
    gradePoint: 4.0,
    remarks: 'Supreme Distinction',
    displayOrder: 1,
  }, db);
  assert(updateRes.success, 'Successfully updated existing grade rule A+');
  assert(updateRes.rule?.name === 'A+ (Super Outstanding)', 'Updated rule name persists');
  assert(updateRes.rule?.remarks === 'Supreme Distinction', 'Updated remarks persist');

  // 8. Add a New Custom Grade Rule
  const addRes = saveGradingRule({
    sessionToken: token,
    name: 'Distinction Honor',
    minPercentage: 98,
    maxPercentage: 100,
    grade: 'A*',
    gradePoint: 4.5,
    remarks: 'High Honor',
    displayOrder: 0,
  }, db);
  assert(addRes.success, 'Saved new grade rule in database');
  assert(addRes.rule?.id > 0, 'New rule assigned auto-increment primary key');

  // 9. Delete Rule
  const deleteRes = deleteGradingRule({ sessionToken: token, id: addRes.rule.id }, db);
  assert(deleteRes.success, 'Successfully deleted test grading rule');

  const afterDelete = getAllGradingRules(db);
  assert(afterDelete.length === 7, 'Grading rules count returned to 7 after deletion');

  // 10. Verify Security: Unauthorized without token
  const unauth = saveGradingRule({
    sessionToken: 'invalid_token',
    name: 'Hacker Rule',
    minPercentage: 10,
    maxPercentage: 20,
    grade: 'HCK',
  }, db);
  assert(!unauth.success, 'Unauthorized user blocked from saving grading rules');

  const unauthDel = deleteGradingRule({ sessionToken: 'invalid_token', id: 1 }, db);
  assert(!unauthDel.success, 'Unauthorized user blocked from deleting grading rules');

  db.close();

  console.log('\n===============================================================');
  console.log(` RESULTS: ${passed} passed, ${failed} failed out of ${passed + failed}`);
  console.log('===============================================================\n');

  if (failed > 0) process.exit(1);
}

runSettingsTestSuite().catch((err) => {
  console.error(err);
  process.exit(1);
});
