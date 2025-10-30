// EXTERNAL JAVASCRIPT FILE - product-operations.js
// This file contains functions for adding and deleting products
// Demonstrates external JavaScript file usage alongside inline scripts
// 
// This approach shows students:
// 1. How to separate JavaScript code into different files
// 2. How external files can be imported into HTML
// 3. How inline and external JavaScript can work together

// Function to delete a product (intentionally vulnerable for teaching)
async function deleteProduct(productId) {
    if (!confirm('Are you sure you want to delete this product?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/products/${productId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            // Reload products to show updated list
            loadProducts();
        } else {
            throw new Error('Failed to delete product');
        }
    } catch (error) {
        console.error('Error deleting product:', error);
        alert('Error deleting product: ' + error.message);
    }
}

// Function to add a new product (now submits to admin review queue)
async function addProduct(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const productData = {
        name: formData.get('name'),
        description: formData.get('description'),
        price: parseFloat(formData.get('price'))
    };
    
    const statusDiv = document.getElementById('form-status');
    
    try {
        const response = await fetch('/api/products/pending', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(productData)
        });
        
        if (response.ok) {
            const newProduct = await response.json();
            statusDiv.style.display = 'block';
            statusDiv.style.backgroundColor = '#d4edda';
            statusDiv.style.color = '#155724';
            statusDiv.style.border = '1px solid #c3e6cb';
            statusDiv.innerHTML = `✅ Product "${newProduct.name}" submitted for review!`;
            
            // Clear the form
            event.target.reset();
            
            // Keep the message visible without reloading the page
            statusDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            throw new Error('Failed to add product');
        }
    } catch (error) {
        console.error('Error adding product:', error);
        statusDiv.style.display = 'block';
        statusDiv.style.backgroundColor = '#f8d7da';
        statusDiv.style.color = '#721c24';
        statusDiv.style.border = '1px solid #f5c6cb';
        statusDiv.innerHTML = `❌ Error adding product: ${error.message}`;
    }
}

// Note: loadProducts() function is still defined in the inline script
// This demonstrates mixing inline and external JavaScript

// Admin queue operations
async function approvePending(pendingId) {
    try {
        const resp = await fetch(`/api/pending-products/${pendingId}/approve`, { method: 'POST' });
        if (!resp.ok) throw new Error('Approve failed');
        // Reload to reflect change
        window.location.reload();
    } catch (e) {
        alert('Error approving product: ' + e.message);
    }
}

async function rejectPending(pendingId) {
    if (!confirm('Reject and remove this pending product?')) return;
    try {
        const resp = await fetch(`/api/pending-products/${pendingId}`, { method: 'DELETE' });
        if (!resp.ok) throw new Error('Reject failed');
        window.location.reload();
    } catch (e) {
        alert('Error rejecting product: ' + e.message);
    }
}
