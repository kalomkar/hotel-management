const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (Frontend)
app.use(express.static(path.join(__dirname, 'public')));

app.use('/invoices', express.static(path.join(__dirname, 'public/invoices')));

const multer = require('multer');
const fs = require('fs');

// Ensure upload dir exists
const uploadDir = path.join(__dirname, 'public/images');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Set up Multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

app.post('/api/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }
    const imageUrl = `/images/${req.file.filename}`;
    res.json({ imageUrl });
});

// Routes
const authRoutes = require('./routes/authRoutes');
const menuRoutes = require('./routes/menuRoutes');
const tableRoutes = require('./routes/tableRoutes');
const orderRoutes = require('./routes/orderRoutes');
const reportRoutes = require('./routes/reportRoutes');
const billingRoutes = require('./routes/billingRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const contactRoutes = require('./routes/contactRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/payment', paymentRoutes);

app.get('/api/test', (req, res) => {
    res.json({ message: 'Welcome to Basaveshwar Hotel API' });
});

// Start the HTTP server when this file is run directly.
// When imported by a serverless platform, only export the app.
if (require.main === module) {
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
}

module.exports = app;
