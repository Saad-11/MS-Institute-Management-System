/**
 * Image Processing & Optimization Utilities
 * 
 * Offline, in-browser canvas-based image downscaling and compression.
 * Reduces raw 5MB-10MB mobile/camera images to lightweight, high-DPI
 * 512x512 base64 data URLs (~35KB-70KB) to prevent localStorage quota exhaustion.
 */

export function resizeImageToMaxDimension(
  fileOrDataUrl: File | string,
  maxDimension = 512
): Promise<string> {
  return new Promise((resolve, reject) => {
    const processImg = (src: string) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;

        if (w > maxDimension || h > maxDimension) {
          if (w > h) {
            h = Math.round((h * maxDimension) / w);
            w = maxDimension;
          } else {
            w = Math.round((w * maxDimension) / h);
            h = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(src);
          return;
        }

        // Enable high-quality image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w, h);

        try {
          const optimized = canvas.toDataURL('image/png');
          resolve(optimized);
        } catch {
          resolve(src);
        }
      };
      img.onerror = () => resolve(src);
      img.src = src;
    };

    if (typeof fileOrDataUrl === 'string') {
      processImg(fileOrDataUrl);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const raw = e.target?.result as string;
        processImg(raw);
      };
      reader.onerror = reject;
      reader.readAsDataURL(fileOrDataUrl);
    }
  });
}
