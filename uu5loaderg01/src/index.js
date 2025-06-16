if (typeof Promise === "undefined") require("./polyfills.js");

let envGlobal = typeof self !== "undefined" ? self : global;
if (envGlobal.SystemJS) {
  console.error(
    "WARNING You loaded Uu5Loader into a page that already contains SystemJS loader - this is not supported. Use only one loader.",
  );
}

// NOTE Using "require" syntax because when uu5loaderg01 is used in <script src="..."> we want the global variable
// to be set to the Loader class itself (so window.Uu5Loader === Loader), not to a namespace merely containing
// the Loader class (so window.Uu5Loader.Loader === Loader). And the variable setting is done by webpack *after*
// this index.js is executed.
require("./startup.js");
const { Uu5Loader } = require("./uu5-loader.js");
module.exports = Uu5Loader;
Uu5Loader.Uu5Loader = Uu5Loader; // in case somebody uses `import { Uu5Loader } from "uu5loaderg01"`

if (process.env.NODE_ENV !== "test") {
  console.log(
    `${process.env.NAME}-${process.env.VERSION} © Unicorn\nTerms of Use: https://unicorn.com/tou/${process.env.NAME}`,
  );
}
