DROP INDEX "cedidos_fecha_hora_cesion_idx";
ALTER TABLE "cedidos" RENAME TO "cedidos_legacy";

CREATE TABLE "cedidos" (
    "id_cedido" TEXT NOT NULL PRIMARY KEY,
    "id_boleto" TEXT,
    "id_sorteo" TEXT NOT NULL,
    "id_origen" TEXT NOT NULL,
    "numero_jugado" TEXT NOT NULL,
    "serie" TEXT NOT NULL,
    "fraccion" TEXT NOT NULL,
    "fecha_hora_cesion" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "precio_centimos" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "cedidos_id_boleto_fkey" FOREIGN KEY ("id_boleto") REFERENCES "boletos" ("id_boleto") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cedidos_id_sorteo_fkey" FOREIGN KEY ("id_sorteo") REFERENCES "sorteos" ("id_sorteo") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cedidos_id_origen_fkey" FOREIGN KEY ("id_origen") REFERENCES "origenes" ("id_origen") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "cedidos_fecha_hora_cesion_idx" ON "cedidos"("fecha_hora_cesion");
CREATE INDEX "cedidos_id_sorteo_numero_jugado_serie_fraccion_idx" ON "cedidos"("id_sorteo", "numero_jugado", "serie", "fraccion");
CREATE INDEX "cedidos_id_origen_idx" ON "cedidos"("id_origen");
CREATE UNIQUE INDEX "cedidos_id_origen_id_sorteo_numero_jugado_serie_fraccion_key" ON "cedidos"("id_origen", "id_sorteo", "numero_jugado", "serie", "fraccion");

INSERT INTO "cedidos" ("id_cedido", "id_boleto", "id_sorteo", "id_origen", "numero_jugado", "serie", "fraccion", "fecha_hora_cesion", "precio_centimos")
SELECT 'legacy-' || c."id_boleto", b."id_boleto", b."id_sorteo", b."id_origen", b."numero_jugado", b."serie", b."fraccion", c."fecha_hora_cesion", c."precio_centimos"
FROM "cedidos_legacy" c
JOIN "boletos" b ON b."id_boleto" = c."id_boleto";

DROP TABLE "cedidos_legacy";
