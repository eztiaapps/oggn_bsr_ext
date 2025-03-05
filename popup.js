function requestDataFromContentScript() {
    console.log("📨 Requesting latest data from content.js...");

    // Try to get data from storage first
    chrome.storage.local.get(['quarterlyData'], (storageResult) => {
        console.log("Storage retrieval result:", storageResult);

        // If data exists in storage, try to update popup
        if (storageResult.quarterlyData) {
            console.log("📦 Data retrieved from local storage:", storageResult.quarterlyData);
            updatePopup(storageResult.quarterlyData);
        }

        // Send message to active tab's content script
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { request: "getLatestData" }, (response) => {
                    // Check for chrome runtime errors
                    if (chrome.runtime.lastError) {
                        console.error("❌ Messaging Error:", chrome.runtime.lastError.message);
                        handleDataError();
                        return;
                    }

                    // Process response
                    console.log("Raw response received:", response);

                    if (response && !response.error) {
                        console.log("✅ Data received from content.js:", response);
                        updatePopup(response);
                    } else {
                        console.error("❌ No data or error received:", response);
                        handleDataError();
                    }
                });
            } else {
                console.error("❌ No active tab found.");
                handleDataError();
            }
        });
    });
}

function handleDataError() {
    const errorMessage = document.getElementById("errorMessage");
    errorMessage.style.display = "block";
    
    // Hide loading elements
    const loadingElements = document.querySelectorAll('.loading');
    loadingElements.forEach(el => {
        el.textContent = "❌ Data Unavailable";
        el.style.color = "red";
    });
}

function updatePopup(data) {
    console.log("Updating popup with data:", data);

    // Comprehensive error checking
    if (!data) {
        console.error("No data provided to updatePopup");
        handleDataError();
        return;
    }

    // Enhanced null/empty checks with detailed logging
    const safeGet = (arr, defaultValue = "❌ No Data") => 
        arr && arr.length > 0 ? arr.map(val => val.toLocaleString()).join(", ") : defaultValue;

    // Update elements with safe data retrieval
    try {
        document.getElementById("reportDates").innerText = safeGet(data.reportDates);
        document.getElementById("salesData").innerText = safeGet(data.salesData);
        document.getElementById("expensesData").innerText = safeGet(data.expensesData);
        document.getElementById("profitData").innerText = safeGet(data.profitData);
        document.getElementById("profitCAGR").innerText = data.profitCAGR || "N/A";
        document.getElementById("epsData").innerText = safeGet(data.epsData);

        // EPS Growth with color coding
        const epsGrowthElement = document.getElementById("epsGrowth");
        if (data.epsGrowth && data.epsGrowth.length > 0) {
            const growthHTML = data.epsGrowth.map(growth => {
                const numericGrowth = parseFloat(growth);
                const className = numericGrowth >= 0 ? 'eps-growth-positive' : 'eps-growth-negative';
                return `<span class="${className}">${growth}</span>`;
            }).join(", ");
            
            epsGrowthElement.innerHTML = growthHTML;
        } else {
            epsGrowthElement.innerText = "N/A";
        }

        // Hide error message if data is successfully displayed
        const errorMessage = document.getElementById("errorMessage");
        errorMessage.style.display = "none";
    } catch (error) {
        console.error("Error updating popup:", error);
        handleDataError();
    }
}

document.addEventListener("DOMContentLoaded", function () {
    console.log("✅ popup.js loaded.");
    requestDataFromContentScript();
});