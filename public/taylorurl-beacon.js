(function () {
  "use strict";

  var BASE_URL = "https://gujgtjqqurildqurpffh.supabase.co/functions/v1/analytics-service";
  var API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1amd0anFxdXJpbGRxdXJwZmZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5MTkxOTAsImV4cCI6MjA3OTQ5NTE5MH0.9jd6izem9wvp9RgYvlzgLhjSAiRxfsCfTxuIQHOunZc";
  var HEARTBEAT_INTERVAL_MS = 30000;

  var script = document.currentScript;
  var project = script && script.getAttribute("data-project");
  if (!project) return;

  function post(endpoint, body) {
    fetch(BASE_URL + "/" + endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": API_KEY,
        "Authorization": "Bearer " + API_KEY,
      },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(function () {});
  }

  function trackPageView() {
    post("track", {
      project: project,
      page_url: location.pathname + location.search,
      referrer: document.referrer || null,
    });
  }

  function sendHeartbeat() {
    post("heartbeat", { project: project });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", trackPageView);
  } else {
    trackPageView();
  }

  setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
})();
