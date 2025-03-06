console.log("Content script loaded successfully!");

// Function to extract financial data
function extractFinancialData() {
    const extractedData = { profitLoss: {}, balanceSheet: {} };
    const profitLossSection = document.querySelector("#profit-loss");

    if (profitLossSection) {
        // Extract always-visible data
        extractedData.profitLoss.sales = extractRowData(profitLossSection, "Sales");
        extractedData.profitLoss.eps = extractRowData(profitLossSection, "EPS in Rs");
        extractedData.profitLoss.dividendPayout = extractRowData(profitLossSection, "Dividend Payout %");
        extractedData.profitLoss.depreciation = extractRowData(profitLossSection, "Depreciation");

        // Extract Balance Sheet data
        const balanceSheetSection = document.querySelector("#balance-sheet");
        if (balanceSheetSection) {
            extractedData.balanceSheet.fixedAssets = extractRowData(balanceSheetSection, "Fixed Assets");
        }

        // Extract periods (years/quarters)
        extractedData.periods = extractPeriods(profitLossSection);

        // Expand "Net Profit" first
        expandNetProfitSection(profitLossSection)
            .then(() => {
                console.log("Net Profit section expanded successfully");

                // Wait until "Profit for EPS" actually appears in the DOM
                return waitForElement(profitLossSection, "Profit for EPS", 5000);
            })
            .then(() => {
                console.log("Extracting Profit for EPS...");
                extractedData.profitLoss.profitForEPS = extractRowData(profitLossSection, "Profit for EPS");

                // Send extracted data
                const calculatedMetrics = calculateFinancialMetrics(extractedData);
                chrome.runtime.sendMessage({
                    action: "dataExtracted",
                    data: { extractedData, calculatedMetrics }
                });

                console.log("Data extraction complete", extractedData, calculatedMetrics);
            })
            .catch(error => {
                console.error("Error extracting full data:", error);
                // Send partial data
                const calculatedMetrics = calculateFinancialMetrics(extractedData);
                chrome.runtime.sendMessage({
                    action: "dataExtracted",
                    data: { extractedData, calculatedMetrics },
                    status: "partial"
                });

                console.log("Partial data extraction complete", extractedData, calculatedMetrics);
            });
    } else {
        console.error("Could not find profit-loss section.");
    }
}

/**
 * Function to expand the "Net Profit" section reliably
 */
function expandNetProfitSection(profitLossSection) {
    return new Promise((resolve, reject) => {
        // Find the row containing "Net Profit"
        const netProfitRow = Array.from(profitLossSection.querySelectorAll("tr"))
            .find(row => row.textContent.includes("Net Profit"));

        if (!netProfitRow) {
            console.warn("Could not find 'Net Profit' row.");
            reject("Net Profit row not found");
            return;
        }

        // Find the correct expand button inside the row
        const netProfitButton = netProfitRow.querySelector("button.button-plain");

        if (!netProfitButton) {
            console.warn("Could not find expand button for 'Net Profit'.");
            reject("Net Profit button not found");
            return;
        }

        // Click the button to expand
        console.log("Clicking 'Net Profit' button to expand...");
        netProfitButton.click();

        // Poll every 500ms until "Profit for EPS" appears (max wait: 5 seconds)
        waitForElement(profitLossSection, "Profit for EPS", 5000)
            .then(() => {
                console.log("'Profit for EPS' is now visible.");
                resolve();
            })
            .catch(() => {
                console.warn("Failed to expand 'Net Profit' fully.");
                reject("Expansion failed");
            });
    });
}

/**
 * Wait for an element containing a specific keyword to appear within a section.
 * @param {Element} section - The parent section to search in.
 * @param {string} keyword - The text to search for in table rows.
 * @param {number} timeout - Maximum wait time in milliseconds.
 */
function waitForElement(section, keyword, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const interval = 500; // Check every 500ms
        let elapsedTime = 0;

        const checkElement = () => {
            const row = Array.from(section.querySelectorAll("tr"))
                .find(row => row.textContent.includes(keyword));

            if (row) {
                resolve(row);
                return;
            }

            if (elapsedTime >= timeout) {
                reject(`Timeout waiting for '${keyword}'`);
                return;
            }

            elapsedTime += interval;
            setTimeout(checkElement, interval);
        };

        checkElement();
    });
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
        extractFinancialData();
        sendResponse({ status: "extracting" });
        return true; // Keep the message channel open for async response
    }
});
