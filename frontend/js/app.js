const API = 'http://localhost:3000';

const PRODUCT_IMAGES = {
    p1: 'https://surf.inc/12291-large_default2x/just-be-quiet-box-tee-vintage-white.webp',
    p2: 'https://surf.inc/11100-large_default2x/just-be-quiet-hoodie-acid-black.webp',
    p3: 'https://surf.inc/7973-large_default2x/no-rules-cord-cap-cookie.webp',
};

document.addEventListener('DOMContentLoaded', () => {
    updateCartBadge();
    const path = window.location.pathname;

    if (path.endsWith('/') || path.includes('index.html')) loadCatalog();
    if (path.includes('product.html')) loadProduct();
    if (path.includes('cart.html')) loadCart();
});

/* -------- SHARED -------- */
async function updateCartBadge() {
    try {
        const res = await fetch(`${API}/cart`);
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
        const res = await fetch(`${API}/products`);
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
                <a href="product.html?id=${p.id}" class="image-wrapper">
                    <img src="${PRODUCT_IMAGES[p.id]}" alt="${p.name}" referrerpolicy="no-referrer" />
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
        const res = await fetch(`${API}/products/${id}`);
        if (!res.ok) throw new Error();
        const p = await res.json();

        container.innerHTML = `
            <div class="image-wrapper">
                <img src="${PRODUCT_IMAGES[p.id]}" alt="${p.name}" referrerpolicy="no-referrer" />
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
        const res = await fetch(`${API}/cart`);
        const cart = await res.json();

        if (!cart.length) {
            container.innerHTML = `
                <div class="cart-empty empty-state">
                    <p>Your cart is empty.</p>
                    <a href="index.html" class="button button-secondary">Continue shopping</a>
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
            cart.map(item => fetch(`${API}/products/${item.productId}`).then(r => r.json()))
        );

        productsData.forEach((p, index) => {
            const item = cart[index];
            total += p.price * item.quantity;
            currency = p.currency;

            const row = document.createElement('div');
            row.className = 'cart-item';
            row.innerHTML = `
                <img src="${PRODUCT_IMAGES[p.id]}" alt="${p.name}" referrerpolicy="no-referrer" />
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
                const res = await fetch(`${API}/orders`, { method: 'POST' });
                if (!res.ok) throw new Error();
                const order = await res.json();

                container.innerHTML = `
                    <div class="message message-success">
                        <h3>Thank you!</h3>
                        <p>Order <strong>${order.orderId}</strong> completed successfully.</p>
                        <a href="index.html" class="button button-secondary button-inline">
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
        const res = await fetch(`${API}/cart`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId }),
        });

        if (!res.ok) throw new Error();

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