
'use strict';

// This is an old file and should be deleted... I think

const chromium = require('chrome-aws-lambda');
const puppeteer = require('puppeteer');
const lighthouse = require('lighthouse');

// This port will be used by Lighthouse later. The specific port is arbitrary.
const PORT = 8041;

/**
 * @param {import('puppeteer').Browser} browser
 * @param {string} origin
 */
async function login(browser, origin) {
  const page = await browser.newPage();
  await page.goto(origin);
  await page.waitForSelector('input[type="email"]', {visible: true});

  // Fill in and submit login form.
  const emailInput = await page.$('input[type="email"]');
  await emailInput.type('some email');
  const passwordInput = await page.$('input[type="password"]');
  await passwordInput.type('some password');
  await Promise.all([
    page.$eval('.simple_form.user', form => form.submit()),
    page.waitForNavigation(),
  ]);

  await page.close();
}

/**
 * @param {puppeteer.Browser} browser
 * @param {string} origin
 */
async function logout(browser, origin) {
  const page = await browser.newPage();
  await page.goto(`${origin}/logout`);
  await page.close();
}

/**
 * @param {puppeteer.Browser} browser
 * @param {string} url
 */
async function visit(browser, url) {

  const options = {
    port: browser.defaultViewport, // Direct Lighthouse to use the same port.
    preset: 'desktop',
    disableStorageReset: true,
    onlyAudits: [
      'total-blocking-time',
      'server-response-time',
      'interactive',
      'bootup-time',
      'network-rtt',
      'network-server-latency',
      'first-contentful-paint',
      'first-meaningful-paint',
      'total-blocking-time',
    ]
  }

  const result = await lighthouse(url, options);

  return JSON.stringify(result.lhr, null, 2)
}

async function main() {
  // Direct Puppeteer to open Chrome with a specific debugging port.
  const browser = await chromium.puppeteer.launch({
    args: [`--remote-debugging-port=${PORT}`],
    headless: false,
    slowMo: 50,
  });

  // Setup the browser session to be logged into our site.
  await login(browser, 'https://demo.my.redcanary.co/');

  // Test our specifit URL
  const result = await visit(browser, 'https://demo.my.redcanary.co/dashboard')

  // Direct Puppeteer to close the browser as we're done with it.
  await browser.close();

  // Output the result.
  console.log(result);
}

if (require.main === module) {
  main();
} else {
  module.exports = {
    login,
    logout,
    visit
  };
}