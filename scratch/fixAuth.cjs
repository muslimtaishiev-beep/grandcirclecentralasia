const fs = require('fs');

function fixAuth(file) {
  let content = fs.readFileSync(file, 'utf8');

  // Remove localStorage from useState
  content = content.replace(
    /const \[isAuthenticated, setIsAuthenticated\] = useState\(\(\) => localStorage\.getItem\("[^"]+"\) === "true"\);/g,
    'const [isAuthenticated, setIsAuthenticated] = useState(false);'
  );
  
  // Remove localStorage.setItem
  content = content.replace(/localStorage\.setItem\("[^"]+", "true"\);/g, '');

  // Add onAuthStateChanged
  if (!content.includes('onAuthStateChanged')) {
    // Add import if missing
    if (!content.includes('onAuthStateChanged')) {
        content = content.replace(
            'import { signInWithEmailAndPassword }',
            'import { signInWithEmailAndPassword, onAuthStateChanged }'
        );
    }
    
    // inject useEffect
    const useEffectInjection = `
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      if (user) {
        setIsAuthenticated(true);
        if (typeof fetchStudents !== "undefined") fetchStudents();
        else if (typeof fetchStudent !== "undefined") fetchStudent();
      } else {
        setIsAuthenticated(false);
      }
    });
    return () => unsubscribe();
  }, []);
`;
    // find the first useEffect and insert before it
    content = content.replace(/useEffect\(\(\) => \{/i, useEffectInjection + '\n  useEffect(() => {');
  }

  fs.writeFileSync(file, content);
  console.log('Fixed ' + file);
}

['src/pages/ManagerDashboard.tsx', 'src/pages/ManagerForm.tsx', 'src/pages/PsychologistForm.tsx'].forEach(fixAuth);
