import { useEffect, useState } from "react";
import { useFlutterwave, closePaymentModal } from "flutterwave-react-v3";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";


function naira(n) {
  return "₦" + Number(n).toLocaleString("en-NG");
}

const statusColor = {
  pending_payment: "text-ink-faint",
  paid: "text-teal",
  processing: "text-gold-bright",
  delivered: "text-teal",
  cancelled: "text-coral",
  refunded: "text-coral",
};

export default function MyOrders() {
  const [orders, setOrders] = useState([]);
  const { user } = useAuth();
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [loadingId, setLoadingId] = useState(null);
  const [error, setError] = useState("");

  const handleFlutterPayment = useFlutterwave({
    public_key: import.meta.env.VITE_FLW_PUBLIC_KEY,
    tx_ref: selectedOrder
      ? `krisgen-${selectedOrder._id}-${Date.now()}`
      : `krisgen-${Date.now()}`,
    amount: paymentAmount,
    currency: "NGN",
    payment_options: "card,banktransfer,ussd",
    customer: {
      email: user?.email || "",
      name: user?.name || "",
      phone_number: user?.phone_number || "",
    },
    customizations: {
      title: "Krisgen Communications Ltd",
      description: "Complete your phone purchase",
      logo: "",
    },
  });

  useEffect(() => {
    api.get("/orders/mine").then((res) => setOrders(res.data.data));
  }, []);

  function continuePayment(order) {
    setError("");
    setSelectedOrder(order);
    setPaymentAmount(order.totalAmount);
  }

  async function cancelOrder(orderId) {
    const confirmed = window.confirm(
      "Are you sure you want to cancel this order?"
    );

    if (!confirmed) return;

    try {
      setLoadingId(orderId);
      setError("");

      await api.patch(`/orders/${orderId}/cancel`);

      setOrders((current) =>
        current.map((order) =>
          order._id === orderId
            ? { ...order, status: "cancelled" }
            : order
        )
      );
    } catch (err) {
      setError(
        err.response?.data?.message || "Could not cancel order"
      );
    } finally {
      setLoadingId(null);
    }
  }

  useEffect(() => {
    if (!selectedOrder || !paymentAmount) return;

    handleFlutterPayment({
      callback: async (response) => {
        try {
          setLoadingId(selectedOrder._id);

          await api.post("/orders/verify-payment", {
            orderId: selectedOrder._id,
            transactionId: response.transaction_id,
          });

          closePaymentModal();

          setOrders((current) =>
            current.map((order) =>
              order._id === selectedOrder._id
                ? { ...order, status: "paid" }
                : order
            )
          );
        } catch (err) {
          closePaymentModal();

          setError(
            err.response?.data?.message ||
            "Payment was received but could not be verified."
          );
        } finally {
          setLoadingId(null);
          setSelectedOrder(null);
          setPaymentAmount(0);
        }
      },

      onClose: () => {
        setSelectedOrder(null);
        setPaymentAmount(0);
      },
    });
  }, [selectedOrder, paymentAmount]);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-1">My orders</h1>
      <p className="text-ink-dim text-sm mb-6">Every phone you've bought through Krisgen.</p>
      {error && (
        <p className="text-coral text-sm mb-4">
          {error}
        </p>
      )}
      {orders.length === 0 ? (
        <p className="text-ink-dim text-sm">No orders yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((o) => (
            <div key={o._id} className="card">
              <div className="flex justify-between items-center mb-2">
                <span className="font-mono text-sm text-ink-dim">{o.orderNumber}</span>
                <span className={`text-xs font-semibold uppercase ${statusColor[o.status] || "text-ink-dim"}`}>
                  {o.status.replace("_", " ")}
                </span>
              </div>
              {o.items.map((item, i) => (
                <div key={i} className="text-sm text-ink flex justify-between">
                  <span>{item.name} × {item.quantity}</span>
                  <span>{naira(item.sellingPriceSnapshot * item.quantity)}</span>
                </div>
              ))}
              <div className="flex justify-between pt-2 mt-2 border-t border-navy-line text-sm">
                <span className="text-ink-dim">Total</span>
                <span className="font-semibold text-gold-bright">{naira(o.totalAmount)}</span>
              </div>
              {o.status === "pending_payment" && (
                <div className="flex gap-3 mt-4">
                  <button
                    className="btn-primary"
                    onClick={() => continuePayment(o)}
                    disabled={loadingId === o._id}
                  >
                    Continue Payment
                  </button>

                  <button
                    className="btn-secondary"
                    onClick={() => cancelOrder(o._id)}
                    disabled={loadingId === o._id}
                  >
                    {loadingId === o._id ? "Please wait..." : "Cancel Order"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
