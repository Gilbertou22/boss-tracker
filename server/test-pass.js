const bcrypt = require('bcryptjs');

const password = '1234';
const salt = bcrypt.genSaltSync(); // 默認 10 輪
const hashedPassword = bcrypt.hashSync(password, salt);
console.log('Generated hash:', hashedPassword);

const myhashedPassword = '$$2b$10$IBeVnhBhHXebU62sxxxlMOajyrU67yptd1AvLyVWBRMW.zlL1nE0y';

const isMatch = bcrypt.compareSync(password, hashedPassword);
console.log('Password match:', isMatch);


const isMatch2 = bcrypt.compareSync(password, myhashedPassword);
console.log('Password match:', isMatch2);
