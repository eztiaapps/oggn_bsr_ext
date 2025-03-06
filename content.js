console.log("Content script loaded successfully!");

// Function to extract financial data
function extractFinancialData() {
  const extractedData = { profitLoss: {}, balanceSheet: {} };

  // Select Profit & Loss section
  const profitLossSection = document.querySelector("#profit-loss");
  if (profitLossSection) {
    extractedData.profitLoss.sales = extractRowData(profitLossSection, "Sales");
    extractedData.profitLoss.profitForEPS = extractRowData(profitLossSection, "Profit for EPS");
    extractedData.profitLoss.eps = extractRowData(profitLossSection, "EPS in Rs");
    extractedData.profitLoss.dividendPayout = extractRowData(profitLossSection, "Dividend Payout %");
    extractedData.profitLoss.depreciation = extractRowData(profitLossSection, "Depreciation");
  }

  // Select Balance Sheet section
  const balanceSheetSection = document.querySelector("#balance-sheet");
  if (balanceSheetSection) {
    extractedData.balanceSheet.fixedAssets = extractRowData(balanceSheetSection, "Fixed Assets");
  }

  // Extract periods (years/quarters)
  extractedData.periods = extractPeriods(profitLossSection);

  return extractedData;
}

/**
 * Extracts financial data row based on the keyword
 */
function extractRowData(section, keyword) {
  const row = Array.from(section.querySelectorAll("tr")).find(row => row.textContent.includes(keyword));
  return row
    ? {
        label: keyword,
        values: Array.from(row.querySelectorAll("td:not(:first-child)")).map(td => td.textContent.trim())
      }
    : { label: keyword, values: [] };
}

/**
 * Extract periods (years/quarters) from table headers
 */
function extractPeriods(section) {
  const headerRow = section?.querySelector("thead tr");
  return headerRow
    ? Array.from(headerRow.querySelectorAll("th:not(:first-child)")).map(th => th.textContent.trim())
    : [];
}

/**
 * Calculate financial metrics using extracted data
 */
function calculateFinancialMetrics(data) {
  const metrics = {};
  const latestYearIndex = data.periods.length - 2; // Ignore TTM/latest quarter

  function parseValue(values) {
    return parseFloat(values?.[latestYearIndex]?.replace(/,/g, "")) || 0;
  }

  const sales = parseValue(data.profitLoss.sales?.values);
  const fixedAssets = parseValue(data.balanceSheet.fixedAssets?.values);
  const profitForEPS = parseValue(data.profitLoss.profitForEPS?.values);
  const depreciation = parseValue(data.profitLoss.depreciation?.values);

  metrics.fixedAssetTurnover = fixedAssets ? sales / fixedAssets : 0;
  metrics.returnOnFixedAssets = fixedAssets ? (profitForEPS / fixedAssets) * 100 : 0;
  metrics.depreciationToFixedAssets = fixedAssets ? (depreciation / fixedAssets) * 100 : 0;

  return metrics;
}

// Listen for messages from popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extractData") {
    console.log("Extracting financial data...");
    const extractedData = extractFinancialData();
    const calculatedMetrics = calculateFinancialMetrics(extractedData);

    chrome.runtime.sendMessage({ extractedData, calculatedMetrics });
  }
});
