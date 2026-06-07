-- Bump the default model on generated_image to cx/gpt-5.5-image.
--
-- The image-gen tool now generates with cx/gpt-5.5-image, and the app always
-- writes the model explicitly on insert, so this only realigns the column
-- default for any direct/manual inserts. Existing rows are left untouched.

alter table public.generated_image
  alter column model set default 'cx/gpt-5.5-image';
