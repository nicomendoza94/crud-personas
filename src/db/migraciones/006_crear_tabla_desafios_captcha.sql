-- =============================================================================
-- Migración 006: desafíos del captcha deslizante propio
-- =============================================================================

-- Cada desafío guarda la posición horizontal correcta del hueco del rompecabezas.
-- Esa posición NUNCA se envía al navegador: el servidor la usa para comparar con
-- la posición donde el usuario soltó la pieza.
--
-- Cada desafío admite un solo intento: al verificarlo se elimina, acierte o no.
-- Así no se puede probar posición por posición con el mismo desafío.
CREATE TABLE desafios_captcha (
  -- Identificador aleatorio, generado por la aplicación (crypto.randomUUID)
  id          UUID        PRIMARY KEY,

  -- Posición horizontal correcta del hueco, en píxeles
  posicion_x  SMALLINT    NOT NULL CHECK (posicion_x >= 0),

  -- Cuándo se creó: permite exigir un tiempo mínimo de resolución
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Vencimiento: un desafío viejo no se acepta
  expira_en   TIMESTAMPTZ NOT NULL
);

-- Para borrar rápidamente los desafíos vencidos que nadie intentó resolver
CREATE INDEX desafios_captcha_expira ON desafios_captcha (expira_en);