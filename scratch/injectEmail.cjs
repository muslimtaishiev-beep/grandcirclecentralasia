const fs = require('fs');

function injectEmail(file) {
  let content = fs.readFileSync(file, 'utf8');

  // Look for the password input inside the login form
  const emailInput = `
            <input 
              type="email" 
              placeholder="Email" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border p-3 rounded-xl mb-4 bg-slate-50 text-center"
            />`;

  // Inject before password input only if it doesn't already have one
  if (!content.includes('type="email"')) {
    content = content.replace(/(<input \s*\n*\s*type="password")/g, emailInput + '\n            $1');
  }

  fs.writeFileSync(file, content);
  console.log('Injected email to ' + file);
}

['src/pages/ManagerDashboard.tsx', 'src/pages/ManagerForm.tsx', 'src/pages/PsychologistForm.tsx'].forEach(injectEmail);
