-- Atomic increment of views for a photo marker
create or replace function increment_photo_marker_views(marker_id uuid)
returns integer as $$
begin
  update photo_markers set views = views + 1 where id = marker_id;
  return (select views from photo_markers where id = marker_id);
end;
$$ language plpgsql;
