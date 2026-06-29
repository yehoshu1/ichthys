const fs = require('fs');
const path = require('path');

const pagePath = path.join('/home/josh/Projects/ixoye/src/dashboard/app/dashboard/[guildId]/welcome/page.tsx');
let content = fs.readFileSync(pagePath, 'utf8');

// The rewrite is too complex for a single regex. Let's create a simplified React component structure
// and replace the entire return statement.
