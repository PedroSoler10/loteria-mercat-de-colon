PRAGMA foreign_keys=OFF;

CREATE TABLE "new_origenes" (
    "id_origen" TEXT NOT NULL PRIMARY KEY,
    "id_sorteo" TEXT,
    "tipo_origen" TEXT NOT NULL,
    "nombre_albaran" TEXT NOT NULL,
    "fecha_hora_carga" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_emision" DATETIME,
    "total_numeros" INTEGER NOT NULL DEFAULT 0,
    "total_series" INTEGER NOT NULL DEFAULT 0,
    "total_billetes" INTEGER NOT NULL DEFAULT 0,
    "pdf_path" TEXT,
    "pdf_checksum" TEXT,
    "deleted_at" DATETIME,
    CONSTRAINT "origenes_id_sorteo_fkey" FOREIGN KEY ("id_sorteo") REFERENCES "sorteos" ("id_sorteo") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_origenes" (
    "id_origen", "id_sorteo", "tipo_origen", "nombre_albaran", "fecha_hora_carga", "fecha_emision",
    "total_numeros", "total_series", "total_billetes", "pdf_path", "pdf_checksum", "deleted_at"
)
SELECT
    o."id_origen",
    (SELECT b."id_sorteo" FROM "boletos" b WHERE b."id_origen" = o."id_origen" LIMIT 1),
    o."tipo_origen",
    o."nombre_albaran",
    o."fecha_hora_carga",
    o."fecha_hora_carga",
    (SELECT COUNT(DISTINCT b."numero_jugado") FROM "boletos" b WHERE b."id_origen" = o."id_origen"),
    (SELECT COUNT(DISTINCT b."numero_jugado" || ':' || b."serie") FROM "boletos" b WHERE b."id_origen" = o."id_origen"),
    (SELECT COUNT(*) FROM "boletos" b WHERE b."id_origen" = o."id_origen"),
    o."pdf_path",
    o."pdf_checksum",
    o."deleted_at"
FROM "origenes" o;

DROP TABLE "origenes";
ALTER TABLE "new_origenes" RENAME TO "origenes";
CREATE UNIQUE INDEX "origenes_pdf_checksum_key" ON "origenes"("pdf_checksum");
CREATE INDEX "origenes_id_sorteo_idx" ON "origenes"("id_sorteo");

PRAGMA foreign_keys=ON;
