const express = require("express");
const db = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

const padOrderId = (id) => `O-${id.toString().padStart(4, "0")}`;

const extractOrderId = (formattedId) => {
  const match = formattedId.match(/^O-(\d{4,})$/);
  return match ? parseInt(match[1], 10) : null;
};

// Place Order Route
router.post("/placeOrder", authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  const { items, addressId, paymentMethod } = req.body;

  if (!items || items.length === 0 || !addressId || !paymentMethod) {
    return res.status(400).json({ error: "Incomplete order data" });
  }

  const connection = await db.getConnection(); // Get DB connection for transaction

  try {
    await connection.beginTransaction();

    // Get the address text from addressId
    const [addressResult] = await connection.execute(
      "SELECT * FROM addresses WHERE id = ? AND user_id = ?",
      [addressId, userId]
    );

    if (addressResult.length === 0) {
      return res.status(404).json({ error: "Address not found" });
    }

    const address = addressResult[0];

    // Calculate total amount
    let totalAmount = 0;
    items.forEach((item) => {
      totalAmount += parseFloat(item.price) * item.quantity;
    });

    // Insert into orders table
    const [orderResult] = await connection.execute(
      `INSERT INTO orders (user_id, address, payment_method, total_amount)
       VALUES (?, ?, ?, ?)`,
      [userId, address, paymentMethod, totalAmount.toFixed(2)]
    );

    const orderId = orderResult.insertId;
    const formattedOrderId = padOrderId(orderId);

    // Insert items into order_items
    for (const item of items) {
      await connection.execute(
        `INSERT INTO order_items 
        (order_id, product_id, product_name, image_url, quantity, price_at_purchase)
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          item.product_id,
          item.name,
          item.image_url,
          item.quantity,
          item.price
        ]
      );

      // Decrease product stock
      await connection.execute(
        "UPDATE products SET stock = stock - ? WHERE id = ?",
        [item.quantity, item.product_id]
      );

      // Remove item from cart
      await connection.execute(
        "DELETE FROM carts WHERE id = ? AND user_id = ?",
        [item.cart_id, userId]
      );
    }

    await connection.commit();
    connection.release();

    res.status(201).json({ message: "Order placed", orderId: formattedOrderId });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error("Order placement error:", error);
    res.status(500).json({ error: "Order placement failed" });
  }
});

// Get Orders Route
router.get("/getOrders", authMiddleware, async (req, res) => {
  const userId = req.user.userId;

  try {
    // Fetch user orders
    const [orders] = await db.execute(
      "SELECT id, address, payment_method, is_paid, total_amount, order_status, placed_at FROM orders WHERE user_id = ? ORDER BY placed_at DESC",
      [userId]
    );

    // Fetch order items for each order
    for (let order of orders) {
      const [items] = await db.execute(
        `SELECT product_id, product_name, image_url, quantity, price_at_purchase
         FROM order_items WHERE order_id = ?`,
        [order.id]
      );
      order.items = items;
      order.order_id = padOrderId(order.id);
    }

    res.status(200).json({ orders });
  } catch (error) {
    console.error("Fetch orders error:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

router.get("/getOrder/:orderId", authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  const { orderId } = req.params;

  // Support both O-0002 and raw numeric ID
  const internalOrderId = /^\d+$/.test(orderId)
    ? parseInt(orderId, 10)
    : extractOrderId(orderId);

  if (!internalOrderId) {
    return res.status(400).json({ error: "Invalid order ID format" });
  }

  try {
    const [orders] = await db.execute(
      `SELECT id, address, payment_method, is_paid, total_amount, order_status, placed_at
       FROM orders WHERE id = ? AND user_id = ?`,
      [internalOrderId, userId]
    );

    if (orders.length === 0) {
      return res.status(404).json({ status: "order_not_found", message: "Order not found" });
    }

    const order = orders[0];

    const [items] = await db.execute(
      `SELECT product_id, product_name, image_url, quantity, price_at_purchase, size, color
       FROM order_items WHERE order_id = ?`,
      [internalOrderId]
    );

    order.items = items;
    order.order_id = `O-${internalOrderId.toString().padStart(4, "0")}`;

    res.status(200).json({ order });
  } catch (error) {
    console.error("Fetch single order error:", error);
    res.status(500).json({ error: "Failed to fetch order" });
  }
});

module.exports = router;