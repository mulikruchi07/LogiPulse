// Vercel serverless function: GET /api/data
// Reads the database using keys kept in Vercel environment variables.
// The browser never sees SUPABASE_URL or SUPABASE_KEY.
const { SUPABASE_URL, SUPABASE_KEY } = process.env;

async function q(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!r.ok) throw new Error(`Database request failed (${r.status})`);
  return r.json();
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Server is missing SUPABASE_URL or SUPABASE_KEY' });
  }
  try {
    const [ports, shipments, legs, cargo] = await Promise.all([
      q('ports?select=id,port_code,name,country,lat,lon&order=port_code'),
      q('shipments?select=id,tracking_code,sender,receiver,status,stage,base_cost_usd,total_weight_kg,total_duty_usd,cur_lat,cur_lon,metadata_jsonb,created_at&order=id.desc'),
      q('shipment_legs?select=*&order=leg_order'),
      q('cargo_items?select=*'),
    ]);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ ports, shipments, legs, cargo });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
};