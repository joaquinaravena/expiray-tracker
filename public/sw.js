self.addEventListener("push", function (event) {
  if (!event.data) return;
  let payload = { title: "Vencimientos", body: "" };
  try {
    const data = event.data.json();
    if (data && typeof data === "object") {
      if (data.title) payload.title = data.title;
      if (data.body) payload.body = data.body;
    }
  } catch (_) {
    payload.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: "vencimientos-alert",
      icon: "/favicon.ico",
    })
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      if (clientList.length > 0 && clientList[0].focus) {
        clientList[0].focus();
      }
      if (clientList.length > 0 && clientList[0].navigate) {
        clientList[0].navigate("/");
      } else {
        self.clients.openWindow("/");
      }
    })
  );
});
