import { Uu5Loader, SystemJS } from "./uu5-loader.js";
import "./features/react-dnd-upgrade.js";

// https://github.com/systemjs/systemjs/blob/master/docs/api.md#systemsetid-module---module
Uu5Loader.config({ imports: { uu5loaderg01: "app:uu5loaderg01" } });
SystemJS.set("app:uu5loaderg01", { __useDefault: true, default: Uu5Loader });

let envGlobal = typeof self !== "undefined" ? self : global;
// delete envGlobal.System; // NOTE Cannot delete this as systemjs uses it itself + it's used from systemjs-babel.

// TODO Remove when all libraries no longer use deprecated SystemJS API.
// TODO Add warnings to calls of backward compatible API.
envGlobal.SystemJS = {
  config: (opts) => {
    if (!opts || typeof opts !== "object") return;
    let cfg = { imports: opts.paths, meta: opts.meta, dependencyMap: opts.depCache };
    Uu5Loader.config(cfg);
  },
  getConfig: () => {
    let cfg = Uu5Loader.config();
    return { paths: cfg.imports, meta: cfg.meta, depCache: cfg.dependencyMap };
  },
  import: Uu5Loader.import,
  normalizeSync: (name) => Uu5Loader.resolve(name) ?? Uu5Loader.resolve("./" + name),
  get: Uu5Loader.get,
  set: Uu5Loader.set,
  has: SystemJS.has.bind(SystemJS),
};

// auto-transpile <script type="text/babel"> scripts
function onDomReady() {
  let babelScripts = document.querySelectorAll('script[type="text/babel"]');
  if (babelScripts.length > 0) import("./in-browser-transpilation.js");
}

if (document.readyState === "complete") onDomReady();
else window.addEventListener("DOMContentLoaded", onDomReady);
