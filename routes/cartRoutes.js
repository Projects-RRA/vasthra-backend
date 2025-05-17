const express = require("express");
const db = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Fetch cart Items
router.get("/getCartItems", authMiddleware, async (req, res) => {
  const userId = req.user.userId;

  try {
    // Join with products and filter out inactive ones
    const [items] = await db.execute(
      `SELECT 
         c.id AS cart_id, 
         c.quantity, 
         p.id AS product_id, 
         p.name, 
         p.price, 
         p.image_url, 
         p.stock
       FROM carts c
       JOIN products p ON c.product_id = p.id
       WHERE c.user_id = ? AND p.is_active = 1`,
      [userId]
    );

    res.status(200).json({ cart: items });
  } catch (error) {
    console.error("Fetch cart error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Add item to the cart
router.post("/addItem", authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  const { product_id, quantity } = req.body;

  if (!product_id || !quantity || quantity < 1) {
    return res
      .status(400)
      .json({ error: "Product ID and valid quantity required" });
  }

  try {
    // Fetch product details
    const [productRows] = await db.execute(
      "SELECT stock, is_active FROM products WHERE id = ?",
      [product_id]
    );

    if (productRows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    const { stock, is_active } = productRows[0];

    if (!is_active) {
      return res.status(400).json({ error: "Product is inactive" });
    }

    if (stock < quantity) {
      return res.status(400).json({ error: `Only ${stock} items in stock` });
    }

    // Check if product already in cart
    const [existing] = await db.execute(
      "SELECT * FROM carts WHERE user_id = ? AND product_id = ?",
      [userId, product_id]
    );

    if (existing.length > 0) {
      const newQuantity = existing[0].quantity + quantity;

      if (stock < newQuantity) {
        return res.status(400).json({ error: `Only ${stock} items in stock` });
      }

      await db.execute(
        "UPDATE carts SET quantity = ? WHERE user_id = ? AND product_id = ?",
        [newQuantity, userId, product_id]
      );

      return res.status(200).json({ message: "Cart item quantity increased" });
    }

    // Add new item to cart
    await db.execute(
      "INSERT INTO carts (user_id, product_id, quantity) VALUES (?, ?, ?)",
      [userId, product_id, quantity]
    );

    res.status(201).json({ message: "Item added to cart" });
  } catch (error) {
    console.error("Add to cart error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update cart item
router.put("/updateItem", authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  
  const { product_id, quantity } = req.body;

  if (!product_id || typeof quantity !== "number" || quantity < 1) {
    return res
      .status(400)
      .json({ error: "Valid productId and quantity required" });
  }

  try {
    // Check if product exists and is active
    const [productRows] = await db.execute(
      "SELECT stock, is_active FROM products WHERE id = ?",
      [product_id]
    );

    if (productRows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    const { stock, is_active } = productRows[0];

    if (!is_active) {
      return res.status(400).json({ error: "Product is inactive" });
    }

    if (quantity > stock) {
      return res.status(400).json({ error: `Only ${stock} items in stock` });
    }

    // Check if cart item exists
    const [existing] = await db.execute(
      "SELECT * FROM carts WHERE user_id = ? AND product_id = ?",
      [userId, product_id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: "Cart item not found" });
    }

    // Update cart
    await db.execute(
      "UPDATE carts SET quantity = ? WHERE user_id = ? AND product_id = ?",
      [quantity, userId, product_id]
    );

    res.status(200).json({ message: "Cart updated successfully" });
  } catch (error) {
    console.error("Update cart error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete a Cart Item by Product ID
router.delete("/removeItem/:productId", authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  const productId = req.params.productId;

  try {
    await db.execute("DELETE FROM carts WHERE user_id = ? AND product_id = ?", [
      userId,
      productId,
    ]);

    res.status(200).json({ message: "Item removed from cart" });
  } catch (error) {
    console.error("Delete cart item error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Clear Entire Cart for Logged-in User
router.delete("/clearCart", authMiddleware, async (req, res) => {
  const userId = req.user.userId;

  try {
    await db.execute("DELETE FROM carts WHERE user_id = ?", [userId]);
    res.status(200).json({ message: "Cart cleared" });
  } catch (error) {
    console.error("Clear cart error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
