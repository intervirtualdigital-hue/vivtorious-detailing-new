// Usage: node db/hash-password.js "your password"
const bcrypt = require('bcrypt');
const password = process.argv[2];
if (!password) {
  console.error('Usage: node db/hash-password.js <password>');
  process.exit(1);
}
bcrypt.hash(password, 12).then(hash => {
  console.log(hash);
});
