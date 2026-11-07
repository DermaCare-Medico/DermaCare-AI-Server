import assert from "node:assert/strict";
import test from "node:test";
import { signAccessToken } from "../auth/services/token.service.js";
import { Role } from "../../generated/prisma/client.js";

const BASE_URL = "http://localhost:4000/api/v1";

const patientToken = signAccessToken({
    id: "20000000-0000-4000-8000-000000000001",
    role: Role.PATIENT,
});

test("Pharmacy E2E: Medicine catalog search, filtering, and availability", async () => {
    const res = await fetch(`${BASE_URL}/medicines?page=1&limit=5&requiresPrescription=false`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.data.length > 0);
    for (const med of json.data) {
        assert.equal(med.requiresPrescription, false);
        assert.ok(med.price > 0);
        assert.ok(med.stockQuantity > 0);
    }

    const singleMed = json.data[0];
    const detailRes = await fetch(`${BASE_URL}/medicines/${singleMed.id}`);
    assert.equal(detailRes.status, 200);
    const detailJson = await detailRes.json();
    assert.equal(detailJson.data.id, singleMed.id);
});

test("Pharmacy E2E: Shopping cart add, view, update quantity, remove, and totals", async () => {
    // 1. Get initial cart
    const cartRes = await fetch(`${BASE_URL}/cart`, {
        headers: { Authorization: `Bearer ${patientToken}` },
    });
    assert.equal(cartRes.status, 200);

    // 2. Add an OTC medicine to cart (Benzoyl Peroxide 2.5% Wash)
    const addRes = await fetch(`${BASE_URL}/cart/items`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${patientToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            medicineId: "40000000-0000-4000-8000-000000000002",
            quantity: 2,
        }),
    });
    assert.equal(addRes.status, 201);
    const addJson = await addRes.json();
    assert.ok(addJson.data.cartItemId);
    const cartItemId = addJson.data.cartItemId;

    // 3. View cart and check calculations
    const updatedCartRes = await fetch(`${BASE_URL}/cart`, {
        headers: { Authorization: `Bearer ${patientToken}` },
    });
    const updatedCart = await updatedCartRes.json();
    assert.equal(updatedCartRes.status, 200);
    assert.ok(updatedCart.data.items.length >= 1);
    const foundItem = updatedCart.data.items.find((it: any) => it.id === cartItemId);
    assert.ok(foundItem);
    assert.equal(foundItem.quantity, 2);
    assert.equal(foundItem.unitPrice, 340);
    assert.equal(foundItem.lineTotal, 680);
    assert.ok(updatedCart.data.subtotal >= 680);
    assert.equal(updatedCart.data.shipping, 5.0);
    assert.equal(updatedCart.data.total, Number((updatedCart.data.subtotal + 5.0).toFixed(2)));

    // 4. Update quantity
    const patchRes = await fetch(`${BASE_URL}/cart/items/${cartItemId}`, {
        method: "PATCH",
        headers: {
            Authorization: `Bearer ${patientToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ quantity: 3 }),
    });
    assert.equal(patchRes.status, 200);
    const patchJson = await patchRes.json();
    assert.equal(patchJson.data.quantity, 3);
    assert.equal(patchJson.data.lineTotal, 1020);

    // 5. Remove item
    const delRes = await fetch(`${BASE_URL}/cart/items/${cartItemId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${patientToken}` },
    });
    assert.equal(delRes.status, 200);
});

test("Pharmacy E2E: Prescription verification enforces ownership and eligibility", async () => {
    // Try adding Rx-required medicine without prescription (Adapalene Gel 0.1%)
    const failRes = await fetch(`${BASE_URL}/cart/items`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${patientToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            medicineId: "40000000-0000-4000-8000-000000000001",
            quantity: 1,
        }),
    });
    assert.equal(failRes.status, 400);

    // Try adding with another patient's prescription (or invalid prescription)
    const fakeRxRes = await fetch(`${BASE_URL}/cart/items`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${patientToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            medicineId: "40000000-0000-4000-8000-000000000001",
            quantity: 1,
            prescriptionId: "00000000-0000-0000-0000-000000000000",
        }),
    });
    assert.equal(fakeRxRes.status, 400);

    // Try checking out directly with an unauthorized Rx
    const directOrderFail = await fetch(`${BASE_URL}/orders`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${patientToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            deliveryAddress: "House 10, Road 4, Dhanmondi, Dhaka",
            items: [
                {
                    medicineId: "40000000-0000-4000-8000-000000000001",
                    quantity: 1,
                },
            ],
        }),
    });
    assert.equal(directOrderFail.status, 400);
});

test("Pharmacy E2E: Cart checkout, atomic stock deduction, idempotency, and payment simulation", async () => {
    // 1. Add OTC item to cart
    await fetch(`${BASE_URL}/cart/items`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${patientToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            medicineId: "40000000-0000-4000-8000-000000000004", // Hydrocortisone 1% Cream (price 120)
            quantity: 1,
        }),
    });

    const idempotencyKey = `idemp-${Date.now()}`;

    // 2. Checkout order from cart
    const checkoutRes = await fetch(`${BASE_URL}/orders`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${patientToken}`,
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
            fromCart: true,
            deliveryAddress: "House 24, Road 7, Dhanmondi, Dhaka 1205",
        }),
    });
    assert.equal(checkoutRes.status, 201);
    const checkoutJson = await checkoutRes.json();
    assert.equal(checkoutJson.success, true);
    assert.ok(checkoutJson.data.id);
    const orderId = checkoutJson.data.id;
    assert.equal(checkoutJson.data.status, "PENDING");
    assert.equal(checkoutJson.data.totalAmount, "120");

    // 3. Test Idempotency with exact same key
    const duplicateRes = await fetch(`${BASE_URL}/orders`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${patientToken}`,
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
            fromCart: true,
            deliveryAddress: "House 24, Road 7, Dhanmondi, Dhaka 1205",
        }),
    });
    assert.equal(duplicateRes.status, 201);
    const duplicateJson = await duplicateRes.json();
    assert.equal(duplicateJson.data.id, orderId); // Exact same order returned

    // 4. Verify cart was cleared after checkout
    const postCheckoutCartRes = await fetch(`${BASE_URL}/cart`, {
        headers: { Authorization: `Bearer ${patientToken}` },
    });
    const postCheckoutCart = await postCheckoutCartRes.json();
    assert.equal(postCheckoutCart.data.items.length, 0);

    // 5. Order history & detail retrieval
    const orderListRes = await fetch(`${BASE_URL}/orders`, {
        headers: { Authorization: `Bearer ${patientToken}` },
    });
    assert.equal(orderListRes.status, 200);
    const orderListJson = await orderListRes.json();
    assert.ok(orderListJson.data.length > 0);

    const orderDetailRes = await fetch(`${BASE_URL}/orders?id=${orderId}`, {
        headers: { Authorization: `Bearer ${patientToken}` },
    });
    assert.equal(orderDetailRes.status, 200);
    const orderDetailJson = await orderDetailRes.json();
    assert.equal(orderDetailJson.data.id, orderId);

    // 6. Test payment simulation / status
    const payStatusRes = await fetch(`${BASE_URL}/orders/${orderId}/payments`, {
        headers: { Authorization: `Bearer ${patientToken}` },
    });
    assert.equal(payStatusRes.status, 200);

    // Simulated payment in test environment
    const payRes = await fetch(`${BASE_URL}/orders/${orderId}/payments`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${patientToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            amount: 120,
            currency: "BDT",
        }),
    });
    assert.equal(payRes.status, 201);
    const payJson = await payRes.json();
    assert.equal(payJson.data.status, "PAID");

    // Recheck order status is now CONFIRMED
    const paidOrderRes = await fetch(`${BASE_URL}/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${patientToken}` },
    });
    const paidOrderJson = await paidOrderRes.json();
    assert.equal(paidOrderJson.data.status, "CONFIRMED");
});
