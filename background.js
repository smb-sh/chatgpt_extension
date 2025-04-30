// Configuration for which domain to synchronize
let targetDomain = 'chatgpt.com';
let isEnabled = true;
let serverUrl = 'http://your-server-address:3000'; // Enter your server address here
let token = ''; // Token for consumer mode
let myToken = ''; // Token for creator mode
let mode = 'creator'; // Default mode: creator

// Listen for changes in the extension's storage
chrome.storage.local.onChanged.addListener((changes, namespace) => {
  if (changes.targetDomain) {
    targetDomain = changes.targetDomain.newValue;
  }
  if (changes.isEnabled) {
    isEnabled = changes.isEnabled.newValue;
  }
  if (changes.serverUrl) {
    serverUrl = changes.serverUrl.newValue;
  }
  if (changes.token) {
    token = changes.token.newValue;
  }
  if (changes.myToken) {
    myToken = changes.myToken.newValue;
  }
  if (changes.mode) {
    mode = changes.mode.newValue;
  }
});

// Initialize configuration from storage
chrome.storage.local.get(['targetDomain', 'isEnabled', 'serverUrl', 'token', 'myToken', 'mode'], (result) => {
  // Use default values if nothing saved before
  if (!result.targetDomain) {
    chrome.storage.local.set({ targetDomain: targetDomain });
  } else {
    targetDomain = result.targetDomain;
  }
  
  if (result.isEnabled === undefined) {
    chrome.storage.local.set({ isEnabled: isEnabled });
  } else {
    isEnabled = result.isEnabled;
  }
  
  if (!result.serverUrl) {
    chrome.storage.local.set({ serverUrl: serverUrl });
  } else {
    serverUrl = result.serverUrl;
  }
  
  if (result.token) {
    token = result.token;
  }
  
  if (result.myToken) {
    myToken = result.myToken;
  }
  
  if (result.mode) {
    mode = result.mode;
  } else {
    chrome.storage.local.set({ mode: mode });
  }
});

// Listen for tab updates to detect when we need to sync
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (isEnabled && changeInfo.status === 'complete' && tab.url && tab.url.includes(targetDomain)) {
    syncSessionData();
  }
});

// Function to sync session data
function syncSessionData() {
  if (!targetDomain || !isEnabled || !serverUrl) return;

  // Get all cookies for the target domain
  chrome.cookies.getAll({ domain: targetDomain }, (cookies) => {
    if (cookies.length > 0) {
      if (mode === 'creator') {
        // Send cookies to server
        if (myToken) {
          // Creator mode with token - use token-based API
          fetch(`${serverUrl}/api/token/${myToken}/sync`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ cookies: cookies })
          })
          .then(response => response.json())
          .then(data => {
            console.log('Cookies synced successfully with token:', data);
          })
          .catch(error => {
            console.error('Error syncing cookies with token:', error);
          });
        } else {
          // Creator mode without token - use regular API
          fetch(`${serverUrl}/api/sessions/${targetDomain}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ cookies: cookies })
          })
          .then(response => response.json())
          .then(data => {
            console.log('Cookies synced successfully:', data);
          })
          .catch(error => {
            console.error('Error syncing cookies:', error);
          });
        }
      }
      // In consumer mode, we don't send cookies
    } else {
      // If no cookies found, get synced cookies from server
      if (mode === 'consumer' && token) {
        // Consumer mode - get cookies using token
        fetch(`${serverUrl}/api/token/${token}/session`)
        .then(response => response.json())
        .then(data => {
          if (data.session && data.session.cookies && data.session.cookies.length > 0) {
            applySyncedCookies(data.session.cookies);
          }
        })
        .catch(error => {
          console.error('Error getting synced cookies with token:', error);
        });
      } else {
        // Creator mode - get cookies directly
        fetch(`${serverUrl}/api/sessions/${targetDomain}`)
        .then(response => response.json())
        .then(data => {
          if (data.cookies && data.cookies.length > 0) {
            applySyncedCookies(data.cookies);
          }
        })
        .catch(error => {
          console.error('Error getting synced cookies:', error);
        });
      }
    }
  });
}

// Function to apply synced cookies
function applySyncedCookies(cookies) {
  if (!cookies || !isEnabled) return;
  
  cookies.forEach(cookieData => {
    // Remove unnecessary properties that can't be set
    delete cookieData.hostOnly;
    delete cookieData.session;
    
    // Add required url property
    const prefix = cookieData.secure ? 'https://' : 'http://';
    cookieData.url = prefix + cookieData.domain + cookieData.path;
    
    // Set the cookie
    chrome.cookies.set(cookieData);
  });
}

// Periodically check for updates
setInterval(() => {
  if (isEnabled && targetDomain && serverUrl) {
    // Only fetch new cookies if we don't have cookies already
    chrome.cookies.getAll({ domain: targetDomain }, (cookies) => {
      if (cookies.length === 0) {
        if (mode === 'consumer' && token) {
          // Consumer mode - get cookies using token
          fetch(`${serverUrl}/api/token/${token}/session`)
          .then(response => response.json())
          .then(data => {
            if (data.session && data.session.cookies && data.session.cookies.length > 0) {
              applySyncedCookies(data.session.cookies);
            }
          })
          .catch(error => {
            console.error('Error checking for updates with token:', error);
          });
        } else {
          // Creator mode - get cookies directly
          fetch(`${serverUrl}/api/sessions/${targetDomain}`)
          .then(response => response.json())
          .then(data => {
            if (data.cookies && data.cookies.length > 0) {
              applySyncedCookies(data.cookies);
            }
          })
          .catch(error => {
            console.error('Error checking for updates:', error);
          });
        }
      }
    });
  }
}, 30000); // Check every 30 seconds 