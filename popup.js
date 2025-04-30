// Load saved settings when popup opens
document.addEventListener('DOMContentLoaded', function() {
  // Get DOM elements - Tab system
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  
  // Get DOM elements - Creator tab
  const domainInput = document.getElementById('domain');
  const enableSyncToggle = document.getElementById('enableSync');
  const saveButton = document.getElementById('saveSettings');
  const createTokenButton = document.getElementById('createToken');
  const tokenContainer = document.getElementById('tokenContainer');
  const tokenValue = document.getElementById('tokenValue');
  const copyTokenButton = document.getElementById('copyToken');
  
  // Get DOM elements - Consumer tab
  const tokenInput = document.getElementById('token');
  const useTokenButton = document.getElementById('useToken');
  const tokenInfo = document.getElementById('tokenInfo');
  const tokenInfoValue = document.getElementById('tokenInfoValue');
  
  // Get DOM elements - Common
  const serverUrlInput = document.getElementById('serverUrl');
  const statusDiv = document.getElementById('status');
  const lastUpdatedDiv = document.getElementById('lastUpdated');
  
  // Set default values
  domainInput.value = 'chatgpt.com';
  enableSyncToggle.checked = true;
  serverUrlInput.value = 'http://your-server-address:3000';
  
  // Load saved settings
  chrome.storage.local.get(['targetDomain', 'isEnabled', 'serverUrl', 'token', 'mode', 'lastUpdated'], function(result) {
    if (result.targetDomain) {
      domainInput.value = result.targetDomain;
    }
    
    if (result.isEnabled !== undefined) {
      enableSyncToggle.checked = result.isEnabled;
    }
    
    if (result.serverUrl) {
      serverUrlInput.value = result.serverUrl;
    }
    
    if (result.token) {
      tokenInput.value = result.token;
    }
    
    if (result.mode === 'consumer') {
      // Switch to consumer tab
      tabs[1].click();
    }
    
    if (result.lastUpdated) {
      lastUpdatedDiv.textContent = 'Last updated: ' + new Date(result.lastUpdated).toLocaleString();
    }
    
    // Check server status
    checkServerStatus(result.serverUrl || serverUrlInput.value);
  });
  
  // Tab system
  tabs.forEach(tab => {
    tab.addEventListener('click', function() {
      const tabId = this.getAttribute('data-tab');
      
      // Update active tab
      tabs.forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      
      // Update visible content
      tabContents.forEach(content => content.classList.remove('active'));
      document.getElementById(tabId + '-tab').classList.add('active');
      
      // Save the mode
      chrome.storage.local.set({ mode: tabId });
    });
  });
  
  // Save settings when the save button is clicked
  saveButton.addEventListener('click', function() {
    const domain = domainInput.value.trim();
    const isEnabled = enableSyncToggle.checked;
    const serverUrl = serverUrlInput.value.trim();
    
    if (!domain && isEnabled) {
      statusDiv.textContent = 'Error: Please enter a domain to enable synchronization.';
      return;
    }
    
    if (!serverUrl && isEnabled) {
      statusDiv.textContent = 'Error: Please enter a server URL to enable synchronization.';
      return;
    }
    
    // Save settings
    chrome.storage.local.set({
      targetDomain: domain,
      isEnabled: isEnabled,
      serverUrl: serverUrl,
      mode: 'creator'
    }, function() {
      statusDiv.textContent = 'Settings saved successfully!';
      
      // Check server status
      checkServerStatus(serverUrl);
      
      // Clear status message after 3 seconds
      setTimeout(function() {
        statusDiv.textContent = '';
      }, 3000);
    });
  });
  
  // Create token
  createTokenButton.addEventListener('click', function() {
    const domain = domainInput.value.trim();
    const serverUrl = serverUrlInput.value.trim();
    
    if (!domain) {
      statusDiv.textContent = 'Error: Please enter a domain to create a token.';
      return;
    }
    
    if (!serverUrl) {
      statusDiv.textContent = 'Error: Please enter a server URL to create a token.';
      return;
    }
    
    // Create token on server
    fetch(`${serverUrl}/api/token/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ domain: domain })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to create token');
      }
      return response.json();
    })
    .then(data => {
      if (data.success) {
        tokenValue.textContent = data.token;
        tokenContainer.style.display = 'block';
        
        // Save the token locally
        chrome.storage.local.set({
          myToken: data.token
        });
        
        statusDiv.textContent = 'Token created successfully!';
      } else {
        statusDiv.textContent = 'Error creating token: ' + (data.message || 'Unknown error');
      }
    })
    .catch(error => {
      statusDiv.textContent = 'Error: ' + error.message;
    });
  });
  
  // Copy token
  copyTokenButton.addEventListener('click', function() {
    // Copy token to clipboard
    navigator.clipboard.writeText(tokenValue.textContent)
      .then(() => {
        statusDiv.textContent = 'Token copied to clipboard!';
        setTimeout(() => {
          statusDiv.textContent = '';
        }, 2000);
      })
      .catch(err => {
        statusDiv.textContent = 'Failed to copy token: ' + err;
      });
  });
  
  // Use token
  useTokenButton.addEventListener('click', function() {
    const token = tokenInput.value.trim();
    const serverUrl = serverUrlInput.value.trim();
    
    if (!token) {
      statusDiv.textContent = 'Error: Please enter a token.';
      return;
    }
    
    if (!serverUrl) {
      statusDiv.textContent = 'Error: Please enter a server URL.';
      return;
    }
    
    // Validate token on server
    fetch(`${serverUrl}/api/token/${token}/session`)
    .then(response => {
      if (!response.ok) {
        throw new Error('Invalid token');
      }
      return response.json();
    })
    .then(data => {
      tokenInfo.style.display = 'block';
      tokenInfoValue.textContent = `Domain: ${data.domain}`;
      
      // Save token and set mode to consumer
      chrome.storage.local.set({
        token: token,
        targetDomain: data.domain,
        isEnabled: true,
        serverUrl: serverUrl,
        mode: 'consumer'
      });
      
      statusDiv.textContent = 'Token validated and saved successfully!';
      setTimeout(() => {
        statusDiv.textContent = '';
      }, 3000);
    })
    .catch(error => {
      statusDiv.textContent = 'Error: ' + error.message;
    });
  });
  
  // Function to check server status
  function checkServerStatus(url) {
    if (!url) return;
    
    fetch(`${url}/api/status`)
      .then(response => response.json())
      .then(data => {
        lastUpdatedDiv.textContent = `Server status: ${data.status}. Domains: ${data.domains.join(', ') || 'none'}. Tokens: ${data.tokens_count || 0}`;
      })
      .catch(error => {
        lastUpdatedDiv.textContent = `Cannot connect to server. Please check the URL.`;
        console.error('Error checking server status:', error);
      });
  }
}); 