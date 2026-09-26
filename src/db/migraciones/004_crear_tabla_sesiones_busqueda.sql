-- =============================================================================
-- Migración 004: sesiones de búsqueda habilitadas por un captcha aprobado
-- =============================================================================

-- Un captcha aprobado habilita una cantidad limitada de búsquedas durante un
-- tiempo limitado. El navegador recibe un token aleatorio en una cookie; aquí
-- solo se guarda su hash SHA-256: una copia de la base no permite usar sesiones.
CREATE TABLE sesiones_busqueda (
  token_hash          CHAR(64)    PRIMARY KEY,
  busquedas_restantes INTEGER     NOT NULL,
  creada_en           TIMESTAMPTZ NOT NULL DEFAULT now(),
  expira_en           TIMESTAMPTZ NOT NULL,

  CONSTRAINT sesiones_busqueda_restantes_no_negativas CHECK (busquedas_restantes >= 0)
);

-- Para borrar rápidamente las sesiones vencidas
CREATE INDEX sesiones_busqueda_expira ON sesiones_busqueda (expira_en);