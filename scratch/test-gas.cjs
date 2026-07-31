const fetch = require('node-fetch');
async function run() {
  const res = await fetch("https://www.studyfreeforum.com/api/gas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "getAllStudents"
    })
  });
  const data = await res.json();
  console.log(JSON.stringify(data[data.length-1], null, 2));
}
run();
