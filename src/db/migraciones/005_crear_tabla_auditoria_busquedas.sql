-- =============================================================================
-- Migración 005: auditoría de búsquedas
-- =============================================================================

-- Cada búsqueda ejecutada queda registrada. El registro se crea al buscar;
-- la geolocalización de la IP y la notificación a Telegram se realizan después
-- de responder al usuario y actualizan sus columnas (estado inicial: 'pendiente').
CREATE TABLE auditoria_busquedas (
  id                  BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fecha_hora          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  termino             VARCHAR(100) NOT NULL,
  criterio            VARCHAR(10)  NOT NULL,
  cantidad_resultados INTEGER      NOT NULL,

  -- INET: tipo nativo para direcciones IP (valida el formato, IPv4 e IPv6)
  ip                  INET         NOT NULL,
  -- De dónde se obtuvo la IP: 'cloudflare' (vía túnel) o 'conexion' (directa)
  ip_origen           VARCHAR(10)  NOT NULL,

  -- Geolocalización de la IP (API pública)
  geo_estado          VARCHAR(20)  NOT NULL DEFAULT 'pendiente',
  geo_pais            VARCHAR(100),
  geo_ciudad          VARCHAR(100),
  geo_organizacion    VARCHAR(200),
  geo_latitud         NUMERIC(9, 6),
  geo_longitud        NUMERIC(9, 6),

  -- Notificación a Telegram
  telegram_estado     VARCHAR(20)  NOT NULL DEFAULT 'pendiente',
  telegram_detalle    VARCHAR(300),

  CONSTRAINT auditoria_criterio_valido
    CHECK (criterio IN ('nombre', 'documento')),
  CONSTRAINT auditoria_cantidad_no_negativa
    CHECK (cantidad_resultados >= 0),
  CONSTRAINT auditoria_ip_origen_valido
    CHECK (ip_origen IN ('cloudflare', 'conexion')),
  CONSTRAINT auditoria_geo_estado_valido
    CHECK (geo_estado IN ('pendiente', 'ok', 'ip_privada', 'sin_datos', 'limite_excedido', 'error')),
  CONSTRAINT auditoria_telegram_estado_valido
    CHECK (telegram_estado IN ('pendiente', 'enviado', 'error'))
);

-- El historial se consulta del más reciente al más antiguo, y la política de
-- retención borra por fecha: ambas operaciones usan este índice.
CREATE INDEX auditoria_busquedas_fecha ON auditoria_busquedas (fecha_hora DESC);