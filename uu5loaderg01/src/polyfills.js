import Config from "./config/config.js";

let { baseUri } = Config;
let url = baseUri + process.env.NAME + "-polyfills" + (process.env.NODE_ENV === "production" ? ".min" : "") + ".js";

let xhr = new XMLHttpRequest();
xhr.onload = function () {
  // eval in global scope
  if (this.status === 200) (0, eval)(this.responseText);
  else console.error("Polyfills failed to load from " + url);
};
xhr.open("GET", url, false);
xhr.send();
