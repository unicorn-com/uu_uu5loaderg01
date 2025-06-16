const { Uu5Loader } = require("./uu5-loader.js");

const JSX_TRANSPILATION_FN_NAME = "__devkitJsx";
const JSX_TRANSPILATION_FRAG_NAME = "__devkitJsxFrag";
const JSX_TRANSPILATION_FN_TEXT = `
var ${JSX_TRANSPILATION_FN_NAME}0;
function ${JSX_TRANSPILATION_FN_NAME}(...args) {
  if (${JSX_TRANSPILATION_FN_NAME}0) return ${JSX_TRANSPILATION_FN_NAME}0(...args);
  var resultFn;
  if (typeof Uu5 !== "undefined" && Uu5 && Uu5.Utils && Uu5.Utils.Element && typeof Uu5.Utils.Element.create === "function") {
    resultFn = Uu5.Utils.Element.create;
  } else if (typeof Uu5g05 !== "undefined" && Uu5g05 && Uu5g05.Utils && Uu5g05.Utils.Element && typeof Uu5g05.Utils.Element.create === "function") {
    resultFn = Uu5g05.Utils.Element.create;
  } else if (typeof UU5 !== "undefined" && UU5 && UU5.Common && UU5.Common.Element && typeof UU5.Common.Element.create === "function") {
    resultFn = UU5.Common.Element.create;
  } else {
    resultFn = React.createElement;
  }
  ${JSX_TRANSPILATION_FN_NAME}0 = resultFn;
  return resultFn(...args);
};`
  .trim()
  .replace(/\n/g, " ");
const JSX_TRANSPILATION_FRAG_TEXT = `
var ${JSX_TRANSPILATION_FRAG_NAME};
if (typeof Uu5 !== "undefined" && Uu5 && Uu5.Fragment) {
  ${JSX_TRANSPILATION_FRAG_NAME} = Uu5.Fragment;
} else if (typeof Uu5g05 !== "undefined" && Uu5g05 && Uu5g05.Fragment) {
  ${JSX_TRANSPILATION_FRAG_NAME} = Uu5g05.Fragment;
} else if (typeof UU5 !== "undefined" && UU5 && UU5.Common && UU5.Common.Fragment) {
  ${JSX_TRANSPILATION_FRAG_NAME} = UU5.Common.Fragment;
} else if (typeof React !== "undefined") {
  ${JSX_TRANSPILATION_FRAG_NAME} = React.Fragment;
};`
  .trim()
  .replace(/\n/g, " ");

let envGlobal = typeof self !== "undefined" ? self : global;
let systemJSPrototype = envGlobal.System.constructor.prototype;

// override fetching mechanism
let inlineTranspilations = {}; // map 'systemjs name' -> script content, e.g. 'app-inline-script-0.jsx' -> `import ...`
let remoteTranspilations = {}; // map 'systemjs name' -> url, e.g. 'app-remote-script-0.jsx' -> 'https://.../demo-controls.js'
let fetchWithoutTranspilation = systemJSPrototype.fetch;
systemJSPrototype.fetch = function (url, options) {
  if (url in inlineTranspilations) {
    // use our custom JSX fn instead of React.createElement (note that the 1st @jsx comment wins)
    let scriptText = inlineTranspilations[url];
    let indent = 1e10;
    scriptText.replace(
      /(^|\n)( *)(?=(.)|\n|$)/g,
      (m, g1, g2, g3) => (indent = Math.min(indent, g3 ? g2.length : indent)),
    );
    if (indent) scriptText = scriptText.trim().replace(/(^|\n)( *)/g, (m, g1, g2) => g1 + g2.slice(indent));
    scriptText = `${JSX_TRANSPILATION_FRAG_TEXT}\n${JSX_TRANSPILATION_FN_TEXT}\n/* @jsx ${JSX_TRANSPILATION_FN_NAME} */\n/* @jsxFrag ${JSX_TRANSPILATION_FRAG_NAME} */\n\n\n${scriptText}`;
    return Promise.resolve(new Response(new Blob([scriptText], { type: "application/javascript" })));
  } else {
    let usedUrl =
      url in remoteTranspilations
        ? remoteTranspilations[url]
        : new URL(url).pathname.match(/\.(jsx|mjs)$/)
          ? url
          : undefined;
    if (usedUrl) {
      return fetchWithoutTranspilation(usedUrl, options)
        .then((response) => response.text())
        .then((scriptText) => {
          scriptText = `${JSX_TRANSPILATION_FRAG_TEXT}\n${JSX_TRANSPILATION_FN_TEXT}\n/* @jsx ${JSX_TRANSPILATION_FN_NAME} */\n/* @jsxFrag ${JSX_TRANSPILATION_FRAG_NAME} */\n\n\n${scriptText}`;
          return Promise.resolve(new Response(new Blob([scriptText], { type: "application/javascript" })));
        });
    }
  }
  return fetchWithoutTranspilation(url, options);
};
require("systemjs-babel"); // needs self.System (or global.System) variable
let fetchWithTranspilation = systemJSPrototype.fetch;
systemJSPrototype.fetch = function (url, options) {
  if (url in inlineTranspilations || url in remoteTranspilations || new URL(url).pathname.match(/\.(jsx|mjs)$/)) {
    return fetchWithTranspilation(url, options);
  }
  return fetchWithoutTranspilation(url, options);
};

// transpile scripts
// NOTE Using setTimeout so that other DOMContentLoaded listeners can finish before we start importing stuff.
// That is needed for uu5devkit's example-config.js in case that there's demo which links several example-config.js
// files and therefore those example-config.js files cannot use initUuApp() (because page can call this only once)
// and must fall back to using build-time configuration - and to detect this, the example-config.js files
// use DOMContentLoaded listener and must configure the loader before we start importing stuff).
setTimeout(() => {
  let scripts = document.querySelectorAll('script[type="text/babel"]');
  if (scripts.length > 0) {
    // we'll extract scripts texts and import them via SystemJS with transpilation
    let result = Promise.resolve();
    for (let i = 0; i < scripts.length; ++i) {
      let script = scripts[i];
      let name;
      // transpilable scripts must have .jsx extension
      if (script.src) {
        name = Uu5Loader.resolve("./app-remote-script-" + i + ".jsx?" + script.src);
        remoteTranspilations[name] = script.src;
      } else {
        name = Uu5Loader.resolve("./app-inline-script-" + i + ".jsx");
        inlineTranspilations[name] = script.textContent;
      }
      // execute scripts one after another (next one waits for the previous)
      result = result.catch((e) => console.error(e)).then(() => Uu5Loader.import(name));
    }
  }
}, 0);
