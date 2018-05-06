var ACCOUNT_BALANCE_API_URL = '*://api.gdax.com/accounts?profile_id=*';

// Used for differentiating between original and replayed requests.
var REPLAY_HEADER_NAME = 'ce-note';
var REPLAY_HEADER_VALUE = 'replay';

var accountInfoRequestURL = '';
var accountInfoRequestHeaders = [];

function isReplay(requestHeaders) {
  for (var i = 0; i < requestHeaders.length; ++i) {
    var header = requestHeaders[i];
    if (header.name == REPLAY_HEADER_NAME &&
        header.value == REPLAY_HEADER_VALUE) {
      return true;
    }
  }
  return false;
}

chrome.webRequest.onSendHeaders.addListener(
    function(details) {
      if (isReplay(details.requestHeaders) || details.method != 'GET') {
        return;
      }
      // Save request, replay later to get response body.
      accountInfoRequestURL = details.url;
      accountInfoRequestHeaders = details.requestHeaders;
      accountInfoRequestHeaders.push(
          {name: REPLAY_HEADER_NAME, value: REPLAY_HEADER_VALUE});
      chrome.tabs.executeScript(null, {file: 'jquery.min.js'}, function() {
        chrome.tabs.executeScript(null, {file: 'content_script.js'});
      });
    },
    {urls: [ACCOUNT_BALANCE_API_URL], types: ['xmlhttprequest']},
    ['requestHeaders']);

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.content == 'getAccountInfoRequestHeaders')
    sendResponse(
        {url: accountInfoRequestURL, headers: accountInfoRequestHeaders});
});
