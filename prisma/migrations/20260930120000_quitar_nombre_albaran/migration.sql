-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_origenes" (
    "id_origen" TEXT NOT NULL PRIMARY KEY,
    "id_sorteo" TEXT,
    "id_receptor_admin" TEXT,
    "tipo_origen" TEXT NOT NULL,
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
INSERT INTO "new_origenes" ("deleted_at", "fecha_emision", "fecha_hora_carga", "id_origen", "id_receptor_admin", "id_sorteo", "pdf_checksum", "pdf_path", "tipo_origen", "total_billetes", "total_numeros", "total_series") SELECT "deleted_at", "fecha_emision", "fecha_hora_carga", "id_origen", "id_receptor_admin", "id_sorteo", "pdf_checksum", "pdf_path", "tipo_origen", "total_billetes", "total_numeros", "total_series" FROM "origenes";
DROP TABLE "origenes";
ALTER TABLE "new_origenes" RENAME TO "origenes";
CREATE UNIQUE INDEX "origenes_pdf_checksum_key" ON "origenes"("pdf_checksum");
CREATE INDEX "origenes_id_sorteo_idx" ON "origenes"("id_sorteo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

