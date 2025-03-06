document.getElementById("fetchData").addEventListener("click", function () {
    document.getElementById("data-container").innerHTML = "<p>Fetching data...</p>";
    
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
        
        // Wait a second and request data
        setTimeout(() => {
          chrome.tabs.sendMessage(tabs[0].id, { action: "extractData" });
        }, 1000);
      });
    });
  });
  
  // Listen for messages from `content.js`
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.extractedData && message.calculatedMetrics) {
      displayData(message.extractedData, message.calculatedMetrics);
    }
  });
  
  /**
   * Display extracted data in popup
   */
  function displayData(extractedData, calculatedMetrics) {
    let content = `<h3>Extracted Data</h3>`;
  
    Object.keys(extractedData.profitLoss).forEach(key => {
      content += `<p><strong>${extractedData.profitLoss[key].label}:</strong> ${extractedData.profitLoss[key].values.join(', ')}</p>`;
    });
  
    content += `<h3>Calculated Metrics</h3>`;
    content += `<p class="metric">Fixed Asset Turnover: ${calculatedMetrics.fixedAssetTurnover.toFixed(2)}</p>`;
    content += `<p class="metric">Return on Fixed Assets: ${calculatedMetrics.returnOnFixedAssets.toFixed(2)}%</p>`;
    content += `<p class="metric">Depreciation to Fixed Assets: ${calculatedMetrics.depreciationToFixedAssets.toFixed(2)}%</p>`;
  
    document.getElementById("data-container").innerHTML = content;
  }
  