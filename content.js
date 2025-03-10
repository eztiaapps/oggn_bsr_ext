console.log("✅ Content script loaded successfully!");

// Function to extract financial data
function extractFinancialData() {
    const extractedData = { profitLoss: {}, balanceSheet: {} };
    const profitLossSection = document.querySelector("#profit-loss");

    // Extract the stock name
    const stockNameElement = document.querySelector('h1.margin-0.show-from-tablet-landscape');
    const stockName = stockNameElement ? stockNameElement.textContent.trim() : 'Unknown Stock';

// Then include it in your extractedData object
extractedData.stockName = stockName;

    if (profitLossSection) {
        // Extract always-visible data
        extractedData.profitLoss.sales = extractRowData(profitLossSection, "Sales");
        extractedData.profitLoss.eps = extractRowData(profitLossSection, "EPS in Rs");
        extractedData.profitLoss.dividendPayout = extractRowData(profitLossSection, "Dividend Payout %");
        extractedData.profitLoss.depreciation = extractRowData(profitLossSection, "Depreciation");
        extractedData.profitLoss.dividendPayout = extractRowData(profitLossSection, "Dividend Payout %");


        // Extract Balance Sheet data
        const balanceSheetSection = document.querySelector("#balance-sheet");
        if (balanceSheetSection) {
            extractedData.balanceSheet.fixedAssets = extractRowData(balanceSheetSection, "Fixed Assets");
        }

        // Extract periods (years/quarters)
        extractedData.periods = extractPeriods(profitLossSection);

        // Expand "Net Profit" before extracting "Profit for EPS"
        expandNetProfitSection(profitLossSection)
            .then(() => {
                //console.log("✅ Net Profit section expanded successfully");

                // Wait until "Profit for EPS" appears in the DOM
                return waitForElement(profitLossSection, "Profit for EPS", 5000);
            })
            .then(() => {
                //console.log("✅ Extracting Profit for EPS...");
                extractedData.profitLoss.profitForEPS = extractRowData(profitLossSection, "Profit for EPS");

                // Calculate metrics
                const calculatedMetrics = calculateFinancialMetrics(extractedData);
                
                // Send extracted data to popup
                chrome.runtime.sendMessage({
                    action: "dataExtracted",
                    data: { extractedData, calculatedMetrics }
                });

                //console.log("✅ Data extraction complete:", extractedData, calculatedMetrics);
            })
            .catch(error => {
                //console.error("❌ Error extracting full data:", error);

                // Send partial data if extraction fails
                const calculatedMetrics = calculateFinancialMetrics(extractedData);
                chrome.runtime.sendMessage({
                    action: "dataExtracted",
                    data: { extractedData, calculatedMetrics },
                    status: "partial"
                });

                //console.log("⚠️ Partial data extraction complete:", extractedData, calculatedMetrics);
            });
    } else {
        //console.error("❌ Could not find profit-loss section.");
    }
}

/**
 * Expands the "Net Profit" section before extracting "Profit for EPS"
 */
function expandNetProfitSection(profitLossSection) {
    return new Promise((resolve, reject) => {
        const netProfitRow = Array.from(profitLossSection.querySelectorAll("tr"))
            .find(row => row.textContent.includes("Net Profit"));

        if (!netProfitRow) {
            //console.warn("⚠️ Could not find 'Net Profit' row.");
            reject("Net Profit row not found");
            return;
        }

        const netProfitButton = netProfitRow.querySelector("button.button-plain");

        if (!netProfitButton) {
            //console.warn("⚠️ Could not find expand button for 'Net Profit'.");
            reject("Net Profit button not found");
            return;
        }

        //console.log("🔄 Clicking 'Net Profit' button to expand...");
        netProfitButton.click();

        waitForElement(profitLossSection, "Profit for EPS", 5000)
            .then(() => {
                //console.log("✅ 'Profit for EPS' is now visible.");
                resolve();
            })
            .catch(() => {
                //console.warn("⚠️ Failed to expand 'Net Profit' fully.");
                reject("Expansion failed");
            });
    });
}

/**
 * Waits for an element containing a specific keyword to appear within a section.
 */
function waitForElement(section, keyword, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const interval = 500;
        let elapsedTime = 0;

        const checkElement = () => {
            const row = Array.from(section.querySelectorAll("tr"))
                .find(row => row.textContent.includes(keyword));

            if (row) {
                resolve(row);
                return;
            }

            if (elapsedTime >= timeout) {
                reject(`❌ Timeout waiting for '${keyword}'`);
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
 * Extracts periods (years/quarters) from table headers
 */
function extractPeriods(section) {
    const headerRow = section?.querySelector("thead tr");
    return headerRow
        ? Array.from(headerRow.querySelectorAll("th:not(:first-child)")).map(th => th.textContent.trim())
        : [];
}

/**
 * Calculates financial metrics
 */
function calculateFinancialMetrics(data) {
    const metrics = {};
    const periods = data.periods || [];
    const numPeriods = periods.length;

    function parseValue(valueObject, index) {
        if (!valueObject || !valueObject.values || valueObject.values.length <= index) {
            return 0;
        }
        const valueStr = valueObject.values[index];
        return valueStr ? parseFloat(valueStr.replace(/,/g, "")) || 0 : 0;
    }

    const sales = data.profitLoss.sales;
    const fixedAssets = data.balanceSheet.fixedAssets;
    const profitForEPS = data.profitLoss.profitForEPS;
    const dividendPayout = data.profitLoss.dividendPayout;
    const depreciation = data.profitLoss.depreciation;


    let nfat = [];
    let avgNfat3Y = [];
    let npmPercent = [];
    let avgNpm3Y = [];
    let dividendPayoutValues = [];
    let avgDividendPayout3Y = [];
    let depreciationValues = [];
    let depreciationPercent = [];
    let avgDepreciation3Y = [];
    let avgDepreciationPercent3Y = [];
    



    for (let i = 0; i < numPeriods; i++) {
        const currentSales = parseValue(sales, i);
        const currentFixedAssets = parseValue(fixedAssets, i);
        const previousFixedAssets = i > 0 ? parseValue(fixedAssets, i - 1) : 0;
        const currentProfitForEPS = parseValue(profitForEPS, i);
        const currentDividendPayout = parseValue(dividendPayout, i);
        const currentDepreciation = parseValue(depreciation, i);
    

        // NFAT Calculation
        let nfatValue = (previousFixedAssets + currentFixedAssets) > 0
            ? (currentSales * 2) / (previousFixedAssets + currentFixedAssets)
            : 0;
        nfat.push(nfatValue);

        // 3-Year Avg NFAT Calculation
        if (i < 3) {
            avgNfat3Y.push(0);
        } else {
            let avgValue = (nfat[i - 2] + nfat[i - 1] + nfat[i]) / 3;
            avgNfat3Y.push(avgValue);
        }

        // NPM% Calculation
        let npmValue = currentSales > 0 ? (currentProfitForEPS / currentSales) : 0;
        npmPercent.push(npmValue);

        // 3-Year Avg. NPM% Calculation
        if (i < 3) {
            avgNpm3Y.push(0); // Not enough data for 3-year average
        } else {
            let avgValue = (npmPercent[i - 2] + npmPercent[i - 1] + npmPercent[i]) / 3;
            avgNpm3Y.push(avgValue);
        }

        // Dividend Payout %
        dividendPayoutValues.push(currentDividendPayout);

        // 3-Year Avg. Dividend Payout %
        if (i < 3) {
            // Calculate only if we have non-zero values
            let validValues = dividendPayoutValues.slice(0, i + 1).filter(v => !isNaN(v));
            let avgValue = validValues.length > 0 ? validValues.reduce((sum, v) => sum + v, 0) / validValues.length : 0;
            avgDividendPayout3Y.push(avgValue);
        } else {
            let avgValue = (dividendPayoutValues[i - 2] + dividendPayoutValues[i - 1] + dividendPayoutValues[i]) / 3;
            avgDividendPayout3Y.push(avgValue);
        }

        // 3-Year Avg. Depreciation %
        for (let i = 0; i < numPeriods; i++) {
            const currentFixedAssets = parseValue(fixedAssets, i);
            const currentDepreciation = parseValue(depreciation, i);
    
            // Depreciation % Calculation
            let depPercent = currentFixedAssets > 0 ? (currentDepreciation / currentFixedAssets) : 0;
            depreciationPercent.push(depPercent);
    
            // 3-Year Avg Depreciation % Calculation
            let validValues = depreciationPercent.slice(0, i + 1).filter(v => !isNaN(v));
            let avgValue = validValues.length >= 3
                ? (depreciationPercent[i - 2] + depreciationPercent[i - 1] + depreciationPercent[i]) / 3
                : validValues.length > 0 ? validValues.reduce((sum, v) => sum + v, 0) / validValues.length : 0;
            avgDepreciationPercent3Y.push(avgValue);
        }
    
    }


    //console.log("✅ NFAT:", nfat);
    //console.log("✅ 3-Year Avg. NFAT:", avgNfat3Y);
    //console.log("✅ NPM%:", npmPercent);
    //console.log("✅ DPR%:", npmPercent);
    //console.log("✅ 3-Year Avg. Dividend Payout %:", avgDividendPayout3Y);
    //console.log("✅ Depreciation Values:", depreciationValues);
    //console.log("✅ Depreciation %:", depreciationPercent);
    //console.log("✅ 3-Year Avg. Depreciation %:", avgDepreciationPercent3Y);


    metrics.nfat = nfat;
    metrics.avgNfat3Y = avgNfat3Y;
    metrics.npmPercent = npmPercent;
    metrics.avgNpm3Y = avgNpm3Y;
    metrics.dividendPayout = dividendPayoutValues;
    metrics.avgDividendPayout3Y = avgDividendPayout3Y;
    metrics.depreciationValues = depreciationValues;
    metrics.depreciationPercent = depreciationPercent;
    metrics.avgDepreciationPercent3Y = avgDepreciationPercent3Y;
    
    return metrics;
}

// Listen for messages from popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "extractData") {
        //console.log("🔄 Extracting financial data...");
        extractFinancialData();
        sendResponse({ status: "extracting" });
        return true;
    }
});