const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);

function validate(extractedData) {
  const normalizedData = JSON.parse(JSON.stringify(extractedData));
  const validationErrors = [];
  let score = 1.0;

  // STEP 1 — Detect missing fields
  const requiredFields = ['vendor_name', 'invoice_number', 'invoice_date', 'currency', 'total_amount'];
  const missingFields = requiredFields.filter(f => normalizedData[f] == null);

  // STEP 2 — Normalize invoice_date
  if (normalizedData.invoice_date) {
    const formats = ['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY', 'D MMM YYYY', 'MMM D YYYY', 'DD-MM-YYYY', 'MM-DD-YYYY'];
    const parsedDate = dayjs(normalizedData.invoice_date, formats, true);
    if (parsedDate.isValid()) {
      normalizedData.invoice_date = parsedDate.format('YYYY-MM-DD');
    } else {
      const parsedDateLenient = dayjs(normalizedData.invoice_date);
      if(parsedDateLenient.isValid()) {
        normalizedData.invoice_date = parsedDateLenient.format('YYYY-MM-DD');
      } else {
        validationErrors.push("invoice_date: unrecognized date format");
      }
    }
  }

  // STEP 3 — Normalize currency
  if (normalizedData.currency) {
    let curr = normalizedData.currency.toUpperCase().trim();
    const map = { "$": "USD", "€": "EUR", "£": "GBP", "₹": "INR" };
    normalizedData.currency = map[curr] || curr;
  }

  // STEP 4 — Validate line items sum
  let lineItemsSum = 0;
  if (Array.isArray(normalizedData.line_items)) {
    for (const item of normalizedData.line_items) {
      if (item.line_total != null) {
        lineItemsSum += Number(item.line_total);
      }
    }
  }

  let lineItemsSumMismatchError = false;
  if (lineItemsSum > 0 && normalizedData.total_amount != null) {
    const tolerance = Number(normalizedData.total_amount) * 0.01;
    if (Math.abs(lineItemsSum - Number(normalizedData.total_amount)) > tolerance) {
      validationErrors.push(`Line items sum (${lineItemsSum.toFixed(2)}) does not match total_amount (${Number(normalizedData.total_amount).toFixed(2)})`);
      lineItemsSumMismatchError = true;
    }
  }

  // STEP 5 — Confidence score
  score -= 0.15 * missingFields.length;
  if (lineItemsSumMismatchError) {
    score -= 0.10;
  }
  
  let incompleteLineItems = 0;
  if (Array.isArray(normalizedData.line_items)) {
    for (const item of normalizedData.line_items) {
      if (item.quantity == null || item.unit_price == null) {
        incompleteLineItems++;
      }
    }
  }
  score -= 0.05 * incompleteLineItems;
  score = Math.max(0, Math.min(1, score));

  const isValid = validationErrors.length === 0 && missingFields.length === 0;

  return {
    normalizedData,
    missingFields,
    validationErrors,
    confidenceScore: score,
    isValid
  };
}

module.exports = {
  validate
};