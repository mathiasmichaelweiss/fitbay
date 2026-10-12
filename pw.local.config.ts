import base from '/home/claude/fitbay/playwright.config';
export default { ...base, testDir: '/home/claude/fitbay/e2e', projects: [{ name: 'mobile', use: { ...base.projects![0]!.use, launchOptions: { executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' } } }] };
