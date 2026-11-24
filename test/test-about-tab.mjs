import * as path from 'path';
import * as fs from 'fs';

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

console.log('====================================================');
console.log('   About Software Tab UI/UX Verification Suite      ');
console.log('====================================================\n');

try {
  // ─── 1. Inspect AboutTab.tsx Content & Requirements ───────────
  console.log('--- 1. Inspect AboutTab.tsx Content & Requirements ---');
  const aboutPath = path.resolve('src/pages/Settings/AboutTab.tsx');
  assert(fs.existsSync(aboutPath), 'AboutTab.tsx exists');
  const code = fs.readFileSync(aboutPath, 'utf-8');

  // A. Software Information Header
  assert(code.includes('MS Institute Management System'), 'Application name is "MS Institute Management System"');
  assert(code.includes('A complete offline solution for modern educational institutions.'), 'Description matches exactly');
  assert(code.includes('v{appVersion}'), 'Version number displayed dynamically using state/API');
  assert(code.includes('window.electronAPI.getAppInfo') || code.includes('electronAPI?.getAppInfo'), 'Queries electronAPI.getAppInfo for dynamic versioning');

  // B. Developer Information Card
  assert(code.includes('Muhammad Saad'), 'Developer Name is "Muhammad Saad"');
  assert(code.includes('Software Developer'), 'Developer Designation is "Software Developer"');
  assert(code.includes('03159928851'), 'Mobile number is "03159928851"');
  assert(code.includes('ms.muhammadsaad1999@gamil.com'), 'Email is "ms.muhammadsaad1999@gamil.com"');

  // C. Email Information Correction & Single Display Check
  const oldEmail1 = 'muhammadsaad.se@outlook.com';
  const oldEmail2 = 'sk8731247@gmail.com';
  assert(!code.includes(oldEmail1), `Old email 1 (${oldEmail1}) is completely removed`);
  assert(!code.includes(oldEmail2), `Old email 2 (${oldEmail2}) is completely removed`);

  // Count occurrences of ms.muhammadsaad1999@gamil.com
  const emailRegex = /ms\.muhammadsaad1999@gamil\.com/g;
  const emailMatches = code.match(emailRegex) || [];
  assert(emailMatches.length === 1, `The new email appears exactly once (found: ${emailMatches.length})`);

  // D. Icons & Layout Elements
  assert(code.includes('<Phone') && code.includes('<Mail'), 'Uses local Phone and Mail icons');
  assert(code.includes('Software Notes'), 'Software Notes card exists');
  assert(code.includes('All data is stored locally'), 'Note 1 (100% local data) preserved');
  assert(code.includes('Designed for ease of use'), 'Note 2 (user ease) preserved');
  assert(code.includes('contact the developer above'), 'Note 3 (support contact) preserved');

  // ─── 2. Inspect AboutTab.css Styles ───────────────────────────
  console.log('\n--- 2. Inspect AboutTab.css Styles ---');
  const cssPath = path.resolve('src/pages/Settings/AboutTab.css');
  assert(fs.existsSync(cssPath), 'AboutTab.css exists');
  const css = fs.readFileSync(cssPath, 'utf-8');

  assert(css.includes('.about-tab'), 'Scoped to .about-tab container');
  assert(css.includes('.about-header-card'), 'Contains .about-header-card styling');
  assert(css.includes('.about-contact-grid'), 'Contains 2-column balanced .about-contact-grid');
  assert(css.includes('.about-notes-grid'), 'Contains .about-notes-grid');
  assert(css.includes('@media (max-width:'), 'Contains responsive media queries for smaller window sizes');

  // ─── 3. Offline Compatibility Check ───────────────────────────
  console.log('\n--- 3. Offline Compatibility Check ---');
  assert(!code.includes('http://') && !code.includes('https://'), 'AboutTab.tsx contains zero external HTTP/HTTPS resources');
  assert(!css.includes('@import') && !css.includes('http://') && !css.includes('https://'), 'AboutTab.css contains zero external font or stylesheet imports');

  // ─── 4. Isolation Check (Other Settings Tabs Untouched) ────────
  console.log('\n--- 4. Isolation Check ---');
  const schoolSettingsPath = path.resolve('src/pages/Settings/SchoolSettingsTab.tsx');
  const schoolSettingsCode = fs.readFileSync(schoolSettingsPath, 'utf-8');
  assert(schoolSettingsCode.includes('Institution Identity') && schoolSettingsCode.includes('Signature Picture of Principal'), 'SchoolSettingsTab.tsx preserved untouched');

  const sessionsTabPath = path.resolve('src/pages/Settings/AcademicSessionsTab.tsx');
  const sessionsCode = fs.readFileSync(sessionsTabPath, 'utf-8');
  assert(sessionsCode.includes('Academic Sessions'), 'AcademicSessionsTab.tsx preserved untouched');

  console.log('\n====================================================');
  console.log(`Test Results: ${passed} passed, ${failed} failed.`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
} catch (err) {
  console.error('Test execution failed:', err);
  process.exit(1);
}
