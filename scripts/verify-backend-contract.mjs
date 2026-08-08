#!/usr/bin/env node

const origin =
  process.env.ADJUSTER_NETWORK_ORIGIN || 'https://adjusternetwork.org';
const failures = [];

async function request(name, path, options = {}) {
  const response = await fetch(`${origin}${path}`, {
    redirect: 'manual',
    ...options,
  });
  return { name, response };
}

async function main() {
  const checks = await Promise.all([
    request('user API key authorization', '/user-api-key/new', {
      method: 'HEAD',
    }),
    request('mobile basic info', '/site/basic-info.json'),
    request('closed-site boundary', '/site.json'),
    request('web manifest', '/manifest.webmanifest'),
  ]);

  for (const { name, response } of checks) {
    if (name === 'user API key authorization') {
      const version = Number(response.headers.get('auth-api-version'));
      if (response.status !== 200 || version < 2) {
        failures.push(
          `${name}: expected 200 and Auth-Api-Version >= 2; got ${response.status}/${version}`,
        );
      }
    } else if (name === 'mobile basic info') {
      const body = await response.json();
      if (response.status !== 200 || body.login_required !== true) {
        failures.push(
          `${name}: expected 200 with login_required=true; got ${response.status}/${body.login_required}`,
        );
      }
    } else if (name === 'closed-site boundary') {
      if (response.status !== 403) {
        failures.push(
          `${name}: expected anonymous 403; got ${response.status}`,
        );
      }
    } else if (response.status !== 200) {
      failures.push(`${name}: expected 200; got ${response.status}`);
    }
  }

  if (failures.length) {
    console.error(failures.join('\n'));
    process.exitCode = 1;
    return;
  }

  console.log(
    `PASS ${origin}: mobile API v2+, closed-site boundary, basic info, and manifest`,
  );
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
