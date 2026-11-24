-- Migration: Populate asset_path for all 6 head and torso parts in public.parts_catalog
-- so all 12/12 MVP parts serve isometric anatomy SVGs from the parts-assets bucket.

update public.parts_catalog
set asset_path = case id
  when 'head_stitch_skull' then 'parts/head/head_stitch_skull.svg'
  when 'head_brass_visor' then 'parts/head/head_brass_visor.svg'
  when 'head_voltaic_crown' then 'parts/head/head_voltaic_crown.svg'
  when 'torso_canvas_ribcage' then 'parts/torso/torso_canvas_ribcage.svg'
  when 'torso_boiler_plate' then 'parts/torso/torso_boiler_plate.svg'
  when 'torso_reactor_core' then 'parts/torso/torso_reactor_core.svg'
  else asset_path
end
where id in (
  'head_stitch_skull',
  'head_brass_visor',
  'head_voltaic_crown',
  'torso_canvas_ribcage',
  'torso_boiler_plate',
  'torso_reactor_core'
);
