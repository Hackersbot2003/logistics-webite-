require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const hash = await bcrypt.hash("123456", 12);
  await mongoose.connection.collection("users").updateOne(
    { email: "1234@gmail.com" },
    { $set: { password: hash } }
  );
  const check = await bcrypt.compare("123456", hash);
  console.log("Hash valid:", check);
  console.log("Done. Login with: 1234@gmail.com / 123456");
  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });