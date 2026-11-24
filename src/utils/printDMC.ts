/**
 * printDMC Utility
 * 
 * Safely prepares the document for Detailed Marks Certificate (DMC) printing and PDF export:
 * 1. Preloads and decodes visible crests and student photos without stalling on missing assets.
 * 2. Injects authoritative A4 portrait @page styling into <head>.
 * 3. Adds the `printing-dmc` class to <body> to trigger isolated single/multi-page A4 print styles.
 * 4. Triggers window.print() or invokes window.electronAPI.exportPDF().
 * 5. Reliably restores normal application state when the print dialog completes or cancels.
 */

export interface PrintDMCOptions {
  onBeforePrint?: () => Promise<void> | void;
  onAfterPrint?: () => void;
  timeoutMs?: number;
}

export interface ExportDMCPDFOptions {
  defaultFileName?: string;
  onBeforeExport?: () => Promise<void> | void;
  onAfterExport?: () => void;
  timeoutMs?: number;
}

/**
 * Preload and decode all images in .dmc-document elements before printing or exporting.
 */
export async function waitForDmcImages(timeoutMs = 2500): Promise<void> {
  // Allow React to commit any pending DOM nodes
  await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 50)));

  const images = Array.from(
    document.querySelectorAll('.dmc-document img')
  ) as HTMLImageElement[];

  if (images.length === 0) return;

  const decodePromises = images.map((img) => {
    return new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };

      // Already loaded and has dimensions
      if (img.complete && img.naturalWidth > 0) {
        if ('decode' in img && typeof img.decode === 'function') {
          img.decode().then(finish).catch(finish);
          return;
        }
        finish();
        return;
      }

      // If already failed or empty
      if (img.complete && img.naturalWidth === 0) {
        finish();
        return;
      }

      const timer = setTimeout(finish, timeoutMs);

      img.addEventListener(
        'load',
        () => {
          clearTimeout(timer);
          if ('decode' in img && typeof img.decode === 'function') {
            img.decode().then(finish).catch(finish);
          } else {
            finish();
          }
        },
        { once: true }
      );

      img.addEventListener(
        'error',
        () => {
          clearTimeout(timer);
          finish();
        },
        { once: true }
      );
    });
  });

  await Promise.all(decodePromises);

  // Final flush for browser layout recalculation
  await new Promise((resolve) => requestAnimationFrame(resolve));
}

/**
 * Injects a temporary <style> tag ensuring @page A4 portrait with standard 8mm margins.
 */
function injectA4PrintStyle(): HTMLStyleElement {
  let styleEl = document.getElementById('dmc-print-active-page') as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'dmc-print-active-page';
    styleEl.innerHTML = `@page { size: A4 portrait !important; margin: 8mm 8mm 8mm 8mm !important; }`;
    document.head.appendChild(styleEl);
  }
  return styleEl;
}

function removeA4PrintStyle(): void {
  const styleEl = document.getElementById('dmc-print-active-page');
  if (styleEl && styleEl.parentNode) {
    styleEl.parentNode.removeChild(styleEl);
  }
}

/**
 * Triggers standard browser printing for DMC with robust image preloading and state isolation.
 */
export async function printDMC(options?: PrintDMCOptions): Promise<void> {
  // 1. Run before-print hook if provided
  if (options?.onBeforePrint) {
    try {
      await options.onBeforePrint();
    } catch (err) {
      console.warn('Error in onBeforePrint:', err);
    }
  }

  // 2. Preload and decode images inside .dmc-document
  await waitForDmcImages(options?.timeoutMs || 2500);

  // 3. Inject authoritative A4 print style and add body class
  injectA4PrintStyle();
  document.body.classList.add('printing-dmc');

  // 4. Register cleanup handlers
  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    document.body.classList.remove('printing-dmc');
    removeA4PrintStyle();
    window.removeEventListener('afterprint', cleanup);
    window.removeEventListener('focus', onFocus);

    if (options?.onAfterPrint) {
      try {
        options.onAfterPrint();
      } catch (err) {
        console.warn('Error in onAfterPrint:', err);
      }
    }
  };

  const onFocus = () => {
    // When focus returns to window after print dialog, cleanup with small buffer
    setTimeout(cleanup, 400);
  };

  window.addEventListener('afterprint', cleanup);
  window.addEventListener('focus', onFocus);

  // 5. Trigger print after a brief render flush
  setTimeout(() => {
    window.print();
    // Safety fallback after 60s in case afterprint/focus don't fire
    setTimeout(cleanup, 60000);
  }, 100);
}

/**
 * Exports DMC certificate(s) directly to PDF using Electron IPC with offline capability.
 */
export async function exportDMCPDF(
  options?: ExportDMCPDFOptions
): Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }> {
  // 1. Run before-export hook if provided
  if (options?.onBeforeExport) {
    try {
      await options.onBeforeExport();
    } catch (err) {
      console.warn('Error in onBeforeExport:', err);
    }
  }

  // 2. Preload and decode images inside .dmc-document
  await waitForDmcImages(options?.timeoutMs || 2500);

  // 3. Inject authoritative A4 print style and add body class
  injectA4PrintStyle();
  document.body.classList.add('printing-dmc');

  try {
    if (window.electronAPI?.exportPDF) {
      const res = await window.electronAPI.exportPDF({
        defaultFileName: options?.defaultFileName || 'Detailed_Marks_Certificate.pdf',
      });
      return res;
    } else {
      // Running in browser outside Electron: trigger native print for Save as PDF
      window.print();
      return { success: true };
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to export PDF';
    console.error('exportDMCPDF Error:', err);
    return { success: false, error: errorMsg };
  } finally {
    document.body.classList.remove('printing-dmc');
    removeA4PrintStyle();

    if (options?.onAfterExport) {
      try {
        options.onAfterExport();
      } catch (err) {
        console.warn('Error in onAfterExport:', err);
      }
    }
  }
}
