import { useEffect, useState } from "react";
import api from "../../api/axios";
import ProductImage from "../../components/ProductImage";
import PhotoManager from "../../components/PhotoManager";

function naira(n) {
  return "₦" + Number(n).toLocaleString("en-NG");
}

const emptyForm = { name: "", brand: "Tecno", model: "", ram: "", storage: "", costPrice: "", sellingPrice: "",  commissionRateOverride: "", stock: "", specifications: {} };

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [editing, setEditing] = useState(null); // product being edited, or "new"
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [photos, setPhotos] = useState([]); // photos already saved on the phone being edited
  const [queued, setQueued] = useState([]); // photos chosen for a new phone, uploaded after it is saved
  const [saving, setSaving] = useState(false);
  const [listError, setListError] = useState("");

  function load() {
    api.get("/products/admin/all").then((res) => setProducts(res.data.data));
  }
  useEffect(load, []);

  function startEdit(p) {
    setEditing(p._id);
    setError("");
    setPhotos(p.images || []);
    setQueued([]);
    setForm({
      name: p.name, brand: p.brand, model: p.model, ram: p.ram || "", storage: p.storage || "",
      costPrice: p.costPrice, sellingPrice: p.sellingPrice, stock: p.stock, commissionRateOverride: p.commissionRateOverride ?? "",
      specifications: { ...(p.specifications || {}) },
    });
  }

  function startNew() {
    setEditing("new");
    setError("");
    setPhotos([]);
    setQueued([]);
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
    setSaving(true);
    try {
      let productId = editing;
      if (editing === "new") {
        const created = await api.post("/products/admin", payload);
        productId = created.data.data._id;
      } else {
        await api.patch(`/products/admin/${editing}`, payload);
      }

      if (queued.length) {
        // Upload the photos chosen for a new phone, one at a time, now that it exists.
        const waiting = [...queued];
        try {
          while (waiting.length) {
            const data = new FormData();
            data.append("image", waiting[0]);
            const uploaded = await api.post(`/products/admin/${productId}/images`, data);
            setPhotos(uploaded.data.data.images || []);
            waiting.shift();
            setQueued([...waiting]);
          }
        } catch (uploadError) {
          setEditing(productId);
          setError(`The phone was saved, but ${waiting.length} photo${waiting.length === 1 ? "" : "s"} could not be uploaded: ${uploadError.response?.data?.message || "please try again."}`);
          await load();
          return;
        }
      }

      setEditing(null);
      setQueued([]);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not save product");
    } finally {
      setSaving(false);
    }
  }

  // Hides a phone from the shop, or shows it again. Nothing is deleted either way.
  async function toggleActive(p) {
    setListError("");
    try {
      if (p.isActive === false) await api.patch(`/products/admin/${p._id}`, { isActive: true });
      else await api.delete(`/products/admin/${p._id}`);
      await load();
    } catch (err) {
      setListError(err.response?.data?.message || "Could not change this phone. Please try again.");
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <h1 className="page-title">Products</h1>
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
          <input className="input" placeholder="Camera (e.g. 50MP)" value={form.specifications.camera || ""}
            onChange={(e) => setForm({ ...form, specifications: { ...form.specifications, camera: e.target.value } })} />
          <input className="input" placeholder="Battery (e.g. 5000mAh)" value={form.specifications.battery || ""}
            onChange={(e) => setForm({ ...form, specifications: { ...form.specifications, battery: e.target.value } })} />
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
          <PhotoManager
            productId={editing}
            name={form.name}
            photos={photos}
            onPhotosChange={(next) => { setPhotos(next); load(); }}
            queued={queued}
            onQueuedChange={setQueued}
          />
          {error && <p className="text-coral text-sm col-span-2">{error}</p>}
          <div className="col-span-2 flex gap-2">
            <button type="submit" disabled={saving} className="btn-primary text-sm py-2 px-4 disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
            <button type="button" disabled={saving} onClick={() => setEditing(null)} className="btn-outline text-sm py-2 px-4 disabled:opacity-50">Cancel</button>
          </div>
        </form>
      )}

      {listError && <p role="alert" className="mb-3 text-sm text-coral">{listError}</p>}
      <div className="overflow-x-auto">
      <table className="w-full min-w-[850px] text-sm">
        <thead>
          <tr className="text-left text-ink-faint text-xs uppercase border-b border-navy-line">
            <th className="py-2.5">Brand</th>
            <th className="py-2.5">Image</th>
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
            <tr key={p._id} className={`border-b border-navy-line ${p.isActive === false ? "bg-navy-panel2/60" : ""}`}>
              <td className="py-2.5 text-ink">{p.brand}</td>
              <td className="py-2.5">
                <div className="relative h-12 w-12">
                  <ProductImage src={p.images?.[0]} alt={p.name} width={200} className="h-12 w-12 rounded object-contain" />
                  {(p.images?.length || 0) > 1 && (
                    <span className="absolute -bottom-1 -right-1 rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-semibold text-brand-text">{p.images.length}</span>
                  )}
                </div>
              </td>
              <td className="py-2.5 text-ink">
                <span className={p.isActive === false ? "text-ink-dim" : ""}>{p.name}</span>
                {p.isActive === false && <span className="badge badge-muted ml-2">Hidden from shop</span>}
                {!(p.sellingPrice > 0) && <span className="badge badge-muted ml-2">Needs price</span>}
                {(p.storage || p.ram) && (
                  <span className="block text-xs text-ink-faint">{[p.storage, p.ram && `${p.ram} RAM`].filter(Boolean).join(" · ")}</span>
                )}
              </td>
              <td className="py-2.5 text-ink-dim">{naira(p.costPrice)}</td>
              <td className="py-2.5 text-ink-dim">{naira(p.sellingPrice)}</td>
              <td className="py-2.5 text-teal">{naira(p.sellingPrice - p.costPrice)}</td>
              <td className="py-2.5 text-ink-dim">{p.commissionRateOverride !== null ? p.commissionRateOverride + "%" : "Default"}</td>
              <td className="py-2.5 text-ink-dim">{p.stock}</td>
              <td className="py-2.5">
                <button onClick={() => startEdit(p)} className="text-xs border border-navy-line rounded-lg px-3 py-1.5 transition-colors mr-1.5 hover:border-gold">Edit</button>
                <button
                  onClick={() => toggleActive(p)}
                  className={`text-xs border border-navy-line rounded-lg px-3 py-1.5 transition-colors ${
                    p.isActive === false ? "hover:border-mint hover:text-mint" : "hover:border-coral hover:text-coral"
                  }`}
                >
                  {p.isActive === false ? "Activate" : "Deactivate"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <p className="text-ink-faint text-xs mt-3">Cost price and margin are only ever shown on this admin page — never on customer-facing pages or API responses.</p>
    </div>
  );
}
