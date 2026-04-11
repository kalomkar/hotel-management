require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // Use SSL
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: false // Helps with some cloud server firewall issues
    }
});

const sendEmail = async ({ to, subject, html }) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: to || process.env.RECEIVER_EMAIL || process.env.EMAIL_USER,
            subject,
            html
        };
        const result = await transporter.sendMail(mailOptions);
        console.log('Email sent:', result.messageId);
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
};

const sendPreOrderEmail = async (orderDetails) => {
    let itemsHtml = orderDetails.items.map(item => `<li>${item.quantity} x ${item.name} (₹${item.price})</li>`).join('');

    return sendEmail({
        subject: 'New Pre-Order – Basaveshwar Hotel',
        html: `
            <h2>New Pre-Order Received</h2>
            <p><strong>Customer Name:</strong> ${orderDetails.customer_name}</p>
            <p><strong>Phone:</strong> ${orderDetails.customer_mobile}</p>
            <p><strong>Visit Time:</strong> ${orderDetails.visit_time}</p>
            <h3>Items:</h3>
            <ul>${itemsHtml}</ul>
            <p><strong>Total:</strong> ₹${orderDetails.total_amount}</p>
            <p><strong>Payment Mode:</strong> Pay at Hotel</p>
        `
    });
};

module.exports = { sendEmail, sendPreOrderEmail };
