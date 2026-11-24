import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

console.log('app is defined:', Boolean(app));
if (app) {
  try {
    console.log('app.getPath("userData"):', app.getPath('userData'));
  } catch (e) {
    console.log('app.getPath("userData") threw:', e.message);
  }
}
