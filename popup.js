document.getElementById('saveTokenButton').addEventListener('click', function() {
  const tokenInput = document.getElementById('tokenInput');
  const token = tokenInput.value.trim();
  
  if (token) {
    chrome.storage.local.set({ 'user_token': token }, function() {
      if (chrome.runtime.lastError) {
        console.error('popup.js: Error saving token:', chrome.runtime.lastError);
        alert('خطا در ذخیره توکن.');
      } else {
        console.log('popup.js: Token saved successfully.');
        alert('توکن با موفقیت ذخیره شد! شروع همگام‌سازی اولیه...');
        tokenInput.value = ''; // Clear the input field

        // Send message to background script to start initial sync
        chrome.runtime.sendMessage({ action: "startInitialSync", token: token }, function(response) {
          if (chrome.runtime.lastError) {
            console.error("popup.js: Error sending message to background:", chrome.runtime.lastError.message);
            // alert("خطا در ارتباط با اسکریپت پس‌زمینه.");
          } else if (response && response.status) {
            console.log("popup.js: Background script response:", response.status);
            // alert(response.status); // Optionally show status to user
          }
        });
      }
    });
  } else {
    alert('لطفاً توکن را وارد کنید.');
  }
});
