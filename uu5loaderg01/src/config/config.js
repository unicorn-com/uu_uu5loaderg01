import mod from "module";

let uri = ((mod ? mod.uri : document.currentScript?.src) || "").toString();
let baseUri = uri.replace(/[^/]*$/, "");

export default { uri, baseUri };
