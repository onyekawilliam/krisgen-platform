import { useEffect, useState } from "react";
import api from "../../api/axios";
import ProductImage from "../../components/ProductImage";

function naira(n) {
  return "₦" + Number(n).toLocaleString("en-NG");
}

const emptyForm = { name: "", brand: "Tecno", model: "", ram: "", storage: "", costPrice: "", sellingPrice: "",  commissionRateOverride: "", stock: "" };

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [editing, setEditing] = useState(null); // product being edited, or "new"
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [imageStatus, setImageStatus] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!imageFile) return;
    const preview = URL.createObjectURL(imageFile);
    setImagePreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [imageFile]);

  function load() {
    api.get("/products/admin/all").then((res) => setProducts(res.data.data));
  }
  useEffect(load, []);

  function startEdit(p) {
    setEditing(p._id);
    setError("");
    setImageStatus("");
    setImageFile(null);
    setImagePreview(p.images?.[0] || "");
    setForm({
      name: p.name, brand: p.brand, model: p.model, ram: p.ram || "", storage: p.storage || "",
      costPrice: p.costPrice, sellingPrice: p.sellingPrice, stock: p.stock, commissionRateOverride: p.commissionRateOverride ?? "",
    });
  }

  function startNew() {
    setEditing("new");
    setError("");
    setImageStatus("");
    setImageFile(null);
    setImagePreview("");
    setForm(emptyForm);
  }

  function chooseImage(file) {
    setError("");
    setImageStatus("");
    if (!file) {
      setImageFile(null);
      setImagePreview(editing !== "new" ? products.find((p) => p._id === editing)?.images?.[0] || "" : "");
      return;
    }
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
    if (!allowedTypes.includes(file.type)) {
      setError("Choose a JPEG, PNG, WebP, GIF, or AVIF image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Product images must be 5 MB or smaller.");
      return;
    }
    setImageFile(file);
    setImageStatus("Image selected. It will upload when you save the product.");
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

      if (imageFile) {
        setImageStatus("Uploading image to Cloudinary…");
        const data = new FormData();
        data.append("image", imageFile);
        try {
          const uploaded = await api.post(`/products/admin/${productId}/image`, data);
          setImagePreview(uploaded.data.data.images?.[0] || "");
          setImageFile(null);
          setImageStatus("Image saved successfully.");
        } catch (uploadError) {
          if (editing === "new") setEditing(productId);
          setError(`Product details were saved, but the image upload failed: ${uploadError.response?.data?.message || "Please try again."}`);
          setImageStatus("Choose Save again to retry the image upload.");
          await load();
          return;
        }
      }

      setEditing(null);
      setImageFile(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not save product");
    } finally {
      setSaving(false);
    }
  }

  async function removeImage() {
    if (imageFile) {
      chooseImage(null);
      return;
    }
    if (!editing || editing === "new" || !imagePreview) return;
    setError("");
    setImageStatus("Removing image…");
    try {
      const response = await api.delete(`/products/admin/${editing}/image`);
      setImagePreview(response.data.data.images?.[0] || "");
      setImageStatus(response.data.warning || "Product image removed.");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not remove the product image.");
      setImageStatus("");
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
          <div className="col-span-2">
            <label className="label" htmlFor="product-image">Product image</label>
            <input id="product-image" className="input" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
              onChange={(event) => chooseImage(event.target.files?.[0])} />
            <p className="text-ink-faint text-xs mt-1">JPEG, PNG, WebP, GIF or AVIF; maximum 5 MB.</p>
            {imagePreview && (
              <div className="flex items-center gap-3 mt-3">
                <ProductImage src={imagePreview} alt={form.name || "Product preview"} className="w-24 h-24 object-contain rounded-md" />
                {editing !== "new" && <button type="button" onClick={removeImage} className="text-xs text-coral hover:underline">{imageFile ? "Clear selected image" : "Remove current image"}</button>}
              </div>
            )}
            {imageStatus && <p className="text-teal text-xs mt-2" role="status">{imageStatus}</p>}
          </div>
          {error && <p className="text-coral text-sm col-span-2">{error}</p>}
          <div className="col-span-2 flex gap-2">
            <button type="submit" disabled={saving} className="btn-primary text-sm py-2 px-4 disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
            <button type="button" disabled={saving} onClick={() => setEditing(null)} className="btn-outline text-sm py-2 px-4 disabled:opacity-50">Cancel</button>
          </div>
        </form>
      )}

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
            <tr key={p._id} className="border-b border-navy-line">
              <td className="py-2.5 text-ink">{p.brand}</td>
              <td className="py-2.5"><ProductImage src={p.images?.[0]} alt={p.name} className="w-12 h-12 object-contain rounded" /></td>
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
      </div>
      <p className="text-ink-faint text-xs mt-3">Cost price and margin are only ever shown on this admin page — never on customer-facing pages or API responses.</p>
    </div>
  );
}
