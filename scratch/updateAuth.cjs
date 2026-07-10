const fs = require('fs');

function updateFile(file) {
  let content = fs.readFileSync(file, 'utf8');

  // 1. Rename `auth` state to `isAuthenticated` to avoid conflict with firebase auth
  content = content.replace(/const \[auth, setAuth\]/g, 'const [isAuthenticated, setIsAuthenticated]');
  content = content.replace(/setAuth\(/g, 'setIsAuthenticated(');
  content = content.replace(/if \(auth\)/g, 'if (isAuthenticated)');
  // handle useEffect dep
  content = content.replace(/\[auth\]/g, '[isAuthenticated]');

  // 2. Add email state
  content = content.replace(/const \[password, setPassword\] = useState\(""\);/g, 
    'const [email, setEmail] = useState("");\n  const [password, setPassword] = useState("");');

  // 3. Import Firebase auth
  if (!content.includes('from "../lib/firebase"')) {
    content = content.replace('import React, { useState', 'import { auth as firebaseAuth } from "../lib/firebase";\nimport { signInWithEmailAndPassword } from "firebase/auth";\nimport React, { useState');
  } else {
    content = content.replace('from "../lib/firebase"', ', auth as firebaseAuth } from "../lib/firebase"');
    content = content.replace('import React', 'import { signInWithEmailAndPassword } from "firebase/auth";\nimport React');
  }

  // 4. Update handleAuth
  const oldHandleAuthRegex = /const handleAuth = async \(e: React\.FormEvent\) => \{[\s\S]*?\};/g;
  const newHandleAuth = `const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(firebaseAuth, email, password);
      setIsAuthenticated(true);
      fetchStudents && fetchStudents();
    } catch(err) {
      setError("Неверная почта или пароль / Invalid credentials");
    } finally {
      setLoading(false);
    }
  };`;
  content = content.replace(oldHandleAuthRegex, newHandleAuth);
  
  // Specifically for ManagerForm/PsychoForm which might not have fetchStudents
  content = content.replace(/fetchStudents && fetchStudents\(\);/g, 'if (typeof fetchStudents !== "undefined") fetchStudents(); else if (typeof fetchStudent !== "undefined") fetchStudent();');

  // 5. Add Email input field to the form
  const passInputRegex = /<input[^>]*type="password"[^>]*value=\{password\}[^>]*onChange=\{[^\}]*\}[^>]*\/>/g;
  
  // Find where the password input is rendered and inject the email input before it
  // Actually, let's just find the form rendering `!isAuthenticated`
  if (content.includes('!isAuthenticated')) {
    const emailInputStr = `
            <input 
              type="email" 
              className="w-full border-2 border-slate-900 px-4 py-3 text-lg font-medium outline-none placeholder:text-slate-400 mb-4"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />`;
    // Insert before the password input placeholder
    content = content.replace(/(<input[^>]*type="password")/g, emailInputStr + '\n            $1');
  }

  // 6. Update all fetch("/api/gas") to include the auth token
  // We need to fetch the token right before fetch("/api/gas")
  const fetchRegex = /const res = await fetch\("\/api\/gas", \{([\s\S]*?)\}\);/g;
  content = content.replace(fetchRegex, (match, p1) => {
    return `const idToken = await firebaseAuth.currentUser?.getIdToken();
      const res = await fetch("/api/gas", {
        headers: { "Authorization": "Bearer " + idToken, "Content-Type": "application/json" },${p1}});`;
  });

  fs.writeFileSync(file, content);
  console.log('Updated ' + file);
}

['src/pages/ManagerDashboard.tsx', 'src/pages/ManagerForm.tsx', 'src/pages/PsychologistForm.tsx'].forEach(updateFile);
