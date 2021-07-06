'use strict';

const lighthouse = require('lighthouse');
const chromium = require('chrome-aws-lambda');
const log = require('lighthouse-logger');
var AWS = require('aws-sdk');
AWS.config.update({region: 'us-east-1'});
const bucket = 'rc-portal-performance-stats'
var s3 = new AWS.S3({apiVersion: '2006-03-01'});
var baseURL, subdomain, loginURL;

const lighthouseOptions = {
  output: "json",
  preset: 'desktop',
  onlyAudits: [
    "first-contentful-paint",
    "network-server-latency",
    "first-meaningful-paint",
    "interactive",
    "server-response-time",
    "total-blocking-time"],
  port: 9222
}

const pathsToAudit = [
  'dashboard',
  'automate',
  'users',
  'detections'
]

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index]);
  }
}

async function login(browser, origin, event) {
  const page = await browser.newPage();
  await page.goto(origin);
  await page.waitForSelector('input[type="email"]', {visible: true});

  // Fill in and submit login form.
  const emailInput = await page.$('input[type="email"]');
  await emailInput.type(event.username);
  const passwordInput = await page.$('input[type="password"]');
  await passwordInput.type(event.password);
  await Promise.all([
    page.$eval('.simple_form.user', form => form.submit()),
    page.waitForNavigation(),
  ]);

  await page.close();
}

async function uploadResultsToS3(path, report){
  console.error("Uploading " + path)
  const dateParts = new Date().toISOString().split('T')
  const json = JSON.stringify(report)
  const bucket_name = bucket
  const file_name = `${subdomain}/${path}/${dateParts[0]}/${dateParts[1]}.json`
  var payload = {
    Key: file_name,
    Body: json,
    Bucket: bucket_name,
    CacheControl: 'no-cache'
  };

  await s3.putObject(payload, function (err, data) {
    if (err) {
      console.error('Error uploading data: ', err);
    } else {
      console.error("Finished uploading " + path)
      return {
        name: file_name,
        path: bucket_name
      };
    }
  });
}

async function auditPath(path){
  const url = baseURL + '/' + path;
  console.error("Auditing " + url)
  const result = await lighthouse(url, lighthouseOptions);
  const report = JSON.parse(result.report);
  await uploadResultsToS3(path, report)
}

exports.handler = async (event) => {
  let browser;
  let response;
  let report;
  log.setLevel("error");

  subdomain = event.subdomain
  baseURL = `https://${subdomain}.my.redcanary.co`;

  try {
    browser = await chromium.puppeteer.launch({
      args: [...chromium.args, "--remote-debugging-port=9222"],
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
      ignoreHTTPSErrors: false,
    });

    await login(browser, baseURL + '/dashboard', event);

    await asyncForEach(pathsToAudit, auditPath)

  } catch (error) {
    console.error(error);
    response = {
      statusCode: 500,
      body: error
    }
  } finally {
    if (browser !== null) {
      await browser.close();
    }
  }

  return response;
};

