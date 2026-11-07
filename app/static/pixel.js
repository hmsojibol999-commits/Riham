/* RIHAM — Meta Pixel + GA4 loader.
   Inline scripts are blocked by the site's CSP, so tracking lives in this external file.
   IDs come from Admin → ওয়েবসাইট সেটিংস → SEO ও Analytics. Nothing loads if the IDs are empty/invalid. */
(function () {
  var queue = [], ready = false, configured = false, usePixel = false, useGA = false;

  function loadPixel(id) {
    if (window.fbq) return;
    var n = window.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
    if (!window._fbq) window._fbq = n;
    n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
    var s = document.createElement('script');
    s.async = true; s.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(s);
    window.fbq('init', id);
    window.fbq('track', 'PageView');
  }

  function loadGA(id) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', id);
    var s = document.createElement('script');
    s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
    document.head.appendChild(s);
  }

  function send(name, data) {
    data = data || {};
    try { if (usePixel && window.fbq) window.fbq('track', name === 'GenerateLead' ? 'Lead' : name, data); } catch (e) {}
    try {
      if (useGA && window.gtag) {
        var map = { GenerateLead: 'generate_lead', InitiateCheckout: 'begin_checkout', ViewContent: 'view_item' };
        window.gtag('event', map[name] || name, {
          currency: data.currency, value: data.value,
          transaction_id: data.transaction_id || data.order_invoice,
          items: (data.contents || []).map(function (c) { return { item_id: String(c.id), quantity: c.quantity, price: c.item_price }; })
        });
      }
    } catch (e) {}
  }

  // Public helper used by the shared home and product-landing mode in app.js
  window.rihamTrack = function (name, data) {
    if (!ready) { queue.push([name, data]); return; }
    send(name, data);
  };

  // app.js / info.js pass the settings they already fetched. This avoids
  // a second /api/settings request on every storefront page.
  window.rihamConfigureAnalytics = function (settings) {
    if (configured) return;
    configured = true;
    settings = settings || {};
    var px = String(settings.meta_pixel_id || '').trim();
    var ga = String(settings.ga4_measurement_id || '').trim();
    if (/^\d{8,20}$/.test(px)) { usePixel = true; loadPixel(px); }
    if (/^G-[A-Za-z0-9]{4,20}$/.test(ga)) { useGA = true; loadGA(ga); }
    ready = true;
    queue.splice(0).forEach(function (q) { send(q[0], q[1]); });
  };
})();
