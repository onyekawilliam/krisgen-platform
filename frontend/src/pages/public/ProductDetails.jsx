import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import { useFlutterwave, closePaymentModal } from "flutterwave-react-v3";
import ProductImage from "../../components/ProductImage";
import { blockedArea } from "../../utils/delivery";


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
  const [fulfillment, setFulfillment] = useState("delivery");
  const [pickup, setPickup] = useState(null);
  const [delivery, setDelivery] = useState({ states: [], pickupOnlyAreas: [] });

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

  // Whether the shop offers pickup, and where. If this cannot load, only delivery is offered.
  useEffect(() => {
    api.get("/store/pickup").then((res) => setPickup(res.data.data)).catch(() => setPickup(null));
  }, []);

  useEffect(() => {
    api.get("/store/delivery").then((res) => setDelivery(res.data.data)).catch(() => {});
  }, []);

  const pickupAvailable = Boolean(pickup?.enabled);
  const collecting = fulfillment === "pickup" && pickupAvailable;
  // Delivery can be switched off for particular towns, where people collect instead.
  const noDeliveryHere = !collecting ? blockedArea(delivery.pickupOnlyAreas, address.state, address.city) : null;

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

  if (collecting) {
    if (!address.fullName.trim() || !address.phone.trim()) {
      setError("Enter your name and phone number so we can tell you when your phone is ready.");
      return;
    }
  } else {
    if (!address.fullName.trim() || !address.phone.trim() || !address.state || !address.city.trim()) {
      setError("Enter your name, phone number, state and town so we can deliver your phone.");
      return;
    }
    if (noDeliveryHere) {
      setError(`We do not deliver in ${noDeliveryHere.town}, ${noDeliveryHere.state}.${pickupAvailable ? " Please choose shop pickup." : ""}`);
      return;
    }
  }

  setPlacing(true);
  setError("");

  try {
    // 1. Create the order first
    const res = await api.post("/orders", {
      items: [{ productId: id, quantity: qty }],
      fulfillment: collecting ? "pickup" : "delivery",
      shippingAddress: collecting ? { fullName: address.fullName, phone: address.phone } : address,
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
    <div className="mx-auto grid max-w-6xl items-start gap-8 px-5 py-8 md:grid-cols-[1.05fr_1fr] md:gap-12 md:py-10">
      <div className="card aspect-square overflow-hidden bg-navy-panel2 p-0 md:sticky md:top-32">
        <ProductImage src={product.images?.[0]} alt={product.name} className="h-full w-full object-contain" />
      </div>
      <div>
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-ink-faint">
          <Link to="/" className="hover:text-ink">Home</Link> <span aria-hidden="true">/</span>{" "}
          <Link to="/shop" className="hover:text-ink">Phones</Link> <span aria-hidden="true">/</span>{" "}
          <Link to={`/shop?brand=${product.brand}`} className="text-ink-dim hover:text-ink">{product.brand}</Link>
        </nav>
        <p className="eyebrow">{product.brand}</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight md:text-4xl">{product.name}</h1>
        <dl className="mt-5 grid grid-cols-3 gap-3">
          {product.ram && <div className="rounded-xl bg-navy-panel2 p-3"><dt className="text-[11px] uppercase tracking-wider text-ink-faint">RAM</dt><dd className="mt-1 font-mono text-sm">{product.ram}</dd></div>}
          {product.storage && <div className="rounded-xl bg-navy-panel2 p-3"><dt className="text-[11px] uppercase tracking-wider text-ink-faint">Storage</dt><dd className="mt-1 font-mono text-sm">{product.storage}</dd></div>}
          {product.specifications?.camera && <div className="rounded-xl bg-navy-panel2 p-3"><dt className="text-[11px] uppercase tracking-wider text-ink-faint">Camera</dt><dd className="mt-1 font-mono text-sm">{product.specifications.camera}</dd></div>}
        </dl>
        {product.description && <p className="mt-5 text-sm leading-relaxed text-ink-dim">{product.description}</p>}

        <div className="card mt-7 p-6 shadow-lift">
        <div className="font-display text-4xl font-bold tracking-tight">{naira(product.sellingPrice)}</div>

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

        {pickupAvailable && (
          <div className="mt-6" role="radiogroup" aria-label="How would you like to get your phone?">
            <p className="label">How would you like to get it?</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: "delivery", title: "Delivery", text: "To your town" },
                { value: "pickup", title: "Shop pickup", text: "Collect it yourself" },
              ].map((option) => {
                const active = fulfillment === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setFulfillment(option.value)}
                    className={`rounded-xl border px-4 py-3 text-left transition ${
                      active ? "border-gold bg-gold/10 ring-2 ring-gold/30" : "border-navy-line bg-navy-panel hover:border-ink-faint"
                    }`}
                  >
                    <span className="block text-sm font-semibold">{option.title}</span>
                    <span className="block text-xs text-ink-dim">{option.text}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <fieldset className="mt-6 rounded-xl border border-navy-line bg-navy-deep/60 p-4">
          <legend className="px-2 font-display text-sm font-semibold">{collecting ? "Your details" : "Delivery to your town"}</legend>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label" htmlFor="ship-name">{collecting ? "Your name" : "Recipient name"}</label>
              <input id="ship-name" className="input" autoComplete="name" maxLength={100} value={address.fullName}
                onChange={(e) => setAddress({ ...address, fullName: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className="label" htmlFor="ship-phone">Phone number</label>
              <input id="ship-phone" className="input" autoComplete="tel" maxLength={40} value={address.phone}
                onChange={(e) => setAddress({ ...address, phone: e.target.value })} />
            </div>
            {!collecting && (
              <>
                <div>
                  <label className="label" htmlFor="ship-state">State</label>
                  <select id="ship-state" className="input" autoComplete="address-level1" value={address.state}
                    onChange={(e) => setAddress({ ...address, state: e.target.value })}>
                    <option value="">Choose your state</option>
                    {delivery.states.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="ship-city">Town</label>
                  <input id="ship-city" className="input" autoComplete="address-level2" maxLength={100} value={address.city}
                    onChange={(e) => setAddress({ ...address, city: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <label className="label" htmlFor="ship-address">Landmark or nearest park (optional)</label>
                  <input id="ship-address" className="input" maxLength={250} value={address.address}
                    placeholder="For example: the motor park, or a well-known junction"
                    onChange={(e) => setAddress({ ...address, address: e.target.value })} />
                </div>
                {noDeliveryHere ? (
                  <div role="alert" className="col-span-2 rounded-xl border border-gold/50 bg-gold/10 p-4 text-sm">
                    <div className="font-semibold">We do not deliver in {noDeliveryHere.town}, {noDeliveryHere.state}</div>
                    <p className="mt-1 leading-relaxed text-ink-dim">
                      {pickupAvailable ? "You can collect your phone from our shop instead." : "Please contact us to arrange how to get your phone."}
                    </p>
                    {pickupAvailable && (
                      <button type="button" className="btn-primary mt-3 px-5 py-2 text-sm" onClick={() => setFulfillment("pickup")}>
                        Switch to shop pickup
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="col-span-2 text-xs leading-relaxed text-ink-faint">
                    We deliver to your town, not to a street address. We will call you to arrange the handover.
                  </p>
                )}
              </>
            )}
            {collecting && (
              <div className="col-span-2 rounded-xl bg-navy-panel2 p-4 text-sm">
                <div className="font-semibold">Collect from our shop</div>
                <p className="mt-1 leading-relaxed text-ink-dim">
                  {pickup?.address || "We will confirm the shop address and a pickup time with you by phone or WhatsApp once your payment is confirmed."}
                </p>
                {pickup?.instructions && <p className="mt-1.5 leading-relaxed text-ink-dim">{pickup.instructions}</p>}
              </div>
            )}
          </div>
        </fieldset>

        {error && <p role="alert" className="mt-4 text-sm text-coral">{error}</p>}

        <button onClick={handleBuy} disabled={placing || product.stock === 0 || Boolean(noDeliveryHere)} className="btn-primary mt-6 w-full py-3.5 text-base">
          {placing ? "Placing order…" : product.stock === 0 ? "Out of stock" : "Buy now"}
        </button>

        <ul className="mt-6 grid gap-2.5 text-sm text-ink-dim">
          <li className="flex items-center gap-2.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-mint" aria-hidden="true"><path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6l8-3z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></svg>
            Pay securely by card, bank transfer or USSD
          </li>
          <li className="flex items-center gap-2.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-mint" aria-hidden="true"><path d="M3 7h11v9H3z" /><path d="M14 10h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.8" /><circle cx="17" cy="18" r="1.8" /></svg>
            {collecting ? "Collect it from our shop once payment is confirmed" : "Delivered to the town you choose above"}
          </li>
          <li className="flex items-center gap-2.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-mint" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" /></svg>
            Questions? <a href="tel:08035142589" className="text-gold-bright hover:underline">Call 08035142589</a> or{" "}
            <a href="https://wa.me/2348035142589" target="_blank" rel="noopener noreferrer" className="text-gold-bright hover:underline">WhatsApp us</a>
          </li>
        </ul>
        </div>
      </div>
    </div>
  );
}
