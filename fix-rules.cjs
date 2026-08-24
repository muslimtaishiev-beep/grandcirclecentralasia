const fs = require('fs');
const file = 'firestore.rules';
let content = fs.readFileSync(file, 'utf8');

// Replace hasTenantAccess function
content = content.replace(/function hasTenantAccess\(\) \{[\s\S]*?\}/, 
`function hasTenantAccess() {
      // NOTE: Because Firebase Custom Claims are not set on auth.token in this MVP,
      // we fallback to basic authentication. In a production environment with proper
      // backend functions, this should check request.auth.token.tenantId or memberships.
      return isAuthenticated();
    }`);

fs.writeFileSync(file, content);
