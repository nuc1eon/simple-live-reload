const http = require("http");
const fs = require("fs");
const path = require("path");

const staticFiles = {
  "/script.js": {
    content: fs.readFileSync(path.join(__dirname, "../script.js")),
  },
  "/index.html": {
    content:
      'Test server idle<script>setTimeout(()=>location="/index.html",1000)</script>',
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
  let test = null;

  function startTest({
    timeoutMs = 400,
    liveReloadIntervalMs = 100,
    files = {},
  }) {
    test = { timeoutMs, liveReloadIntervalMs, files, requests: [] };
    test.loaded = new Promise((resolve) => {
      test.onload = resolve;
    });
    test.result = new Promise((resolve) => {
      test.resolve = resolve;
    });
    test.updateFiles = updateFiles;
    test.endTest = endTest;
    return test;
  }

  function updateFiles(files) {
    Object.assign(test.files, files);
  }

  function endTest() {
    test.resolve(test);
    test = null;
  }

  const server = http.createServer(async (req, res) => {
    const time = Date.now();
    test?.requests.push({
      method: req.method,
      url: req.url,
      time: time,
      relTime: test.requests.length ? time - test.requests[0].time : 0,
    });

    res.setHeader("Cache-Control", "no-store, no-cache");

    if (!test && req.url === "/start") {
      await delay(2000);
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(staticFiles["/index.html"].content);
      return;
    }

    if (test && req.url === "/end") {
      if (test.timeout != null) clearTimeout(test.timeout);
      endTest();
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(staticFiles["/index.html"].content);
      return;
    }

    const file = test?.files[req.url] ?? staticFiles[req.url];
    if (!file) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
      return;
    }

    let content = file.content;
    if (test && req.method === "GET" && req.url === "/index.html") {
      if (test.timeout != null) clearTimeout(test.timeout);
      test.timeout = setTimeout(endTest, test.timeoutMs + 5000);
      content =
        String(content) +
        `<script async src="/script.js" data-interval="${test.liveReloadIntervalMs}"></script><script>setTimeout(()=>{location="/end"},${test.timeoutMs})</script>`;
      test.onload();
    }

    res.setHeader(
      "Content-Type",
      contentTypes[path.extname(req.url)] ?? "application/octet-stream"
    );

    if (file.lastModified) {
      res.setHeader("Last-Modified", file.lastModified.toUTCString());
    }

    if (req.method === "HEAD") {
      res.writeHead(200);
      res.end();
    } else if (req.method === "GET") {
      res.writeHead(200);
      res.end(content);
    } else {
      res.writeHead(405, { Allow: "GET, HEAD" });
      res.end("405 Method Not Allowed");
    }
  });

  return {
    server,
    startTest,
  };
};

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
