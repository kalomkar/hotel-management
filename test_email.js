require('dotenv').config();
const nodemailer = require('nodemailer');

async function testEmail() {
    console.log("Testing email connection with:");
    console.log("EMAIL_USER:", process.env.EMAIL_USER);
    console.log("EMAIL_PASS:", process.env.EMAIL_PASS ? "********" : "NOT SET");

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || process.env.EMAIL_USER === 'your_hotel_gmail@gmail.com') {
        console.error("\n❌ ERROR: Invalid or missing EMAIL_USER / EMAIL_PASS in .env file.");
        return;
    }

    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        },
        tls: {
            rejectUnauthorized: false
        }
    });

    try {
        console.log("\nAttempting to connect to Gmail servers...");
        await transporter.verify();
        console.log("✅ Connection successful!");

        console.log("\nAttempting to send test email to yourself...");
        const info = await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER,
            subject: "Basaveshwar Hotel - Email System Test",
            text: "If you received this email, your Nodemailer is configured correctly!",
            html: "<b>If you received this email, your Nodemailer is configured correctly!</b>"
        });

        console.log("✅ Test email sent successfully! Message ID:", info.messageId);
    } catch (error) {
        console.error("\n❌ Email Test Failed:", error.message);
        if (error.code === 'EAUTH') {
            console.error("\n⚠️ This is an authentication error. The App Password might be incorrect or Gmail is blocking it.");
        }
    }
}

testEmail();
