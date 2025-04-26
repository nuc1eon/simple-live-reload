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

  const runnerContent =
    '<iframe src="/START" onload="this.contentWindow.location.pathname===`/END`&&location.reload()"></iframe><button autofocus style="opacity:0"></button>';
  const idleContent =
    '<i>test server idle</i><meta http-equiv="refresh" content="1;url=/">';

  resetRoutes();

  function resetRoutes() {
    app.router.stack.length = 0;
    addBaseRoutes(app);
    addFinalRoute(app);
  }

  let testCounter = 0;
  async function startTest(timeoutSec, callback) {
    const testID = `<${testCounter++}>`;
    app.router.stack.length = 0;

    const { requests, requestLogger } = createRequestLogger();
    app.use(requestLogger);

    const start = promiseWithResolvers();
    const load = promiseWithResolvers();
    const end = promiseWithResolvers();

    app.use(createTestWrapper(timeoutSec, load.resolve));

    addBaseRoutes(app, start.resolve, end.resolve);
    callback(app); // test logic is like a big middleware
    addFinalRoute(app);

    const collectRequests = async () => {
      await end.promise;
      return requests;
    };

    await load.promise;
    return { collectRequests };
  }

  function addBaseRoutes(app, onStart, onEnd) {
    app.get("/RUN", (req, res) => {
      res.status(200).header("Content-Type", "text/html").end(runnerContent);
    });
    app.get("/START", (req, res) => {
      res.status(200).header("Content-Type", "text/html").end(idleContent);
      onStart?.();
    });
    app.get("/END", (req, res) => {
      resetRoutes();
      res
        .status(200)
        .header("Content-Type", "text/html")
        .end("<i>test ended</i>");
      onEnd?.();
    });
    app.get("/script.js", (req, res) => {
      res.sendFile(path.join(__dirname, "../../script.js"));
    });
  }

  function addFinalRoute(app) {
    app.all("*_", (req, res) => {
      if (req.url !== "/") {
        res.status(404).end();
        return;
      }
      res.status(200).header("Content-Type", "text/html").end(idleContent);
    });
  }

  function createTestWrapper(timeoutSec, onLoad) {
    return (req, res, next) => {
      res.header("Cache-Control", "no-store, no-cache");
      res.header(
        "Content-Type",
        contentTypes[path.extname(req.url)] ?? "text/html"
      );

      if (req.method === "GET" && req.url === "/") {
        res.header("Refresh", `${timeoutSec}, url=/END`);
        onLoad();
      }

      next();
    };
  }

  function createRequestLogger() {
    const requests = [];

    function requestLogger(req, res, next) {
      const time = Date.now();
      const mode = req.header("sec-fetch-mode");
      requests.push({
        method: req.method,
        url: req.url,
        mode,
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
          "--disable-popup-blocking",
          "http://localhost:8080/RUN",
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
