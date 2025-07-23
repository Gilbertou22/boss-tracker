const bcrypt = require('bcryptjs');

const password = '1234567';
const salt = bcrypt.genSaltSync(); // 默認 10 輪
const hashedPassword = bcrypt.hashSync(password, salt);
console.log('Generated hash:', hashedPassword);

const isMatch = bcrypt.compareSync(password, hashedPassword);
console.log('Password match:', isMatch);