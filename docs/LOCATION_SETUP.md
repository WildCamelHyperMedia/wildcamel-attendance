# Turning on location for the attendance app

The app labels each check-in **Office**, **Remote**, or **Unknown** using your
device's location. If it shows **Unknown** and never asks for permission, it's
almost always a **one-time device setting** — not a problem with the app.

**Why it works on Windows but not Mac/phones:** macOS, iPhone/iPad and Android
require the *browser itself* to have location permission at the operating-system
level before a website is even allowed to ask. Windows doesn't. When that switch
is off, the browser can't show a prompt, so the check-in falls back to Unknown.

It's a quick fix. Do the steps for your device once, then check in again.

---

## macOS

**Chrome**
1. Apple menu → **System Settings** → **Privacy & Security** → **Location Services** → turn it **On**.
2. In that same list, find **Google Chrome** and switch it **On**.
3. Back in the app, click the icon just left of the web address and set **Location → Allow**.
4. Reload the page and check in again.

**Safari**
1. Apple menu → **System Settings** → **Privacy & Security** → **Location Services** → turn it **On**, and tick **Safari**.
2. Safari → **Settings** → **Websites** → **Location** → set the app's site to **Allow**.
3. Reload the page and check in again.

> If Chrome's checkbox keeps switching itself off, update Chrome first, then
> re-enable it here.

## iPhone & iPad

1. **Settings** → **Privacy & Security** → **Location Services** → turn it **On**.
2. Scroll to **Safari** (or **Chrome**) → set **Location** to **"While Using the App"**.
3. Reopen the app, reload, and tap **Allow** when it asks.

> If you previously tapped "Don't Allow" for the site in Safari, tap the **"aA"**
> button (left of the address bar) → **Website Settings** → **Location** → **Ask**
> or **Allow**, then reload.

## Android (Chrome)

1. Swipe down and make sure **Location** is **On**.
2. **Settings** → **Apps** → **Chrome** → **Permissions** → **Location** → **Allow**.
3. In Chrome, tap the icon left of the address → **Permissions** → **Location** → **Allow**.
4. Reload the page and check in again.

---

## Still stuck?

- In the app, tap **Fix location** when a check-in is marked Unknown — it shows the
  steps for your exact device, and **Try again** re-checks without a new check-in.
- Location only needs to work at **check-in and check-out** — nothing tracks you
  afterwards. It's just to label the day Office vs Remote.
- If none of this works, you can still check in (you'll be marked Unknown); let
  your admin know and they can sort it out.
