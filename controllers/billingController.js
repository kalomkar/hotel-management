const pool = require('../database/db');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// @route   POST api/billing/:orderId
// @desc    Process payment and complete order
// @access  Private (Cashier, Manager)
exports.processPayment = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const orderId = req.params.orderId;
        const { payment_mode, discount = 0 } = req.body;

        let mode = payment_mode;
        if (mode === 'UPI') mode = 'Manual UPI';

        if (!['Cash', 'Manual UPI', 'Card Swipe'].includes(mode)) {
            return res.status(400).json({ message: 'Invalid payment mode' });
        }

        // 1. Get Order Details
        const [orders] = await connection.query('SELECT total_amount, table_id FROM orders WHERE id = ?', [orderId]);
        if (orders.length === 0) return res.status(404).json({ message: 'Order not found' });

        const order = orders[0];
        const finalAmount = order.total_amount - discount;

        // 2. Insert Payment
        await connection.query(
            'INSERT INTO payments (order_id, amount, payment_mode, status, payment_type, cashier_id) VALUES (?, ?, ?, ?, ?, ?)',
            [orderId, finalAmount, mode, 'Success', 'Offline', req.user.id]
        );

        // 3. Update Order Status
        await connection.query(
            'UPDATE orders SET status = ?, discount = ?, final_amount = ? WHERE id = ?',
            ['Completed', discount, finalAmount, orderId]
        );

        // 4. Free the Table (if Dine-in)
        if (order.table_id) {
            await connection.query('UPDATE tables SET status = ? WHERE id = ?', ['Available', order.table_id]);
        }

        await connection.commit();
        res.json({ message: 'Payment processed successfully', orderId, finalAmount });
    } catch (err) {
        await connection.rollback();
        console.error(err.message);
        res.status(500).send('Server Error');
    } finally {
        connection.release();
    }
};

// @route   GET api/billing/invoice/:orderId
// @desc    Generate PDF Invoice
// @access  Private (Cashier, Manager)
exports.generateInvoice = async (req, res) => {
    try {
        const orderId = req.params.orderId;

        const [orders] = await pool.query(
            `SELECT o.*, t.table_number, u.username as cashier_name 
             FROM orders o 
             LEFT JOIN tables t ON o.table_id = t.id 
             LEFT JOIN users u ON u.id = ?
             WHERE o.id = ?`,
            [req.user.id, orderId]
        );

        if (orders.length === 0) return res.status(404).json({ message: 'Order not found' });
        const order = orders[0];

        const [items] = await pool.query(
            `SELECT oi.*, m.english_name 
             FROM order_items oi 
             JOIN menu_items m ON oi.menu_item_id = m.id 
             WHERE oi.order_id = ?`,
            [orderId]
        );

        const [payments] = await pool.query('SELECT payment_mode FROM payments WHERE order_id = ?', [orderId]);
        const paymentMode = payments.length > 0 ? payments[0].payment_mode : 'Unpaid';

        // Create PDF
        const doc = new PDFDocument({ margin: 50 });
        const fileName = `Invoice_${orderId}.pdf`;

        // Ensure public/invoices directory exists
        const dir = path.join(__dirname, '../public/invoices');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const filePath = path.join(dir, fileName);
        const writeStream = fs.createWriteStream(filePath);

        doc.pipe(writeStream);

        // Header
        doc.fontSize(20).text('BASAVESHWAR HOTEL', { align: 'center' });
        doc.fontSize(10).text('Kotnoor, Kalaburagi, Karnataka – 585106', { align: 'center' });
        doc.text('GST Info: Not Applicable', { align: 'center' });
        doc.moveDown();

        // Order Info
        doc.text(`Invoice No: ${orderId}`);
        doc.text(`Date: ${new Date(order.created_at).toLocaleString()}`);
        doc.text(`Order Type: ${order.order_type}`);
        if (order.table_number) doc.text(`Table No: ${order.table_number}`);
        if (order.customer_name) doc.text(`Customer: ${order.customer_name}`);
        doc.text(`Payment Mode: ${paymentMode}`);
        doc.moveDown();

        // Items Table Header
        doc.text('Item', 50, doc.y, { continued: true });
        doc.text('Qty', 300, doc.y, { continued: true });
        doc.text('Price', 400, doc.y, { continued: true });
        doc.text('Total', 500, doc.y);
        doc.moveTo(50, doc.y + 5).lineTo(550, doc.y + 5).stroke();
        doc.moveDown();

        // Items
        items.forEach(item => {
            doc.text(item.english_name, 50, doc.y, { continued: true });
            doc.text(item.quantity.toString(), 300, doc.y, { continued: true });
            doc.text(`Rs.${item.price_at_time}`, 400, doc.y, { continued: true });
            doc.text(`Rs.${item.quantity * item.price_at_time}`, 500, doc.y);
        });

        doc.moveTo(50, doc.y + 5).lineTo(550, doc.y + 5).stroke();
        doc.moveDown();

        // Totals
        doc.text(`Subtotal: Rs.${order.total_amount}`, { align: 'right' });
        if (order.discount > 0) doc.text(`Discount: Rs.${order.discount}`, { align: 'right' });
        doc.fontSize(12).text(`FINAL AMOUNT: Rs.${order.final_amount}`, { align: 'right' });

        doc.moveDown(2);
        doc.fontSize(10).text('Thank you for visiting!', { align: 'center' });

        doc.end();

        writeStream.on('finish', () => {
            res.json({ message: 'Invoice generated', url: `/invoices/${fileName}` });
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};
