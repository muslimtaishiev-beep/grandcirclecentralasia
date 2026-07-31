const fs = require('fs');
let utils = fs.readFileSync('src/lib/utils.ts', 'utf-8');

utils = utils.replace(/\.replace\(\/\\\^2\/g, "²"\).*?\.replace\(\/\\alpha\/g, "α"\)/s,
`.replace(/\\^([-0-9]+)/g, (match, p1) => toSuperscript(p1))
    .replace(/\\alpha/g, "α")`);

fs.writeFileSync('src/lib/utils.ts', utils);
