-- Reconstruye el código de barras de los boletos que no se han leído con el escáner.
--
-- Hasta ahora `codigo_barras_raw` guardaba `PDF:<albarán>` (o `SERIE:<código>`) en los boletos que venían de un
-- albarán. Pasa a guardar siempre el código de 20 caracteres sin el separador de la posición 11 (que solo está
-- impreso), construido con los datos del boleto y con los dígitos de control a 0000 mientras no se haya leído
-- con el escáner. Los códigos que ya son válidos (20 dígitos) no se tocan.
--
--   pos 1       tipo de juego              = primer carácter de id_sorteo
--   pos 2-4     número de sorteo           = a partir del 6.º carácter de id_sorteo, con 3 cifras
--   pos 5       último dígito del año      = 5.º carácter de id_sorteo
--   pos 6-7     fracción
--   pos 8-10    serie
--   (pos 11     separador «>»: no se incluye)
--   pos 12      dígito de relleno          = 0
--   pos 13-17   número jugado
--   pos 18-21   dígitos de control
UPDATE "boletos"
SET "codigo_barras_raw" =
    substr("id_sorteo", 1, 1)
    || substr('000' || substr("id_sorteo", 6), -3)
    || substr("id_sorteo", 5, 1)
    || substr('00' || "fraccion", -2)
    || substr('000' || "serie", -3)
    || '0'
    || substr('00000' || "numero_jugado", -5)
    || substr('0000' || "digitos_control", -4)
WHERE length("codigo_barras_raw") <> 20
   OR "codigo_barras_raw" GLOB '*[^0-9]*';
