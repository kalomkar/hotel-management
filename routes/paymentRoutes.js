const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authMiddleware, roleMiddleware } = require('../middlewares/authMiddleware');

// Public Routes (Customer-facing)
router.post('/create-order', paymentController.createRazorpayOrder);
router.post('/verify', paymentController.verifyPayment);
router.post('/failure', paymentController.handlePaymentFailure);

// Private Route (Staff only)
router.get('/history', authMiddleware, roleMiddleware(['cashier', 'manager']), paymentController.getPaymentHistory);
router.get('/details/:orderId', authMiddleware, roleMiddleware(['cashier', 'manager']), paymentController.getPaymentDetails);

module.exports = router;
