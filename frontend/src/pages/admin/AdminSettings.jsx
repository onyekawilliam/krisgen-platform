import { useEffect, useState } from "react";
import api from "../../api/axios";

export default function AdminSettings() {
  const [form, setForm] = useState({ directCommissionRate: "", referralOverrideRate: "" });
  const [pickup, setPickup] = useState({ pickupEnabled: true, pickupAddress: "", pickupInstructions: "" });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [pickupSaved, setPickupSaved] = useState(false);
  const [pickupError, setPickupError] = useState("");

  function load(data) {
    setForm({ directCommissionRate: data.directCommissionRate, referralOverrideRate: data.referralOverrideRate });
    setPickup({
      pickupEnabled: data.pickupEnabled !== false,
      pickupAddress: data.pickupAddress || "",
      pickupInstructions: data.pickupInstructions || "",
    });
  }

  useEffect(() => {
    api
      .get("/commissions/admin/settings")
      .then((res) => load(res.data.data))
      .catch(() => setError("Could not load settings. Refresh to try again."));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaved(false);
    try {
      const res = await api.patch("/commissions/admin/settings", {
        directCommissionRate: Number(form.directCommissionRate),
        referralOverrideRate: Number(form.referralOverrideRate),
      });
      load(res.data.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err.response?.data?.message || "Could not save settings.");
    }
  }

  async function handlePickupSubmit(e) {
    e.preventDefault();
    setPickupError("");
    setPickupSaved(false);
    try {
      const res = await api.patch("/commissions/admin/settings", pickup);
      load(res.data.data);
      setPickupSaved(true);
      setTimeout(() => setPickupSaved(false), 2000);
    } catch (err) {
      setPickupError(err.response?.data?.message || "Could not save the pickup details.");
    }
  }

  return (
    <div>
      <h1 className="page-title mb-1">Platform settings</h1>
      <p className="mb-6 text-sm text-ink-dim">
        Commission rates apply to a product's profit, not its selling price. Changes only affect future sales —
        commissions already recorded keep their original snapshot.
      </p>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <form onSubmit={handleSubmit} className="card flex flex-col gap-3">
          <h2 className="font-display text-lg font-semibold">Commission rates</h2>
          <div>
            <label className="label" htmlFor="direct-rate">Direct sale commission rate (%)</label>
            <input id="direct-rate" type="number" className="input" min="0" max="100" step="any" required value={form.directCommissionRate} onChange={(e) => setForm({ ...form, directCommissionRate: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="override-rate">Referral override rate (%)</label>
            <input id="override-rate" type="number" className="input" min="0" max="100" step="any" required value={form.referralOverrideRate} onChange={(e) => setForm({ ...form, referralOverrideRate: e.target.value })} />
          </div>
          <button type="submit" className="btn-primary mt-2">Save rates</button>
          <p className="text-xs text-ink-faint">Together the two rates cannot exceed 100% of the profit.</p>
          {error && <p role="alert" className="text-sm text-coral">{error}</p>}
          {saved && <p className="text-sm text-teal">Saved.</p>}
        </form>

        <form onSubmit={handlePickupSubmit} className="card flex flex-col gap-3">
          <h2 className="font-display text-lg font-semibold">Shop pickup</h2>
          <p className="text-sm text-ink-dim">
            Let customers collect their phone from your shop instead of waiting for delivery. They see the address
            below at checkout and on their orders.
          </p>
          <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
            <input
              type="checkbox"
              className="h-5 w-5 accent-[rgb(var(--c-gold))]"
              checked={pickup.pickupEnabled}
              onChange={(e) => setPickup({ ...pickup, pickupEnabled: e.target.checked })}
            />
            Offer shop pickup
          </label>
          <div>
            <label className="label" htmlFor="pickup-address">Shop address</label>
            <textarea
              id="pickup-address"
              className="input min-h-[84px]"
              maxLength={300}
              placeholder="Street, area and city, so customers can find you"
              value={pickup.pickupAddress}
              onChange={(e) => setPickup({ ...pickup, pickupAddress: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="pickup-instructions">Opening hours or instructions (optional)</label>
            <textarea
              id="pickup-instructions"
              className="input min-h-[72px]"
              maxLength={300}
              placeholder="For example: Open Monday to Saturday, 9am to 6pm. Bring your order number."
              value={pickup.pickupInstructions}
              onChange={(e) => setPickup({ ...pickup, pickupInstructions: e.target.value })}
            />
          </div>
          <button type="submit" className="btn-primary mt-1">Save pickup details</button>
          <p className="text-xs text-ink-faint">
            If you leave the address empty, customers are told you will confirm the pickup location with them.
          </p>
          {pickupError && <p role="alert" className="text-sm text-coral">{pickupError}</p>}
          {pickupSaved && <p className="text-sm text-teal">Saved.</p>}
        </form>
      </div>
    </div>
  );
}
