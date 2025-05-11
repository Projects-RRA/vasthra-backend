/* 
  This is the script used to import the products from fakestore api to the database.
  Make sure you change the sellerId
  For now I just added 10 products to import
*/

require("dotenv").config({ path: __dirname + "/../../.env" });
const axios = require("axios");
const db = require("../../config/db");

const sellerId = 78; // Replace with actual seller ID
const conversionRate = 83; // USD to INR

const categoriesToImport = [
  {
    apiUrl: "https://fakestoreapi.com/products/category/men's%20clothing",
    name: "Men's Clothing",
    description: "Clothing for men including t-shirts, shirts, etc.",
    targetAudience: "men",
  },
  {
    apiUrl: "https://fakestoreapi.com/products/category/women's%20clothing",
    name: "Women's Clothing",
    description: "Clothing for women including tops, dresses, etc.",
    targetAudience: "women",
  },
];

async function importSampleProducts() {
  try {
    for (const category of categoriesToImport) {
      // Insert category
      const [categoryResult] = await db.execute(
        "INSERT INTO categories (name, description) VALUES (?, ?)",
        [category.name, category.description]
      );
      const categoryId = categoryResult.insertId;
      console.log(`📁 Category inserted: ${category.name} (ID: ${categoryId})`);

      // Fetch products
      const { data: allProducts } = await axios.get(category.apiUrl);
      const products = allProducts.slice(0, 5); // Limit to 5

      for (const product of products) {
        const priceInINR = (product.price * conversionRate).toFixed(2);

        await db.execute(
          `INSERT INTO products 
         (name, description, price, category_id, seller_id, stock, size, color, image_url, target_audience) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            product.title,
            product.description,
            priceInINR,
            categoryId,
            sellerId,
            Math.floor(Math.random() * 50) + 10,
            "M",
            "Mixed",
            product.image,
            category.name.includes("Men") ? "men" : "women",
          ]
        );

        console.log(
          `🛒 Product added: ${product.title} (₹${priceInINR}) → ${category.name}`
        );
      }
    }
    console.log("✅ All sample products and categories imported successfully!");
  } catch (err) {
    console.error("❌ Import failed:", err);
  }
}

importSampleProducts().catch((error) => {
  console.error("❌ Error importing products:", error);
});
