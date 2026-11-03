import { useEffect, useRef, useState } from "react";
import { useFlutterwave, closePaymentModal } from "flutterwave-react-v3";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";


function naira(n) {
  return "₦" + Number(n).toLocaleString("en-NG");
}

const statusColor = {
  pending_payment: "text-ink-faint",
  payment_review: "text-gold-bright",
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
  const verifyingPayment = useRef(false);

  const handleFlutterPayment = useFlutterwave({
    public_key: import.meta.env.VITE_FLW_PUBLIC_KEY,
    tx_ref: selectedOrder?.paymentReference || "",
    amount: paymentAmount,
    currency: selectedOrder?.currency || "NGN",
    payment_options: "card,banktransfer,ussd",
    customer: {
      email: user?.email || "",
      name: user?.name || "",
      phone_number: user?.phone || "",
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

  async function continuePayment(order) {
    if (loadingId || selectedOrder) return;
    setError("");
    setLoadingId(order._id);
    try {
      const response = await api.post(`/orders/${order._id}/payment-attempt`);
      const attempt = response.data.data;
      setSelectedOrder({ ...order, ...attempt });
      setPaymentAmount(attempt.totalAmount);
    } catch (err) {
      setError(err.response?.data?.message || "Could not start payment. Please refresh your orders.");
      setLoadingId(null);
      api.get("/orders/mine").then((response) => setOrders(response.data.data)).catch(() => {});
    }
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
    if (!selectedOrder?.paymentReference || !paymentAmount) return;

    handleFlutterPayment({
      callback: async (response) => {
        verifyingPayment.current = true;
        try {
          setLoadingId(selectedOrder._id);
          const verification = await api.post("/orders/verify-payment", {
            orderId: selectedOrder._id,
            transactionId: response.transaction_id,
          });
          const status = verification.data.data.status;
          setOrders((current) => current.map((order) =>
            order._id === selectedOrder._id ? { ...order, status } : order
          ));
        } catch (err) {
          if (err.response?.data?.data?.status === "payment_review") {
            setOrders((current) => current.map((order) =>
              order._id === selectedOrder._id ? { ...order, status: "payment_review" } : order
            ));
          }
          setError(
            err.response?.data?.message ||
            "Could not confirm payment. Refresh your orders before attempting another payment."
          );
        } finally {
          try {
            const refreshed = await api.get("/orders/mine");
            setOrders(refreshed.data.data);
          } catch {
            setError((current) => current || "Could not refresh orders. Reload to check payment status.");
          }
          closePaymentModal();
          verifyingPayment.current = false;
          setLoadingId(null);
          setSelectedOrder(null);
          setPaymentAmount(0);
        }
      },

      onClose: () => {
        if (verifyingPayment.current) return;
        setLoadingId(null);
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
                  {o.status === "payment_review" ? "Payment received — awaiting admin review" : o.status.replaceAll("_", " ")}
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
                    disabled={Boolean(loadingId) || Boolean(selectedOrder)}
                  >
                    Continue Payment
                  </button>

                  <button
                    className="btn-secondary"
                    onClick={() => cancelOrder(o._id)}
                    disabled={Boolean(loadingId) || Boolean(selectedOrder)}
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
