let extractedData = null; // Store extracted data globally

document.getElementById("fetchData").addEventListener("click", function () {
    document.getElementById("data-container").innerHTML = "<p>Fetching data...</p>";
    document.getElementById("plotTable").disabled = true; // Disable button until extraction completes

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            files: ["content.js"] // Ensure content.js is injected
        }, () => {
            if (chrome.runtime.lastError) {
                console.error("Script injection error:", chrome.runtime.lastError);
                document.getElementById("data-container").innerHTML = "<p>Error injecting script.</p>";
                return;
            }

            // Wait a second and request data extraction
            setTimeout(() => {
                chrome.tabs.sendMessage(tabs[0].id, { action: "extractData" });
            }, 1000);
        });
    });
});

// Listen for messages from `content.js`
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("📩 Message received in popup.js:", message);

    if (message.action === "dataExtracted" && message.data) {
        console.log("✅ Extracted Data:", message.data.extractedData);
        console.log("✅ Calculated Metrics:", message.data.calculatedMetrics);

        extractedData = message.data; // Store data globally for later use
        displayData(extractedData.extractedData, extractedData.calculatedMetrics);

        // Enable "Show Table" button only if data is valid
        document.getElementById("plotTable").disabled = false;
    } else {
        console.warn("⚠️ Unexpected message format:", message);
        document.getElementById("data-container").innerHTML = "<p>Error: Unexpected data format.</p>";
    }
});

/**
 * Display extracted financial data in popup
 */
function displayData(extractedData, calculatedMetrics) {
    let content = `<h3>Extracted Financial Data</h3>`;

    // Profit & Loss Section
    content += `<h4>Profit & Loss</h4>`;
    Object.keys(extractedData.profitLoss).forEach(key => {
        content += `<p><strong>${extractedData.profitLoss[key].label}:</strong> ${extractedData.profitLoss[key].values.join(', ')}</p>`;
    });

    // Balance Sheet Section
    content += `<h4>Balance Sheet</h4>`;
    Object.keys(extractedData.balanceSheet).forEach(key => {
        content += `<p><strong>${extractedData.balanceSheet[key].label}:</strong> ${extractedData.balanceSheet[key].values.join(', ')}</p>`;
    });

    // Validate and Display Calculated Metrics
    const safeNumber = (num) => (isNaN(num) || num === undefined) ? "N/A" : num.toFixed(2);

    content += `<h3>Calculated Metrics</h3>`;
    content += `<p><strong>Fixed Asset Turnover:</strong> ${safeNumber(calculatedMetrics.fixedAssetTurnover)}</p>`;
    content += `<p><strong>Return on Fixed Assets:</strong> ${safeNumber(calculatedMetrics.returnOnFixedAssets)}%</p>`;
    content += `<p><strong>Depreciation to Fixed Assets:</strong> ${safeNumber(calculatedMetrics.depreciationToFixedAssets)}%</p>`;

    document.getElementById("data-container").innerHTML = content;
}

// Handle "Show Table" button click
document.getElementById("plotTable").addEventListener("click", function () {
    if (!extractedData) {
        console.warn("⚠️ No data available for table.");
        return;
    }

    const periods = extractedData.extractedData.periods || [];
    const salesValues = extractedData.extractedData.profitLoss.sales?.values || [];
    const fixedAssetsValues = extractedData.extractedData.balanceSheet.fixedAssets?.values || [];
    const nfatValues = extractedData.calculatedMetrics.nfat || [];

    // Ensure we have data
    if (periods.length === 0 || salesValues.length === 0 || fixedAssetsValues.length === 0 || nfatValues.length === 0) {
        console.warn("⚠️ Not enough data to plot the table.");
        document.getElementById("table-container").innerHTML = "<p>No data available.</p>";
        document.getElementById("table-container").style.display = "block";
        return;
    }

    let tableHTML = `<h3>NFAT Table</h3><table><thead><tr><th>Period</th><th>Sales</th><th>Fixed Assets</th><th>NFAT</th></tr></thead><tbody>`;

    for (let i = 0; i < periods.length; i++) {
        tableHTML += `<tr>
            <td>${periods[i]}</td>
            <td>${salesValues[i] || "-"}</td>
            <td>${fixedAssetsValues[i] || "-"}</td>
            <td>${!isNaN(nfatValues[i]) ? nfatValues[i].toFixed(2) : "-"}</td>
        </tr>`;
    }

    tableHTML += `</tbody></table>`;
    document.getElementById("table-container").innerHTML = tableHTML;
    document.getElementById("table-container").style.display = "block"; // Show the table
});
