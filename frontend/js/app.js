const API = 'https://my-shop-project-bsg1.onrender.com';
const STARTUP_TIMEOUT = 50000; // 50 seconds for backend startup (can delay up to 50+ seconds)
const RETRY_INTERVAL = 1000; // Retry every 1 second

const PRODUCT_IMAGES = {
    p1: 'items-images/t-shirt.png',
    p2: 'items-images/hoodie.png',
    p3: 'items-images/cap.png',
};

let backendStartupOverlay = null;

function createBackendStartupOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'backend-startup-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 9999;
    `;
    overlay.innerHTML = `
        <div style="
            background: white;
            padding: 2rem;
            border-radius: 8px;
            text-align: center;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            max-width: 400px;
        ">
            <div style="
                width: 50px;
                height: 50px;
                border: 4px solid #f0f0f0;
                border-top-color: #6366f1;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto 1rem;
            "></div>
            <h2 style="margin: 0 0 0.5rem; color: #333;">Starting Backend Server</h2>
            <p style="margin: 0; color: #666; font-size: 14px;">This may take 50 seconds or more. Please wait...</p>
        </div>
        <style>
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
        </style>
    `;
    document.body.appendChild(overlay);
    return overlay;
}

function showBackendStartup() {
    if (!backendStartupOverlay) {
        backendStartupOverlay = createBackendStartupOverlay();
    }
    backendStartupOverlay.style.display = 'flex';
}

function hideBackendStartup() {
    if (backendStartupOverlay) {
        backendStartupOverlay.style.display = 'none';
    }
}

async function fetchWithStartupDetection(url, options = {}) {
    const controller = new AbortController();
    const startupTimer = setTimeout(() => {
        controller.abort();
    }, 5000); // 5 second timeout per request

    try {
        const res = await fetch(url, {
            ...options,
            signal: controller.signal,
        });
        clearTimeout(startupTimer);
        return res;
    } catch (error) {
        clearTimeout(startupTimer);
        // Network error or timeout - backend might be starting
        if (error.name === 'AbortError' || error.message.includes('Failed to fetch')) {
            showBackendStartup();
            // Retry with exponential backoff for up to 15 seconds
            const startTime = Date.now();
            while (Date.now() - startTime < STARTUP_TIMEOUT) {
                await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL));
                try {
                    const retryRes = await fetch(url, {
                        ...options,
                        signal: AbortSignal.timeout(5000),
                    });
                    hideBackendStartup();
                    return retryRes;
                } catch (retryError) {
                    // Continue retrying
                }
            }
            hideBackendStartup();
            throw new Error('Backend server did not respond');
        }
        throw error;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    updateCartBadge();
    const path = window.location.pathname;

    if (path.endsWith('/') || path.includes('index.html') || path.endsWith('/index')) loadCatalog();
    if (path.includes('product.html') || path.endsWith('/product')) loadProduct();
    if (path.includes('cart.html') || path.endsWith('/cart')) loadCart();
});

/* -------- SHARED -------- */
async function updateCartBadge() {
    try {
        const res = await fetchWithStartupDetection(`${API}/cart`);
        const cart = await res.json();
        const count = cart.reduce((sum, item) => sum + item.quantity, 0);
        const badge = document.getElementById('cart-count');
        if (badge) {
            badge.textContent = count > 0 ? count : '';
        }
    } catch (e) {
        console.error('Failed to update cart badge', e);
    }
}

function showMessage(container, text, type = 'success') {
    const msg = document.createElement('div');
    msg.className = `message message-${type}`;
    msg.textContent = text;
    container.prepend(msg);
    setTimeout(() => msg.remove(), 5000);
}

/* -------- CATALOG -------- */
async function loadCatalog() {
    const grid = document.getElementById('product-grid');
    if (!grid) return;

    try {
        const res = await fetchWithStartupDetection(`${API}/products`);
        if (!res.ok) throw new Error();
        const products = await res.json();

        if (products.length === 0) {
            grid.innerHTML = '<p class="cart-empty">No products found.</p>';
            return;
        }

        grid.innerHTML = '';
        products.forEach(p => {
            const card = document.createElement('div');
            card.className = 'product-card';
            card.innerHTML = `
                <a href="product?id=${p.id}" class="image-wrapper">
                    <img src="${PRODUCT_IMAGES[p.id]}" alt="${p.name}" />
                </a>
                <div class="product-info sticky-block">
                    <h3>${p.name}</h3>
                    <div class="price">${p.price.toFixed(2)} ${p.currency}</div>
                    <button class="button button-primary add-to-cart-btn" data-id="${p.id}">Add to cart</button>
                    <span class="feedback-text">Added to cart ✓</span>
                </div>
            `;

            card.querySelector('.add-to-cart-btn').addEventListener('click', (e) => {
                handleAddToCart(e.target, p.id, card.querySelector('.feedback-text'));
            });

            grid.appendChild(card);
        });
    } catch {
        grid.innerHTML = '<div class="message message-error">Failed to load products. Please try again later.</div>';
    }
}

/* -------- PRODUCT PAGE -------- */
async function loadProduct() {
    const container = document.getElementById('product-page');
    if (!container) return;

    const id = new URLSearchParams(window.location.search).get('id');
    if (!id) return;

    try {
        const res = await fetchWithStartupDetection(`${API}/products/${id}`);
        if (!res.ok) throw new Error();
        const p = await res.json();

        // Push event to Data Layer
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
            event: 'view_item',
            ecommerce: {
                currency: p.currency,
                value: p.price,
                items: [{
                    item_id: p.id,
                    item_name: p.name,
                    price: p.price,
                    quantity: 1,
                }, ],
            },
        });

        container.innerHTML = `
            <div class="image-wrapper">
                <img src="${PRODUCT_IMAGES[p.id]}" alt="${p.name}" />
            </div>
            <div class="product-info sticky-block">
                <h2>${p.name}</h2>
                <div class="price">${p.price.toFixed(2)} ${p.currency}</div>
                <button class="button button-primary add-to-cart-btn">Add to cart</button>
                <span class="feedback-text">Added to cart ✓</span>
            </div>
        `;

        container.querySelector('.add-to-cart-btn').addEventListener('click', (e) => {
            handleAddToCart(e.target, p.id, container.querySelector('.feedback-text'));
        });
    } catch {
        container.innerHTML = '<div class="message message-error">Failed to load product.</div>';
    }
}

/* -------- CART -------- */
async function loadCart() {
    const container = document.getElementById('cart-container');
    if (!container) return;

    try {
        const res = await fetchWithStartupDetection(`${API}/cart`);
        const cart = await res.json();

        if (!cart.length) {
            container.innerHTML = `
                <div class="cart-empty empty-state">
                    <p>Your cart is empty.</p>
                    <a href="/" class="button button-secondary">Continue shopping</a>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="cart-items" id="cart-items-list"></div>
            <div class="cart-summary" id="cart-summary"></div>
        `;

        const list = document.getElementById('cart-items-list');
        const summary = document.getElementById('cart-summary');

        let total = 0;
        let currency = 'EUR';

        const productsData = await Promise.all(
            cart.map(item => fetchWithStartupDetection(`${API}/products/${item.productId}`).then(r => r.json()))
        );

        productsData.forEach((p, index) => {
            const item = cart[index];
            total += p.price * item.quantity;
            currency = p.currency;

            const row = document.createElement('div');
            row.className = 'cart-item';
            row.innerHTML = `
                <img src="${PRODUCT_IMAGES[p.id]}" alt="${p.name}" />
                <div class="cart-item-details">
                    <h4>${p.name}</h4>
                    <p>Quantity: ${item.quantity} <button class="button-add-more" data-id="${p.id}">+</button></p>
                </div>
                <div class="cart-item-price">${(p.price * item.quantity).toFixed(2)} ${p.currency}</div>
            `;
            row.querySelector('.button-add-more').addEventListener('click', async () => {
                await handleAddToCart(row.querySelector('.button-add-more'), p.id);
                loadCart();
            });
            list.appendChild(row);
        });

        summary.innerHTML = `
            <h3><span>Total</span> <span>${total.toFixed(2)} ${currency}</span></h3>
            <button class="button button-primary" id="buy-btn">Complete Purchase</button>
        `;

        summary.querySelector('#buy-btn').addEventListener('click', async (e) => {
            const btn = e.target;
            btn.disabled = true;
            btn.classList.add('loading');

            try {
                const res = await fetchWithStartupDetection(`${API}/orders`, { method: 'POST' });
                if (!res.ok) throw new Error();
                const order = await res.json();

                // Push event to Data Layer
                const purchaseItems = productsData.map((product, index) => ({
                    item_id: product.id,
                    item_name: product.name,
                    price: product.price,
                    quantity: cart[index].quantity,
                }));

                window.dataLayer = window.dataLayer || [];
                window.dataLayer.push({
                    event: 'purchase',
                    ecommerce: {
                        transaction_id: order.orderId,
                        value: total,
                        currency,
                        items: purchaseItems,
                        tax: 0,
                        shipping: 0
                    },
                });

                container.innerHTML = `
                    <div class="message message-success">
                        <h3>Thank you!</h3>
                        <p>Order <strong>${order.orderId}</strong> completed successfully.</p>
                        <a href="/" class="button button-secondary button-inline">
                    Back to shop</a>
                    </div>
                `;
                updateCartBadge();
            } catch {
                btn.disabled = false;
                btn.classList.remove('loading');
                showMessage(summary, 'Failed to complete purchase.', 'error');
            }
        });
    } catch {
        container.innerHTML = '<div class="message message-error">Failed to load cart.</div>';
    }
}

/* -------- ACTIONS -------- */
async function handleAddToCart(btn, productId, feedback) {
    if (btn.classList.contains('loading')) return;

    const originalText = btn.textContent;
    btn.classList.add('loading');
    btn.disabled = true;

    try {
        const res = await fetchWithStartupDetection(`${API}/cart`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId }),
        });

        if (!res.ok) throw new Error();

        // Push event to Data Layer
        const productRes = await fetchWithStartupDetection(`${API}/products/${productId}`);
        const product = await productRes.json();

        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
            event: 'add_to_cart',
            ecommerce: {
                currency: product.currency,
                value: product.price,
                items: [{
                    item_id: product.id,
                    item_name: product.name,
                    price: product.price,
                    quantity: 1,
                }],
            },
        });

        btn.classList.remove('loading');
        btn.classList.add('success');
        
        if (originalText === 'Add to cart') {
            btn.textContent = 'Added';
        }
        
        if (feedback) feedback.classList.add('show');

        updateCartBadge();

        setTimeout(() => {
            btn.classList.remove('success');
            btn.disabled = false;
            btn.textContent = originalText;
            if (feedback) feedback.classList.remove('show');
        }, 2000);
    } catch {
        btn.classList.remove('loading');
        btn.disabled = false;
        
        if (originalText === 'Add to cart') {
            btn.textContent = 'Error';
            setTimeout(() => {
                btn.textContent = originalText;
            }, 2000);
        } else {
            btn.textContent = originalText;
        }
    }
}