const admin = require("firebase-admin");

async function test() {
  try {
    try {
      await admin.auth().generatePasswordResetLink("test@example.com");
    } catch(authErr) {
      console.log("Caught authErr:", authErr.message);
      try {
        await admin.auth().createUser({ email: "test@example.com" });
      } catch(createErr) {
        console.log("Caught createErr:", createErr.message);
      }
    }
    console.log("Done successfully");
  } catch (err) {
    console.log("Outer err:", err.message);
  }
}
test();
