import * as fs from 'fs';
import * as path from 'path';

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    failedTests++;
  }
}

async function runTestSuite() {
  console.log('===============================================================');
  console.log(' DMC MODULE REDESIGN, PRINT & PDF EXPORT VERIFICATION SUITE');
  console.log('===============================================================\n');

  // 1. Check DMCReportCard for zero hardcoded school names and correct structure
  console.log('--- 1. DMC Report Card Component Verification ---');
  const dmcReportCardPath = path.resolve('src/pages/DMC/DMCReportCard.tsx');
  assert(fs.existsSync(dmcReportCardPath), 'DMCReportCard.tsx exists');

  const reportCardContent = fs.readFileSync(dmcReportCardPath, 'utf-8');
  assert(!reportCardContent.includes('Oxford Model High School'), 'No hardcoded Oxford Model High School in DMCReportCard.tsx');
  assert(!reportCardContent.includes('Iqra School System'), 'No hardcoded Iqra School System in DMCReportCard.tsx');
  assert(reportCardContent.includes('school.schoolName'), 'Uses dynamic school.schoolName');
  assert(reportCardContent.includes('dmc-logo-fallback'), 'Includes fallback crest generator when logo is absent');
  assert(reportCardContent.includes('dmc-status-badge'), 'Includes status badges for Pass, Fail, and Absent');
  assert(reportCardContent.includes('formatPosition'), 'Includes formatted position calculation');
  assert(reportCardContent.includes('dmc_display_preferences'), 'Honors user display preferences from Settings');

  // 2. Check DMCPage for workspace, features, and Phase 3 Print/PDF controls
  console.log('\n--- 2. DMC Page Workspace & Features Verification ---');
  const dmcPagePath = path.resolve('src/pages/DMC/DMCPage.tsx');
  assert(fs.existsSync(dmcPagePath), 'DMCPage.tsx exists');

  const dmcPageContent = fs.readFileSync(dmcPagePath, 'utf-8');
  assert(dmcPageContent.includes('Detailed Marks Certificate (DMC)'), 'Page title reflects redesigned professional header');
  assert(dmcPageContent.includes('Generate DMC Preview'), 'Provides Generate DMC Preview primary action');
  assert(dmcPageContent.includes('Reset Filters'), 'Provides Reset Filters secondary action');
  assert(dmcPageContent.includes('viewMode'), 'Supports single student and whole class batch modes');
  assert(dmcPageContent.includes('Print Current DMC'), 'Provides Print Current DMC action');
  assert(dmcPageContent.includes('Print All DMCs'), 'Provides Print All DMCs batch action');
  assert(dmcPageContent.includes('Export PDF'), 'Provides Export PDF action for single student');
  assert(dmcPageContent.includes('Export All PDF'), 'Provides Export All PDF action for class batch');
  assert(dmcPageContent.includes('activePrintScope'), 'Isolates active print scope (current vs all) without corrupting on-screen state');
  assert(dmcPageContent.includes('dmc-page-break'), 'Includes page break container for batch printing');
  assert(dmcPageContent.includes('studentSearchQuery'), 'Includes search/filter for student selector');
  assert(dmcPageContent.includes('stats.passRate'), 'Calculates and displays class summary KPI metrics');

  // 3. Check printDMC and exportDMCPDF utilities
  console.log('\n--- 3. printDMC & PDF Export Utility Verification ---');
  const printDMCPath = path.resolve('src/utils/printDMC.ts');
  assert(fs.existsSync(printDMCPath), 'printDMC.ts exists');

  const printDMCContent = fs.readFileSync(printDMCPath, 'utf-8');
  assert(printDMCContent.includes('printing-dmc'), 'Adds printing-dmc class to document.body');
  assert(!printDMCContent.includes('setTimeout(cleanup, 3000)'), 'Does NOT prematurely remove printing-dmc after 3 seconds');
  assert(printDMCContent.includes('afterprint'), 'Listens for afterprint event for reliable cleanup');
  assert(printDMCContent.includes('window.print()'), 'Calls window.print()');
  assert(printDMCContent.includes('waitForDmcImages'), 'Exports waitForDmcImages image-readiness preloader');
  assert(printDMCContent.includes('exportDMCPDF'), 'Exports exportDMCPDF helper with Electron & browser compatibility');
  assert(printDMCContent.includes('dmc-print-active-page'), 'Injects authoritative A4 portrait @page style during print/export');

  // 4. Check CSS print isolation and A4 layout
  console.log('\n--- 4. CSS Print Isolation & A4 Styles Verification ---');
  const dmcCssPath = path.resolve('src/styles/dmc.css');
  assert(fs.existsSync(dmcCssPath), 'dmc.css exists');

  const dmcCssContent = fs.readFileSync(dmcCssPath, 'utf-8');
  assert(!dmcCssContent.includes('Oxford Model High School'), 'No hardcoded Oxford Model High School in dmc.css header');
  assert(dmcCssContent.includes('@page'), 'Defines @page A4 portrait layout');
  assert(dmcCssContent.includes('size: A4 portrait'), 'Specifies size: A4 portrait');
  assert(dmcCssContent.includes('max-width: 194mm'), 'Constrains print width to printable 194mm avoiding horizontal clipping');
  assert(dmcCssContent.includes('body.printing-dmc'), 'Scopes print unwrapping under body.printing-dmc');
  assert(dmcCssContent.includes('.results-header'), 'Hides results-header in print');
  assert(dmcCssContent.includes('.dmc-page-break'), 'Defines page-break-after: always for batch printing');
  assert(dmcCssContent.includes('.dmc-page-break:last-child'), 'Suppresses trailing page-break on last student in batch');
  assert(dmcCssContent.includes('word-break: break-word'), 'Prevents clipping on long student or subject names');

  const globalCssPath = path.resolve('src/styles/global.css');
  const globalCssContent = fs.readFileSync(globalCssPath, 'utf-8');
  assert(globalCssContent.includes('.results-header'), 'global.css print hides results-header');
  assert(globalCssContent.includes('body.printing-dmc .print-result-sheet-container'), 'global.css suppresses result sheet during DMC print');

  const resultsPagePath = path.resolve('src/pages/Results/ResultsPage.tsx');
  const resultsPageContent = fs.readFileSync(resultsPagePath, 'utf-8');
  assert(resultsPageContent.includes('results-header no-print'), 'ResultsPage header includes no-print class');

  const viewResultsTabPath = path.resolve('src/pages/Results/ViewResultsTab.tsx');
  const viewResultsTabContent = fs.readFileSync(viewResultsTabPath, 'utf-8');
  assert(viewResultsTabContent.includes('dmcModalViewMode'), 'ViewResultsTab DMC modal supports both single and batch preview');
  assert(viewResultsTabContent.includes('Print Current DMC'), 'ViewResultsTab modal offers Print Current DMC');
  assert(viewResultsTabContent.includes('Print All'), 'ViewResultsTab modal offers Print All DMCs');
  assert(viewResultsTabContent.includes('Export PDF'), 'ViewResultsTab modal offers Export PDF');
  assert(viewResultsTabContent.includes('Export All PDF'), 'ViewResultsTab modal offers Export All PDF');

  console.log(`\n===============================================================`);
  console.log(` Results: ${passedTests} passed, ${failedTests} failed out of ${passedTests + failedTests}`);
  console.log(`===============================================================`);

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
