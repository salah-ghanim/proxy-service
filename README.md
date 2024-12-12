# **Proxy Service**

This project provides a lightweight proxy service built with Node.js and Express. It includes two endpoints optimized for different use cases:

1. `/proxy` - A general-purpose proxy for lightweight API calls and small payloads.
2. `/files` - A streaming proxy optimized for large file uploads and downloads.

The project is pre-configured with all dependencies included in the `node_modules` folder, making it ready for deployment and immediate use.

---

## **Features**

### `/proxy`
- Forwards API requests and small payloads.
- Automatically sets headers and manages query parameters.

### `/files`
- Handles large file uploads and downloads efficiently using streaming.
- Ideal for scenarios where memory overhead needs to be minimized.

---

## **Requirements**

- **Node.js**: Version 16.x or later.

---

## **How to Use**

### 1. **Download or Clone the Repository**
```bash
git clone <repository-url>
cd proxy-service
```

### 2. **Install Dependencies (Optional)**
The `node_modules` folder is included in the project, but if you need to update dependencies:
```bash
npm install
```

### 3. **Run the Service**
```bash
node index.js
```

The service will start and run on `http://localhost:3000` by default.

### 4. **Endpoints**

#### **1. `/proxy`**
- Use for lightweight API requests.
- Example:
    ```bash
    curl "http://localhost:3000/proxy?targetURL=https://jsonplaceholder.typicode.com/posts&getawayAPIKey=d53e4e28-8b9e-4c5d-9a8b-5c2e3a3b4a57"
    ```

#### **2. `/files`**
- Use for large file uploads or downloads.
- Example (Uploading a file):
    ```bash
    curl -F "file=@example.pdf" "http://localhost:3000/files?targetURL=https://example.com/upload&getawayAPIKey=d53e4e28-8b9e-4c5d-9a8b-5c2e3a3b4a57"
    ```

---

## **Environment Variables**

- `API_KEY`: Authentication key for the proxy service. Defaults to `d53e4e28-8b9e-4c5d-9a8b-5c2e3a3b4a57`.
- `PORT`: Port on which the proxy service runs. Defaults to `3000`.

---

## **Notes**

- The `node_modules` folder is included for convenience so the service can be deployed and run immediately without additional setup.
- Modify the `API_KEY` as required for security.

---

## **License**

This project is licensed under the MIT License.

---

Let me know if you need further clarification or modifications!
