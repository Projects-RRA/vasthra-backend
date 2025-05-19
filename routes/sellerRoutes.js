const express = require("express");
const db = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Create a product
router.post("/addProducts", authMiddleware, async (req, res) => {
  const sellerId = req.user.userId; // or req.user.sellerId
  const {
    name,
    description,
    price,
    category_id,
    stock,
    image_url,
    size,
    color,
    target_audience,
    is_active = 1,
  } = req.body;

  try {
    await db.execute(
      `INSERT INTO products (seller_id, name, description, price, category_id, stock, image_url, size, color, is_active, target_audience)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sellerId,
        name,
        description,
        price,
        category_id,
        stock,
        image_url,
        size,
        color,
        is_active,
        target_audience
      ]
    );

    res.status(201).json({ message: "Product created successfully" });
  } catch (error) {
    console.error("Create product error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update Product
router.put("/products/:id", authMiddleware, async (req, res) => {
  const sellerId = req.user.userId;
  const productId = req.params.id;
  const { name, price, stock, description, category_id, image_url, size, color, is_active } = req.body;

  try {
    // Verify ownership
    const [productRows] = await db.execute(
      "SELECT id FROM products WHERE id = ? AND seller_id = ?",
      [productId, sellerId]
    );

    if (productRows.length === 0) {
      return res.status(403).json({ message: "Not authorized to update this product" });
    }

    // Update
    await db.execute(
      `UPDATE products 
       SET name = ?, price = ?, stock = ?, description = ?, category_id = ?, image_url = ?, size = ?, color = ?, is_active = ? 
       WHERE id = ?`,
      [name, price, stock, description, category_id, image_url, size, color, is_active, productId]
    );

    res.status(200).json({ message: "Product updated successfully" });
  } catch (error) {
    console.error("Update product error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete Product
router.delete("/products/:id", authMiddleware, async (req, res) => {
  const sellerId = req.user.userId;
  const productId = req.params.id;

  try {
    // Verify ownership
    const [productRows] = await db.execute(
      "SELECT id FROM products WHERE id = ? AND seller_id = ?",
      [productId, sellerId]
    );

    if (productRows.length === 0) {
      return res.status(403).json({ message: "Not authorized to delete this product" });
    }

    await db.execute("DELETE FROM products WHERE id = ?", [productId]);
    res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("Delete product error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// List the Products
router.get("/products", authMiddleware, async (req, res) => {
  const sellerId = req.user.userId ; // Assuming `req.user` is set by `authMiddleware`

  try {
    const [rows] = await db.execute(
      `SELECT p.*, c.name AS category_name
       FROM products p
       JOIN categories c ON p.category_id = c.id
       WHERE p.seller_id = ?
       ORDER BY p.created_at DESC`,
      [sellerId]
    );

    res.status(200).json({ products: rows });
  } catch (error) {
    console.error("Error fetching seller's products:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Search Products

router.get("/products/search", authMiddleware, async (req, res) => {
  const sellerId = req.user.userId;
  const { id, name = ""} = req.query;

  try {
    let query = "SELECT * FROM products WHERE seller_id = ?";
    const params = [sellerId];

    // If product ID is provided and not empty
    if (id && id.trim() !== "") {
      query += " AND id = ?";
      params.push(id);
    } else {
      // If name is provided and not empty
      if (name && name.trim() !== "") {
        query += " AND name LIKE ?";
        params.push(`%${name}%`);
      }

      // If category ID is provided and not empty
    //   if (category_id && category_id.trim() !== "") {
    //     query += " AND category_id = ?";
    //     params.push(category_id);
    //   }
    }

    // Debug logs
    // console.log("Search query:", query);
    // console.log("Params:", params);

    const [rows] = await db.execute(query, params);
    res.status(200).json(rows);
  } catch (error) {
    console.error("Search product error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});




module.exports = router;
