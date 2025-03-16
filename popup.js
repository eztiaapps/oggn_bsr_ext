let extractedData = null; // Store extracted data globally

document.getElementById("fetchData").addEventListener("click", function () {
    const spinner = document.getElementById("spinner");
    document.getElementById("data-container").innerHTML = "<p>Connecting AI Assistant...</p>";
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

// Calculate normal Sales Growth for each period (year-over-year growth)
function calculateSalesGrowth(salesValues) {
    const result = [];
    const parsedSales = salesValues.map(val => parseFloat(val.replace(/,/g, "")));
    
    // For each period, calculate the year-over-year growth
    for (let i = 0; i < parsedSales.length; i++) {
        // Need at least 2 periods of data to calculate growth
        if (i >= 1) {
            const endValue = parsedSales[i];
            const startValue = parsedSales[i - 1];
            
            // Calculate simple percentage growth
            const growth = startValue !== 0 ? ((endValue - startValue) / startValue) * 100 : 0;
            result.push(growth);
        } else {
            // Not enough history, push null or a placeholder
            result.push(null);
        }
    }
    
    return result;
}

// Handle "Show Table" button click
// Handle "Show Table" button click
document.getElementById("plotTable").addEventListener("click", function () {
    if (!extractedData) {
        console.warn("⚠️ No data available for table.");
        return;
    }

    const periods = extractedData.extractedData.periods || [];
    const salesValues = extractedData.extractedData.profitLoss.sales?.values || [];
    
    // Access the metrics directly from the calculatedMetrics object
    const avgNfatValues = extractedData.calculatedMetrics.avgNfat3Y || [];
    const avgNpm3YValues = extractedData.calculatedMetrics.avgNpm3Y || [];
    const avgDividendPayout3Y = extractedData.calculatedMetrics.avgDividendPayout3Y || [];
    const avgDepreciationPercent3Y = extractedData.calculatedMetrics.avgDepreciationPercent3Y || [];

    // Debug the values received to verify we're accessing them correctly
    console.log("📊 Detailed Raw Data:");
    console.log("- Periods:", periods);
    console.log("- Sales Values:", salesValues);
    console.log("- Full calculatedMetrics:", extractedData.calculatedMetrics);
    console.log("- Avg NFAT 3Y (raw):", avgNfatValues);
    console.log("- Avg NPM 3Y (raw):", avgNpm3YValues);
    console.log("- Avg Dividend Payout 3Y (raw):", avgDividendPayout3Y);
    console.log("- Avg Depreciation % 3Y (raw):", avgDepreciationPercent3Y);

    // Parse the sales values
    const parsedSalesValues = salesValues.map(val => {
        if (!val) return 0;
        return parseFloat(val.replace(/,/g, "")) || 0;
    });
    
    // Fix BSR calculation - make extra sure we're handling all values safely
    const bsrValues = [];
    for (let i = 0; i < periods.length; i++) {
        // Get the values for this period with appropriate fallbacks
        const nfat = typeof avgNfatValues[i] === 'number' ? avgNfatValues[i] : 0;
        const npm = typeof avgNpm3YValues[i] === 'number' ? avgNpm3YValues[i] : 0;
        const divPayout = typeof avgDividendPayout3Y[i] === 'number' ? avgDividendPayout3Y[i] / 100 : 0; // Convert from percentage to decimal
        const deprPercent = typeof avgDepreciationPercent3Y[i] === 'number' ? avgDepreciationPercent3Y[i] : 0;
        
        // For troubleshooting, log each component for this period
        console.log(`Period ${periods[i]} components:`, {
            nfat,
            npm,
            divPayout: divPayout * 100, // convert back to % for logging
            deprPercent
        });
        
        // Calculate BSR using the formula: (NFAT * NPM * (1 - DivPayout) - DepreciationPercent) * 100
        const bsr = (nfat * npm * (1 - divPayout) - deprPercent) * 100;
        console.log(`Period ${periods[i]} BSR calculation:`, {
            nfatComponent: nfat,
            npmComponent: npm,
            divPayoutEffect: (1 - divPayout),
            combinedFactor: nfat * npm * (1 - divPayout),
            deprEffect: deprPercent,
            finalBSR: bsr
        });
        
        bsrValues.push(isNaN(bsr) ? 0 : bsr);
    }
    
    console.log("📊 Calculated BSR Values:", bsrValues);

    // Calculate year-over-year sales growth
    const salesGrowthYoY = [];
    for (let i = 0; i < parsedSalesValues.length; i++) {
        if (i === 0) {
            // First period has no prior period to compare with
            salesGrowthYoY.push(null);
        } else {
            const currentSales = parsedSalesValues[i];
            const previousSales = parsedSalesValues[i-1];
            
            if (previousSales && previousSales > 0) {
                const growthRate = ((currentSales - previousSales) / previousSales) * 100;
                salesGrowthYoY.push(growthRate);
            } else {
                salesGrowthYoY.push(null);
            }
        }
    }
    
    console.log("📊 Calculated Sales Growth YoY:", salesGrowthYoY);

    // Get the 5 most recent periods (or fewer if not available)
    const recentPeriodsCount = Math.min(5, periods.length);
    const recentPeriods = periods.slice(-recentPeriodsCount);
    const recentBsrValues = bsrValues.slice(-recentPeriodsCount);
    const recentSalesGrowthYoY = salesGrowthYoY.slice(-recentPeriodsCount);

    // Ensure we have enough data
    if (periods.length === 0) {
        console.warn("⚠️ Not enough data to plot the table.");
        document.getElementById("table-container").innerHTML = "<p>No data available.</p>";
        document.getElementById("table-container").style.display = "block";
        return;
    }

    // Function to format value with color based on sign
    function formatWithColor(value) {
        if (value === null || isNaN(value)) return '<span>N/A</span>';
        const isNegative = value < 0;
        return '<span style="color: ' + (isNegative ? 'red' : 'green') + ';">' + value.toFixed(2) + '%</span>';
    }

    // Create the new growth summary table with BSR values and YoY Sales Growth
    let tableHTML = `
    <p><h3>Growth Summary${extractedData.extractedData.stockName ? ' - ' + extractedData.extractedData.stockName : ''}</h3></p>
    <table border="1" style="width: 100%; border-collapse: collapse;">
        <thead>
            <tr>
                <th style="padding: 8px; background-color: #f2f2f2;">Metric</th>`;
    
    // Add period headers
    recentPeriods.forEach(period => {
        tableHTML += `<th style="padding: 8px; background-color: #f2f2f2;">${period}</th>`;
    });
    
    tableHTML += `
            </tr>
        </thead>
        <tbody>
            <tr>
                <td style="padding: 8px; font-weight: bold;">BSR Value</td>`;
    
    // Add BSR values
    recentBsrValues.forEach(value => {
        tableHTML += `<td style="padding: 8px; text-align: right;">${formatWithColor(value)}</td>`;
    });
    
    tableHTML += `
            </tr>
            <tr>
                <td style="padding: 8px; font-weight: bold;">Sales Growth Y-o-Y</td>`;
    
    // Add Sales Growth YoY values
    recentSalesGrowthYoY.forEach(value => {
        tableHTML += `<td style="padding: 8px; text-align: right;">${formatWithColor(value)}</td>`;
    });
    
    tableHTML += `
            </tr>
        </tbody>
    </table>`;

    

    // Add the analysis section
    tableHTML += '<div style="margin-top: 15px; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">';
    tableHTML += '<p><strong>BSR Analysis:</strong></p>';
    
    // Calculate average BSR value for recent periods
    const validBsrValues = recentBsrValues.filter(val => !isNaN(val) && val !== null);
    const avgBsrValue = validBsrValues.length > 0 
        ? validBsrValues.reduce((sum, val) => sum + val, 0) / validBsrValues.length 
        : 0;
    
    // Determine if BSR values are improving (latest > average)
    const latestBsrValue = recentBsrValues[recentBsrValues.length - 1] || 0;
    const isBsrImproving = latestBsrValue > avgBsrValue;
    
    // Count positive BSR values
    const positiveBsrCount = validBsrValues.filter(val => val > 0).length;
    const bsrHealth = positiveBsrCount > validBsrValues.length / 2 ? 'Good' : 'Poor';
    
    tableHTML += '<p><strong>BSR Trend:</strong> <span style="color: ' + (isBsrImproving ? 'green' : 'red') + '; font-weight: bold;">' + (isBsrImproving ? 'Improving' : 'Declining') + '</span> - Latest BSR value is ' + (isBsrImproving ? 'higher' : 'lower') + ' than average</p>';
    tableHTML += '<p><strong>BSR Health:</strong> <span style="color: ' + (bsrHealth === 'Good' ? 'green' : 'red') + '; font-weight: bold;">' + bsrHealth + '</span> - BSR is positive in ' + positiveBsrCount + ' out of ' + validBsrValues.length + ' periods</p>';
    
    tableHTML += '<p><strong>Important Notes: </strong></p>';
    tableHTML += '<ul style="margin-top: 10px; margin-bottom: 0;">';
    tableHTML += '<li>If BSR > Sales Growth indicates efficient capital deployment by Management, can be considered for Investing. High BSR means they can continue to improve Sales without taking debt or diluting the shares.</li>';
    tableHTML += '<li><b>Good BSR is not enough, Sales Growth is important. Then right entry time is important. Safety Margin should be calculated next (Coming Soon)</b></li>';
    tableHTML += '<li>Improving trend shows management effectiveness over time</li>';
    tableHTML += '<li><b>If BSR is <span style="color: red;">Negative</span>, it is better to <span style="color: red;">AVOID</span> that stock</b></li>';
    tableHTML += '<li>Some Business could have good BSR, but they have Poor Sales, avoid such stocks too!</li>';
    tableHTML += '</ul>';
    tableHTML += '</div>';

    // Contact us section
    tableHTML += '<div style="margin-top: 15px; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">';
    tableHTML += '<p><strong><h3>Contact Us: </strong></p></h3>';
    tableHTML += '<ul style="margin-top: 10px; margin-bottom: 0;">';
    tableHTML += '<li>eztiaapps@gmail.com</li>';
    tableHTML += '<li>Write to us, if you want to connect to SEBI Registered Advisors</li>';
    tableHTML += '<li>Try the APP here: <a href="https://chromewebstore.google.com/detail/datalotus-portfolio-assis/iohllegnicbflhjdpdjifpdodooofphj" target="_blank" rel="noopener noreferrer">Datalotus Portfolio Assistant</a></li>';
    tableHTML += '</div>';

    document.getElementById("table-container").innerHTML = tableHTML;
    document.getElementById("table-container").style.display = "block"; // Show the table
});