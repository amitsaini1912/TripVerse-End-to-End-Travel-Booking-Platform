const cloudinary = require('cloudinary');
const cloudinaryStorage = require('multer-storage-cloudinary');

cloudinary.v2.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_API_SECRET
});

const storage = cloudinaryStorage({
    cloudinary: cloudinary,
    folder: "WanderLust",
    allowedFormats: ["jpg", "png", "jpeg", "webp", "avif"],
});

module.exports = {cloudinary, storage};
