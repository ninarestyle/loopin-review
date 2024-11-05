// background.ts
function initiateOAuth() {
  const client_id = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const redirect_uri = chrome.identity.getRedirectURL();
  const auth_url = `https://accounts.google.com/o/oauth2/auth?client_id=${client_id}&response_type=token id_token&redirect_uri=${redirect_uri}&scope=openid profile email`;

  chrome.identity.launchWebAuthFlow({
      url: auth_url,
      interactive: true
  }, (redirect_url) => {
      if (chrome.runtime.lastError || !redirect_url) {
          console.error('Authentication failed:', chrome.runtime.lastError);
          return;
      }
      // Parsing both access token and ID token
      const urlParams = new URLSearchParams(new URL(redirect_url).hash.substring(1));
      const access_token = urlParams.get('access_token');
      const id_token = urlParams.get('id_token');

      if (access_token && id_token) {
        fetchAdditionalUserInfo(access_token, id_token);
      }
  });
}

function fetchAdditionalUserInfo(accessToken: string, idToken: string) {
  const userInfoUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/google/token`;
  fetch(userInfoUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      accessToken,
      idToken,
      clientType: 1
    })
  })
  .then(response => response.json())
  .then(data => {
    const response = data?.data;
    if (response?.payload?.jwt) {
      chrome.storage.local.set(
        { 
          jwtToken: response.payload.jwt 
        });
      console.log("JWT Token saved locally.");
    } else {
      console.error("JWT Token not returned from server.");
    }
  })
  .catch(error => {
    console.error('Failed to fetch user data:', error);
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'login') {
    initiateOAuth();
    sendResponse({status: 'Attempting to authenticate'});
  }
});

function polling() {
  chrome.storage.local.get(['jwtToken'], (result) => {
      if (result.jwtToken) {
          console.log("Polling with JWT Token:", result.jwtToken);
      } else {
          console.log("JWT Token not found, cannot poll.");
      }
  });
  setTimeout(polling, 1000 * 30);  // Poll every 30 seconds
}

polling();
