const { spawn } = require("node:child_process");
const { createTest } = require("./base.js");
const { createTestServer } = require("./server.js");
const fixtures = require("./fixtures.js");
const { mkdtemp } = require("node:fs/promises");

const { test, assert, report } = createTest();
const { app, startTest } = createTestServer();
const server = app.listen(8080, async () => {
  const chromiumUserDir = await mkdtemp("/tmp/slrtest");
  const chromium = spawn(
    "chromium",
    [`--user-data-dir=${chromiumUserDir}`, "http://localhost:8080/start"],
    { shell: true }
  );
  await delay(1000);

  await test("reloads page when HTML is updated", async () => {
    const t = startTest({
      files: {
        "/index.html": {
          content: `foo ${snippet()}`,
          lastModified: new Date(Date.UTC(2000, 0, 1, 0, 0)),
        },
      },
    });
    await t.loaded;

    await delay(200);

    t.updateFiles({
      "/index.html": {
        content: `bar ${snippet()}`,
        lastModified: new Date(Date.UTC(2000, 0, 1, 0, 1)),
      },
    });

    assert(
      (await t.result).requests.filter(
        (req) => req.method === "GET" && req.url === "/index.html"
      ).length === 2
    );
  });

  await test("reloads page at the specified frequency", async () => {
    const t = startTest({
      timeoutMs: 3100,
      files: {
        "/index.html": {
          content: `foo ${snippet({ interval: 1000 })}`,
          lastModified: new Date(Date.UTC(2000, 0, 1, 0, 0)),
        },
      },
    });
    await t.loaded;
    await delay(1000); // wait for first HEAD

    for (let i = 0; i < 5; i++) {
      await delay(100);
      t.updateFiles({
        "/index.html": {
          content: `bar${i} ${snippet({ interval: 1000 })}`,
          lastModified: new Date(Date.UTC(2000, 0, 1, 0, i + 1)),
        },
      });
    }

    assert(
      (await t.result).requests.filter(
        (req) => req.method === "GET" && req.url === "/index.html"
      ).length === 2
    );
  });

  await test("reloads page when page is updated more than once", async () => {
    const t = startTest({
      files: {
        "/index.html": {
          content: `foo ${snippet()}`,
          lastModified: new Date(Date.UTC(2000, 0, 1, 0, 0)),
        },
      },
    });
    await t.loaded;

    await delay(200);

    t.updateFiles({
      "/index.html": {
        content: `bar ${snippet()}`,
        lastModified: new Date(Date.UTC(2000, 0, 1, 0, 1)),
      },
    });

    await delay(200);

    t.updateFiles({
      "/index.html": {
        content: `baz ${snippet()}`,
        lastModified: new Date(Date.UTC(2000, 0, 1, 0, 2)),
      },
    });

    assert(
      (await t.result).requests.filter(
        (req) => req.method === "GET" && req.url === "/index.html"
      ).length === 3
    );
  });

  await test("reloads page when a CSS resource is updated", async () => {
    const t = startTest({
      files: {
        "/index.html": {
          content: `<link rel='stylesheet' href='/css.css'> css ${snippet()}`,
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

    assert(
      (await t.result).requests.filter(
        (req) => req.method === "GET" && req.url === "/index.html"
      ).length === 2
    );
  });

  await test("reloads page when a CSS background-image is updated", async () => {
    const t = startTest({
      files: {
        "/index.html": {
          content: `<link rel='stylesheet' href='/css.css'> css with url ${snippet()}`,
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

    assert(
      (await t.result).requests.filter(
        (req) => req.method === "GET" && req.url === "/index.html"
      ).length === 2
    );
  });

  await test("reloads page when a JS resource is updated", async () => {
    const t = startTest({
      files: {
        "/index.html": {
          content: `<script async src='js.js'></script> script src ${snippet()}`,
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

    assert(
      (await t.result).requests.filter(
        (req) => req.method === "GET" && req.url === "/index.html"
      ).length === 2
    );
  });

  await test("reloads page when a JS sub-import is updated", async () => {
    const t = startTest({
      files: {
        "/index.html": {
          content: `<script type='module' src='main.js'></script> script module src ${snippet()}`,
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

    assert(
      (await t.result).requests.filter(
        (req) => req.method === "GET" && req.url === "/index.html"
      ).length === 2
    );
  });

  process.exitCode = report() ? 0 : 1;
  // chromium.kill();
  server.close();
  server.closeAllConnections();
});

function snippet({ interval = 100 } = {}) {
  return `<script async src='/script.js' data-interval='${interval}'>`;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
