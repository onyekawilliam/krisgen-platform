import { useEffect, useState } from "react";
import api from "../../api/axios";

function naira(n) {
  return "₦" + Number(n).toLocaleString("en-NG");
}

function saleReference(commission) {
  return commission.order?.orderNumber || commission.order?.payment?.reference || "Order unavailable";
}

function customerName(commission) {
  return commission.order?.buyer?.name || commission.order?.walkInCustomer?.name || "Customer unavailable";
}

function customerKind(commission) {
  if (commission.order?.buyer) return "Registered customer";
  if (commission.order?.walkInCustomer) return "Walk-in customer";
  return "Order unavailable";
}

function productName(commission) {
  const product = commission.product;
  return product ? [product.brand, product.name, product.model].filter(Boolean).join(" ") : "Product unavailable";
}

function saleDate(commission) {
  if (!commission.order?.createdAt) return "Sale date unavailable";
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" })
    .format(new Date(commission.order.createdAt));
}

function CommissionActions({ commission, updateStatus }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {commission.status === "pending" && (
        <button onClick={() => updateStatus(commission._id, "approved")} className="text-xs border border-navy-line rounded px-2.5 py-1 hover:border-teal">Approve</button>
      )}
      {commission.status === "approved" && (
        <button onClick={() => updateStatus(commission._id, "paid")} className="text-xs border border-navy-line rounded px-2.5 py-1 hover:border-gold">Mark paid</button>
      )}
      {["pending", "approved"].includes(commission.status) && (
        <button onClick={() => updateStatus(commission._id, "reversed")} className="text-xs border border-navy-line rounded px-2.5 py-1 hover:border-coral hover:text-coral">Reverse</button>
      )}
    </div>
  );
}

export default function AdminCommissions() {
  const [commissions, setCommissions] = useState([]);
  const [filter, setFilter] = useState("");

  function load() {
    api.get("/commissions/admin/all", { params: filter ? { status: filter } : {} }).then((res) => setCommissions(res.data.data));
  }
  useEffect(load, [filter]);

  async function updateStatus(id, status) {
    await api.patch(`/commissions/admin/${id}/status`, { status });
    load();
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <h1 className="font-display text-xl font-bold">Commissions</h1>
        <select className="input w-auto" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All statuses</option>
          {["pending", "approved", "paid", "cancelled", "reversed"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full min-w-[1120px] text-sm">
          <thead>
            <tr className="text-left text-ink-faint text-xs uppercase border-b border-navy-line">
              <th className="py-2.5 pr-3">Sale</th>
              <th className="py-2.5 pr-3">Customer</th>
              <th className="py-2.5 pr-3">Sale date</th>
              <th className="py-2.5 pr-3">Beneficiary</th>
              <th className="py-2.5 pr-3">Type</th>
              <th className="py-2.5 pr-3">Product</th>
              <th className="py-2.5 pr-3">Profit</th>
              <th className="py-2.5 pr-3">Rate</th>
              <th className="py-2.5 pr-3">Amount</th>
              <th className="py-2.5 pr-3">Status</th>
              <th className="py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {commissions.map((c) => (
              <tr key={c._id} className="border-b border-navy-line align-top">
                <td className="py-2.5 pr-3 text-ink font-medium">{saleReference(c)}</td>
                <td className="py-2.5 pr-3 text-ink"><div>{customerName(c)}</div><div className="text-xs text-ink-faint">{customerKind(c)}</div></td>
                <td className="py-2.5 pr-3 text-ink-dim whitespace-nowrap">{saleDate(c)}</td>
                <td className="py-2.5 pr-3 text-ink">{c.beneficiary?.name || "Beneficiary unavailable"}</td>
                <td className="py-2.5 pr-3 text-ink-dim capitalize">{c.type}</td>
                <td className="py-2.5 pr-3 text-ink-dim">{productName(c)}</td>
                <td className="py-2.5 pr-3 text-ink-dim whitespace-nowrap">{naira(c.grossProfitSnapshot)}</td>
                <td className="py-2.5 pr-3 text-ink-dim">{c.commissionRate}%</td>
                <td className="py-2.5 pr-3 text-ink font-medium whitespace-nowrap">{naira(c.commissionAmount)}</td>
                <td className="py-2.5 pr-3 text-ink-dim capitalize">{c.status}</td>
                <td className="py-2.5"><CommissionActions commission={c} updateStatus={updateStatus} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 lg:hidden">
        {commissions.map((c) => (
          <article key={c._id} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-ink-faint uppercase">Sale</p>
                <p className="text-ink font-medium break-all">{saleReference(c)}</p>
              </div>
              <span className="text-xs text-ink-dim capitalize shrink-0">{c.status}</span>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 mt-4 text-sm">
              <div><dt className="text-xs text-ink-faint">Customer</dt><dd className="text-ink">{customerName(c)}</dd><dd className="text-xs text-ink-faint">{customerKind(c)}</dd></div>
              <div><dt className="text-xs text-ink-faint">Sale date</dt><dd className="text-ink-dim">{saleDate(c)}</dd></div>
              <div><dt className="text-xs text-ink-faint">Beneficiary</dt><dd className="text-ink">{c.beneficiary?.name || "Beneficiary unavailable"}</dd></div>
              <div><dt className="text-xs text-ink-faint">Commission type</dt><dd className="text-ink-dim capitalize">{c.type}</dd></div>
              <div className="col-span-2"><dt className="text-xs text-ink-faint">Product</dt><dd className="text-ink-dim">{productName(c)}</dd></div>
              <div><dt className="text-xs text-ink-faint">Gross profit</dt><dd className="text-ink-dim">{naira(c.grossProfitSnapshot)}</dd></div>
              <div><dt className="text-xs text-ink-faint">Rate / amount</dt><dd className="text-ink">{c.commissionRate}% · {naira(c.commissionAmount)}</dd></div>
            </dl>
            <div className="mt-4"><CommissionActions commission={c} updateStatus={updateStatus} /></div>
          </article>
        ))}
      </div>
    </div>
  );
}
