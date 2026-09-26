-- =============================================================================
-- Migración 002: índice para el listado paginado de personas
-- =============================================================================

-- El listado ordena por apellidos, nombres e id (el id desempata para que el
-- orden sea siempre el mismo y la paginación no repita ni saltee filas).
-- Con este índice PostgreSQL recorre las filas ya ordenadas y se detiene al
-- alcanzar el LIMIT, en lugar de ordenar la tabla completa en cada petición.
CREATE INDEX personas_orden_listado ON personas (apellidos, nombres, id);