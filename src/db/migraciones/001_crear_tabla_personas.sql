-- =============================================================================
-- Migración 001: tabla de personas
-- =============================================================================

CREATE TABLE personas (
  -- Identificador generado por la base. ALWAYS impide asignarlo manualmente.
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- Límites de longitud: protegen contra cadenas muy largas aunque falle
  -- la validación del backend (defensa en profundidad).
  nombres          VARCHAR(100) NOT NULL,
  apellidos        VARCHAR(100) NOT NULL,

  -- Se guarda NORMALIZADO por el backend: sin puntos, guiones ni espacios,
  -- en mayúsculas ("1.234.567" -> "1234567"). Así la restricción UNIQUE
  -- detecta el mismo documento escrito de distintas formas.
  nro_documento    VARCHAR(20)  NOT NULL,

  -- DATE: solo fecha, sin hora ni zona horaria. La edad NO se almacena: se deriva.
  fecha_nacimiento DATE         NOT NULL,

  -- Solo el nombre del archivo generado por el servidor (ej: "<uuid>.webp"),
  -- nunca la ruta completa ni el nombre enviado por el cliente.
  imagen_frente    VARCHAR(100) NOT NULL,
  imagen_dorso     VARCHAR(100) NOT NULL,

  -- Fecha y hora con zona horaria (se guardan en UTC internamente)
  creado_en        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  actualizado_en   TIMESTAMPTZ  NOT NULL DEFAULT now(),

  -- Las restricciones tienen nombre explícito para que el backend pueda
  -- identificarlas en los errores (ej: documento duplicado -> respuesta 409).
  CONSTRAINT personas_nro_documento_unico     UNIQUE (nro_documento),
  CONSTRAINT personas_nro_documento_formato   CHECK (nro_documento ~ '^[0-9A-Z]{3,20}$'),
  CONSTRAINT personas_nombres_no_vacio        CHECK (btrim(nombres) <> ''),
  CONSTRAINT personas_apellidos_no_vacio      CHECK (btrim(apellidos) <> ''),

  -- La regla "no puede ser futura" se valida en el backend: un CHECK con
  -- CURRENT_DATE no es recomendable porque su resultado cambia con el tiempo.
  -- Aquí solo se fija un límite inferior que detecta errores evidentes.
  CONSTRAINT personas_fecha_nacimiento_minima CHECK (fecha_nacimiento >= DATE '1900-01-01')
);