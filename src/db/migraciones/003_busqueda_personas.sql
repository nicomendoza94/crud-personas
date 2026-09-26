-- =============================================================================
-- Migración 003: soporte para la búsqueda de personas
-- =============================================================================

-- pg_trgm: índices de trigramas, para búsquedas "que contenga" (LIKE '%texto%')
-- unaccent: quita tildes y diacríticos ("José" -> "Jose")
-- Ambas son extensiones "confiables": puede instalarlas el dueño de la base,
-- sin permisos de superusuario.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Normaliza un texto para comparar: sin tildes y en minúsculas.
-- PostgreSQL solo permite indexar funciones IMMUTABLE, y unaccent() no lo es
-- (depende de la configuración). Se usa la versión que recibe el diccionario
-- de forma explícita, lo que hace seguro declararla IMMUTABLE.
CREATE FUNCTION normalizar_texto(texto TEXT) RETURNS TEXT
  LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
  AS $$ SELECT lower(public.unaccent('public.unaccent'::regdictionary, texto)) $$;

-- Búsqueda por nombre: índice de trigramas sobre nombres y apellidos normalizados.
-- La consulta debe usar exactamente la misma expresión para aprovecharlo.
CREATE INDEX personas_busqueda_nombre
  ON personas USING gin (normalizar_texto(nombres || ' ' || apellidos) gin_trgm_ops);

-- Búsqueda de documento por prefijo (LIKE 'texto%'). text_pattern_ops compara
-- caracteres de forma literal, lo que permite usar el índice con LIKE.
CREATE INDEX personas_nro_documento_prefijo
  ON personas (nro_documento text_pattern_ops);