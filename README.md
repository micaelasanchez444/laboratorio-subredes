# Laboratorio de Subredes

Laboratorio visual e interactivo para estudiar direccionamiento IPv4. Muestra los bits de red y de host de una dirección, junto con una explicación corta de cada resultado.

Todo se calcula en el navegador: no envía datos, no usa rastreadores ni carga recursos externos.

## Cómo usarlo

Abrí `index.html` en cualquier navegador. No hace falta instalar nada.

## Calculadora

Escribí la IP y la máscara en alguno de estos formatos:

- `192.168.1.10/24`
- `192.168.1.10 255.255.255.0`
- `192.168.1.10/255.255.255.0`

La calculadora muestra:

- La IP y la máscara en decimal y en binario, con los bits de red y de host diferenciados.
- La dirección de red y la de broadcast.
- El primer y el último host utilizable, y la cantidad de hosts utilizables.
- Si la IP es privada (RFC 1918), pública o de un rango especial, como loopback o multicast.
- Su clase histórica (A, B, C, D o E), como dato informativo.

| Prefijo | Hosts utilizables | Broadcast |
|---|---|---|
| Hasta /30 | 2^(bits de host) − 2 | Sí |
| /31 (enlace punto a punto, RFC 3021) | 2 | No tiene |
| /32 (una sola dirección) | 1 | No tiene |

## Máscara en vivo

Dentro de la calculadora, mové el deslizador de /0 a /32. Los resultados se actualizan al instante y la frontera entre los bits de red y de host se corre con una animación.

## ¿Llega el paquete?

Cargá la IP y la máscara de PC A y de PC B, y el gateway de PC A si tiene uno. Con **Paso anterior** y **Paso siguiente** recorrés la simulación:

1. La compuerta AND calcula la red de cada equipo, octeto por octeto y bit por bit.
2. PC A compara su red con la de PC B usando su propia máscara.
3. Una animación muestra el recorrido: directo por el switch, hacia el gateway, o por qué no llegaría.

## Archivos

| Archivo | Para qué sirve |
|---|---|
| `index.html` | La estructura de la página |
| `style.css` | El diseño, con modo claro y oscuro |
| `js/motor.js` | Las funciones de cálculo, sin código de pantalla |
| `js/ui.js` | Ayudas compartidas y el cambio de tema |
| `js/calculadora.js` | La pantalla de la calculadora |
| `js/paquete.js` | La simulación de ¿Llega el paquete? |
| `js/app.js` | La navegación y el arranque de la app |
| `pruebas.html` y `pruebas.js` | Las pruebas de los cálculos |

## Cómo correr las pruebas

Abrí `pruebas.html` en el navegador. Arriba aparece cuántas pruebas dieron bien y abajo, el detalle de cada una.
