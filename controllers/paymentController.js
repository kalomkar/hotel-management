const Razorpay = require('razorpay');
const crypto = require('crypto');
const pool = require('../database/db');

let razorpayInstance = null;
function getRazorpay() {
    if (!razorpayInstance) {
        const key_id = process.env.RAZORPAY_KEY_ID;
        const key_secret = process.env.RAZORPAY_KEY_SECRET;
        if (!key_id || !key_secret) {
            throw new Error('Razorpay API keys are missing. Please configure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
        }
        razorpayInstance = new Razorpay({ key_id, key_secret });
    }
    return razorpayInstance;
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/payment/create-order
// @desc    Create a Razorpay order and also create a pre-order record in DB
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
exports.createRazorpayOrder = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const { customer_name, customer_mobile, visit_time, items, total_amount } = req.body;

        if (!customer_name || !items || items.length === 0 || !total_amount) {
            return res.status(400).json({ message: 'Missing required fields.' });
        }

        // 1. Create Pre-Order record in DB (status = Pending)
        const [orderResult] = await connection.query(
            `INSERT INTO orders 
             (order_type, total_amount, final_amount, customer_name, customer_mobile, visit_time, status)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            ['Pre-Order', total_amount, total_amount, customer_name, customer_mobile, visit_time || null, 'Pending']
        );
        const orderId = orderResult.insertId;

        // 2. Insert Order Items
        for (const item of items) {
            await connection.query(
                'INSERT INTO order_items (order_id, menu_item_id, quantity, price_at_time) VALUES (?, ?, ?, ?)',
                [orderId, item.id, item.quantity, item.price]
            );
        }

        await connection.commit();

        // 3. Create Razorpay order (amount in paise = amount × 100)
        const razorpayOrder = await getRazorpay().orders.create({
            amount: Math.round(total_amount * 100),
            currency: 'INR',
            receipt: `receipt_order_${orderId}`,
            notes: {
                hotel_order_id: orderId.toString(),
                customer_name,
                customer_mobile: customer_mobile || '',
            },
        });

        res.json({
            razorpay_order_id: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            key: process.env.RAZORPAY_KEY_ID,
            hotel_order_id: orderId,
            customer_name,
            customer_mobile: customer_mobile || '',
        });

    } catch (err) {
        await connection.rollback();
        console.error('❌ createRazorpayOrder Error:', err.message);
        res.status(500).json({ message: 'Failed to create order. Please try again.' });
    } finally {
        connection.release();
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/payment/verify
// @desc    Verify Razorpay payment signature and update order/payment in DB
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
exports.verifyPayment = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            hotel_order_id,
        } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !hotel_order_id) {
            return res.status(400).json({ success: false, message: 'Missing payment verification fields.' });
        }

        // 1. Verify HMAC-SHA256 signature
        const generatedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');

        if (generatedSignature !== razorpay_signature) {
            // Signature mismatch → payment is tampered/failed
            await connection.query(
                `UPDATE orders SET status = 'Cancelled' WHERE id = ?`,
                [hotel_order_id]
            );
            return res.status(400).json({ success: false, message: 'Payment verification failed. Signature mismatch.' });
        }

        await connection.beginTransaction();

        // 2. Update order status to Confirmed
        await connection.query(
            `UPDATE orders SET status = 'Confirmed' WHERE id = ?`,
            [hotel_order_id]
        );

        // 3. Fetch order amount
        const [orderRows] = await connection.query(
            'SELECT final_amount FROM orders WHERE id = ?',
            [hotel_order_id]
        );
        const amount = orderRows.length > 0 ? orderRows[0].final_amount : 0;

        // 4. Insert/update payment record
        await connection.query(
            `INSERT INTO payments 
             (order_id, amount, payment_mode, status, razorpay_order_id, razorpay_payment_id, razorpay_signature)
             VALUES (?, ?, 'Online', 'Success', ?, ?, ?)
             ON DUPLICATE KEY UPDATE 
                status = 'Success',
                razorpay_payment_id = VALUES(razorpay_payment_id),
                razorpay_order_id = VALUES(razorpay_order_id),
                razorpay_signature = VALUES(razorpay_signature)`,
            [hotel_order_id, amount, razorpay_order_id, razorpay_payment_id, razorpay_signature]
        );

        await connection.commit();

        console.log(`✅ Payment verified & confirmed for Order #${hotel_order_id} | Razorpay: ${razorpay_payment_id}`);

        res.json({
            success: true,
            message: 'Payment verified successfully!',
            hotel_order_id,
            razorpay_payment_id,
        });

    } catch (err) {
        await connection.rollback();
        console.error('❌ verifyPayment Error:', err.message);
        res.status(500).json({ success: false, message: 'Server error during payment verification.' });
    } finally {
        connection.release();
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/payment/failure
// @desc    Handle payment failure — mark order as Cancelled
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
exports.handlePaymentFailure = async (req, res) => {
    try {
        const { hotel_order_id, razorpay_order_id, error_description } = req.body;

        if (!hotel_order_id) {
            return res.status(400).json({ success: false, message: 'hotel_order_id required.' });
        }

        await pool.query(
            `UPDATE orders SET status = 'Cancelled' WHERE id = ?`,
            [hotel_order_id]
        );

        console.warn(`⚠️  Payment FAILED for Order #${hotel_order_id}: ${error_description || 'No reason provided'}`);

        res.json({ success: false, message: 'Payment failed. Order not confirmed.' });
    } catch (err) {
        console.error('❌ handlePaymentFailure Error:', err.message);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/payment/history
// @desc    Get all payments (Manager/Cashier use)
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
exports.getPaymentHistory = async (req, res) => {
    try {
        const [payments] = await pool.query(
            `SELECT 
                p.id as payment_id,
                p.order_id,
                p.amount as paid_amount,
                p.payment_mode,
                p.payment_type,
                p.status as payment_status,
                p.razorpay_order_id,
                p.razorpay_payment_id,
                p.timestamp as payment_date,
                o.customer_name,
                o.customer_mobile,
                o.total_amount as order_total_amount,
                o.order_type,
                t.table_number,
                u.username as cashier_name
             FROM payments p
             INNER JOIN orders o ON p.order_id = o.id
             LEFT JOIN tables t ON o.table_id = t.id
             LEFT JOIN users u ON p.cashier_id = u.id
             ORDER BY p.timestamp DESC
             LIMIT 200`
        );
        res.json(payments);
    } catch (err) {
        console.error('❌ getPaymentHistory Error:', err.message);
        res.status(500).json({ message: 'Server error.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/payment/details/:orderId
// @desc    Get order items for detail popup
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
exports.getPaymentDetails = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const [items] = await pool.query(
            `SELECT oi.*, m.english_name 
             FROM order_items oi 
             JOIN menu_items m ON oi.menu_item_id = m.id 
             WHERE oi.order_id = ?`,
            [orderId]
        );
        res.json({ items });
    } catch (err) {
        console.error('❌ getPaymentDetails Error:', err.message);
        res.status(500).json({ message: 'Server error.' });
    }
};
