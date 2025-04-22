const { spawn } = require("node:child_process");
const { createTest } = require("./base.js");
const { createTestServer } = require("./server.js");
const fixtures = require("./fixtures.js");

const { test, assert, report } = createTest();
const { server, startTest } = createTestServer();
server.listen(8080, async () => {
  spawn("chromium", ["http://localhost:8080/start"], { shell: true });
  await delay(1000);

  await test("reloads page when page is updated", async () => {
    const t = startTest({
      files: {
        "/index.html": {
          content: "foo",
          lastModified: new Date(Date.UTC(2000, 0, 1, 0, 0)),
        },
      },
    });
    await t.loaded;

    await delay(200);
    t.updateFiles({
      "/index.html": {
        content: "bar",
        lastModified: new Date(Date.UTC(2000, 0, 1, 0, 1)),
      },
    });

    const { requests } = await t.result;
    assert(
      requests.filter(
        (req) => req.method === "GET" && req.url === "/index.html"
      ).length === 2
    );
  });

  await test("reloads page when page is updated more than once", async () => {
    const t = startTest({
      files: {
        "/index.html": {
          content: "foo",
          lastModified: new Date(Date.UTC(2000, 0, 1, 0, 0)),
        },
      },
    });
    await t.loaded;

    await delay(200);
    t.updateFiles({
      "/index.html": {
        content: "bar",
        lastModified: new Date(Date.UTC(2000, 0, 1, 0, 1)),
      },
    });
    await delay(200);
    t.updateFiles({
      "/index.html": {
        content: "baz",
        lastModified: new Date(Date.UTC(2000, 0, 1, 0, 2)),
      },
    });

    const { requests } = await t.result;
    assert(
      requests.filter(
        (req) => req.method === "GET" && req.url === "/index.html"
      ).length === 3
    );
  });

  await test("reloads page when a CSS resource is updated", async () => {
    const t = startTest({
      files: {
        "/index.html": {
          content: "<link rel='stylesheet' href='/css.css'>css",
        },
        "/css.css": {
          content: "* { color: red }",
          lastModified: new Date(Date.UTC(2000, 0, 1, 0, 0)),
        },
      },
    });
    await t.loaded;

    await delay(200);
    t.updateFiles({
      "/css.css": {
        content: "* { color: blue }",
        lastModified: new Date(Date.UTC(2000, 0, 1, 0, 1)),
      },
    });

    const { requests } = await t.result;
    assert(
      requests.filter(
        (req) => req.method === "GET" && req.url === "/index.html"
      ).length === 2
    );
  });

  await test("reloads page when a CSS background-image is updated", async () => {
    const t = startTest({
      files: {
        "/index.html": {
          content: "<link rel='stylesheet' href='/css.css'>css with url()",
        },
        "/css.css": {
          content: "body { background-image: url('/image.bmp') }",
        },
        "/image.bmp": {
          content: fixtures.yellowBMP,
          lastModified: new Date(Date.UTC(2000, 0, 1, 0, 0)),
        },
      },
    });
    await t.loaded;

    await delay(200);
    t.updateFiles({
      "/image.bmp": {
        content: fixtures.greenBMP,
        lastModified: new Date(Date.UTC(2000, 0, 1, 0, 1)),
      },
    });

    const { requests } = await t.result;
    assert(
      requests.filter(
        (req) => req.method === "GET" && req.url === "/index.html"
      ).length === 2
    );
  });

  await test("reloads page when a JS resource is updated", async () => {
    const t = startTest({
      files: {
        "/index.html": {
          content: "<script async src='js.js'></script>script src",
        },
        "/js.js": {
          content: "console.log(0)",
          lastModified: new Date(Date.UTC(2000, 0, 1, 0, 0)),
        },
      },
    });
    await t.loaded;

    await delay(200);
    t.updateFiles({
      "/js.js": {
        content: "console.log(1)",
        lastModified: new Date(Date.UTC(2000, 0, 1, 0, 1)),
      },
    });

    const { requests } = await t.result;
    assert(
      requests.filter(
        (req) => req.method === "GET" && req.url === "/index.html"
      ).length === 2
    );
  });

  await test("reloads page when a JS sub-import is updated", async () => {
    const t = startTest({
      files: {
        "/index.html": {
          content: "<script type='module' src='main.js'></script>script module src",
        },
        "/main.js": {
          content: "import('/sub.js')",
        },
        "/sub.js": {
          content: "console.log(0)",
          lastModified: new Date(Date.UTC(2000, 0, 1, 0, 0)),
        },
      },
    });
    await t.loaded;

    await delay(200);
    t.updateFiles({
      "/sub.js": {
        content: "console.log(1)",
        lastModified: new Date(Date.UTC(2000, 0, 1, 0, 1)),
      },
    });

    const { requests } = await t.result;
    assert(
      requests.filter(
        (req) => req.method === "GET" && req.url === "/index.html"
      ).length === 2
    );
  });

  report();
  server.close();
  server.closeAllConnections();
});

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
