import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import { useFlutterwave, closePaymentModal } from "flutterwave-react-v3";


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

  useEffect(() => {
    api.get(`/products/${id}`).then((res) => setProduct(res.data.data));
  }, [id]);

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

  setPlacing(true);
  setError("");

  try {
    // 1. Create the order first
    const res = await api.post("/orders", {
      items: [{ productId: id, quantity: qty }],
      shippingAddress: {},
    });

    const order = res.data.data;

    setPaymentAmount(order.totalAmount);
    setPendingOrder(order);

    // // 2. Open Flutterwave checkout
    // handleFlutterPayment({
    //   callback: async (response) => {
    //     try {
    //       // 3. Send Flutterwave transaction to our backend for verification
    //       await api.post("/orders/verify-payment", {
    //         orderId: order.orderId,
    //         transactionId: response.transaction_id,
    //       });

    //       closePaymentModal();

    //       // 4. Payment verified — go to orders
    //       navigate("/dashboard/orders", {
    //         state: { justPlaced: order.orderNumber },
    //       });
    //     } catch (err) {
    //       closePaymentModal();
    //       setError(
    //         err.response?.data?.message ||
    //           "Payment was received but could not be verified."
    //       );
    //     }
    //   },

    //   onClose: () => {
    //     setPlacing(false);
    //   },
    // });
  } catch (err) {
    setError(
      err.response?.data?.message ||
        "Could not place order"
    );
    setPlacing(false);
  }
}

  if (!product) return <div className="max-w-4xl mx-auto px-5 py-10 text-ink-dim">Loading…</div>;

  return (
    <div className="max-w-4xl mx-auto px-5 py-10 grid md:grid-cols-2 gap-10">
      <div className="card aspect-square flex items-center justify-center text-ink-faint text-sm">
        {product.images?.[0] ? (
          <img src={product.images[0]} alt={product.name} className="rounded-md" />
        ) : (
          "No image uploaded"
        )}
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
            onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
            className="input w-20"
          />
          <span className="text-ink-faint text-xs">{product.stock} available</span>
        </div>

        {error && <p className="text-coral text-sm mt-3">{error}</p>}

        <button onClick={handleBuy} disabled={placing || product.stock === 0} className="btn-primary mt-5 disabled:opacity-50">
          {placing ? "Placing order…" : product.stock === 0 ? "Out of stock" : "Buy now"}
        </button>
      </div>
    </div>
  );
}
