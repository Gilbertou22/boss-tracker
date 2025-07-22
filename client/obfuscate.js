const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');

// 讀取原始代碼
const code = fs.readFileSync('src/ManageBosses.js', 'utf8');

// 混淆代碼
const obfuscationResult = JavaScriptObfuscator.obfuscate(code, {
    compact: true, // 壓縮代碼
    controlFlowFlattening: true, // 控制流平坦化
    controlFlowFlatteningThreshold: 0.75,
    deadCodeInjection: true, // 注入死碼
    deadCodeInjectionThreshold: 0.4,
    debugProtection: false, // 禁用調試保護（可選）
    identifierNamesGenerator: 'hexadecimal', // 變量名生成方式
    renameGlobals: false, // 不重命名全局變量
    rotateStringArray: true,
    stringArray: true,
    stringArrayEncoding: 'base64', // 字符串數組編碼
    stringArrayThreshold: 0.75,
    transformObjectKeys: true, // 轉換對象鍵
});

// 寫入混淆後的代碼
fs.writeFileSync('dist/ManageBosses.obfuscated.js', obfuscationResult.getObfuscatedCode());
console.log('Code obfuscation completed!');