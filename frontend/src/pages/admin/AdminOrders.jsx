import { useEffect, useRef, useState } from "react";
import api from "../../api/axios";

function naira(n) {
  return "₦" + Number(n).toLocaleString("en-NG");
}

const emptySale = {
  customerType: "walk_in", customerId: "", customerName: "", customerPhone: "",
  customerEmail: "", referrerId: "", productId: "", quantity: 1, paymentMethod: "cash",
};
const pendingStorageKey = "krisgen.pendingInStoreSale";
function readPendingSale() {
  try { return JSON.parse(sessionStorage.getItem(pendingStorageKey)) || null; }
  catch { return null; }
}

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [paymentReviews, setPaymentReviews] = useState([]);
  const [reviewError, setReviewError] = useState("");
  const [filter, setFilter] = useState("");
  const [showInStoreForm, setShowInStoreForm] = useState(false);

  const [products, setProducts] = useState([]);
  const [members, setMembers] = useState([]);

  const [pendingSale, setPendingSale] = useState(readPendingSale);
  const [saleForm, setSaleForm] = useState(() => readPendingSale()?.form || { ...emptySale });
  const submitting = useRef(false);
  const [saleSuccess, setSaleSuccess] = useState("");

  const [savingSale, setSavingSale] = useState(false);
  const [saleError, setSaleError] = useState("");


  function load() {
    // Review receipts include unmatched references and additional payments on an order.
    api.get("/admin/payments/review").then((res) => {
      setPaymentReviews(res.data.data);
      setReviewError("");
    }).catch(() => setReviewError("Could not load payments awaiting review. Refresh to try again."));
    return api.get("/orders/admin/all", { params: filter ? { status: filter } : {} }).then((res) => setOrders(res.data.data));
  }
  useEffect(() => { load().catch(() => setSaleError("Could not refresh orders. Reload to try again.")); }, [filter]);
  useEffect(() => {
    if (!showInStoreForm) return;

    async function loadSaleOptions() {
      try {
        setSaleError("");

        const [productsRes, membersRes] = await Promise.all([
          api.get("/products/admin/all"),
          api.get("/admin/members"),
        ]);

        setProducts(productsRes.data.data.filter((product) => product.isActive));
        setMembers(membersRes.data.data);
      } catch (err) {
        setSaleError(
          err.response?.data?.message ||
          "Could not load products and members"
        );
      }
    }

    loadSaleOptions();
  }, [showInStoreForm]);

  async function submitSale(event) {
    event.preventDefault();
    if (submitting.current) return;
    const qty = Number(saleForm.quantity);
    if (!pendingSale && (!Number.isSafeInteger(qty) || qty < 1)) {
      setSaleError("Quantity must be a positive whole number");
      return;
    }
    const registered = saleForm.customerType === "registered";
    const request = pendingSale || {
      form: { ...saleForm },
      body: {
        idempotencyKey: crypto.randomUUID(),
        productId: saleForm.productId, quantity: qty, paymentMethod: saleForm.paymentMethod,
        ...(registered ? { customerId: saleForm.customerId } : {
          customerName: saleForm.customerName.trim(), customerPhone: saleForm.customerPhone.trim(),
          customerEmail: saleForm.customerEmail.trim(), referrerId: saleForm.referrerId,
        }),
      },
    };
    // Persist before sending: a lost response or page reload must reuse the same key.
    try { sessionStorage.setItem(pendingStorageKey, JSON.stringify(request)); }
    catch { setSaleError("Enable browser session storage before recording a sale."); return; }
    submitting.current = true;
    setSavingSale(true);
    setPendingSale(request);
    setSaleError("");
    setSaleSuccess("");
    try {
      const response = await api.post("/admin/orders/in-store", request.body);
      sessionStorage.removeItem(pendingStorageKey);
      setPendingSale(null);
      setSaleForm({ ...emptySale });
      setShowInStoreForm(false);
      setSaleSuccess("Sale " + response.data.data.orderNumber + " recorded successfully.");
      // A list refresh failure must never be reported as a failed sale submission.
      load().catch(() => setSaleError("Sale recorded. Reload to refresh the orders list."));
    } catch (err) {
      const status = err.response?.status;
      const keyConflict = err.response?.data?.code === "SALE_REQUEST_CONFLICT";
      const definitiveFailure = !keyConflict && [400, 404, 409, 422].includes(status);
      if (definitiveFailure) {
        sessionStorage.removeItem(pendingStorageKey);
        setPendingSale(null);
      }
      setSaleError((err.response?.data?.message || "Could not confirm whether the sale was recorded.") +
        (definitiveFailure ? "" : " Retry this sale to check safely; its request ID has been kept."));
    } finally {
      submitting.current = false;
      setSavingSale(false);
    }
  }

  async function updateStatus(id, status) {
    setSaleError("");
    try {
      await api.patch(`/orders/admin/${id}/status`, { status });
      await load();
    } catch (err) {
      setSaleError(err.response?.data?.message || "Could not update or refresh the order. Reload to check its status.");
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <h1 className="font-display text-xl font-bold">Orders</h1>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="btn-primary"
            onClick={() => setShowInStoreForm(true)}
          >
            + Record In-Store Sale
          </button>

          <select
            className="input w-auto"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            {["pending_payment", "payment_review", "paid", "processing", "delivered", "cancelled", "refunded"].map((s) => (
              <option key={s} value={s}>{s.replace("_", " ")}</option>
            ))}
          </select>
        </div>
      </div>

      {reviewError && <p role="alert" className="text-coral text-sm mb-4">{reviewError}</p>}
      {paymentReviews.length > 0 && (
        <section className="card mb-6" aria-label="Payments requiring admin review">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-display font-bold">Payments awaiting review</h2>
            <button type="button" className="text-sm text-teal" onClick={() => load().catch(() => setSaleError("Could not refresh orders."))}>Refresh</button>
          </div>
          <p className="text-sm text-ink-dim mb-3">These payments were received and need admin resolution. Review fulfillment or refund with the customer.</p>
          {paymentReviews.map((payment) => (
            <div key={payment._id} className="border-t border-navy-line py-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <span className="font-mono">{payment.order?.orderNumber || "Unmatched payment"} · Transaction {payment.transactionId}</span>
                <span>{Number(payment.amount).toLocaleString("en-NG")} {payment.currency}</span>
              </div>
              <p className="text-ink-dim mt-1">{payment.resolutionReason?.replaceAll("_", " ") || "Payment requires review"}</p>
              <p className="text-xs text-ink-faint mt-1">Reference: {payment.reference}</p>
            </div>
          ))}
        </section>
      )}
      {saleSuccess && <p role="status" className="text-teal text-sm mb-4">{saleSuccess}</p>}
      {!showInStoreForm && saleError && <p role="alert" className="text-coral text-sm mb-4">{saleError}</p>}
      {showInStoreForm && (
        <form onSubmit={submitSale} className="border border-navy-line rounded-xl p-5 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-display font-bold text-lg">
              Record In-Store Sale
            </h2>

            <button
              type="button"
              onClick={() => setShowInStoreForm(false)}
              className="text-ink-dim hover:text-ink"
            >
              Close
            </button>
          </div>

          {saleError && (
            <p role="alert" className="text-coral text-sm mb-4">{saleError}</p>
          )}

          {pendingSale && <p className="text-sm mb-4">A sale is awaiting confirmation. Retry to confirm it before entering another sale.</p>}
          <fieldset disabled={savingSale || Boolean(pendingSale)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-2">Customer Type</label>
              <select
                className="input"
                value={saleForm.customerType}
                onChange={(e) =>
                  setSaleForm({
                    ...saleForm,
                    customerType: e.target.value,
                    customerId: "",
                    referrerId: "",
                  })
                }
              >
                <option value="walk_in">Unregistered Walk-in</option>
                <option value="registered">Registered Member</option>
              </select>
            </div>

            {saleForm.customerType === "registered" ? (
              <div>
                <label className="block text-sm mb-2">
                  Select Registered Customer
                </label>
                <select
                  className="input"
                  required
                  value={saleForm.customerId}
                  onChange={(e) =>
                    setSaleForm({
                      ...saleForm,
                      customerId: e.target.value,
                    })
                  }
                >
                  <option value="">Select customer</option>
                  {members.map((member) => (
                    <option key={member._id} value={member._id}>
                      {member.name} — {member.email}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm mb-2">
                    Customer Name
                  </label>
                  <input
                    className="input"
                    required
                    maxLength={200}
                    placeholder="Walk-in customer name"
                    value={saleForm.customerName}
                    onChange={(e) =>
                      setSaleForm({
                        ...saleForm,
                        customerName: e.target.value,
                      })
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm mb-2">
                    Phone Number
                  </label>
                  <input
                    className="input"
                    required
                    type="tel"
                    maxLength={40}
                    placeholder="Customer phone number"
                    value={saleForm.customerPhone}
                    onChange={(e) =>
                      setSaleForm({
                        ...saleForm,
                        customerPhone: e.target.value,
                      })
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm mb-2">
                    Email (Optional)
                  </label>
                  <input
                    className="input"
                    type="email"
                    maxLength={254}
                    value={saleForm.customerEmail}
                    onChange={(e) =>
                      setSaleForm({
                        ...saleForm,
                        customerEmail: e.target.value,
                      })
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm mb-2">
                    Referrer (Optional)
                  </label>
                  <select
                    className="input"
                    value={saleForm.referrerId}
                    onChange={(e) =>
                      setSaleForm({
                        ...saleForm,
                        referrerId: e.target.value,
                      })
                    }
                  >
                    <option value="">No referrer</option>
                    {members.filter((member) => member.status === "active").map((member) => (
                      <option key={member._id} value={member._id}>
                        {member.name} — {member.referralCode}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm mb-2">Phone/Product</label>
              <select
                className="input"
                required
                value={saleForm.productId}
                onChange={(e) =>
                  setSaleForm({
                    ...saleForm,
                    productId: e.target.value,
                  })
                }
              >
                <option value="">Select phone</option>
                {products.map((product) => (
                  <option key={product._id} value={product._id} disabled={product.stock < 1}>
                    {product.brand} {product.model} — {naira(product.sellingPrice)}
                    {" "}({product.stock} available)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm mb-2">Quantity</label>
              <input
                className="input"
                type="number"
                min="1"
                step="1"
                required
                value={saleForm.quantity}
                onChange={(e) =>
                  setSaleForm({
                    ...saleForm,
                    quantity: e.target.value,
                  })
                }
              />
            </div>

            <div>
              <label className="block text-sm mb-2">Payment Method</label>
              <select
                className="input"
                value={saleForm.paymentMethod}
                onChange={(e) =>
                  setSaleForm({
                    ...saleForm,
                    paymentMethod: e.target.value,
                  })
                }
              >
                <option value="cash">Cash</option>
                <option value="pos">POS</option>
                <option value="transfer">Bank Transfer</option>
              </select>
            </div>
          </fieldset>

          {saleForm.customerType === "registered" && saleForm.customerId && (
            <p className="text-sm mt-4">Seller: {members.find(m => m._id === saleForm.customerId)?.referredBy?.name || "No saved referrer (no commission)"}</p>
          )}
          <p className="mt-4 font-bold">Total: {naira((products.find(p => p._id === saleForm.productId)?.sellingPrice || 0) * Number(saleForm.quantity || 0))}</p>
          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              className="btn-primary"
              disabled={savingSale}
            >
              {savingSale ? "Recording…" : pendingSale ? "Retry / Confirm Sale" : "Record Sale"}
            </button>
          </div>
        </form>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-ink-faint text-xs uppercase border-b border-navy-line">
            <th className="py-2.5">Order</th>
            <th className="py-2.5">Buyer</th>
            <th className="py-2.5">Products</th>
            <th className="py-2.5">Amount</th>
            <th className="py-2.5">Status</th>
            <th className="py-2.5"></th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o._id} className="border-b border-navy-line">
              <td className="py-2.5 text-ink font-mono">{o.orderNumber}</td>
              <td className="py-2.5 text-ink-dim">
                {o.buyer?.name || o.walkInCustomer?.name || "Unknown customer"}
              </td>
              <td className="py-2.5 text-ink-dim">
                {o.items?.map((item, index) => (
                  <div key={index}>
                    {item.name || [item.product?.brand, item.product?.model].filter(Boolean).join(" ")} × {item.quantity}
                  </div>
                ))}
              </td>
              <td className="py-2.5 text-ink-dim">{naira(o.totalAmount)}</td>
              <td className="py-2.5 text-ink-dim capitalize">{o.status.replace("_", " ")}</td>
              <td className="py-2.5">
                {o.status === "paid" && (
                  <button onClick={() => updateStatus(o._id, "processing")} className="text-xs border border-navy-line rounded px-2.5 py-1 mr-1.5 hover:border-gold">Mark processing</button>
                )}
                {o.status === "processing" && (
                  <button onClick={() => updateStatus(o._id, "delivered")} className="text-xs border border-navy-line rounded px-2.5 py-1 mr-1.5 hover:border-teal">Mark delivered</button>
                )}
                {["paid", "processing"].includes(o.status) && (
                  <button onClick={() => updateStatus(o._id, "cancelled")} className="text-xs border border-navy-line rounded px-2.5 py-1 hover:border-coral hover:text-coral">Cancel</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
