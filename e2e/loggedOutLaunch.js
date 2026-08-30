import { by, device, element, waitFor } from 'detox';

export async function waitForLoggedOutWelcome() {
  const welcome = element(by.id('logged-out-welcome-scroll'));

  try {
    await waitFor(welcome).toExist().withTimeout(15000);
  } catch {
    // The remote-update-first staging runtime may activate its first update
    // only after one bounded relaunch. Preserve installed state when retrying.
    await device.launchApp({ newInstance: true });
    await waitFor(welcome).toExist().withTimeout(30000);
  }
}
