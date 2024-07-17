let nextcloudUrl = '';
let loginName = '';
let appPassword = '';
let conversations = [];

browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus.create({
    id: "sendToNextcloudTalk",
    title: "Send to Nextcloud Talk",
    contexts: ["selection", "link", "image"]
  });
});

browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "sendToNextcloudTalk") {
    sendToNextcloudTalk(info, tab);
  }
});

async function sendToNextcloudTalk(info, tab) {
  try {
    const result = await browser.storage.sync.get(['selectedConversation', 'nextcloudUrl', 'loginName', 'appPassword']);
    const conversationId = result.selectedConversation;
    nextcloudUrl = result.nextcloudUrl;
    loginName = result.loginName;
    appPassword = result.appPassword;

    if (!conversationId || !nextcloudUrl || !loginName || !appPassword) {
      console.error('Missing required information');
      return;
    }

    let message = '';
    if (info.selectionText) {
      message = info.selectionText;
    } else if (info.linkUrl) {
      message = info.linkUrl;
    } else if (info.srcUrl) {
      message = info.srcUrl;
    }

    const response = await fetch(`${nextcloudUrl}/ocs/v2.php/apps/spreed/api/v1/chat/${conversationId}`, {
      method: 'POST',
      headers: {
        'OCS-APIRequest': 'true',
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + btoa(loginName + ':' + appPassword)
      },
      body: JSON.stringify({ message })
    });
    const data = await response.json();
    console.log('Message sent:', data);
  } catch (error) {
    console.error('Error:', error);
  }
}

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getConversations") {
    fetchConversations().then(sendResponse);
    return true; // Indicates that the response is sent asynchronously
  } else if (request.action === "testConnection") {
    testConnection().then(sendResponse);
    return true; // Indicates that the response is sent asynchronously
  }
});

async function fetchConversations() {
  try {
    const result = await browser.storage.sync.get(['nextcloudUrl', 'loginName', 'appPassword']);
    nextcloudUrl = result.nextcloudUrl;
    loginName = result.loginName;
    appPassword = result.appPassword;

    if (!nextcloudUrl || !loginName || !appPassword) {
      console.error('Missing required information');
      return [];
    }

    console.log('Fetching conversations from:', `${nextcloudUrl}/ocs/v2.php/apps/spreed/api/v4/room`);
    const response = await fetch(`${nextcloudUrl}/ocs/v2.php/apps/spreed/api/v4/room`, {
      headers: {
        'OCS-APIRequest': 'true',
        'Authorization': 'Basic ' + btoa(loginName + ':' + appPassword)
      }
    });
    const data = await response.json();
    console.log('Conversations API response:', data);
    if (data && data.ocs && data.ocs.data) {
      conversations = data.ocs.data;
      return conversations;
    } else {
      console.error('Unexpected response format:', data);
      return [];
    }
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return [];
  }
}

async function testConnection() {
  try {
    const result = await browser.storage.sync.get(['nextcloudUrl', 'loginName', 'appPassword']);
    nextcloudUrl = result.nextcloudUrl;
    loginName = result.loginName;
    appPassword = result.appPassword;

    if (!nextcloudUrl || !loginName || !appPassword) {
      return { success: false, error: 'Missing credentials' };
    }

    const response = await fetch(`${nextcloudUrl}/ocs/v1.php/cloud/capabilities`, {
      headers: {
        'OCS-APIRequest': 'true',
        'Authorization': 'Basic ' + btoa(loginName + ':' + appPassword)
      }
    });
    const data = await response.json();
    
    if (data && data.ocs && data.ocs.data) {
      return { success: true, data: data.ocs.data };
    } else {
      return { success: false, error: 'Unexpected response format', data: data };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}