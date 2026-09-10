CREATE TABLE "cedidos" (
    "id_boleto" TEXT NOT NULL PRIMARY KEY,
    "fecha_hora_cesion" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "precio_centimos" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "cedidos_id_boleto_fkey" FOREIGN KEY ("id_boleto") REFERENCES "boletos" ("id_boleto") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "cedidos_fecha_hora_cesion_idx" ON "cedidos"("fecha_hora_cesion");

INSERT INTO "cedidos" ("id_boleto", "fecha_hora_cesion", "precio_centimos")
SELECT v."id_boleto", v."fecha_hora_venta", 0
FROM "ventas" v
JOIN "boletos" b ON b."id_boleto" = v."id_boleto"
JOIN "origenes" o ON o."id_origen" = b."id_origen"
WHERE o."tipo_origen" = 'Cesión de Consignación' AND v."estado" = 'activa';

DELETE FROM "ventas"
WHERE "id_boleto" IN (SELECT "id_boleto" FROM "cedidos");
