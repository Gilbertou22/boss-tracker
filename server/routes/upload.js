const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { auth } = require('../middleware/auth'); // 假設你有一個身份驗證中間件

// 設置 Multer 存儲配置
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // 圖片存儲在 uploads 資料夾
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    },
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        } else {
            cb(new Error('僅支援 JPEG/PNG 圖片！'));
        }
    },
    limits: { fileSize: 5 * 1024 * 1024 }, // 限制文件大小為 5MB
});

router.post('/', auth, (req, res, next) => {
    upload.single('image')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            // 處理 multer 錯誤（例如文件過大）
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ msg: '圖片大小超過限制（10MB）' });
            }
            return res.status(400).json({ msg: '圖片上傳失敗', detail: err.message });
        } else if (err) {
            // 處理其他錯誤（例如文件格式錯誤）
            return res.status(400).json({ msg: '圖片上傳失敗', detail: err.message });
        }
        next();
    });
}, (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ msg: '請上傳圖片' });
        }
        const imagePath = `/uploads/${req.file.filename}`;
        res.status(200).json({ path: imagePath });
    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ msg: '圖片上傳失敗', detail: err.message });
    }
});
module.exports = router;