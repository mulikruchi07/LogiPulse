// Vercel serverless function: POST /api/rpc  { fn, args }
// Only the functions listed below can be called, and inputs are validated
// before anything is forwarded to the database.
const { SUPABASE_URL, SUPABASE_KEY } = process.env;

const KEYS = {
  rank_ports_throughput: [],
  hazardous_shipments: [],
  shipment_analytics: [],
  lane_summary: [],
  port_manifest: ['p_code'],
  client_ledger: [],
  port_stats: ['p_refresh'],
  search_shipments: ['p_q'],
  advance_shipment: ['p_id'],
  shipment_timeline: ['p_id'],
  audit_recent: ['p_limit'],
  explain_demo: ['p_kind'],
  ports_within: ['p_lat', 'p_lon', 'p_radius_km'],
  create_shipment: ['p_sender', 'p_receiver', 'p_origin', 'p_dest', 'p_category', 'p_weight', 'p_metadata', 'p_base_cost'],
};
const CATS = ['General', 'Electronics', 'Chemicals', 'Perishables', 'Machinery'];
const num = (v) => typeof v === 'number' && Number.isFinite(v);
const str = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;

const CHECK = {
  port_manifest: (a) => /^[A-Za-z]{3}$/.test(a.p_code || ''),
  port_stats: (a) => typeof a.p_refresh === 'boolean',
  search_shipments: (a) => str(a.p_q, 80),
  advance_shipment: (a) => Number.isInteger(a.p_id) && a.p_id > 0,
  shipment_timeline: (a) => Number.isInteger(a.p_id) && a.p_id > 0,
  audit_recent: (a) => Number.isInteger(a.p_limit) && a.p_limit >= 1 && a.p_limit <= 100,
  explain_demo: (a) => ['spatial', 'jsonb', 'search', 'status'].includes(a.p_kind),
  ports_within: (a) =>
    num(a.p_lat) && Math.abs(a.p_lat) <= 90 && num(a.p_lon) && Math.abs(a.p_lon) <= 180 &&
    num(a.p_radius_km) && a.p_radius_km > 0 && a.p_radius_km <= 20000,
  create_shipment: (a) =>
    str(a.p_sender, 120) && str(a.p_receiver, 120) &&
    /^[A-Za-z]{3}$/.test(a.p_origin || '') && /^[A-Za-z]{3}$/.test(a.p_dest || '') &&
    CATS.includes(a.p_category) &&
    num(a.p_weight) && a.p_weight > 0 && a.p_weight <= 10000000 &&
    num(a.p_base_cost) && a.p_base_cost >= 0 && a.p_base_cost <= 1e9 &&
    a.p_metadata && typeof a.p_metadata === 'object' && !Array.isArray(a.p_metadata) &&
    JSON.stringify(a.p_metadata).length <= 5000,
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Server is missing SUPABASE_URL or SUPABASE_KEY' });
  }
  const { fn, args } = req.body || {};
  const allowed = KEYS[fn];
  if (!allowed) return res.status(400).json({ error: 'Unknown function' });

  const a = {};
  allowed.forEach((k) => { a[k] = (args || {})[k]; });
  if (CHECK[fn] && !CHECK[fn](a)) return res.status(400).json({ error: 'Invalid input' });

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(a),
    });
    let j = null;
    try { j = await r.json(); } catch (e) { /* empty body */ }
    if (!r.ok) {
      return res.status(400).json({ error: String((j && j.message) || 'Database rejected the request').slice(0, 200) });
    }
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ data: j });
  } catch (e) {
    res.status(502).json({ error: 'Could not reach the database' });
  }
};
