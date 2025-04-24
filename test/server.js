const express = require("express");
const path = require("path");

const staticFiles = {
  "/index.html": {
    content:
      '<i>test server idle</i><script>setTimeout(()=>location="/index.html",1000)</script>',
  },
};

const contentTypes = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".bmp": "image/bmp",
};

module.exports.createTestServer = function createTestServer() {
  const app = express();

  let restRoute;
  initBaseRoutes();
  resetRestRoute();

  let test = null;

  function startTest({ timeoutMs = 400, files = {} }) {
    resetRestRoute();

    test = { timeoutMs, files, requests: [] };

    test.loaded = new Promise((resolve) => {
      test.onload = resolve;
    });

    test.result = new Promise((resolve) => {
      test.resolve = resolve;
    });

    test.updateFiles = (files) => {
      Object.assign(test.files, files);
    };

    test.end = () => {
      test.resolve(test);
      test = null;
    };

    return test;
  }

  function initBaseRoutes() {
    app.get("/start", async (req, res) => {
      if (!test) {
        await delay(2000);
        res.status(200).send(staticFiles["/index.html"].content);
      } else {
        res.status(400).end();
      }
    });

    app.get("/end", (req, res) => {
      if (test) {
        clearTimeout(test.timeout);
        test.end();
        res.status(200).send(staticFiles["/index.html"].content);
      } else {
        res.status(400).end();
      }
    });

    app.get("/script.js", (req, res) => {
      res.sendFile(path.join(__dirname, "../script.js"));
    });
  }

  function resetRestRoute() {
    if (restRoute) {
      app.router.stack.splice(
        app.router.stack.findIndex((layer) => layer.route === restRoute),
        1
      );
    }
    restRoute = app.route("*_");
    restRoute.all((req, res) => {
      const time = Date.now();
      test?.requests.push({
        method: req.method,
        url: req.url,
        time: time,
        relTime: test.requests.length ? time - test.requests[0].time : 0,
      });

      res.header("Cache-Control", "no-store, no-cache");
      const file = test?.files[req.url] ?? staticFiles[req.url];
      if (!file) {
        res.status(404).end();
        return;
      }

      let content = file.content;
      if (test && req.method === "GET" && req.url === "/index.html") {
        clearTimeout(test.timeout);
        test.timeout = setTimeout(test.end, test.timeoutMs + 5000);
        content =
          String(content) +
          `</script><script>setTimeout(()=>{location="/end"},${test.timeoutMs})</script>`;
        test.onload();
      }

      res.header(
        "Content-Type",
        contentTypes[path.extname(req.url)] ?? "application/octet-stream"
      );

      if (file.lastModified) {
        res.header("Last-Modified", file.lastModified.toUTCString());
      }

      res.status(200).send(content);
    });
  }

  return {
    app,
    startTest,
  };
};

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
