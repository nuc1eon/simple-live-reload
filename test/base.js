module.exports.createTest = function createTest() {
  let currentTestName = "";
  let passed = 0;
  let total = 0;

  async function test(name, func) {
    try {
      currentTestName = name;
      await func();
    } finally {
      currentTestName = "";
    }
  }

  function assert(condition) {
    total++;
    if (condition) {
      passed++;
    } else {
      console.error(`FAIL: ${currentTestName || "Assertion failed"}`);
    }
  }

  function report() {
    console.log(`${passed}/${total} tests passed`);
  }

  return {
    test,
    assert,
    report,
  };
};
