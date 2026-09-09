import { by, device, element, waitFor } from 'detox';

// The element-level waits below are deliberately unchanged. The flake this
// helper is associated with was never the matcher: it was the outer Jest
// hook/test budget in e2e/jest.config.js, which a cold-boot reinstall could
// exceed before these waits had a chance to run. Keep the assertions strict.
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
