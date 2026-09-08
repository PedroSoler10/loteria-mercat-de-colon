-- CreateTable
CREATE TABLE "sorteos" (
    "id_sorteo" TEXT NOT NULL PRIMARY KEY,
    "tipo_juego" INTEGER NOT NULL,
    "ano_emision" INTEGER NOT NULL,
    "ano_completo" INTEGER NOT NULL,
    "numero_sorteo" INTEGER NOT NULL,
    "nombre_sorteo" TEXT NOT NULL,
    "precio_unitario_centimos" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "origenes" (
    "id_origen" TEXT NOT NULL PRIMARY KEY,
    "tipo_origen" TEXT NOT NULL,
    "nombre_albaran" TEXT NOT NULL,
    "fecha_hora_carga" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pdf_path" TEXT,
    "pdf_checksum" TEXT
);

-- CreateTable
CREATE TABLE "boletos" (
    "id_boleto" TEXT NOT NULL PRIMARY KEY,
    "id_sorteo" TEXT NOT NULL,
    "id_origen" TEXT NOT NULL,
    "numero_jugado" TEXT NOT NULL,
    "serie" TEXT NOT NULL,
    "fraccion" TEXT NOT NULL,
    "digitos_control" TEXT NOT NULL,
    "codigo_barras_raw" TEXT NOT NULL,
    "fecha_hora_registro" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "boletos_id_sorteo_fkey" FOREIGN KEY ("id_sorteo") REFERENCES "sorteos" ("id_sorteo") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "boletos_id_origen_fkey" FOREIGN KEY ("id_origen") REFERENCES "origenes" ("id_origen") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ventas" (
    "id_boleto" TEXT NOT NULL PRIMARY KEY,
    "fecha_hora_venta" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" TEXT NOT NULL DEFAULT 'activa',
    "fecha_hora_anulacion" DATETIME,
    "motivo_anulacion" TEXT,
    CONSTRAINT "ventas_id_boleto_fkey" FOREIGN KEY ("id_boleto") REFERENCES "boletos" ("id_boleto") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "sorteos_tipo_juego_ano_completo_numero_sorteo_key" ON "sorteos"("tipo_juego", "ano_completo", "numero_sorteo");

-- CreateIndex
CREATE UNIQUE INDEX "origenes_pdf_checksum_key" ON "origenes"("pdf_checksum");

-- CreateIndex
CREATE INDEX "boletos_id_sorteo_numero_jugado_idx" ON "boletos"("id_sorteo", "numero_jugado");

-- CreateIndex
CREATE INDEX "boletos_id_origen_idx" ON "boletos"("id_origen");

-- CreateIndex
CREATE UNIQUE INDEX "boletos_id_sorteo_numero_jugado_serie_fraccion_key" ON "boletos"("id_sorteo", "numero_jugado", "serie", "fraccion");

-- CreateIndex
CREATE INDEX "ventas_estado_fecha_hora_venta_idx" ON "ventas"("estado", "fecha_hora_venta");
