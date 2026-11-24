/**
 * Monetary Calculation and Currency Formatting Utilities
 * 
 * CRITICAL RULE:
 * Never use JavaScript floating-point arithmetic for storing or calculating monetary values.
 * All monetary amounts are stored as exact integers in minor units (e.g. paisa, where 100 paisa = 1 PKR).
 * Example:
 *   Rs. 5,000.00 is stored as 500000 minor units.
 *   Rs. 250.50 is stored as 25050 minor units.
 */

export const DEFAULT_CURRENCY = 'PKR';
export const DEFAULT_CURRENCY_SYMBOL = 'Rs.';

/**
 * Converts a major unit currency amount (number or string, e.g. 1500 or "1500.50")
 * to integer minor units (paisa).
 * Uses string splitting to prevent IEEE 754 floating point precision errors (e.g. 0.1 + 0.2 !== 0.3).
 */
export function toMinorUnits(majorAmount: number | string | null | undefined): number {
  if (majorAmount === null || majorAmount === undefined) {
    return 0;
  }

  const str = String(majorAmount).trim();
  if (!str) return 0;

  // Handle negative sign
  const isNegative = str.startsWith('-');
  const cleanStr = isNegative ? str.slice(1) : str;

  // Remove commas or currency symbols if passed accidentally
  const sanitized = cleanStr.replace(/[^0-9.]/g, '');
  if (!sanitized) return 0;

  const parts = sanitized.split('.');
  const wholePart = parts[0] || '0';
  let decimalPart = parts[1] || '';

  // Limit or pad to exactly 2 decimal places
  if (decimalPart.length > 2) {
    decimalPart = decimalPart.slice(0, 2);
  } else {
    decimalPart = decimalPart.padEnd(2, '0');
  }

  const wholeInt = parseInt(wholePart, 10) || 0;
  const decInt = parseInt(decimalPart, 10) || 0;

  const total = wholeInt * 100 + decInt;
  return isNegative ? -total : total;
}

/**
 * Converts integer minor units (paisa) back to a decimal number or display string.
 * Example: 25050 -> "250.50"
 */
export function toMajorUnits(minorUnits: number | null | undefined): string {
  if (minorUnits === null || minorUnits === undefined || isNaN(minorUnits)) {
    return '0.00';
  }

  const isNegative = minorUnits < 0;
  const abs = Math.abs(Math.round(minorUnits));

  const whole = Math.floor(abs / 100);
  const fraction = abs % 100;

  const formattedFraction = fraction < 10 ? `0${fraction}` : `${fraction}`;
  return `${isNegative ? '-' : ''}${whole}.${formattedFraction}`;
}

/**
 * Formats minor units (paisa) into a standard localized currency string.
 * Example: 500000 -> "Rs. 5,000.00"
 */
export function formatMoney(
  minorUnits: number | null | undefined,
  symbol: string = DEFAULT_CURRENCY_SYMBOL
): string {
  if (minorUnits === null || minorUnits === undefined || isNaN(minorUnits)) {
    return `${symbol} 0.00`;
  }

  const isNegative = minorUnits < 0;
  const abs = Math.abs(Math.round(minorUnits));

  const whole = Math.floor(abs / 100);
  const fraction = abs % 100;

  // Add thousand separators to whole part
  const wholeFormatted = whole.toLocaleString('en-US');
  const formattedFraction = fraction < 10 ? `0${fraction}` : `${fraction}`;

  return `${isNegative ? '-' : ''}${symbol} ${wholeFormatted}.${formattedFraction}`;
}

/**
 * Safely calculates net payable fee in minor units:
 * Net Amount = Original Amount - Discount + Fine
 * 
 * Rules:
 * 1. Discount cannot make the net amount negative (capped at originalAmount + fine, or 0 if full waiver).
 * 2. Fine is additive.
 * 3. All operations strictly in integer minor units.
 */
export function calculateNetFee(
  originalAmount: number,
  discount: number = 0,
  fine: number = 0
): {
  netAmount: number;
  discountApplied: number;
} {
  const safeOriginal = Math.max(0, Math.round(originalAmount));
  const safeFine = Math.max(0, Math.round(fine));

  // Max allowed discount is originalAmount (or original + fine if full waiver)
  const maxDiscount = safeOriginal + safeFine;
  const safeDiscount = Math.min(Math.max(0, Math.round(discount)), maxDiscount);

  const net = Math.max(0, safeOriginal - safeDiscount + safeFine);
  return {
    netAmount: net,
    discountApplied: safeDiscount,
  };
}

/**
 * Calculates discount amount in minor units from a percentage.
 * Example: original = 500000, 10% -> 50000 (Rs. 500.00)
 */
export function calculatePercentageDiscount(originalAmount: number, percentage: number): number {
  if (originalAmount <= 0 || percentage <= 0) return 0;
  const safePct = Math.min(100, Math.max(0, percentage));
  // Integer arithmetic: (original * pct) / 100
  return Math.round((originalAmount * safePct) / 100);
}

/**
 * Calculates remaining balance and financial status:
 * Remaining = Net Amount - Paid Amount
 */
export function calculateFeeStatus(
  netAmount: number,
  paidAmount: number,
  dueDate?: string,
  isWaived?: boolean,
  isCancelled?: boolean
): {
  remainingBalance: number;
  status: 'Unpaid' | 'Partially Paid' | 'Paid' | 'Waived' | 'Cancelled';
  isOverdue: boolean;
} {
  if (isCancelled) {
    return { remainingBalance: 0, status: 'Cancelled', isOverdue: false };
  }
  if (isWaived) {
    return { remainingBalance: 0, status: 'Waived', isOverdue: false };
  }

  const safeNet = Math.max(0, Math.round(netAmount));
  const safePaid = Math.max(0, Math.round(paidAmount));
  const remaining = Math.max(0, safeNet - safePaid);

  let isOverdue = false;
  if (dueDate && remaining > 0) {
    const todayStr = new Date().toISOString().split('T')[0];
    if (todayStr > dueDate) {
      isOverdue = true;
    }
  }

  let status: 'Unpaid' | 'Partially Paid' | 'Paid' = 'Unpaid';
  if (remaining === 0 && safeNet > 0) {
    status = 'Paid';
  } else if (safePaid > 0 && remaining > 0) {
    status = 'Partially Paid';
  } else {
    status = 'Unpaid';
  }

  return {
    remainingBalance: remaining,
    status,
    isOverdue,
  };
}

/**
 * Converts integer minor units (paisa) into English words for receipts and vouchers.
 * Example:
 *   500000 -> "Five Thousand Rupees Only"
 *   125050 -> "One Thousand Two Hundred Fifty Rupees and Fifty Paisa Only"
 */
export function amountToWords(
  minorUnits: number | null | undefined,
  currencyName: string = 'Rupees',
  subunitName: string = 'Paisa'
): string {
  if (minorUnits === null || minorUnits === undefined || isNaN(minorUnits)) {
    return `Zero ${currencyName} Only`;
  }

  const abs = Math.abs(Math.round(minorUnits));
  const whole = Math.floor(abs / 100);
  const fraction = abs % 100;

  if (whole === 0 && fraction === 0) {
    return `Zero ${currencyName} Only`;
  }

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = [
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertGroup(n: number): string {
    let str = '';
    if (n >= 100) {
      str += `${ones[Math.floor(n / 100)]} Hundred `;
      n %= 100;
    }
    if (n >= 10 && n <= 19) {
      str += `${teens[n - 10]} `;
    } else if (n >= 20) {
      str += `${tens[Math.floor(n / 10)]} `;
      if (n % 10 > 0) {
        str += `${ones[n % 10]} `;
      }
    } else if (n > 0) {
      str += `${ones[n]} `;
    }
    return str.trim();
  }

  function convertWhole(num: number): string {
    if (num === 0) return 'Zero';

    // Supports Billions, Millions, Thousands
    const billions = Math.floor(num / 1000000000);
    let rem = num % 1000000000;

    const millions = Math.floor(rem / 1000000);
    rem %= 1000000;

    const thousands = Math.floor(rem / 1000);
    const hundreds = rem % 1000;

    const parts: string[] = [];
    if (billions > 0) {
      parts.push(`${convertGroup(billions)} Billion`);
    }
    if (millions > 0) {
      parts.push(`${convertGroup(millions)} Million`);
    }
    if (thousands > 0) {
      parts.push(`${convertGroup(thousands)} Thousand`);
    }
    if (hundreds > 0) {
      parts.push(convertGroup(hundreds));
    }

    return parts.join(' ').trim();
  }

  let result = '';
  if (whole > 0) {
    result = `${convertWhole(whole)} ${currencyName}`;
  }

  if (fraction > 0) {
    const fractionWords = convertGroup(fraction);
    if (result) {
      result += ` and ${fractionWords} ${subunitName}`;
    } else {
      result = `${fractionWords} ${subunitName}`;
    }
  }

  return `${result} Only`;
}
