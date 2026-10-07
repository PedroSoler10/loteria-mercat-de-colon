# Código de barras de un décimo de Lotería Nacional

El código de barras impreso en un décimo no es un identificador aleatorio: es una cadena estructurada con la que los terminales de Loterías y Apuestas del Estado (SELAE) identifican de forma automática y segura la participación exacta. Este documento explica qué significa cada posición y cómo lo usa la aplicación.

La estructura se ha tomado del documento «Significado del Código de Barras de la Lotería de Navidad». Los ejemplos corresponden al Sorteo Extraordinario de Navidad de 2026.

## 21 posiciones impresas, 20 caracteres leídos

El código **impreso** tiene 21 posiciones. En la posición 11 hay un separador `>` que solo existe de forma gráfica en el boleto: **el escáner no lo lee**, así que el código leído tiene **20 caracteres**. La aplicación trabaja siempre con esos 20 caracteres y **nunca guarda el separador**.

| Posición impresa | Caracteres | Campo | Ejemplo | Significado |
| --- | --- | --- | --- | --- |
| 1 | 1 | Tipo de juego | `5` | `5` es la Lotería Nacional |
| 2–4 | 3 | Número de sorteo | `102` | Lugar del sorteo en el calendario anual de SELAE. En 2026 el `102` es el Extraordinario de Navidad (22 de diciembre) |
| 5 | 1 | Año de emisión | `6` | Último dígito del año (`6` = 2026) |
| 6–7 | 2 | Fracción | `05` | Qué décimo del billete (formado por 10) es: del `01` al `10` |
| 8–10 | 3 | Serie | `014` | Grupo de billetes al que pertenece. En Navidad 2026 hay 205 series (`001` a `205`) |
| **11** | – | **Separador** | `>` | **Solo impreso. No está en el código leído ni se guarda** |
| 12 | 1 | Relleno | `0` | Dígito de relleno estándar |
| 13–17 | 5 | Número jugado | `07333` | Combinación de cinco cifras (`00000` a `99999`) |
| 18–21 | 4 | Dígitos de control | `8940` | Dígitos de seguridad que genera el algoritmo criptográfico de SELAE |

Los dígitos de control validan la autenticidad del boleto y evitan falsificaciones manipulando el resto del código: si no coinciden con el algoritmo interno de SELAE, el terminal rechaza la lectura. **No se pueden calcular fuera de SELAE**, por lo que solo se conocen cuando el boleto se lee con el escáner.

### Ejemplo

| | Código |
| --- | --- |
| Impreso (21 posiciones) | `5102605014>0073338940` |
| Leído y guardado (20 caracteres) | `51026050140073338940` |

Se lee así: juego `5`, sorteo `102`, año `6`, fracción `05`, serie `014`, relleno `0`, número `07333`, control `8940`.

Con 20 caracteres, el escáner entrega las posiciones 1 a 10 seguidas de las posiciones 12 a 21; de ahí que el número jugado ocupe los caracteres 12 a 16 del código leído y los dígitos de control los 17 a 20.

## Cómo se guarda en la base de datos

| Columna de `boletos` | Parte del código | Notas |
| --- | --- | --- |
| `codigoBarrasRaw` | Los 20 caracteres | Sin separador, sin espacios. Es el código leído o, si el boleto nunca se ha escaneado, el construido |
| `numeroJugado` | Posiciones 13–17 | Texto de 5 cifras, para conservar los ceros iniciales |
| `serie` | Posiciones 8–10 | Texto de 3 cifras |
| `fraccion` | Posiciones 6–7 | Texto de 2 cifras |
| `digitosControl` | Posiciones 18–21 | `0000` mientras no se haya leído con el escáner |

El juego, el número de sorteo y el año no se guardan en el boleto: están en su sorteo (`idSorteo`). El identificador del sorteo se forma con el tipo de juego (1 cifra), el **año completo** (4 cifras) y el número de sorteo (3 cifras), por ejemplo `52026102`; en el código de barras, en cambio, solo viaja la última cifra del año.

## Cuándo se construye y cuándo se actualiza

Un boleto que viene de un albarán no trae código de barras: el PDF solo indica número, series y fracciones. Para que `codigoBarrasRaw` contenga siempre un código de 20 caracteres, la aplicación lo **construye** con los datos del boleto y los dígitos de control a `0000`. Cuando el boleto se lee con el escáner, se **actualizan** `digitosControl` y `codigoBarrasRaw` con lo leído.

| Situación | `codigoBarrasRaw` | `digitosControl` |
| --- | --- | --- |
| Alta desde un albarán de entrada | Construido | `0000` |
| Boleto cedido que aún no se ha recibido (albarán de cesión) | Construido | `0000` |
| Resto de fracciones de una serie vendida sin recibir (modo Serie del TPV) | Construido | `0000` |
| Alta manual sin lector | Construido con los dígitos indicados | Los indicados (`0000` por defecto) |
| Alta manual con lector | El leído | Los leídos |
| Venta en el TPV con el escáner | **Se actualiza** con el leído | **Se actualizan** con los leídos |
| Importación de un `.txt` de ventas | **Se actualiza** con el código de la línea | **Se actualizan** |

En una venta de serie completa, el código leído solo pertenece a una fracción: esa fracción guarda su código y sus dígitos de control reales; las demás conservan el código construido y `0000`.

Un boleto con `digitosControl` igual a `0000` tiene, por tanto, un código **construido**, no leído.

## Cómo lo trata el código

`lib/selae-barcode.ts`:

- `parseSelaeBarcode(texto)`: acepta los 20 caracteres leídos, o los 21 con el separador `>` (con o sin espacios), y devuelve cada campo más `codigo`, el código normalizado de 20 caracteres que se guarda. Rechaza cualquier otra longitud.
- `buildSelaeBarcode(datos)`: construye el código de 20 caracteres a partir del juego, el sorteo, el año, la fracción, la serie, el número y, opcionalmente, los dígitos de control.
- `buildSelaeBarcodeForSorteo(idSorteo, boleto)`: igual, tomando el juego, el año y el número de sorteo del `idSorteo`.

Los códigos que ya había en bases de datos anteriores (`PDF:<albarán>` o `SERIE:<código>`) se reconstruyen con la migración `20261007100000_construir_codigo_barras`. Los que ya tenían 20 dígitos no se modifican.
