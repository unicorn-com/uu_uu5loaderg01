// Support for meta.deps[] if using old modules (with global variables).

let SystemJS = typeof self !== "undefined" ? self.System : global.System;
let systemPrototype = SystemJS.constructor.prototype;

function getMeta(url, config = SystemJS._config) {
  return config.meta ? config.meta[url] || {} : {};
}

let shouldFetch = systemPrototype.shouldFetch;
systemPrototype.shouldFetch = function (url) {
  let metaInfo = getMeta(url);
  return metaInfo.format === "global" || (metaInfo.deps && metaInfo.deps.length > 0) ? true : shouldFetch(url);
};

let fetch = systemPrototype.fetch;
systemPrototype.fetch = function (url, opts) {
  let metaInfo = getMeta(url);
  if (!metaInfo.deps || metaInfo.deps.length === 0) return fetch(url, opts);

  return fetch(url, opts)
    .then(function (response) {
      return response.text();
    })
    .then(function (content) {
      // check whether it's AMD module (we support extra deps only for "global" modules)
      if (content && content.match(/\bdefine\.amd\b/) && content.match(/\bdefine\s*\(/)) {
        return new Response(new Blob([content], { type: "application/javascript" }));
      }

      if (content.indexOf("//# sourceURL=") < 0) content += "\n//# sourceURL=" + url + "!initial";
      let sysRegContent = `System.register(${JSON.stringify(metaInfo.deps)}, function(ex) {
  ex({ default: {}, __useDefault: true });
  return {
    setters: [],
    execute: function() {
      var g = typeof self !== "undefined" ? self : global;
      var len = Object.keys(g).length;
      (0,eval)(${JSON.stringify(content)});
      var exps = g[Object.keys(g)[len]];
      if (exps && (typeof exps === "object" || typeof exps === "function")) ex(exps);
      ex("default", exps);
    }
  }
});`;
      return new Response(new Blob([sysRegContent], { type: "application/javascript" }));
    });
};
