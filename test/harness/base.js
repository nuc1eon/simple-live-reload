module.exports.createTest = function createTest() {
  let testQueue = [];
  let currentTestName = "";
  let passed = 0;
  let total = 0;

  function test(name, func) {
    testQueue.push([name, func]);
  }

  test.skip = () => {};
  test.only = (...args) => {
    testQueue = [];
    test(...args);
    testQueue.push = () => {};
  };

  function assert(condition) {
    total++;
    if (condition) {
      passed++;
    } else {
      console.error(`FAIL: ${currentTestName || "Assertion failed"}`);
    }
  }

  async function report() {
    for (const [name, func] of testQueue) {
      console.log("running:", name);
      try {
        currentTestName = name;
        await func();
      } finally {
        currentTestName = "";
      }
    }

    console.log(`${passed}/${total} tests passed`);
    return total === passed;
  }

  return {
    test,
    assert,
    report,
  };
};
