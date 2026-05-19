const nextConfig = require("eslint-config-next/core-web-vitals");
module.exports = [
  ...nextConfig,
  {
    rules: {
      // Pattern "setState in useEffect" is valid for derived state and data-fetching triggers
      "react-hooks/set-state-in-effect": "off",
    },
  },
];
