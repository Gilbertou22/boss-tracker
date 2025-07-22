// utils/formatNumber.js
const formatNumber = (number) => {
    if (typeof number !== 'number') return number;
    return number.toLocaleString('en-US'); // 使用千分位分隔符
};

export default formatNumber;