const express = require("express");

const app = express();
const PORT = 3000;

app.get("/", (req, res) => {
  res.send("Server is running");
});

// loblaws adaptor 
app.get("/api/products", async (req, res) => {
    const search = req.query.search;
  
    try {
      const response = await fetch(
        `https://www.loblaws.ca/en/search?search-bar=${encodeURIComponent(search)}`
      );
  
      const html = await response.text();
  
      res.send(html);
    } catch (error) {
      console.error(error);
  
      res.status(500).json({
        error: "Failed to fetch products"
      });
    }
  });


app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
