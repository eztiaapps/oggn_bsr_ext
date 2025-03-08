let extractedData = null; // Store extracted data globally

document.getElementById("fetchData").addEventListener("click", function () {
    const spinner = document.getElementById("spinner");
    document.getElementById("data-container").innerHTML = "<p>Fetching data...</p>";
    document.getElementById("plotTable").disabled = true; // Disable "Show Table" button until data is ready
    spinner.style.display = "block"; // Show spinner

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            files: ["content.js"] // Ensure content.js is injected
        }, () => {
            if (chrome.runtime.lastError) {
                console.error("❌ Script injection error:", chrome.runtime.lastError);
                document.getElementById("data-container").innerHTML = "<p>Error injecting script.</p>";
                spinner.style.display = "none"; // Hide spinner on error
                return;
            }

            // Wait before requesting data extraction
            setTimeout(() => {
                chrome.tabs.sendMessage(tabs[0].id, { action: "extractData" });
                setTimeout(() => {
                    spinner.style.display = "none"; // Hide spinner after 2 seconds
                }, 2000);
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

        extractedData = message.data; // Store data globally
        
        // Simply show a success message instead of displaying extracted data
        document.getElementById("data-container").innerHTML = "<p>Data successfully extracted! Click 'Stock Report' to view the analysis.</p>";

        // Enable "Show Table" button
        document.getElementById("plotTable").disabled = false;
    } else {
        console.warn("⚠️ Unexpected message format:", message);
        document.getElementById("data-container").innerHTML = "<p>Error: Unexpected data format.</p>";
    }
});

/**
 * Calculate compound annual growth rate (CAGR)
 * @param {number} startValue - The initial value
 * @param {number} endValue - The final value
 * @param {number} years - Number of years between start and end
 * @returns {number} CAGR as a percentage
 */
function calculateCAGR(startValue, endValue, years) {
    // Check for valid inputs
    if (years <= 0) return 0;
    
    // Handle special cases
    if (startValue <= 0 && endValue <= 0) {
        // Both negative or zero - calculate growth on absolute values
        // and then determine if it's growth or decline
        const absStart = Math.abs(startValue);
        const absEnd = Math.abs(endValue);
        
        if (absStart === 0) return 0; // Can't calculate growth from zero
        
        const growth = (Math.pow(absEnd / absStart, 1 / years) - 1) * 100;
        // If both negative and absolute value increased, it's actually a decline
        return (startValue < 0 && endValue < 0 && absEnd > absStart) ? -growth : growth;
    }
    
    // One value is negative and one is positive - special handling needed
    if ((startValue <= 0 && endValue > 0) || (startValue > 0 && endValue <= 0)) {
        // Can't calculate traditional CAGR with sign change
        // Return simple annual rate instead
        return ((endValue - startValue) / Math.abs(startValue) / years) * 100;
    }
    
    // Standard CAGR calculation for positive values
    return (Math.pow(endValue / startValue, 1 / years) - 1) * 100;
}

// Handle "Show Table" button click
document.getElementById("plotTable").addEventListener("click", function () {
    if (!extractedData) {
        console.warn("⚠️ No data available for table.");
        return;
    }

    const periods = extractedData.extractedData.periods || [];
    const salesValues = extractedData.extractedData.profitLoss.sales?.values || [];
    const avgNfatValues = extractedData.calculatedMetrics.avgNfat3Y || [];
    const avgNpm3YValues = extractedData.calculatedMetrics.avgNpm3Y || [];
    const avgDividendPayout3Y = extractedData.calculatedMetrics.avgDividendPayout3Y.map(val => val / 100) || [];
    const avgDepreciationPercent3Y = extractedData.calculatedMetrics.avgDepreciationPercent3Y || [];

    // Ensure BSR calculation is correct
    let bsrValues = avgNfatValues.map((val, i) =>
        (val * avgNpm3YValues[i] * (1 - avgDividendPayout3Y[i]) - avgDepreciationPercent3Y[i]) * 100
    );

    // Parse values for calculations
    const parsedSalesValues = salesValues.map(val => parseFloat(val.replace(/,/g, "")));
    const parsedBsrValues = bsrValues.map(val => parseFloat(val));

    // Debug information to help diagnose calculation issues
    console.log("📊 Periods:", periods);
    console.log("📊 Parsed BSR Values:", parsedBsrValues);
    console.log("📊 Parsed Sales Values:", parsedSalesValues);

    // Calculate BSR Growth and Sales Growth for TTM, 3, 4, and 5 years
    let bsrGrowthTTM = 0;
    let bsrGrowth3Y = 0;
    let bsrGrowth4Y = 0;
    let bsrGrowth5Y = 0;
    let salesGrowthTTM = 0;
    let salesGrowth3Y = 0;
    let salesGrowth4Y = 0;
    let salesGrowth5Y = 0;

    const totalPeriods = periods.length;
    
    // Only calculate if we have enough data
    
    // For TTM (latest value compared to value 1 year ago)
    if (totalPeriods >= 2) {
        const latestBsr = parsedBsrValues[totalPeriods - 1];
        const bsr1YearAgo = parsedBsrValues[totalPeriods - 2];
        
        const latestSales = parsedSalesValues[totalPeriods - 1];
        const sales1YearAgo = parsedSalesValues[totalPeriods - 2];
        
        console.log("📈 TTM BSR Calculation:", { 
            latestBsr, 
            bsr1YearAgo, 
            years: 1 
        });
        console.log("📈 TTM Sales Calculation:", { 
            latestSales, 
            sales1YearAgo, 
            years: 1 
        });
        
        bsrGrowthTTM = calculateCAGR(bsr1YearAgo, latestBsr, 1);
        salesGrowthTTM = calculateCAGR(sales1YearAgo, latestSales, 1);
    }
    
    // For 3-year growth rate
    if (totalPeriods >= 4) {
        // For BSR - use 1 period prior to TTM as ending and shift starting accordingly
        const endingBsr = parsedBsrValues[totalPeriods - 2]; // 1 period prior to TTM
        const startingBsr = parsedBsrValues[totalPeriods - 5]; // 3 years back from ending period
        
        // For Sales - use 1 period prior to TTM as ending and shift starting accordingly
        const endingSales = parsedSalesValues[totalPeriods - 2]; // 1 period prior to TTM
        const startingSales = parsedSalesValues[totalPeriods - 5]; // 3 years back from ending period
        
        console.log("📈 3-Year BSR Calculation:", { 
            endingBsr, 
            startingBsr, 
            years: 3 
        });
        console.log("📈 3-Year Sales Calculation:", { 
            endingSales, 
            startingSales, 
            years: 3
        });
        
        bsrGrowth3Y = calculateCAGR(startingBsr, endingBsr, 3);
        salesGrowth3Y = calculateCAGR(startingSales, endingSales, 3);
    }
    
        
    // For 5-year growth rate
    if (totalPeriods >= 7) {
        // For BSR - use 1 period prior to TTM as ending and shift starting accordingly
        const endingBsr = parsedBsrValues[totalPeriods - 2]; // 1 period prior to TTM
        const startingBsr = parsedBsrValues[totalPeriods - 7]; // 5 years back from ending period
        
        // For Sales - use 1 period prior to TTM as ending and shift starting accordingly
        const endingSales = parsedSalesValues[totalPeriods - 2]; // 1 period prior to TTM
        const startingSales = parsedSalesValues[totalPeriods - 7]; // 5 years back from ending period
        
        console.log("📈 5-Year BSR Calculation:", { 
            endingBsr, 
            startingBsr, 
            years: 4 
        });
        console.log("📈 5-Year Sales Calculation:", { 
            endingSales, 
            startingSales, 
            years: 4
        });
        
        bsrGrowth5Y = calculateCAGR(startingBsr, endingBsr, 5);
        salesGrowth5Y = calculateCAGR(startingSales, endingSales, 5);
    }

    console.log("✅ TTM BSR Growth:", bsrGrowthTTM.toFixed(2) + "%");
    console.log("✅ 3-Year BSR Growth:", bsrGrowth3Y.toFixed(2) + "%");
    console.log("✅ 4-Year BSR Growth:", bsrGrowth4Y.toFixed(2) + "%");
    console.log("✅ 5-Year BSR Growth:", bsrGrowth5Y.toFixed(2) + "%");
    console.log("✅ TTM Sales Growth:", salesGrowthTTM.toFixed(2) + "%");
    console.log("✅ 3-Year Sales Growth:", salesGrowth3Y.toFixed(2) + "%");
    console.log("✅ 4-Year Sales Growth:", salesGrowth4Y.toFixed(2) + "%");
    console.log("✅ 5-Year Sales Growth:", salesGrowth5Y.toFixed(2) + "%");

    // Ensure we have enough data
    if (periods.length === 0) {
        console.warn("⚠️ Not enough data to plot the table.");
        document.getElementById("table-container").innerHTML = "<p>No data available.</p>";
        document.getElementById("table-container").style.display = "block";
        return;
    }

    // Updated Growth Summary table with TTM and 4-Year periods
    let tableHTML = `
    <p><h3>Growth Summary</h3></p>;
    <table border="1">
        <thead>
            <tr>
                <th>Metric</th>
                <th>TTM Growth</th>
                <th>3-Year Growth (CAGR)</th>
                <th>5-Year Growth (CAGR)</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td><strong>BSR Growth</strong></td>
                <td>${bsrGrowthTTM.toFixed(2)}%</td>
                <td>${bsrGrowth3Y.toFixed(2)}%</td>
                <td>${bsrGrowth5Y.toFixed(2)}%</td>
            </tr>
            <tr>
                <td><strong>Sales Growth</strong></td>
                <td>${salesGrowthTTM.toFixed(2)}%</td>
                <td>${salesGrowth3Y.toFixed(2)}%</td>
                <td>${salesGrowth5Y.toFixed(2)}%</td>
            </tr>
        </tbody>
    </table>`;

    // Compare BSR growth to Sales growth
    const isBsrHigherThanSales = {
        ttm: bsrGrowthTTM > salesGrowthTTM,
        threeYear: bsrGrowth3Y > salesGrowth3Y,
        fiveYear: bsrGrowth5Y > salesGrowth5Y
    };

    // Compare BSR growth improvement
    const isBsrImproving = bsrGrowth3Y > bsrGrowth5Y;
        
    // Add the analysis section using string concatenation
    tableHTML += '<div style="margin-top: 15px; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">';
    tableHTML += '<p><strong><h2>Conclusion Notes : </strong></p></h2>';
    tableHTML += '<p><strong>BSR Growth vs Sales Growth (3-Year):</strong> ' + (isBsrHigherThanSales.threeYear ? 'Good' : 'Poor') + ' - BSR Growth ' + (isBsrHigherThanSales.threeYear ? 'is' : 'is not') + ' higher than Sales Growth</p>';
    tableHTML += '<p><strong>BSR Growth vs Sales Growth (5-Year):</strong> ' + (isBsrHigherThanSales.fiveYear ? 'Good' : 'Poor') + ' - BSR Growth ' + (isBsrHigherThanSales.fiveYear ? 'is' : 'is not') + ' higher than Sales Growth</p>';
    tableHTML += '<p><strong>Important Notes: </strong></p>';
    tableHTML += '<ul style="margin-top: 10px; margin-bottom: 0;">';
    tableHTML += '<li>BSR > Sales Growth indicates efficient capital deployment by Management</li>';
    tableHTML += '<li>Improving trend shows management effectiveness over time (3 years vs 5 years)</li>';
    tableHTML += '<li>If BSR < Sales Growth or BSR is Negative, it is better to avoid that stock</li>';
    tableHTML += '</ul>';
    tableHTML += '</div>';

    // Contact us section
    tableHTML += '<div style="margin-top: 15px; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">';
    tableHTML += '<p><strong><h3>Contact Us: </strong></p></h3>';
    tableHTML += '<ul style="margin-top: 10px; margin-bottom: 0;">';
    tableHTML += '<li>eztiaapps@gmail.com</li>';
    tableHTML += '<li>Write to us, if you want to connect to SEBI Registered Advisors</li>';
    tableHTML += '</div>';

    
    document.getElementById("table-container").innerHTML = tableHTML;
    document.getElementById("table-container").style.display = "block"; // Show the table
});