# HTML Actions - Express Server with SQLite

This project demonstrates a basic e-commerce website with an Express server and SQLite database, intentionally designed for teaching security vulnerabilities like SQL injection and XSS.

## Setup Instructions

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Initialize the database:**
   ```bash
   npm run init-db
   ```

3. **Start the server:**
   ```bash
   npm start
   ```

4. **Open your browser and navigate to:**
   ```
   http://localhost:3000
   ```

## Features

- **Product Display**: Products are loaded from a SQLite database instead of being hardcoded
- **Search Functionality**: Search products by name or description (intentionally vulnerable to SQL injection)
- **Add Products**: Form to add new products to the database (demonstrates POST requests)
- **Delete Products**: X buttons on each product to delete them (demonstrates DELETE requests)
- **Interactive Banner**: Click the banner to cycle through promotional messages
- **Mixed JavaScript**: Demonstrates both inline and external JavaScript files
- **No Input Validation**: Intentionally designed for teaching security concepts

## Security Vulnerabilities (For Educational Purposes)

⚠️ **WARNING**: This application is intentionally vulnerable and should only be used for educational purposes.

### SQL Injection
- The search endpoint (`/api/products/search`) is vulnerable to SQL injection
- Try searching for: `' OR '1'='1` to see all products
- Try searching for: `'; DROP TABLE products; --` to attempt table deletion

### XSS (Cross-Site Scripting)
- Product names and descriptions are not sanitized when displayed
- The search functionality uses `encodeURIComponent()` but the server doesn't validate input
- The "Add Product" form displays user input without sanitization

### POST Request Demonstration
- The "Add Product" form demonstrates how POST requests work
- Students can observe the request in browser developer tools (Network tab)
- Shows JSON payload structure and HTTP headers
- Demonstrates form data collection and API communication

### DELETE Request Demonstration
- X buttons on each product demonstrate DELETE requests
- Students can observe DELETE requests in browser developer tools
- Shows URL parameters and HTTP DELETE method
- Demonstrates confirmation dialogs and error handling

### JavaScript Structure Demonstration
- **Inline JavaScript**: Banner functionality and product loading in `<script>` tags
- **External JavaScript**: Product operations (add/delete) in `product-operations.js`
- **Mixed Approach**: Shows how both can work together in the same application
- **File Organization**: Demonstrates code separation and modularity concepts

## API Endpoints

- `GET /` - Serves the main HTML page
- `GET /api/products` - Returns all products
- `GET /api/products/search?q=<search_term>` - Searches products (vulnerable to SQL injection)
- `POST /api/products` - Adds a new product (vulnerable to SQL injection)
- `DELETE /api/products/:id` - Deletes a product by ID (vulnerable to SQL injection)

## Database Schema

```sql
CREATE TABLE products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    price REAL NOT NULL
);
```

## Educational Use

This project is designed to teach:
1. How SQL injection attacks work
2. The importance of input validation and sanitization
3. How to identify vulnerable code patterns
4. Basic web application security concepts

## Next Steps for Security

To make this application secure, you would need to:
1. Use parameterized queries instead of string concatenation
2. Implement input validation and sanitization
3. Add proper error handling
4. Use a web application firewall
5. Implement proper authentication and authorization
