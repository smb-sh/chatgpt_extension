const BASE_SERVER_URL = 'http://127.0.0.1:5151/api';
// GET_COOKIES_URL will be constructed dynamically with the token
const UPDATE_COOKIES_URL = `${BASE_SERVER_URL}/update_cookies`;
const TARGET_DOMAIN = "google.com"; // دامنه اصلی برای همگام سازی دو طرفه اولیه
const PERIODIC_SYNC_ALARM_NAME = "periodicCookieSync";
const SYNC_INTERVAL_MINUTES = 1;

let isSyncingFromServer = false; // Flag to prevent loops

// --- Helper Functions ---
async function getToken() {
  try {
    const result = await chrome.storage.local.get('user_token');
    return result.user_token;
  } catch (error) {
    console.error('background.js: Error retrieving token:', error);
    return null;
  }
}

// --- Core Sync Logic ---

// 1. Fetch cookies from server and set them in the browser
async function fetchAndSetCookiesFromServer(userToken) {
  if (!userToken) {
    console.log("background.js: fetchAndSetCookiesFromServer - No user token, skipping.");
    return { success: false, message: "No user token" };
  }
  console.log("background.js: Attempting to fetch cookies from server...");
  isSyncingFromServer = true;
  let cookiesSetCount = 0;

  const getCookiesUrlWithToken = `${BASE_SERVER_URL}/get_cookies/${userToken}`;
  console.log("background.js: Fetching from URL:", getCookiesUrlWithToken);

  try {
    const response = await fetch(getCookiesUrlWithToken, { // URL now includes token
      method: 'GET',
      headers: {
        // 'Authorization': `Bearer ${userToken}`, // Server expects token in URL path, not header for this endpoint
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 404) {
        console.log("background.js: Server returned 404 (No cookies for this token or endpoint issue).");
        isSyncingFromServer = false;
        // This is now the signal that the server has no cookies for this user (as per server logic)
        return { success: true, cookiesReceived: false, message: "Server has no cookies for this user (404)." };
    }
    if (!response.ok) {
      console.error(`background.js: Error fetching cookies from server. Status: ${response.status}`);
      isSyncingFromServer = false;
      return { success: false, message: `Server error: ${response.status}` };
    }

    const cookiesToSet = await response.json();
    console.log("background.js: Received cookies from server:", cookiesToSet);

    if (!Array.isArray(cookiesToSet)) {
        console.error("background.js: Invalid format for cookies from server. Expected an array.");
        isSyncingFromServer = false;
        return { success: false, message: "Invalid format from server" };
    }
    
    // No need to check cookiesToSet.length === 0 specifically if 404 is the indicator for no cookies

    for (const cookie of cookiesToSet) {
      if (!cookie.name || !cookie.value || !cookie.domain) {
        console.warn("background.js: Skipping invalid cookie object from server:", cookie);
        continue;
      }
      const protocol = cookie.secure ? "https://" : "http://";
      const cleanDomain = cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain;
      const url = protocol + cleanDomain + (cookie.path || "/");

      let cookieDetails = {
        url: url,
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path || '/',
      };
      if (cookie.secure !== undefined) cookieDetails.secure = cookie.secure;
      if (cookie.httpOnly !== undefined) cookieDetails.httpOnly = cookie.httpOnly;
      if (cookie.expirationDate !== undefined) cookieDetails.expirationDate = cookie.expirationDate;
      if (cookie.sameSite) cookieDetails.sameSite = cookie.sameSite;

      try {
        await chrome.cookies.set(cookieDetails);
        cookiesSetCount++;
      } catch (error) {
        console.error("background.js: Error setting cookie:", cookie.name, error, "Details:", cookieDetails);
      }
    }
    console.log(`background.js: Finished setting cookies. ${cookiesSetCount} cookies processed.`);
    isSyncingFromServer = false;
    return { success: true, cookiesReceived: true, count: cookiesSetCount, message: "Cookies fetched and set." };

  } catch (error) {
    console.error("background.js: General error in fetchAndSetCookiesFromServer:", error);
    isSyncingFromServer = false;
    return { success: false, message: `Fetch/set error: ${error.message}` };
  }
}

// 2. Send current browser cookies (for a specific domain) to the server
async function sendCookieToServer(userToken, cookieObject) {
    if (!userToken) { 
        console.error("background.js: sendCookieToServer - User token is missing, empty, or invalid. Aborting send.");
        return false;
    }
    if (!cookieObject || Object.keys(cookieObject).length === 0) {
        console.error("background.js: sendCookieToServer - Cookie object is missing or empty. Aborting send.", cookieObject);
        return false;
    }

    // console.log(`background.js: Preparing to send. UserToken type: ${typeof userToken}, value: "${userToken}"`);
    // console.log(`background.js: CookieObject type: ${typeof cookieObject}, value:`, JSON.stringify(cookieObject, null, 2));

    const payload = {
        token: userToken, 
        cookie: cookieObject
    };
    
    let jsonPayloadString;
    try {
        jsonPayloadString = JSON.stringify(payload);
    } catch (e) {
        console.error("background.js: sendCookieToServer - Error stringifying payload:", e, "Payload was:", payload);
        return false;
    }

    if (!jsonPayloadString || jsonPayloadString === "{}") { // بررسی اضافه شده برای اطمینان از payload معتبر
        console.error("background.js: sendCookieToServer - JSON payload string is empty or invalid after stringify. Aborting send. Payload was:", payload);
        return false;
    }

    console.log("background.js: Payload for /api/update_cookies (stringified):", jsonPayloadString);

    try {
        const response = await fetch(UPDATE_COOKIES_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userToken}` 
            },
            body: jsonPayloadString // استفاده از رشته JSON شده
        });

        const responseText = await response.text(); 
        if (response.ok) {
            console.log("background.js: Successfully sent cookie to server:", cookieObject.name, "Response:", responseText);
            return true;
        } else {
            console.error(`background.js: Error sending cookie ${cookieObject.name} to server. Status: ${response.status}`, "Response:", responseText);
            return false;
        }
    } catch (error) {
        console.error(`background.js: Network error sending cookie ${cookieObject.name} to server:`, error);
        return false;
    }
}

async function sendDomainCookiesToServer(userToken, domain) {
  if (!userToken || !domain) {
    console.log("background.js: sendDomainCookiesToServer - Missing token or domain.");
    return { success: false, message: "Missing token or domain" };
  }
  console.log(`background.js: Getting cookies for domain ${domain} to send to server...`);
  try {
    const browserCookies = await chrome.cookies.getAll({ domain: domain });
    if (browserCookies.length === 0) {
      console.log(`background.js: No cookies found in browser for domain ${domain}.`);
      return { success: true, sentCount: 0, message: "No local cookies to send." };
    }

    let sentCount = 0;
    for (const cookie of browserCookies) {
      const cookieToSend = {
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path,
          secure: cookie.secure,
          httpOnly: cookie.httpOnly,
          expirationDate: cookie.expirationDate,
      };
      if(await sendCookieToServer(userToken, cookieToSend)){
          sentCount++;
      }
    }
    return { success: true, sentCount: sentCount, message: `${sentCount} cookies sent to server.` };
  } catch (error) {
    console.error(`background.js: Error getting or sending cookies for domain ${domain}:`, error);
    return { success: false, message: `Error processing domain ${domain}: ${error.message}` };
  }
}

// 3. Initial Sync Logic (triggered by popup)
async function handleInitialSync() {
  console.log("background.js: Starting initial sync process...");
  const userToken = await getToken();
  if (!userToken) {
    console.error("background.js: Initial sync failed - no user token.");
    return "Initial sync: No token.";
  }

  const fetchResult = await fetchAndSetCookiesFromServer(userToken);

  // Server logic: if token not in cookies_data, it returns 404 for get_cookies.
  // So, if fetchResult.cookiesReceived is false (due to 404 or other non-ok but handled status),
  // it implies server has no cookies for this user.
  if (fetchResult.success && !fetchResult.cookiesReceived) {
    console.log("background.js: Initial sync - Server has no cookies (or 404). Sending browser cookies for TARGET_DOMAIN.");
    await sendDomainCookiesToServer(userToken, TARGET_DOMAIN);
    return "Initial sync: Server had no cookies, local cookies for target domain sent.";
  } else if (fetchResult.success && fetchResult.cookiesReceived) {
    return `Initial sync: ${fetchResult.count} cookies fetched from server and set.`;
  } else {
    return `Initial sync: Failed to fetch cookies from server. ${fetchResult.message}`;
  }
}


// --- Event Listeners ---

// Listener for onChanged (sending to server)
if (chrome.cookies) {
  console.log("background.js: chrome.cookies API is available. Adding onChanged listener.");
  chrome.cookies.onChanged.addListener(async (changeInfo) => {
    if (isSyncingFromServer) {
      console.log("background.js: onChanged - Syncing from server, skipping send for:", changeInfo.cookie.name);
      return;
    }
    if (changeInfo.removed) {
        // console.log("background.js: onChanged - Cookie removed, not sending to server:", changeInfo.cookie.name);
        // Decide if removed cookies should be propagated. For now, no.
        return;
    }

    if (changeInfo.cookie.domain && changeInfo.cookie.domain.includes(TARGET_DOMAIN)) {
      const userToken = await getToken();
      if (!userToken) return;
      
      let cookieToSend = {
          name: changeInfo.cookie.name,
          value: changeInfo.cookie.value,
          domain: changeInfo.cookie.domain,
          path: changeInfo.cookie.path,
          secure: changeInfo.cookie.secure,
          httpOnly: changeInfo.cookie.httpOnly,
          expirationDate: changeInfo.cookie.expirationDate 
      };
      await sendCookieToServer(userToken, cookieToSend);
    }
  });
} else {
  console.error("background.js: chrome.cookies API is not available.");
}

// Listener for messages from popup (e.g., to start initial sync)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("background.js: Message received:", request);
  if (request.action === "startInitialSync") {
    handleInitialSync().then(status => sendResponse({ status: status }));
    initializeAlarms(); // Ensure alarm is set/reset when a new token/sync is triggered
    return true; 
  }
  // Add other message handlers if needed
  return false; // No async response
});

// Listener for Alarms (periodic sync)
chrome.alarms.onAlarm.addListener(async (alarm) => {
  console.log("background.js: Alarm triggered:", alarm.name);
  if (alarm.name === PERIODIC_SYNC_ALARM_NAME) {
    console.log("background.js: Periodic sync alarm. Fetching cookies from server.");
    const userToken = await getToken();
    if (userToken) {
      await fetchAndSetCookiesFromServer(userToken);
    } else {
      console.log("background.js: Periodic sync - No token, skipping fetch from server.");
    }
  }
});

// --- Initialization ---
// Create the alarm when the extension starts or when a token is available.
// It's better to create it once a token is confirmed.
// For simplicity, we'll try to create it. If a token isn't there, periodic sync won't do much.
async function initializeAlarms() {
    const token = await getToken();
    if (token) {
        console.log("background.js: Token found. Ensuring periodic sync alarm is set.");
        chrome.alarms.get(PERIODIC_SYNC_ALARM_NAME, (existingAlarm) => {
            if (!existingAlarm) {
                chrome.alarms.create(PERIODIC_SYNC_ALARM_NAME, {
                    delayInMinutes: 0.2, // Slightly longer delay to allow manual sync first if needed
                    periodInMinutes: SYNC_INTERVAL_MINUTES
                });
                console.log("background.js: Periodic sync alarm created.");
            } else {
                console.log("background.js: Periodic sync alarm already exists.");
            }
        });
    } else {
        console.log("background.js: No token found on init. Alarm will not be effective until token is set.");
        // Consider clearing the alarm if no token, or let it try and fail silently.
        // chrome.alarms.clear(PERIODIC_SYNC_ALARM_NAME);
    }
}

// Run initialization
initializeAlarms();

// Also, re-initialize alarms if a new token is set (e.g. after initial sync message from popup)
// This can be done by calling initializeAlarms() again after token is known to be set.
// The 'startInitialSync' message from popup implies a token has just been set.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "startInitialSync" && request.token) {
        // Token has been set/updated, ensure alarm is active
        initializeAlarms(); 
        // The actual initial sync logic is handled by the other listener for this message.
        // This is just to re-trigger alarm setup if it wasn't done because token was missing.
    }
});


console.log("background.js: Script loaded and listeners attached.");

// Consider adding a listener for chrome.runtime.onStartup to re-initialize alarms
chrome.runtime.onStartup.addListener(() => {
    console.log("background.js: Extension started up. Initializing alarms.");
    initializeAlarms();
});
