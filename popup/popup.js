document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form');
    const loginButton = document.getElementById('login-button');
    const loginStatus = document.getElementById('login-status');
    const conversationList = document.getElementById('conversation-list');
    const conversationsUl = document.getElementById('conversations');
    const saveButton = document.getElementById('save-button');
  
    loginButton.addEventListener('click', async function() {
      const nextcloudUrl = document.getElementById('nextcloud-url').value;
      if (!nextcloudUrl) {
        alert('Please enter your Nextcloud URL');
        return;
      }
  
      loginForm.style.display = 'none';
      loginStatus.style.display = 'block';
  
      try {
        // Initiate Login Flow v2
        const response = await fetch(`${nextcloudUrl}/index.php/login/v2`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        const data = await response.json();
  
        // Open the login URL in a new tab
        browser.tabs.create({ url: data.login });
  
        // Start polling for the token
        pollForToken(nextcloudUrl, data.poll.endpoint, data.poll.token);
      } catch (error) {
        console.error('Error initiating login:', error);
        loginForm.style.display = 'block';
        loginStatus.style.display = 'none';
      }
    });
  
    async function pollForToken(nextcloudUrl, pollEndpoint, pollToken) {
      try {
        const response = await fetch(pollEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: `token=${encodeURIComponent(pollToken)}`
        });
        const data = await response.json();
  
        if (data.server && data.loginName && data.appPassword) {
          // Login successful, save the credentials
          await browser.storage.sync.set({
            nextcloudUrl: nextcloudUrl,
            loginName: data.loginName,
            appPassword: data.appPassword
          });
  
          loginStatus.style.display = 'none';
          conversationList.style.display = 'block';
          loadConversations();
        } else {
          // Continue polling
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
        const response = await browser.runtime.sendMessage({action: "getConversations"});
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
      } catch (error) {
        console.error('Error loading conversations:', error);
      }
    }
  
    saveButton.addEventListener('click', async function() {
      const selectedConversations = Array.from(conversationsUl.querySelectorAll('input:checked'))
        .map(checkbox => checkbox.value);
      try {
        await browser.storage.sync.set({selectedConversations: selectedConversations});
        console.log('Conversations saved');
      } catch (error) {
        console.error('Error saving conversations:', error);
      }
    });
  });