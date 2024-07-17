document.addEventListener('DOMContentLoaded', async function() {
  const loginForm = document.getElementById('login-form');
  const loginButton = document.getElementById('login-button');
  const loginStatus = document.getElementById('login-status');
  const conversationList = document.getElementById('conversation-list');
  const conversationsUl = document.getElementById('conversations');
  const saveButton = document.getElementById('save-button');

  // Add a troubleshooting button
  const troubleshootButton = document.createElement('button');
  troubleshootButton.textContent = 'Troubleshoot';
  troubleshootButton.addEventListener('click', troubleshoot);
  document.body.appendChild(troubleshootButton);

  console.log('Popup opened, checking credentials...');
  const storage = await browser.storage.sync.get(['nextcloudUrl', 'loginName', 'appPassword']);
  console.log('Stored credentials:', storage);

  if (storage.nextcloudUrl && storage.loginName && storage.appPassword) {
    console.log('Credentials found, attempting to load conversations...');
    loginForm.style.display = 'none';
    await loadConversations();
  } else {
    console.log('No credentials found, displaying login form...');
    loginForm.style.display = 'block';
  }

  loginButton.addEventListener('click', async function() {
    const nextcloudUrl = document.getElementById('nextcloud-url').value;
    if (!nextcloudUrl) {
      alert('Please enter your Nextcloud URL');
      return;
    }

    loginForm.style.display = 'none';
    loginStatus.style.display = 'block';

    try {
      console.log('Initiating Login Flow v2...');
      const response = await fetch(`${nextcloudUrl}/index.php/login/v2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      console.log('Login Flow v2 response:', data);

      browser.tabs.create({ url: data.login });

      pollForToken(nextcloudUrl, data.poll.endpoint, data.poll.token);
    } catch (error) {
      console.error('Error initiating login:', error);
      loginForm.style.display = 'block';
      loginStatus.style.display = 'none';
    }
  });

  async function pollForToken(nextcloudUrl, pollEndpoint, pollToken) {
    try {
      console.log('Polling for token...');
      const response = await fetch(pollEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `token=${encodeURIComponent(pollToken)}`
      });
      const data = await response.json();
      console.log('Poll response:', data);

      if (data.server && data.loginName && data.appPassword) {
        console.log('Login successful, saving credentials...');
        await browser.storage.sync.set({
          nextcloudUrl: nextcloudUrl,
          loginName: data.loginName,
          appPassword: data.appPassword
        });

        loginStatus.style.display = 'none';
        await loadConversations();
      } else {
        console.log('Login not yet complete, continuing to poll...');
        setTimeout(() => pollForToken(nextcloudUrl, pollEndpoint, pollToken), 3000);
      }
    } catch (error) {
      console.error('Error polling for token:', error);
      loginForm.style.display = 'block';
      loginStatus.style.display = 'none';
    }
  }

  async function loadConversations() {
    try {
      console.log('Fetching conversations...');
      const response = await browser.runtime.sendMessage({action: "getConversations"});
      console.log('Conversations response:', response);

      if (response && response.length > 0) {
        conversationsUl.innerHTML = '';
        response.forEach(conversation => {
          const li = document.createElement('li');
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.value = conversation.token;
          checkbox.id = `conversation-${conversation.token}`;
          const label = document.createElement('label');
          label.htmlFor = `conversation-${conversation.token}`;
          label.textContent = conversation.displayName;
          li.appendChild(checkbox);
          li.appendChild(label);
          conversationsUl.appendChild(li);
        });
        conversationList.style.display = 'block';
      } else {
        console.error('No conversations returned');
        conversationList.innerHTML = '<p>No conversations found. Please check your Nextcloud Talk app.</p>';
        conversationList.style.display = 'block';
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
      conversationList.innerHTML = '<p>Error loading conversations. Please try logging in again.</p>';
      conversationList.style.display = 'block';
    }
  }

  saveButton.addEventListener('click', async function() {
    const selectedConversations = Array.from(conversationsUl.querySelectorAll('input:checked'))
      .map(checkbox => checkbox.value);
    try {
      await browser.storage.sync.set({selectedConversations: selectedConversations});
      console.log('Conversations saved:', selectedConversations);
    } catch (error) {
      console.error('Error saving conversations:', error);
    }
  });

  async function troubleshoot() {
    console.log('Starting troubleshooting...');
    const storage = await browser.storage.sync.get(['nextcloudUrl', 'loginName', 'appPassword', 'selectedConversations']);
    console.log('Current storage state:', storage);

    if (storage.nextcloudUrl && storage.loginName && storage.appPassword) {
      console.log('Credentials found, testing API connection...');
      const testResponse = await browser.runtime.sendMessage({action: "testConnection"});
      console.log('API test response:', testResponse);
    } else {
      console.log('No credentials found. Please log in first.');
    }
  }
});