# Dead simple live reload module

A lightweight JavaScript helper for automatically reloading the page when changes are detected in local files. Perfect for simple static sites.

## Get started

1. Add the script to your HTML file.

   ```html
   <script
     src="https://kalabasa.github.io/simple-live-reload/script.js"
     data-interval="1000"
     data-debug
   ></script>
   ```

   - `data-interval` (optional): The interval time in milliseconds for polling resource status (default: `1000` ms).
   - `data-debug` (optional): Set to enable debug logging to the console.

2. Use your favourite local HTTP server, I don’t care.

   ```sh
   python3 -m http.server -d ./site/
   ```

## Production version

The script will refuse to run on non-localhost contexts, but you still shouldn’t ship the initial script request to your users in the first place. Better to check before loading the script.

```js
if (window.location.hostname === "localhost") {
  // replace with your self-hosted copy
  import("https://kalabasa.github.io/simple-live-reload/script.js");
}
```

## License

MIT License.
