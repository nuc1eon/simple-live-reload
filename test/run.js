const { createTest } = require("./harness/base.js");
const { createTestServer } = require("./harness/server.js");
const fixtures = require("./harness/fixtures.js");

const { test, assert, report } = createTest();
const { withClientServer, startTest } = createTestServer();

withClientServer(async () => {
  test("reloads page when HTML is updated", async () => {
    let time = 0;
    let indexHTML = `foo ${snippet()}`;

    const { collectRequests } = await startTest(1, (app) => {
      ["get", "head"].forEach((method) => {
        app[method]("/", (req, res) => {
          res
            .status(200)
            .header(...lastModifiedHeader(time))
            .end(method === "get" ? indexHTML : undefined);
        });
      });
    });

    await delay(200);
    time = 1;
    indexHTML = `bar ${snippet()}`;

    const requests = await collectRequests();
    assert(
      requests.filter(
        (req) =>
          req.method === "GET" &&
          req.mode === "navigate" &&
          req.url === "/"
      ).length === 2
    );
  });

  test("reloads page at the specified frequency", async () => {
    let time = 0;
    let content = `foo ${snippet({ interval: 1000 })}`;

    const { collectRequests } = await startTest(5, (app) => {
      ["get", "head"].forEach((method) => {
        app[method]("/", (req, res) => {
          res
            .status(200)
            .header(...lastModifiedHeader(time))
            .end(method === "get" ? content : undefined);
        });
      });
    });

    for (let i = 0; i < 5; i++) {
      await delay(100);
      time = i + 1;
      content = `bar${i} ${snippet({ interval: 1000 })}`;
    }

    const requests = await collectRequests();
    assert(
      requests.filter(
        (req) =>
          req.method === "GET" &&
          req.mode === "navigate" &&
          req.url === "/"
      ).length === 2
    );
  });

  test("reloads page when page is updated more than once", async () => {
    let time = 0;
    let content = `foo ${snippet()}`;

    const { collectRequests } = await startTest(1, (app) => {
      ["get", "head"].forEach((method) => {
        app[method]("/", (req, res) => {
          res
            .status(200)
            .header(...lastModifiedHeader(time))
            .end(method === "get" ? content : undefined);
        });
      });
    });

    await delay(200);
    time = 1;
    content = `bar ${snippet()}`;

    await delay(200);
    time = 2;
    content = `baz ${snippet()}`;

    const requests = await collectRequests();
    assert(
      requests.filter(
        (req) =>
          req.method === "GET" &&
          req.mode === "navigate" &&
          req.url === "/"
      ).length === 3
    );
  });

  test("reloads page when a CSS resource is updated", async () => {
    let time = 0;
    let cssContent = "* { color: red }";

    const { collectRequests } = await startTest(1, (app) => {
      app.get("/", (req, res) => {
        res
          .status(200)
          .end(`<link rel='stylesheet' href='/css.css'> css ${snippet()}`);
      });

      ["get", "head"].forEach((method) => {
        app[method]("/css.css", (req, res) => {
          res
            .status(200)
            .header(...lastModifiedHeader(time))
            .end(method === "get" ? cssContent : undefined);
        });
      });
    });

    await delay(200);
    time = 1;
    cssContent = "* { color: blue }";

    const requests = await collectRequests();
    assert(
      requests.filter(
        (req) =>
          req.method === "GET" &&
          req.mode === "navigate" &&
          req.url === "/"
      ).length === 2
    );
  });

  test("reloads page when a CSS background-image is updated", async () => {
    let time = 0;
    let imageContent = fixtures.yellowBMP;

    const { collectRequests } = await startTest(1, (app) => {
      app.get("/", (req, res) => {
        res
          .status(200)
          .end(
            `<link rel='stylesheet' href='/css.css'> css with url ${snippet()}`
          );
      });

      app.get("/css.css", (req, res) => {
        res.status(200).end(`body { background-image: url('/image.bmp') }`);
      });

      ["get", "head"].forEach((method) => {
        app[method]("/image.bmp", (req, res) => {
          res
            .status(200)
            .header(...lastModifiedHeader(time))
            .end(method === "get" ? imageContent : undefined);
        });
      });
    });

    await delay(200);
    time = 1;
    imageContent = fixtures.greenBMP;

    const requests = await collectRequests();
    assert(
      requests.filter(
        (req) =>
          req.method === "GET" &&
          req.mode === "navigate" &&
          req.url === "/"
      ).length === 2
    );
  });

  test("reloads page when a JS resource is updated", async () => {
    let time = 0;
    let jsContent = "console.log(0)";

    const { collectRequests } = await startTest(1, (app) => {
      app.get("/", (req, res) => {
        res
          .status(200)
          .end(`<script async src='/js.js'></script> script src ${snippet()}`);
      });

      ["get", "head"].forEach((method) => {
        app[method]("/js.js", (req, res) => {
          res
            .status(200)
            .header(...lastModifiedHeader(time))
            .end(method === "get" ? jsContent : undefined);
        });
      });
    });

    await delay(200);
    time = 1;
    jsContent = "console.log(1)";

    const requests = await collectRequests();
    assert(
      requests.filter(
        (req) =>
          req.method === "GET" &&
          req.mode === "navigate" &&
          req.url === "/"
      ).length === 2
    );
  });

  test("reloads page when a JS sub-import is updated", async () => {
    let time = 0;
    let subContent = "console.log(0)";

    const { collectRequests } = await startTest(1, (app) => {
      app.get("/", (req, res) => {
        res
          .status(200)
          .end(
            `<script type='module' src='/main.js'></script> script module src ${snippet()}`
          );
      });

      app.get("/main.js", (req, res) => {
        res.status(200).end("import('/sub.js')");
      });

      ["get", "head"].forEach((method) => {
        app[method]("/sub.js", (req, res) => {
          res
            .status(200)
            .header(...lastModifiedHeader(time))
            .end(method === "get" ? subContent : undefined);
        });
      });
    });

    await delay(200);
    time = 1;
    subContent = "console.log(1)";

    const requests = await collectRequests();
    assert(
      requests.filter(
        (req) =>
          req.method === "GET" &&
          req.mode === "navigate" &&
          req.url === "/"
      ).length === 2
    );
  });

  test("reloads page when HEAD is 405 Method Not Allowed", async () => {
    let time = 0;
    let content = `foo ${snippet()}`;

    const { collectRequests, app } = await startTest(1, (app) => {
      app.use(function noHead(req, res, next) {
        if (req.method === "HEAD") {
          res.status(405).end();
        } else {
          next();
        }
      });

      app.get("/", (req, res) => {
        res
          .status(200)
          .header(...lastModifiedHeader(time))
          .end(content);
      });
    });

    await delay(200);
    content = `bar ${snippet()}`;
    time = 1;

    const requests = await collectRequests();
    assert(
      requests.filter(
        (req) =>
          req.method === "GET" &&
          req.mode === "navigate" &&
          req.url === "/"
      ).length === 2
    );
  });

  const success = await report();
  process.exitCode = success ? 0 : 1;
  return success;
});

function lastModifiedHeader(time) {
  return [
    "Last-Modified",
    new Date(Date.UTC(2000, 0, 1, 0, 0, time)).toUTCString(),
  ];
}

function snippet({ interval = 100 } = {}) {
  return `<script async src='/script.js' data-interval='${interval}' data-debug></script>`;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
