-- Fusiona `ventas` y `cedidos` dentro de `boletos`.
--
-- Reglas de conversión:
--  * Venta activa            -> estado 'vendido' (con su fecha de venta).
--  * Venta anulada           -> estado 'disponible' conservando fecha, fecha de anulación y motivo.
--  * Cedido                  -> estado 'cedido' (fecha de cesión y origen de la cesión). Se empareja con
--                               el boleto por sorteo, número, serie y fracción, no por id_boleto.
--  * Cedido sin boleto       -> se crea un boleto sin origen (aún no recibido) con estado 'cedido'.
--  * Orígenes 'Venta importada' -> sus boletos pasan a no tener origen (aún no recibidos) y el origen se elimina.
--
-- Un boleto no puede estar vendido y cedido a la vez, ni cedido por dos albaranes. Si los datos actuales lo
-- contradicen, no se decide por el usuario: la migración se detiene ANTES de modificar nada y hay que
-- resolverlo con la versión anterior de la aplicación (anulando la venta o eliminando el albarán de cesión
-- que sobra, que se podrá volver a importar después). Después se marca la migración como no aplicada con:
--   pnpm exec prisma migrate resolve --rolled-back 20260930130000_fusionar_boletos_ventas_cedidos
-- Consulta para localizar los conflictos:
--   SELECT c.id_origen, c.numero_jugado, c.serie, c.fraccion FROM cedidos c
--     JOIN boletos b ON b.id_sorteo = c.id_sorteo AND b.numero_jugado = c.numero_jugado AND b.serie = c.serie AND b.fraccion = c.fraccion
--     JOIN ventas v ON v.id_boleto = b.id_boleto WHERE v.estado = 'activa';
--   SELECT id_sorteo, numero_jugado, serie, fraccion, COUNT(*) FROM cedidos GROUP BY 1, 2, 3, 4 HAVING COUNT(*) > 1;

CREATE TEMP TABLE "comprobacion_previa" (
    "conflictos" INTEGER NOT NULL,
    CONSTRAINT "ABORTADO_hay_boletos_vendidos_y_cedidos_a_la_vez_o_cedidos_por_varios_albaranes_ver_el_inicio_de_la_migracion" CHECK ("conflictos" = 0)
);
INSERT INTO "comprobacion_previa" ("conflictos")
SELECT (
    SELECT COUNT(*) FROM "cedidos" c
    JOIN "boletos" b ON b."id_sorteo" = c."id_sorteo" AND b."numero_jugado" = c."numero_jugado" AND b."serie" = c."serie" AND b."fraccion" = c."fraccion"
    JOIN "ventas" v ON v."id_boleto" = b."id_boleto"
    WHERE v."estado" = 'activa'
) + (
    SELECT COUNT(*) FROM (
        SELECT 1 FROM "cedidos" GROUP BY "id_sorteo", "numero_jugado", "serie", "fraccion" HAVING COUNT(*) > 1
    )
);
DROP TABLE "comprobacion_previa";

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_boletos" (
    "id_boleto" TEXT NOT NULL PRIMARY KEY,
    "id_sorteo" TEXT NOT NULL,
    "id_origen" TEXT,
    "numero_jugado" TEXT NOT NULL,
    "serie" TEXT NOT NULL,
    "fraccion" TEXT NOT NULL,
    "digitos_control" TEXT NOT NULL,
    "codigo_barras_raw" TEXT NOT NULL,
    "fecha_hora_registro" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" TEXT NOT NULL DEFAULT 'disponible',
    "fecha_hora_venta" DATETIME,
    "fecha_hora_anulacion" DATETIME,
    "motivo_anulacion" TEXT,
    "fecha_hora_cesion" DATETIME,
    "id_origen_cesion" TEXT,
    CONSTRAINT "boletos_id_sorteo_fkey" FOREIGN KEY ("id_sorteo") REFERENCES "sorteos" ("id_sorteo") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "boletos_id_origen_fkey" FOREIGN KEY ("id_origen") REFERENCES "origenes" ("id_origen") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "boletos_id_origen_cesion_fkey" FOREIGN KEY ("id_origen_cesion") REFERENCES "origenes" ("id_origen") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 1) Boletos existentes, con su venta y su cesión.
INSERT INTO "new_boletos" (
    "id_boleto", "id_sorteo", "id_origen", "numero_jugado", "serie", "fraccion", "digitos_control",
    "codigo_barras_raw", "fecha_hora_registro", "estado", "fecha_hora_venta", "fecha_hora_anulacion",
    "motivo_anulacion", "fecha_hora_cesion", "id_origen_cesion"
)
SELECT
    b."id_boleto", b."id_sorteo",
    CASE WHEN o."tipo_origen" = 'Venta importada' THEN NULL ELSE b."id_origen" END,
    b."numero_jugado", b."serie", b."fraccion", b."digitos_control", b."codigo_barras_raw", b."fecha_hora_registro",
    CASE
        WHEN v."estado" = 'activa' THEN 'vendido'
        WHEN c."fecha_hora_cesion" IS NOT NULL THEN 'cedido'
        ELSE 'disponible'
    END,
    CASE WHEN v."estado" = 'activa' OR c."fecha_hora_cesion" IS NULL THEN v."fecha_hora_venta" END,
    CASE WHEN c."fecha_hora_cesion" IS NULL THEN v."fecha_hora_anulacion" END,
    CASE WHEN c."fecha_hora_cesion" IS NULL THEN v."motivo_anulacion" END,
    CASE WHEN COALESCE(v."estado", '') <> 'activa' THEN c."fecha_hora_cesion" END,
    CASE WHEN COALESCE(v."estado", '') <> 'activa' THEN c."id_origen" END
FROM "boletos" b
LEFT JOIN "origenes" o ON o."id_origen" = b."id_origen"
LEFT JOIN "ventas" v ON v."id_boleto" = b."id_boleto"
LEFT JOIN (
    SELECT "id_sorteo", "numero_jugado", "serie", "fraccion", "id_origen", MAX("fecha_hora_cesion") AS "fecha_hora_cesion"
    FROM "cedidos"
    GROUP BY "id_sorteo", "numero_jugado", "serie", "fraccion"
) c ON c."id_sorteo" = b."id_sorteo" AND c."numero_jugado" = b."numero_jugado" AND c."serie" = b."serie" AND c."fraccion" = b."fraccion";

-- 2) Cedidos de boletos que aún no se han recibido: boleto sin origen con estado 'cedido'.
INSERT INTO "new_boletos" (
    "id_boleto", "id_sorteo", "id_origen", "numero_jugado", "serie", "fraccion", "digitos_control",
    "codigo_barras_raw", "fecha_hora_registro", "estado", "fecha_hora_cesion", "id_origen_cesion"
)
SELECT
    c."id_sorteo" || '-' || c."numero_jugado" || '-' || c."serie" || '-' || c."fraccion",
    c."id_sorteo", NULL, c."numero_jugado", c."serie", c."fraccion", '0000',
    'PDF:' || c."id_origen", c."fecha_hora_cesion", 'cedido', c."fecha_hora_cesion", c."id_origen"
FROM (
    SELECT "id_sorteo", "numero_jugado", "serie", "fraccion", "id_origen", MAX("fecha_hora_cesion") AS "fecha_hora_cesion"
    FROM "cedidos"
    GROUP BY "id_sorteo", "numero_jugado", "serie", "fraccion"
) c
WHERE NOT EXISTS (
    SELECT 1 FROM "boletos" b
    WHERE b."id_sorteo" = c."id_sorteo" AND b."numero_jugado" = c."numero_jugado" AND b."serie" = c."serie" AND b."fraccion" = c."fraccion"
);

DROP TABLE "ventas";
DROP TABLE "cedidos";
DROP TABLE "boletos";
ALTER TABLE "new_boletos" RENAME TO "boletos";

CREATE INDEX "boletos_id_origen_idx" ON "boletos"("id_origen");
CREATE INDEX "boletos_id_origen_cesion_idx" ON "boletos"("id_origen_cesion");
CREATE INDEX "boletos_estado_idx" ON "boletos"("estado");
CREATE INDEX "boletos_fecha_hora_venta_idx" ON "boletos"("fecha_hora_venta");
CREATE UNIQUE INDEX "boletos_id_sorteo_numero_jugado_serie_fraccion_key" ON "boletos"("id_sorteo", "numero_jugado", "serie", "fraccion");

-- 3) Los orígenes 'Venta importada' ya no sirven: sus boletos quedaron sin origen.
DELETE FROM "origenes" WHERE "tipo_origen" = 'Venta importada';

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
