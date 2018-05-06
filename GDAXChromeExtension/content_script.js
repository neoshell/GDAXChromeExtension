var UNSAFE_HEADER_NAME =
    new Set(['Origin', 'User-Agent', 'Referer', 'Accept-Encoding']);

var BTC_PRICE_API_URL = 'https://api.gdax.com/products/BTC-USD/trades';
var BCH_PRICE_API_URL = 'https://api.gdax.com/products/BCH-USD/trades';
var ETH_PRICE_API_URL = 'https://api.gdax.com/products/ETH-USD/trades';
var LTC_PRICE_API_URL = 'https://api.gdax.com/products/LTC-USD/trades';

var CHECK_BOX_BALANCE_UNIT_ID = 'ce-gdax-balance-unit-control';

var accountInfo = new Map()
                      .set('USD', {price: 0.0, available: 0.0, total: 0.0})
                      .set('BTC', {price: 0.0, available: 0.0, total: 0.0})
                      .set('BCH', {price: 0.0, available: 0.0, total: 0.0})
                      .set('ETH', {price: 0.0, available: 0.0, total: 0.0})
                      .set('LTC', {price: 0.0, available: 0.0, total: 0.0});
var availableSumInUSD = 0.0;
var totalSumInUSD = 0.0;

function xhrGetAsync(url, requestHeaders, callback) {
  var xhr = new XMLHttpRequest();
  xhr.onreadystatechange = function() {
    if (xhr.readyState == 4 && xhr.status == 200) {
      callback(xhr.responseText);
    }
  };
  xhr.open('GET', url, true);
  for (var i = 0; i < requestHeaders.length; ++i) {
    var header = requestHeaders[i];
    if (!UNSAFE_HEADER_NAME.has(header.name)) {
      xhr.setRequestHeader(header.name, header.value);
    }
  }
  xhr.send(null);
}

function isSideBarLoaded() {
  return $('a[class^="TabbedSidebar"]').length != 0;
}

function getAccountInfo(callback) {
  chrome.runtime.sendMessage(
      {content: 'getAccountInfoRequestHeaders'}, function(response) {
        var accountInfoRequestURL = response.url;
        var accountInfoRequestHeaders = response.headers;
        xhrGetAsync(accountInfoRequestURL, accountInfoRequestHeaders, callback);
      });
}

function parseAccountInfo(accountInfoRaw) {
  var accountInfoJson = JSON.parse(accountInfoRaw);
  for (var i = 0; i < accountInfoJson.length; ++i) {
    var item = accountInfoJson[i];
    var currency = item.currency;
    accountInfo.get(currency).available = parseFloat(item.available);
    accountInfo.get(currency).total = parseFloat(item.balance);
  }
}

function getPriceForCurrency(currency, url, callback) {
  xhrGetAsync(url, [], function(responseText) {
    var price = parseFloat(JSON.parse(responseText)[0].price);
    accountInfo.get(currency).price = price;
    callback();
  });
}

function getPrice(callback) {
  accountInfo.get('USD').price = 1.0;
  getPriceForCurrency('BTC', BTC_PRICE_API_URL, function() {
    getPriceForCurrency('BCH', BCH_PRICE_API_URL, function() {
      getPriceForCurrency('ETH', ETH_PRICE_API_URL, function() {
        getPriceForCurrency('LTC', LTC_PRICE_API_URL, function() {
          callback();
        });
      });
    });
  });
}

function computeBalanceInUSD() {
  accountInfo.forEach(function(item, key, mapObj) {
    availableSumInUSD += item.price * item.available;
    totalSumInUSD += item.price * item.total;
  });
}

function changeBalanceUnit() {
  var isInUSD = $('input#' + CHECK_BOX_BALANCE_UNIT_ID)[0].checked;
  var aTabbedSidebarList = $('a[class^="TabbedSidebar"]');
  for (var i = 1; i < aTabbedSidebarList.length - 1; ++i) {
    var currency =
        aTabbedSidebarList[i].children[0].children[0].childNodes[0].textContent;
    var spanAvailable =
        aTabbedSidebarList[i].children[1].children[0].children[2];
    var spanTotal = aTabbedSidebarList[i].children[1].children[1].children[2];
    var accountInfoValue = accountInfo.get(currency);
    var availableValue = accountInfoValue.available;
    var totalValue = accountInfoValue.total;
    if (isInUSD) {
      spanAvailable.textContent =
          '≈$ ' + (availableValue * accountInfoValue.price).toFixed(2);
      spanTotal.textContent =
          '≈$ ' + (totalValue * accountInfoValue.price).toFixed(2);
    } else {
      spanAvailable.textContent = availableValue.toFixed(2);
      spanTotal.textContent = totalValue.toFixed(2);
    }
  }
}

function addSumToPage() {
  var ulFlexHiddenScrollbars =
      $('div[class^="FlexHiddenScrollbars_scroller"]')[0].firstChild;
  if (ulFlexHiddenScrollbars.children.length > 5) {
    console.log('Page already updated.');
    return;
  }
  var hr = document.createElement('hr');
  hr.style = 'height: 1px; border: none; border-top: 1px solid #999999;';
  var li = ulFlexHiddenScrollbars.children[1].cloneNode(true);
  ulFlexHiddenScrollbars.appendChild(hr);
  ulFlexHiddenScrollbars.appendChild(li);

  var aTabbedSidebarEntry = li.firstChild;
  var divSc = aTabbedSidebarEntry.firstChild.firstChild;
  divSc.removeChild(divSc.childNodes[2]);
  divSc.removeChild(divSc.childNodes[1]);
  divSc.textContent = 'SUM';
  aTabbedSidebarEntry.children[1].children[0].children[2].textContent =
      availableSumInUSD.toFixed(2);
  aTabbedSidebarEntry.children[1].children[1].children[2].textContent =
      totalSumInUSD.toFixed(2);

  aTabbedSidebarEntry.innerHTML += '<div style="margin: 30px 0 0 0;">' +
      '<input type="checkbox" id="' + CHECK_BOX_BALANCE_UNIT_ID + '" ' +
      'style="vertical-align: middle; margin: 0 5px 0 0;">' +
      'Show balance in USD' +
      '</div>';
  var checkBoxBalanceUnit = $('input#' + CHECK_BOX_BALANCE_UNIT_ID)[0];
  checkBoxBalanceUnit.checked = false;
  checkBoxBalanceUnit.onclick = changeBalanceUnit;
}

function main() {
  // Repeat until the side bar get loaded.
  var intervalId = setInterval(function() {
    if (isSideBarLoaded()) {
      clearInterval(intervalId);
      getAccountInfo(function(accountInfoRaw) {
        parseAccountInfo(accountInfoRaw);
        getPrice(function() {
          computeBalanceInUSD();
          addSumToPage();
        });
      });
    } else {
      console.log('Side bar has not been loaded.');
    }
  }, 1000);  // 1s
}

main();
