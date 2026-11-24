/**
 * printIDCards Utility
 * 
 * Prepares and executes high-fidelity A4 portrait printing and PDF export
 * for CR80 standard student identity cards.
 */

export interface PrintIDCardsOptions {
  onBeforePrint?: () => Promise<void> | void;
  onAfterPrint?: () => void;
  timeoutMs?: number;
}

export interface ExportIDCardsPDFOptions {
  defaultFileName?: string;
  onBeforeExport?: () => Promise<void> | void;
  onAfterExport?: () => void;
  timeoutMs?: number;
}

/**
 * Preload and decode all images inside .id-card-item elements before printing or exporting.
 */
export async function waitForIDCardImages(timeoutMs = 2500): Promise<void> {
  await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 50)));

  const images = Array.from(
    document.querySelectorAll('.id-card-sheet img')
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
 * Injects a temporary <style> tag ensuring @page A4 portrait with 8mm margins.
 */
function injectA4PrintStyle(): HTMLStyleElement {
  let styleEl = document.getElementById('id-cards-print-active-page') as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'id-cards-print-active-page';
    styleEl.innerHTML = `@page { size: A4 portrait !important; margin: 6mm 8mm !important; }`;
    document.head.appendChild(styleEl);
  }
  return styleEl;
}

function removeA4PrintStyle(): void {
  const styleEl = document.getElementById('id-cards-print-active-page');
  if (styleEl && styleEl.parentNode) {
    styleEl.parentNode.removeChild(styleEl);
  }
}

/**
 * Triggers standard browser/Electron printing for student ID cards.
 */
export async function printIDCards(options?: PrintIDCardsOptions): Promise<void> {
  if (options?.onBeforePrint) {
    try {
      await options.onBeforePrint();
    } catch (err) {
      console.warn('Error in onBeforePrint:', err);
    }
  }

  await waitForIDCardImages(options?.timeoutMs || 2500);

  injectA4PrintStyle();
  document.body.classList.add('printing-id-cards');

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    document.body.classList.remove('printing-id-cards');
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
 * Exports ID cards sheet(s) directly to PDF using Electron IPC or browser fallback.
 */
export async function exportIDCardsPDF(
  options?: ExportIDCardsPDFOptions
): Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }> {
  if (options?.onBeforeExport) {
    try {
      await options.onBeforeExport();
    } catch (err) {
      console.warn('Error in onBeforeExport:', err);
    }
  }

  await waitForIDCardImages(options?.timeoutMs || 2500);

  injectA4PrintStyle();
  document.body.classList.add('printing-id-cards');

  try {
    if (window.electronAPI?.exportPDF) {
      const res = await window.electronAPI.exportPDF({
        defaultFileName: options?.defaultFileName || 'Student_ID_Cards.pdf',
      });
      return res;
    } else {
      window.print();
      return { success: true };
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to export PDF';
    console.error('exportIDCardsPDF Error:', err);
    return { success: false, error: errorMsg };
  } finally {
    document.body.classList.remove('printing-id-cards');
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
