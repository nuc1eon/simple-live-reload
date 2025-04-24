const { mkdtemp } = require("node:fs/promises");
const { spawn } = require("node:child_process");
const express = require("express");
const path = require("path");

const contentTypes = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".bmp": "image/bmp",
};

module.exports.createTestServer = function createTestServer() {
  const app = express();

  const idleContent =
    '<i>test server idle</i><meta http-equiv="refresh" content="1;url=/index.html">';

  addBaseRoutes(app, () => {});
  addFinalRoute(app, () => {});

  async function startTest(timeoutSec, callback) {
    app.router.stack.length = 0;

    const { requests, requestLogger } = createRequestLogger();
    app.use(requestLogger);

    const start = promiseWithResolvers();
    const end = promiseWithResolvers();

    app.use(createTestWrapper(timeoutSec, start.resolve));

    addBaseRoutes(app, end.resolve);
    callback(app); // test logic is like a big middleware
    addFinalRoute(app);

    const collectRequests = async () => {
      await end.promise;
      return requests;
    };

    await start.promise;
    return { collectRequests };
  }

  function addBaseRoutes(app, onEnd) {
    app.get("/end", (req, res) => {
      res.status(200).header("Content-Type", "text/html").end(idleContent);
      onEnd();
    });
    app.get("/script.js", (req, res) => {
      res.sendFile(path.join(__dirname, "../script.js"));
    });
  }

  function addFinalRoute(app) {
    app.all("*_", (req, res) => {
      if (req.url !== "/index.html") {
        res.status(404).end();
        return;
      }
      res.status(200).header("Content-Type", "text/html").end(idleContent);
    });
  }

  function createTestWrapper(timeoutSec, onStart) {
    return (req, res, next) => {
      res.header("Cache-Control", "no-store, no-cache");
      res.header(
        "Content-Type",
        contentTypes[path.extname(req.url)] ?? "text/plain"
      );

      if (req.method === "GET" && req.url === "/index.html") {
        res.header("Refresh", `${timeoutSec}, url=/end`);
        onStart();
      }

      next();
    };
  }

  function createRequestLogger() {
    const requests = [];

    function requestLogger(req, res, next) {
      const time = Date.now();
      requests.push({
        method: req.method,
        url: req.url,
        destination: req.header("sec-fetch-dest"),
        time: time,
        relTime: requests.length ? time - requests[0].time : 0,
      });
      next();
    }

    return { requests, requestLogger };
  }

  function withClientServer(callback) {
    const server = app.listen(8080, async () => {
      const chromiumUserDir = await mkdtemp("/tmp/slrtest");
      const chromium = spawn(
        "chromium",
        [
          `--user-data-dir=${chromiumUserDir}`,
          "http://localhost:8080/index.html",
        ],
        { shell: true }
      );
      await delay(3000); // wait for browser program to open
      const success = await callback();
      if (success) {
        chromium.kill();
        server.close();
        server.closeAllConnections();
      }
    });
  }

  return {
    withClientServer,
    startTest,
  };
};

function promiseWithResolvers() {
  let resolve;
  let reject;
  return {
    promise: new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    }),
    resolve,
    reject,
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
