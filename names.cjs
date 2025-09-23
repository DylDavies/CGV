const fs = require("fs");
const path = require("path");

console.log(fs.readdirSync(path.join(__dirname, "/public/models/Mansion")).map(v => `models/Mansion/${v}`));