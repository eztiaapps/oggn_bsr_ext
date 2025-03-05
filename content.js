let extractedData = null;

function extractQuarterlyResults() {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            try {
                let quarterlyTable = document.querySelector("div[data-result-table] table.data-table");

                if (!quarterlyTable) {
                    console.error("❌ Quarterly Results table not found.");
                    reject(new Error("Table not found"));
                    return;
                }

                let rows = quarterlyTable.querySelectorAll("tbody tr");
                let salesData = [];
                let expensesData = [];
                let reportDates = [];
                let epsData = [];

                rows.forEach((row) => {
                    let firstColumn = row.querySelector("td.text");
                    if (!firstColumn) return;

                    let rowName = firstColumn.textContent.trim();
                    
                    // Function to extract numeric data from cells
                    const extractNumericData = (cells) => {
                        return Array.from(cells)
                            .map(cell => {
                                const value = cell.textContent.trim().replace(/,/g, '');
                                return isNaN(value) ? 0 : parseFloat(value);
                            });
                    };

                    // Extract EPS values
                    if (rowName === "EPS in Rs") {
                        console.log("🎯 EPS Row Found:", rowName);
                        let epsCells = row.querySelectorAll("td:not(.text)");
                        epsData = extractNumericData(epsCells);
                        console.log("🔢 EPS Values:", epsData);
                    }

                    // Extract Sales
                    if (rowName.toLowerCase().includes("sales")) {
                        let salesCells = row.querySelectorAll("td:not(.text)");
                        salesData = extractNumericData(salesCells);
                    }

                    // Extract Expenses
                    if (rowName.toLowerCase().includes("expenses")) {
                        let expensesCells = row.querySelectorAll("td:not(.text)");
                        expensesData = extractNumericData(expensesCells);
                    }
                });

                // Extract report dates from header
                let headerCells = quarterlyTable.querySelectorAll("thead th:not(.text)");
                reportDates = Array.from(headerCells).map(th => th.textContent.trim());

                // Calculate Profit (Sales - Expenses)
                let profitData = salesData.map((sales, index) => sales - (expensesData[index] || 0));

                // Calculate CAGR of Profit Growth
                let profitCAGR = calculateCAGR(profitData);

                // Calculate EPS Growth
                let epsGrowth = calculateEPSGrowth(epsData);

                extractedData = { 
                    reportDates, 
                    salesData, 
                    expensesData, 
                    profitData, 
                    profitCAGR,
                    epsData,
                    epsGrowth
                };
                
                // Resolve the promise with extracted data
                resolve(extractedData);
            } catch (error) {
                console.error("❌ Error extracting quarterly results:", error);
                reject(error);
            }
        }, 2000);
    });
}

// Function to calculate Compound Annual Growth Rate (CAGR)
function calculateCAGR(data) {
    if (data.length < 2) {
        return "N/A"; // Not enough data points
    }

    const firstValue = data[0];
    const lastValue = data[data.length - 1];
    const periods = data.length - 1;

    // Prevent division by zero and handle negative values
    if (firstValue === 0) {
        return "N/A";
    }

    const cagr = Math.pow(lastValue / firstValue, 1 / periods) - 1;
    return (cagr * 100).toFixed(2) + "%";
}

// Function to calculate EPS Growth
function calculateEPSGrowth(epsData) {
    if (epsData.length < 2) {
        return "N/A"; // Not enough data points
    }

    // Calculate quarter-on-quarter EPS growth
    let growthRates = [];
    for (let i = 1; i < epsData.length; i++) {
        if (epsData[i-1] === 0) continue; // Avoid division by zero
        
        let growthRate = ((epsData[i] - epsData[i-1]) / epsData[i-1]) * 100;
        growthRates.push(growthRate.toFixed(2) + "%");
    }

    // Calculate average EPS growth
    if (growthRates.length === 0) return "N/A";

    return growthRates;
}

// Message listener for both manual and automatic data retrieval
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.request === "getLatestData") {
        extractQuarterlyResults()
            .then(data => {
                // Store data in chrome storage
                chrome.storage.local.set({ 'quarterlyData': data }, () => {
                    console.log("✅ Extracted Data Stored in Chrome Storage:", data);
                });
                
                // Send response back to popup
                sendResponse(data);
            })
            .catch(error => {
                console.error("Error in data extraction:", error);
                sendResponse({ error: "Data extraction failed" });
            });
        
        // Indicate that we will send a response asynchronously
        return true;
    }
});

// Automatically extract on page load
extractQuarterlyResults()
    .then(data => {
        chrome.storage.local.set({ 'quarterlyData': data }, () => {
            console.log("✅ Auto-extracted Data Stored in Chrome Storage:", data);
        });
    })
    .catch(error => {
        console.error("Auto-extraction failed:", error);
    });