import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import { useFlutterwave, closePaymentModal } from "flutterwave-react-v3";
import ProductImage from "../../components/ProductImage";


function naira(n) {
  return "₦" + Number(n).toLocaleString("en-NG");
}

export default function ProductDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [qty, setQty] = useState(1);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [pendingOrder, setPendingOrder] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [address, setAddress] = useState({ fullName: "", phone: "", address: "", city: "", state: "" });

  useEffect(() => {
    setLoadError("");
    api
      .get(`/products/${id}`)
      .then((res) => setProduct(res.data.data))
      .catch((err) =>
        setLoadError(
          err.response?.status === 404 || err.response?.status === 400
            ? "This phone is no longer available."
            : "Could not load this phone. Check your connection and try again."
        )
      );
  }, [id]);

  // Pre-fill the delivery form from the account, once, without overwriting edits.
  useEffect(() => {
    if (!user) return;
    setAddress((current) => ({
      ...current,
      fullName: current.fullName || user.name || "",
      phone: current.phone || user.phone || "",
    }));
  }, [user]);

  const handleFlutterPayment = useFlutterwave({
  public_key: import.meta.env.VITE_FLW_PUBLIC_KEY,
  tx_ref: pendingOrder?.paymentReference || "",
  amount: paymentAmount,
  currency: pendingOrder?.currency || "NGN",
  payment_options: "card,banktransfer,ussd",
  customer: {
    email: user?.email || "",
    name: user?.name || "",
    phone_number: user?.phone || "",
  },
  customizations: {
    title: "Krisgen Communications Ltd",
    description: product?.name
      ? `Payment for ${product.name}`
      : "Phone purchase",
    logo: "",
  },
});

useEffect(() => {
  if (!pendingOrder?.paymentReference || !paymentAmount) return;

  handleFlutterPayment({
    callback: async (response) => {
      try {
        await api.post("/orders/verify-payment", {
          orderId: pendingOrder.orderId,
          transactionId: response.transaction_id,
        });

        closePaymentModal();

        navigate("/dashboard/orders", {
          state: { justPlaced: pendingOrder.orderNumber },
        });
      } catch (err) {
        closePaymentModal();

        if (err.response?.data?.data?.status === "payment_review") {
          navigate("/dashboard/orders");
          return;
        }
        setError(
          err.response?.data?.message ||
            "Payment was received but could not be verified."
        );
      } finally {
        setPlacing(false);
        setPendingOrder(null);
      }
    },

    onClose: () => {
      setPlacing(false);
      setPendingOrder(null);
    },
  });
}, [pendingOrder, paymentAmount]);

async function handleBuy() {
  if (!user) {
    return navigate("/login", {
      state: { from: `/shop/${id}` },
    });
  }

  const missing = Object.entries(address).find(([, value]) => !value.trim());
  if (missing) {
    setError("Enter your full delivery address so we can deliver your phone.");
    return;
  }

  setPlacing(true);
  setError("");

  try {
    // 1. Create the order first
    const res = await api.post("/orders", {
      items: [{ productId: id, quantity: qty }],
      shippingAddress: address,
    });

    const order = res.data.data;

    setPaymentAmount(order.totalAmount);
    setPendingOrder(order);

  } catch (err) {
    setError(
      err.response?.data?.message ||
        "Could not place order"
    );
    setPlacing(false);
  }
}

  if (loadError) {
    return (
      <div className="max-w-4xl mx-auto px-5 py-10">
        <p className="text-coral text-sm mb-4">{loadError}</p>
        <Link to="/shop" className="btn-outline text-sm py-2 px-4">Back to phones</Link>
      </div>
    );
  }
  if (!product) return <div className="max-w-4xl mx-auto px-5 py-10 text-ink-dim">Loading…</div>;

  return (
    <div className="mx-auto grid max-w-5xl items-start gap-10 px-5 py-10 md:grid-cols-2 md:gap-14">
      <div className="card aspect-square overflow-hidden p-0 md:sticky md:top-24">
        <ProductImage src={product.images?.[0]} alt={product.name} className="h-full w-full object-contain" />
      </div>
      <div>
        <Link to="/shop" className="mb-4 inline-block text-sm text-ink-dim transition-colors hover:text-ink">← All phones</Link>
        <p className="eyebrow">{product.brand}</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight md:text-4xl">{product.name}</h1>
        <dl className="mt-5 grid grid-cols-3 gap-3">
          {product.ram && <div className="card p-3"><dt className="text-[11px] uppercase tracking-wider text-ink-faint">RAM</dt><dd className="mt-1 font-mono text-sm">{product.ram}</dd></div>}
          {product.storage && <div className="card p-3"><dt className="text-[11px] uppercase tracking-wider text-ink-faint">Storage</dt><dd className="mt-1 font-mono text-sm">{product.storage}</dd></div>}
          {product.specifications?.camera && <div className="card p-3"><dt className="text-[11px] uppercase tracking-wider text-ink-faint">Camera</dt><dd className="mt-1 font-mono text-sm">{product.specifications.camera}</dd></div>}
        </dl>
        {product.description && <p className="mt-5 text-sm leading-relaxed text-ink-dim">{product.description}</p>}

        <div className="mt-7 font-display text-4xl font-bold tracking-tight text-gold-bright">{naira(product.sellingPrice)}</div>

        <div className="mt-5 flex items-center gap-3">
          <label className="label mb-0" htmlFor="qty">Qty</label>
          <input
            id="qty"
            type="number"
            min="1"
            max={product.stock}
            value={qty}
            onChange={(e) => setQty(Math.min(Math.max(1, Math.floor(Number(e.target.value)) || 1), Math.max(1, product.stock)))}
            className="input w-20"
          />
          <span className={`badge ${product.stock > 0 ? "badge-ok" : "badge-muted"}`}>{product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}</span>
        </div>

        <fieldset className="mt-7 rounded-2xl border border-navy-line bg-navy-panel/50 p-5">
          <legend className="px-2 font-display text-sm font-semibold">Delivery details</legend>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label" htmlFor="ship-name">Recipient name</label>
              <input id="ship-name" className="input" autoComplete="name" maxLength={100} value={address.fullName}
                onChange={(e) => setAddress({ ...address, fullName: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className="label" htmlFor="ship-phone">Phone number</label>
              <input id="ship-phone" className="input" autoComplete="tel" maxLength={40} value={address.phone}
                onChange={(e) => setAddress({ ...address, phone: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className="label" htmlFor="ship-address">Street address</label>
              <input id="ship-address" className="input" autoComplete="street-address" maxLength={250} value={address.address}
                onChange={(e) => setAddress({ ...address, address: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="ship-city">City</label>
              <input id="ship-city" className="input" autoComplete="address-level2" maxLength={100} value={address.city}
                onChange={(e) => setAddress({ ...address, city: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="ship-state">State</label>
              <input id="ship-state" className="input" autoComplete="address-level1" maxLength={100} value={address.state}
                onChange={(e) => setAddress({ ...address, state: e.target.value })} />
            </div>
          </div>
        </fieldset>

        {error && <p role="alert" className="mt-4 text-sm text-coral">{error}</p>}

        <button onClick={handleBuy} disabled={placing || product.stock === 0} className="btn-primary mt-6 w-full py-3.5 text-base md:w-auto md:px-10">
          {placing ? "Placing order…" : product.stock === 0 ? "Out of stock" : "Buy now"}
        </button>

        <ul className="mt-6 grid gap-2.5 text-sm text-ink-dim">
          <li className="flex items-center gap-2.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-mint" aria-hidden="true"><path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6l8-3z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></svg>
            Pay securely by card, bank transfer or USSD
          </li>
          <li className="flex items-center gap-2.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-mint" aria-hidden="true"><path d="M3 7h11v9H3z" /><path d="M14 10h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.8" /><circle cx="17" cy="18" r="1.8" /></svg>
            Delivered to the address you enter above
          </li>
          <li className="flex items-center gap-2.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-mint" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" /></svg>
            Questions? <a href="tel:08035142589" className="text-gold-bright hover:underline">Call 08035142589</a> or{" "}
            <a href="https://wa.me/2348035142589" target="_blank" rel="noopener noreferrer" className="text-gold-bright hover:underline">WhatsApp us</a>
          </li>
        </ul>
      </div>
    </div>
  );
}
