/* Wild Camel — push-only service worker.
   No offline caching in v1. This handles exactly two events:
     - push:            show the notification
     - notificationclick: focus/open the app on the Tasks tab
*/

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { title: 'Wild Camel', body: event.data ? event.data.text() : '' }
  }

  const title = payload.title || 'Wild Camel'
  const options = {
    body: payload.body || '',
    icon: payload.icon || './icons/icon-192.png',
    badge: './icons/favicon-256.png',
    tag: payload.tag || 'wildcamel-task',
    data: { url: payload.url || './#/app/tasks' },
    renotify: true,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetPath = (event.notification.data && event.notification.data.url) || './#/app/tasks'

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      // Focus an existing tab if we have one; otherwise open a new one.
      for (const client of allClients) {
        if ('focus' in client) {
          try {
            await client.focus()
            if ('navigate' in client) {
              const url = new URL(targetPath, self.registration.scope).href
              await client.navigate(url)
            }
            return
          } catch {
            // fall through to openWindow
          }
        }
      }
      if (self.clients.openWindow) {
        const url = new URL(targetPath, self.registration.scope).href
        await self.clients.openWindow(url)
      }
    })(),
  )
})
