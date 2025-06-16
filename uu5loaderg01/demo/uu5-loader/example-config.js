// prettier-ignore
var imports = {
  "react": "https://cdn.plus4u.net/libs/react/18.3.1/react.min.js",
  "react-dom": "https://cdn.plus4u.net/libs/react-dom/18.3.1/react-dom.min.js",
  "create-react-class": "https://cdn.plus4u.net/libs/create-react-class/15.7.0/create-react-class.min.js",
  "prop-types": "https://cdn.plus4u.net/libs/prop-types/15.7.2/prop-types.min.js",

  "uu5stringg01": "https://cdn.plus4u.net/uu-uu5stringg01/1.0.0/uu5stringg01.min.js",
  "uu_plus4u5g02": "https://cdn.plus4u.net/uu-plus4u5g02/1.0.0/uu_plus4u5g02.min.js",

  // with Uu5Loader+SystemJS support
  "uu5g04": "https://cdn.plus4u.net/uu-uu5g04/1.0.0/uu5g04.min.js",
  "uu5g04-bricks": "https://cdn.plus4u.net/uu-uu5g04/1.0.0/uu5g04-bricks.min.js",
  "uu5g04-forms": "https://cdn.plus4u.net/uu-uu5g04/1.0.0/uu5g04-forms.min.js",
  "uu5g04-hooks": "https://cdn.plus4u.net/uu-uu5g04/1.0.0/uu5g04-hooks.min.js",
  "uu5g05": "https://cdn.plus4u.net/uu-uu5g05/1.0.0/uu5g05.min.js",
  "uu5g05-elements": "https://cdn.plus4u.net/uu-uu5g05/1.0.0/uu5g05-elements.min.js",
  "uu_plus4u5g01": "https://cdn.plus4u.net/uu-plus4u5g01/4.0.0/uu_plus4u5g01.min.js",

  "uu5loaderg01": "https://cdn.plus4u.net/uu-uu5loaderg01/1.0.0/uu5loaderg01.min.js",
};

// eslint-disable-next-line no-undef
if (typeof Uu5Loader !== "undefined") Uu5Loader.config({ imports: imports });
else if (typeof SystemJS !== "undefined") SystemJS.config({ paths: imports }); // eslint-disable-line no-undef
