const express = require("express");
const db = require("../config/db");

const router = express.Router();

// Get all categories
router.get("/categories", async (req, res) => {
  try {
    const [rows] = await db.execute(
      "SELECT * FROM categories"
    );
    res.status(200).json({ categories: rows });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get all active products
router.get("/products", async (req, res) => {
  try {
    const [rows] = await db.execute(`
        SELECT p.*, c.name AS category_name
        FROM products p
        JOIN categories c ON p.category_id = c.id
        WHERE p.is_active = 1 AND p.stock > 0
        ORDER BY p.created_at DESC
      `);
    res.status(200).json({ products: rows });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get products for a specific category
router.get("/products/category/:id", async (req, res) => {
  const categoryId = req.params.id;

  try {
    const [rows] = await db.execute(
      `
        SELECT p.*, c.name AS category_name
        FROM products p
        JOIN categories c ON p.category_id = c.id
        WHERE p.category_id = ? AND p.is_active = 1
        ORDER BY p.created_at DESC
        `,
      [categoryId]
    );

    res.status(200).json({ products: rows });
  } catch (error) {
    console.error("Error fetching category products:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get a single product by ID
router.get("/products/:id", async (req, res) => {
    const productId = req.params.id;
  
    try {
      const [rows] = await db.execute(
        `
        SELECT p.*, c.name AS category_name
        FROM products p
        JOIN categories c ON p.category_id = c.id
        WHERE p.id = ? AND p.is_active = 1
        `,
        [productId]
      );
  
      if (rows.length === 0) {
        return res.status(404).json({ error: "Product not found" });
      }
  
      res.status(200).json({ product: rows[0] });
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  

module.exports = router;
