(function () {
  'use strict';

  var SESSION_KEY = 'victorious_sid';
  var CONSENT_KEY = 'victorious_consent';
  var UTM_KEY = 'victoriousUTM';

  function uuid() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  function getSessionId() {
    var sid = null;
    try { sid = localStorage.getItem(SESSION_KEY); } catch (e) {}
    if (!sid) {
      sid = uuid();
      try { localStorage.setItem(SESSION_KEY, sid); } catch (e) {}
    }
    return sid;
  }

  function getConsent() {
    try { return localStorage.getItem(CONSENT_KEY) || 'unset'; } catch (e) { return 'unset'; }
  }

  function captureUTM() {
    var params = new URLSearchParams(window.location.search);
    var utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
    var found = {};
    var has = false;
    utmKeys.forEach(function (k) {
      if (params.has(k)) { found[k.replace('utm_', '')] = params.get(k); has = true; }
    });
    if (has) {
      try { localStorage.setItem(UTM_KEY, JSON.stringify(found)); } catch (e) {}
      return found;
    }
    try {
      var stored = localStorage.getItem(UTM_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return {};
  }

  function send(type, props) {
    props = props || {};
    var body = {
      type: type,
      page: window.location.pathname,
      sessionId: getSessionId(),
      consent: getConsent(),
      referrer: document.referrer || null,
      utm: captureUTM()
    };
    if (props.vehicleType) body.vehicleType = props.vehicleType;
    if (props.packageName) body.packageName = props.packageName;
    if (props.priceTotal != null) body.priceTotal = props.priceTotal;
    if (props.city) body.city = props.city;

    try {
      if (navigator.sendBeacon) {
        var blob = new Blob([JSON.stringify(body)], { type: 'application/json' });
        navigator.sendBeacon('/api/event', blob);
      } else {
        fetch('/api/event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          keepalive: true
        }).catch(function () {});
      }
    } catch (e) { /* swallow */ }
  }

  window.VictoriousTrack = {
    event: send,
    sessionId: getSessionId,
    consent: getConsent
  };

  // Auto-fire page_view on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { send('page_view'); });
  } else {
    send('page_view');
  }
})();
