const fs = require('fs');
const path = require('path');
const logFile = path.join(__dirname, 'electron_debug.log');
const log = (msg) => fs.appendFileSync(logFile, new Date().toISOString() + ' ' + msg + '\n');

log('=== STARTING TEST WRAPPER ===');

process.on('uncaughtException', (err) => {
  log('UNCAUGHT EXCEPTION: ' + (err ? err.stack || err.message : 'unknown'));
});

process.on('unhandledRejection', (reason) => {
  log('UNHANDLED REJECTION: ' + (reason ? reason.stack || reason : 'unknown'));
});

try {
  log('Requiring electron...');
  const { app } = require('electron');
  log('app name: ' + app.getName());
  log('app.isPackaged: ' + app.isPackaged);

  app.whenReady().then(() => {
    log('app.whenReady fired successfully');
    log('userData path: ' + app.getPath('userData'));
    
    try {
      log('Requiring better-sqlite3...');
      const Database = require('better-sqlite3');
      log('better-sqlite3 required successfully!');
      
      const dbPath = path.join(app.getPath('userData'), 'test_debug.sqlite');
      log('Opening database at: ' + dbPath);
      const db = new Database(dbPath);
      log('Database open state: ' + db.open);
      
      db.exec('CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY)');
      log('Table created!');
      db.close();
      log('Database closed successfully.');
    } catch (dbErr) {
      log('DATABASE ERROR: ' + (dbErr ? dbErr.stack || dbErr.message : dbErr));
    }

    setTimeout(() => {
      log('Exiting cleanly...');
      app.quit();
    }, 500);
  });
} catch (topErr) {
  log('TOP LEVEL ERROR: ' + (topErr ? topErr.stack || topErr.message : topErr));
}
