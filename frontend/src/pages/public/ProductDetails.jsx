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
    <div className="max-w-4xl mx-auto px-5 py-10 grid md:grid-cols-2 gap-10">
      <div className="card aspect-square flex items-center justify-center text-ink-faint text-sm">
        <ProductImage src={product.images?.[0]} alt={product.name} className="h-full w-full object-contain rounded-md" />
      </div>
      <div>
        <span className="text-xs uppercase tracking-wide text-teal font-semibold">{product.brand}</span>
        <h1 className="font-display text-2xl font-bold mt-1">{product.name}</h1>
        <div className="font-mono text-sm text-ink-dim mt-3 space-y-1">
          {product.ram && <div>RAM: <span className="text-ink">{product.ram}</span></div>}
          {product.storage && <div>Storage: <span className="text-ink">{product.storage}</span></div>}
          {product.specifications?.camera && <div>Camera: <span className="text-ink">{product.specifications.camera}</span></div>}
        </div>
        {product.description && <p className="text-ink-dim text-sm mt-4">{product.description}</p>}

        <div className="text-2xl font-display font-bold text-gold-bright mt-6">{naira(product.sellingPrice)}</div>

        <div className="flex items-center gap-3 mt-4">
          <label className="label mb-0">Qty</label>
          <input
            type="number"
            min="1"
            max={product.stock}
            value={qty}
            onChange={(e) => setQty(Math.min(Math.max(1, Math.floor(Number(e.target.value)) || 1), Math.max(1, product.stock)))}
            className="input w-20"
          />
          <span className="text-ink-faint text-xs">{product.stock} available</span>
        </div>

        <fieldset className="mt-6 border-t border-navy-line pt-5">
          <legend className="font-display font-semibold text-sm pr-2">Delivery details</legend>
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

        {error && <p className="text-coral text-sm mt-3">{error}</p>}

        <button onClick={handleBuy} disabled={placing || product.stock === 0} className="btn-primary mt-5 disabled:opacity-50">
          {placing ? "Placing order…" : product.stock === 0 ? "Out of stock" : "Buy now"}
        </button>
      </div>
    </div>
  );
}
