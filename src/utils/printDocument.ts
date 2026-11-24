/**
 * printDocument Utility
 * 
 * Safely prepares official student certificates for printing and PDF export:
 * 1. Preloads and decodes school crest and student passport photos.
 * 2. Injects authoritative A4 portrait @page styling into <head>.
 * 3. Adds the `printing-document` class to <body> to isolate the single-page A4 certificate.
 * 4. Triggers window.print() or invokes window.electronAPI.exportPDF().
 * 5. Cleans up temporary classes and styles upon completion or cancellation.
 */

export interface PrintDocumentOptions {
  onBeforePrint?: () => Promise<void> | void;
  onAfterPrint?: () => void;
  timeoutMs?: number;
}

export interface ExportDocumentPDFOptions {
  defaultFileName?: string;
  onBeforeExport?: () => Promise<void> | void;
  onAfterExport?: () => void;
  timeoutMs?: number;
}

/**
 * Preload and decode all images in .cert-document elements before printing or exporting.
 */
export async function waitForCertImages(timeoutMs = 2500): Promise<void> {
  // Allow React to commit any pending DOM nodes
  await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 50)));

  const images = Array.from(
    document.querySelectorAll('.cert-document img')
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

      if (img.complete && img.naturalWidth > 0) {
        if ('decode' in img && typeof img.decode === 'function') {
          img.decode().then(finish).catch(finish);
          return;
        }
        finish();
        return;
      }

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
  await new Promise((resolve) => requestAnimationFrame(resolve));
}

/**
 * Injects a temporary <style> tag ensuring @page A4 portrait with standard 8mm margins.
 */
function injectA4PrintStyle(): HTMLStyleElement {
  let styleEl = document.getElementById('cert-print-active-page') as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'cert-print-active-page';
    styleEl.innerHTML = `@page { size: A4 portrait !important; margin: 8mm 8mm 8mm 8mm !important; }`;
    document.head.appendChild(styleEl);
  }
  return styleEl;
}

function removeA4PrintStyle(): void {
  const styleEl = document.getElementById('cert-print-active-page');
  if (styleEl && styleEl.parentNode) {
    styleEl.parentNode.removeChild(styleEl);
  }
}

/**
 * Triggers standard browser printing for official certificates with image preloading and state isolation.
 */
export async function printCertificate(options?: PrintDocumentOptions): Promise<void> {
  if (options?.onBeforePrint) {
    try {
      await options.onBeforePrint();
    } catch (err) {
      console.warn('Error in onBeforePrint:', err);
    }
  }

  await waitForCertImages(options?.timeoutMs || 2500);

  injectA4PrintStyle();
  document.body.classList.add('printing-document');

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    document.body.classList.remove('printing-document');
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
    setTimeout(cleanup, 400);
  };

  window.addEventListener('afterprint', cleanup);
  window.addEventListener('focus', onFocus);

  setTimeout(() => {
    window.print();
    setTimeout(cleanup, 60000);
  }, 100);
}

/**
 * Exports certificate directly to PDF using Electron IPC with offline capability.
 */
export async function exportCertificatePDF(
  options?: ExportDocumentPDFOptions
): Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }> {
  if (options?.onBeforeExport) {
    try {
      await options.onBeforeExport();
    } catch (err) {
      console.warn('Error in onBeforeExport:', err);
    }
  }

  await waitForCertImages(options?.timeoutMs || 2500);

  injectA4PrintStyle();
  document.body.classList.add('printing-document');

  try {
    if (window.electronAPI?.exportPDF) {
      const res = await window.electronAPI.exportPDF({
        defaultFileName: options?.defaultFileName || 'Student_Certificate.pdf',
      });
      return res;
    } else {
      window.print();
      return { success: true };
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to export PDF';
    console.error('exportCertificatePDF Error:', err);
    return { success: false, error: errorMsg };
  } finally {
    document.body.classList.remove('printing-document');
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
