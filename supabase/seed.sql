-- Reference data for the Operations OS. Idempotent — safe to re-run.

-- Pipeline stages (only seeded when the table is empty so manual edits stick).
insert into public.pipeline_stages (name, sort_order, is_won, is_lost)
select v.name, v.sort_order, v.is_won, v.is_lost
from (values
  ('New Inquiry',   1, false, false),
  ('Qualified',     2, false, false),
  ('Proposal Sent', 3, false, false),
  ('Negotiation',   4, false, false),
  ('Won',           5, true,  false),
  ('Lost',          6, false, true)
) as v(name, sort_order, is_won, is_lost)
where not exists (select 1 from public.pipeline_stages);

-- Inventory categories.
insert into public.inventory_categories (name, description) values
  ('Tables',           'Banquet, cocktail, and specialty tables'),
  ('Chairs',           'Seating — Chiavari, folding, lounge'),
  ('Linens',           'Tablecloths, napkins, runners'),
  ('Tents & Canopies', 'Tents, canopies, sidewalls'),
  ('Machines',         'Serialized equipment — fog, lighting, AV, generators'),
  ('Decor',            'Centerpieces, arches, signage')
on conflict (name) do nothing;

-- Vendor network categories.
insert into public.vendor_categories (name, description) values
  ('Catering',      'Full-service caterers'),
  ('Food',          'Food vendors, food trucks, stations'),
  ('Drink',         'Bar service & beverage vendors'),
  ('Entertainment', 'DJs, bands, performers'),
  ('Floral',        'Florists & floral design'),
  ('AV & Lighting', 'Audio, visual, and lighting partners'),
  ('Photography',   'Photographers & videographers'),
  ('Rentals',       'Specialty rental partners')
on conflict (name) do nothing;
