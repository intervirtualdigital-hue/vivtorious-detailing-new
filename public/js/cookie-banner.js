(function () {
  'use strict';
  var KEY = 'victorious_consent';

  function getChoice() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }

  function setChoice(v) {
    try { localStorage.setItem(KEY, v); } catch (e) {}
    if (window.VictoriousTrack) window.VictoriousTrack.event('cookie_consent', { consentChoice: v });
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function build() {
    var banner = el('div', 'victorious-cookie-banner');
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Cookie consent');

    var textWrap = el('div', 'victorious-cookie-banner__text');
    var strong = el('strong', null, 'We use cookies ');
    textWrap.appendChild(strong);
    textWrap.appendChild(document.createTextNode('to improve your experience, analyze site traffic, and show relevant offers. You can accept, reject, or learn more in our '));
    var link = el('a', null, 'Privacy Policy');
    link.href = '/privacy';
    textWrap.appendChild(link);
    textWrap.appendChild(document.createTextNode('.'));

    var btnWrap = el('div', 'victorious-cookie-banner__buttons');
    var rejectBtn = el('button', 'victorious-cookie-banner__btn victorious-cookie-banner__btn--secondary', 'Reject');
    rejectBtn.type = 'button';
    rejectBtn.setAttribute('data-consent', 'reject');
    var acceptBtn = el('button', 'victorious-cookie-banner__btn victorious-cookie-banner__btn--primary', 'Accept');
    acceptBtn.type = 'button';
    acceptBtn.setAttribute('data-consent', 'accept');
    btnWrap.appendChild(rejectBtn);
    btnWrap.appendChild(acceptBtn);

    banner.appendChild(textWrap);
    banner.appendChild(btnWrap);

    banner.addEventListener('click', function (e) {
      var choice = e.target.getAttribute && e.target.getAttribute('data-consent');
      if (!choice) return;
      setChoice(choice);
      banner.classList.add('victorious-cookie-banner--hidden');
      setTimeout(function () { banner.remove(); }, 400);
    });

    document.body.appendChild(banner);
    requestAnimationFrame(function () { banner.classList.add('victorious-cookie-banner--visible'); });
  }

  function init() {
    if (getChoice()) return;
    if (document.body) build();
    else document.addEventListener('DOMContentLoaded', build);
  }

  init();
})();
