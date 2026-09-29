import { useEffect, useState } from "react";
import api from "../../api/axios";

function naira(n) {
  return "₦" + Number(n).toLocaleString("en-NG");
}

const emptyForm = { name: "", brand: "Tecno", model: "", ram: "", storage: "", costPrice: "", sellingPrice: "",  commissionRateOverride: "", stock: "" };

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [editing, setEditing] = useState(null); // product being edited, or "new"
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

  function load() {
    api.get("/products/admin/all").then((res) => setProducts(res.data.data));
  }
  useEffect(load, []);

  function startEdit(p) {
    setEditing(p._id);
    setForm({
      name: p.name, brand: p.brand, model: p.model, ram: p.ram || "", storage: p.storage || "",
      costPrice: p.costPrice, sellingPrice: p.sellingPrice, stock: p.stock, commissionRateOverride: p.commissionRateOverride ?? "",
    });
  }

  function startNew() {
    setEditing("new");
    setForm(emptyForm);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const payload = {
      ...form,
      costPrice: Number(form.costPrice),
      sellingPrice: Number(form.sellingPrice),
      commissionRateOverride: form.commissionRateOverride === "" ? null : Number(form.commissionRateOverride),
      stock: Number(form.stock),
    };
    try {
      if (editing === "new") {
        await api.post("/products/admin", payload);
      } else {
        await api.patch(`/products/admin/${editing}`, payload);
      }
      setEditing(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not save product");
    }
  }

  async function handleDeactivate(id) {
    await api.delete(`/products/admin/${id}`);
    load();
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <h1 className="font-display text-xl font-bold">Products</h1>
        <button onClick={startNew} className="btn-primary text-sm py-2 px-4">+ Add new phone</button>
      </div>

      {editing && (
        <form onSubmit={handleSubmit} className="card mb-6 grid grid-cols-2 gap-3 max-w-2xl">
          <input className="input col-span-2" placeholder="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select className="input" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })}>
            {["Tecno", "Infinix", "Itel", "Viva", "Samsung", "Redmi", "Realme", "Other"].map((b) => <option key={b}>{b}</option>)}
          </select>
          <input className="input" placeholder="Model" required value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
          <input className="input" placeholder="RAM (e.g. 8GB)" value={form.ram} onChange={(e) => setForm({ ...form, ram: e.target.value })} />
          <input className="input" placeholder="Storage (e.g. 256GB)" value={form.storage} onChange={(e) => setForm({ ...form, storage: e.target.value })} />
          <input className="input" type="number" placeholder="Cost price (admin only)" required value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} />
          <input className="input" type="number" placeholder="Selling price" required value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} />
          <input
            className="input"
            type="number"
            min="0"
            max="100"
            step="0.01"
            placeholder="Commission percentage (e.g. 15)"
            value={form.commissionRateOverride}
            onChange={(e) =>
              setForm({ ...form, commissionRateOverride: e.target.value })
            }
          />
          <input className="input" type="number" placeholder="Stock" required value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
          {error && <p className="text-coral text-sm col-span-2">{error}</p>}
          <div className="col-span-2 flex gap-2">
            <button type="submit" className="btn-primary text-sm py-2 px-4">Save</button>
            <button type="button" onClick={() => setEditing(null)} className="btn-outline text-sm py-2 px-4">Cancel</button>
          </div>
        </form>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-ink-faint text-xs uppercase border-b border-navy-line">
            <th className="py-2.5">Brand</th>
            <th className="py-2.5">Model</th>
            <th className="py-2.5">Cost</th>
            <th className="py-2.5">Selling</th>
            <th className="py-2.5">Margin</th>
            <th className="py-2.5">Commission</th>
            <th className="py-2.5">Stock</th>
            <th className="py-2.5"></th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p._id} className="border-b border-navy-line">
              <td className="py-2.5 text-ink">{p.brand}</td>
              <td className="py-2.5 text-ink">{p.name}</td>
              <td className="py-2.5 text-ink-dim">{naira(p.costPrice)}</td>
              <td className="py-2.5 text-ink-dim">{naira(p.sellingPrice)}</td>
              <td className="py-2.5 text-teal">{naira(p.sellingPrice - p.costPrice)}</td>
              <td className="py-2.5 text-ink-dim">{p.commissionRateOverride !== null ? p.commissionRateOverride + "%" : "Default"}</td>
              <td className="py-2.5 text-ink-dim">{p.stock}</td>
              <td className="py-2.5">
                <button onClick={() => startEdit(p)} className="text-xs border border-navy-line rounded px-2.5 py-1 mr-1.5 hover:border-gold">Edit</button>
                <button onClick={() => handleDeactivate(p._id)} className="text-xs border border-navy-line rounded px-2.5 py-1 hover:border-coral hover:text-coral">Deactivate</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-ink-faint text-xs mt-3">Cost price and margin are only ever shown on this admin page — never on customer-facing pages or API responses.</p>
    </div>
  );
}
