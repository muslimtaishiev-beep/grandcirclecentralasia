import * as dotenv from 'dotenv';
dotenv.config();

async function test() {
  const apiKey = process.env.VITE_FIREBASE_API_KEY || "AIzaSyBefuNSd2j9CJJ92EWcg0am9s3zBSSHS4Y";
  const email = "leaderskg75@gmail.com"; // User's employee email
  
  console.log("Using API Key:", apiKey?.substring(0, 5) + "...");
  
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requestType: "PASSWORD_RESET",
      email: email
    })
  });
  
  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Response:", text);
}

test().catch(console.error);
