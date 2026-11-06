"use strict";

/* =====================================================================
   MOTOR: funciones puras. Reciben datos y devuelven datos; no tocan la
   pantalla, así se pueden probar por separado (ver pruebas.js).
   ===================================================================== */

// Error causado por lo que escribió la persona: su mensaje se puede mostrar en pantalla
class ErrorEntrada extends Error {}

// Pasa un número de 0 a 255 a un texto de 8 bits. Ej.: 10 -> "00001010"
function numeroABinario(numero) {
  return numero.toString(2).padStart(8, "0");
}

// Convierte "192.168.1.10" en [192, 168, 1, 10], o lanza un error claro
function textoAOctetos(texto, nombre) {
  const partes = texto.split(".");
  if (partes.length !== 4) {
    throw new ErrorEntrada(
      `${nombre} "${texto}" no es válida: tiene que tener 4 octetos separados por puntos.`
    );
  }
  return partes.map((parte) => {
    if (!/^\d+$/.test(parte)) {
      throw new ErrorEntrada(
        `El octeto "${parte}" no es válido: tiene que ser un número entero entre 0 y 255.`
      );
    }
    if (Number(parte) > 255) {
      throw new ErrorEntrada(
        `El octeto ${parte} no es válido, tiene que estar entre 0 y 255.`
      );
    }
    // "010" es ambiguo: algunos programas lo leen como octal (8) y otros como decimal (10)
    if (parte.length > 1 && parte.startsWith("0")) {
      throw new ErrorEntrada(
        `El octeto "${parte}" no es válido: escribilo sin ceros a la izquierda.`
      );
    }
    return Number(parte);
  });
}

// [192, 168, 1, 10] -> un único número de 32 bits, sin signo
function octetosANumero(octetos) {
  return octetos.reduce((acumulado, octeto) => acumulado * 256 + octeto, 0);
}

// Un número de 32 bits -> [192, 168, 1, 10]. ">>>" desplaza sin tener en cuenta el signo
function numeroAOctetos(numero) {
  return [numero >>> 24, (numero >>> 16) & 255, (numero >>> 8) & 255, numero & 255];
}

// [192, 168, 1, 10] -> "192.168.1.10"
function octetosATexto(octetos) {
  return octetos.join(".");
}

// 24 -> 255.255.255.0, como número de 32 bits
function prefijoAMascara(prefijo) {
  // JavaScript toma los desplazamientos módulo 32: "<< 32" equivaldría a "<< 0".
  // Por eso /0 se resuelve aparte.
  if (prefijo === 0) {
    return 0;
  }
  return (0xffffffff << (32 - prefijo)) >>> 0;
}

// [255, 255, 255, 0] -> 24. La máscara válida es una tira de unos seguida de ceros.
function mascaraAPrefijo(octetos) {
  const bits = octetos.map(numeroABinario).join("");
  if (!/^1*0*$/.test(bits)) {
    throw new ErrorEntrada(
      `La máscara ${octetosATexto(octetos)} no es válida: en binario, todos los unos tienen que estar antes que los ceros.`
    );
  }
  const primerCero = bits.indexOf("0");
  return primerCero === -1 ? 32 : primerCero;
}

// Lee el texto de la persona y devuelve { ipOctetos, prefijo }
function interpretarEntrada(texto) {
  const limpio = texto.trim();
  if (limpio === "") {
    throw new ErrorEntrada("Escribí una dirección IP con su máscara. Por ejemplo: 192.168.1.10/24.");
  }

  // Acepta "IP/24", "IP/255.255.255.0" e "IP 255.255.255.0"
  const partes = limpio.split(/\s*\/\s*|\s+/);
  if (partes.length === 1) {
    throw new ErrorEntrada("Falta la máscara. Agregala así: 192.168.1.10/24 o 192.168.1.10 255.255.255.0.");
  }
  if (partes.length > 2) {
    throw new ErrorEntrada("Escribí solo una IP y una máscara. Por ejemplo: 192.168.1.10/24.");
  }

  const [textoIP, textoMascara] = partes;
  const ipOctetos = textoAOctetos(textoIP, "La IP");

  if (textoMascara.includes(".")) {
    return { ipOctetos, prefijo: mascaraAPrefijo(textoAOctetos(textoMascara, "La máscara")) };
  }
  if (!/^\d+$/.test(textoMascara) || Number(textoMascara) > 32) {
    throw new ErrorEntrada(
      `El prefijo /${textoMascara} no es válido, tiene que ser un número entre 0 y 32.`
    );
  }
  return { ipOctetos, prefijo: Number(textoMascara) };
}

// La clase histórica depende solo del primer octeto
function claseDeIP(primerOcteto) {
  if (primerOcteto <= 127) return "A";
  if (primerOcteto <= 191) return "B";
  if (primerOcteto <= 223) return "C";
  if (primerOcteto <= 239) return "D";
  return "E";
}

// Rangos que no son públicos. RFC 1918 define los tres privados.
const RANGOS_ESPECIALES = [
  { red: [10, 0, 0, 0], prefijo: 8, tipo: "Privada", detalle: "Rango 10.0.0.0/8 de la RFC 1918." },
  { red: [172, 16, 0, 0], prefijo: 12, tipo: "Privada", detalle: "Rango 172.16.0.0/12 de la RFC 1918." },
  { red: [192, 168, 0, 0], prefijo: 16, tipo: "Privada", detalle: "Rango 192.168.0.0/16 de la RFC 1918." },
  { red: [0, 0, 0, 0], prefijo: 8, tipo: "Especial", detalle: "Rango 0.0.0.0/8: identifica \"esta red\"." },
  { red: [100, 64, 0, 0], prefijo: 10, tipo: "Especial", detalle: "Rango 100.64.0.0/10: NAT de operadores (CGNAT)." },
  { red: [127, 0, 0, 0], prefijo: 8, tipo: "Especial", detalle: "Rango 127.0.0.0/8: loopback, tu propia máquina." },
  { red: [169, 254, 0, 0], prefijo: 16, tipo: "Especial", detalle: "Rango 169.254.0.0/16: enlace local (APIPA)." },
  { red: [192, 0, 2, 0], prefijo: 24, tipo: "Especial", detalle: "Rango 192.0.2.0/24: reservado para documentación." },
  { red: [198, 51, 100, 0], prefijo: 24, tipo: "Especial", detalle: "Rango 198.51.100.0/24: reservado para documentación." },
  { red: [203, 0, 113, 0], prefijo: 24, tipo: "Especial", detalle: "Rango 203.0.113.0/24: reservado para documentación." },
  { red: [224, 0, 0, 0], prefijo: 4, tipo: "Especial", detalle: "Rango 224.0.0.0/4: multicast." },
  { red: [240, 0, 0, 0], prefijo: 4, tipo: "Especial", detalle: "Rango 240.0.0.0/4: reservado." },
];

// Devuelve { tipo, detalle } según el rango al que pertenece la IP
function tipoDeIP(ipOctetos) {
  const ip = octetosANumero(ipOctetos);
  for (const rango of RANGOS_ESPECIALES) {
    const mascara = prefijoAMascara(rango.prefijo);
    if ((ip & mascara) >>> 0 === octetosANumero(rango.red)) {
      return { tipo: rango.tipo, detalle: rango.detalle };
    }
  }
  return { tipo: "Pública", detalle: "No está en los rangos privados ni en los reservados." };
}

// Hace todas las cuentas de la subred. broadcast es null en /31 y /32, que no tienen.
function calcularSubred(ipOctetos, prefijo) {
  const ip = octetosANumero(ipOctetos);
  const mascara = prefijoAMascara(prefijo);
  // ">>> 0" vuelve a sin signo: los operadores de bits de JS devuelven enteros con signo
  const red = (ip & mascara) >>> 0;
  const ultima = (red | ~mascara) >>> 0;
  const esPuntoAPunto = prefijo === 31; // RFC 3021: las dos direcciones se usan como hosts
  const esHostUnico = prefijo === 32;

  let hosts = 2 ** (32 - prefijo) - 2;
  if (esPuntoAPunto) hosts = 2;
  if (esHostUnico) hosts = 1;

  const sinBroadcast = esPuntoAPunto || esHostUnico;
  return {
    ip: octetosATexto(ipOctetos),
    ipOctetos,
    prefijo,
    bitsHost: 32 - prefijo,
    mascara: octetosATexto(numeroAOctetos(mascara)),
    mascaraOctetos: numeroAOctetos(mascara),
    red: octetosATexto(numeroAOctetos(red)),
    broadcast: sinBroadcast ? null : octetosATexto(numeroAOctetos(ultima)),
    primerHost: octetosATexto(numeroAOctetos(sinBroadcast ? red : red + 1)),
    ultimoHost: octetosATexto(numeroAOctetos(sinBroadcast ? ultima : ultima - 1)),
    hosts,
    clase: claseDeIP(ipOctetos[0]),
    tipo: tipoDeIP(ipOctetos),
  };
}

// Devuelve los octetos de la red: IP AND máscara, bit a bit
function calcularRed(ipOctetos, prefijo) {
  const mascara = numeroAOctetos(prefijoAMascara(prefijo));
  return ipOctetos.map((octeto, i) => octeto & mascara[i]);
}

// Dice si la IP es la dirección de "red" o de "broadcast" de su subred; null si es de host.
// En /31 y /32 no hay direcciones reservadas.
function direccionReservada(ipOctetos, prefijo) {
  if (prefijo >= 31) return null;
  const s = calcularSubred(ipOctetos, prefijo);
  if (s.ip === s.red) return "red";
  if (s.ip === s.broadcast) return "broadcast";
  return null;
}

function mismaRed(unaIP, otraIP, prefijo) {
  return octetosATexto(calcularRed(unaIP, prefijo)) === octetosATexto(calcularRed(otraIP, prefijo));
}

// Decide qué hace PC A para mandarle un paquete a PC B. Quien envía compara usando SU máscara.
// a y b son { ipOctetos, prefijo }; gatewayOctetos es el gateway de PC A, o null si no tiene.
function analizarPaquete(a, b, gatewayOctetos) {
  const ipA = octetosATexto(a.ipOctetos);
  const ipB = octetosATexto(b.ipOctetos);
  const redA = octetosATexto(calcularRed(a.ipOctetos, a.prefijo));
  const redB = octetosATexto(calcularRed(b.ipOctetos, b.prefijo));
  const redBSegunA = octetosATexto(calcularRed(b.ipOctetos, a.prefijo));
  const directoSegunA = redA === redBSegunA;
  const directoSegunB = mismaRed(a.ipOctetos, b.ipOctetos, b.prefijo);

  const advertencias = [];
  for (const [nombre, equipo] of [["PC A", a], ["PC B", b]]) {
    const reservada = direccionReservada(equipo.ipOctetos, equipo.prefijo);
    if (reservada) {
      advertencias.push(
        `La IP de ${nombre} es la dirección de ${reservada} de su subred: no se le puede asignar a un equipo.`
      );
    }
  }
  if (directoSegunA && !directoSegunB) {
    advertencias.push(
      `Con su máscara /${b.prefijo}, PC B cree que PC A está en otra red: la respuesta la mandaría a su gateway y podría no volver.`
    );
  }
  if (!directoSegunA && directoSegunB) {
    advertencias.push(
      `Con su máscara /${b.prefijo}, PC B cree que PC A está en su misma red: las máscaras no coinciden, así que la respuesta iría por otro camino.`
    );
  }

  const base = { ipA, ipB, redA, redB, redBSegunA, prefijoA: a.prefijo, directoSegunA, advertencias };

  if (ipA === ipB) {
    return {
      ...base,
      resultado: "misma-ip",
      llega: false,
      titulo: "Conflicto de IP",
      explicacion: `PC A y PC B tienen la misma IP (${ipA}). Cada equipo de una red necesita una dirección propia.`,
    };
  }

  if (directoSegunA) {
    return {
      ...base,
      resultado: "directo",
      llega: true,
      titulo: "Misma red: va directo",
      explicacion: `Para PC A, la IP ${ipB} está en su red ${redA}/${a.prefijo}. El paquete va directo por el switch, sin pasar por el router.`,
    };
  }

  const otraRed = `Para PC A, la IP ${ipB} está fuera de su red ${redA}/${a.prefijo}, así que necesita a su gateway.`;

  if (gatewayOctetos === null) {
    return {
      ...base,
      resultado: "sin-gateway",
      llega: false,
      titulo: "No llegaría: falta el gateway",
      explicacion: `${otraRed} Como no tiene ninguno configurado, no sabe a quién entregarle el paquete y lo descarta.`,
    };
  }

  const gateway = octetosATexto(gatewayOctetos);

  if (!mismaRed(gatewayOctetos, a.ipOctetos, a.prefijo)) {
    return {
      ...base,
      gateway,
      resultado: "gateway-fuera",
      llega: false,
      titulo: "No llegaría: gateway fuera de la red",
      explicacion: `${otraRed} Pero el gateway ${gateway} también está fuera de esa red, y PC A solo le puede entregar tramas directamente a equipos de su propia red.`,
    };
  }

  if (gateway === ipA) {
    return {
      ...base,
      gateway,
      resultado: "gateway-invalido",
      llega: false,
      titulo: "No llegaría: el gateway es PC A",
      explicacion: `${otraRed} Pero tiene configurada su propia IP (${gateway}) como gateway, así que el paquete no sale hacia ningún router.`,
    };
  }

  const gatewayReservado = direccionReservada(gatewayOctetos, a.prefijo);
  if (gatewayReservado) {
    return {
      ...base,
      gateway,
      resultado: "gateway-invalido",
      llega: false,
      titulo: "No llegaría: gateway inválido",
      explicacion: `${otraRed} Pero ${gateway} es la dirección de ${gatewayReservado} de esa red, no la de un router.`,
    };
  }

  return {
    ...base,
    gateway,
    resultado: "gateway",
    llega: true,
    titulo: "Otra red: va al gateway",
    explicacion: `${otraRed} Le entrega el paquete al router ${gateway} por el switch. Desde ahí llega a PC B si el router tiene una ruta hacia esa red.`,
  };
}

// ----- Mapa de subredes -----

const MAXIMO_SUBREDES = 256;

// Prefijo más largo cuyo bloque alcanza para esos hosts, reservando red y broadcast.
// Por eso, el bloque más chico es /30: los /31 son para enlaces punto a punto.
function prefijoParaHosts(hosts) {
  let bitsHost = 2;
  while (2 ** bitsHost - 2 < hosts) bitsHost++;
  return 32 - bitsHost;
}

// Datos de un bloque del mapa. redNumero es la dirección de red como número de 32 bits.
function crearBloque(redNumero, prefijo, extra = {}) {
  return {
    ...calcularSubred(numeroAOctetos(redNumero), prefijo),
    redNumero,
    tamano: 2 ** (32 - prefijo),
    clave: `${octetosATexto(numeroAOctetos(redNumero))}/${prefijo}`,
    libre: false,
    ...extra,
  };
}

function crearBloquesIguales(redBase, prefijoNuevo, cantidad) {
  const tamano = 2 ** (32 - prefijoNuevo);
  return Array.from({ length: cantidad }, (_, i) => crearBloque(redBase + i * tamano, prefijoNuevo));
}

// Divide la red en la menor potencia de 2 de subredes iguales que cubra lo pedido
function dividirEnN(ipOctetos, prefijoBase, pedidas) {
  if (!Number.isInteger(pedidas) || pedidas < 1) {
    throw new ErrorEntrada("La cantidad de subredes tiene que ser un número entero mayor que 0.");
  }
  if (pedidas > MAXIMO_SUBREDES) {
    throw new ErrorEntrada(`El mapa dibuja hasta ${MAXIMO_SUBREDES} subredes: pediste ${pedidas}.`);
  }
  let bitsPrestados = 0;
  while (2 ** bitsPrestados < pedidas) bitsPrestados++;
  const prefijoNuevo = prefijoBase + bitsPrestados;
  if (prefijoNuevo > 32) {
    throw new ErrorEntrada(
      `Una red /${prefijoBase} no alcanza para ${pedidas} subredes: necesitaría ${bitsPrestados} bits prestados y solo tiene ${32 - prefijoBase} de host.`
    );
  }
  const redBase = octetosANumero(calcularRed(ipOctetos, prefijoBase));
  return {
    bitsPrestados,
    prefijoNuevo,
    bloques: crearBloquesIguales(redBase, prefijoNuevo, 2 ** bitsPrestados),
  };
}

// Divide la red en todas las subredes iguales del menor tamaño que alcance para esos hosts
function dividirPorHosts(ipOctetos, prefijoBase, hosts) {
  if (!Number.isInteger(hosts) || hosts < 1) {
    throw new ErrorEntrada("La cantidad de hosts tiene que ser un número entero mayor que 0.");
  }
  const prefijoNuevo = prefijoParaHosts(hosts);
  if (prefijoNuevo < prefijoBase) {
    throw new ErrorEntrada(
      `Una red /${prefijoBase} no alcanza para ${hosts.toLocaleString("es-AR")} hosts en una sola subred.`
    );
  }
  const bitsPrestados = prefijoNuevo - prefijoBase;
  const cantidad = 2 ** bitsPrestados;
  if (cantidad > MAXIMO_SUBREDES) {
    throw new ErrorEntrada(
      `Saldrían ${cantidad.toLocaleString("es-AR")} subredes y el mapa dibuja hasta ${MAXIMO_SUBREDES}. Probá con más hosts o una red más chica.`
    );
  }
  const redBase = octetosANumero(calcularRed(ipOctetos, prefijoBase));
  return { bitsPrestados, prefijoNuevo, bloques: crearBloquesIguales(redBase, prefijoNuevo, cantidad) };
}

// VLSM: asigna un bloque a medida por cada pedido, de mayor a menor, y marca lo que sobra como libre.
// Al ir de mayor a menor, cada bloque queda alineado a su tamaño sin dejar huecos.
function asignarVLSM(ipOctetos, prefijoBase, listaHosts) {
  const redBase = octetosANumero(calcularRed(ipOctetos, prefijoBase));
  const fin = redBase + 2 ** (32 - prefijoBase);
  const pedidos = listaHosts
    .map((hosts, indicePedido) => ({ hosts, indicePedido }))
    .sort((x, y) => y.hosts - x.hosts);

  const bloques = [];
  let cursor = redBase;
  for (const { hosts, indicePedido } of pedidos) {
    const prefijo = prefijoParaHosts(hosts);
    const tamano = 2 ** (32 - prefijo);
    if (prefijo < prefijoBase || cursor + tamano > fin) {
      throw new ErrorEntrada(
        `Esos pedidos no entran en una red /${prefijoBase}: no queda lugar para ${hosts.toLocaleString("es-AR")} hosts.`
      );
    }
    bloques.push(crearBloque(cursor, prefijo, { pedidos: hosts, indicePedido }));
    cursor += tamano;
  }

  // Lo que sobra se parte en los bloques alineados más grandes posibles
  while (cursor < fin) {
    let prefijo = prefijoBase;
    while (cursor % 2 ** (32 - prefijo) !== 0 || cursor + 2 ** (32 - prefijo) > fin) prefijo++;
    bloques.push(crearBloque(cursor, prefijo, { libre: true }));
    cursor += 2 ** (32 - prefijo);
  }
  return { bloques };
}

// Lee "100, 50 20" como [100, 50, 20]
function leerListaHosts(texto) {
  const partes = texto.split(/[,;\s]+/).filter((parte) => parte !== "");
  if (partes.length === 0) {
    throw new ErrorEntrada("Escribí una cantidad de hosts o una lista, como 100, 50, 20.");
  }
  if (partes.length > MAXIMO_SUBREDES) {
    throw new ErrorEntrada(`El mapa dibuja hasta ${MAXIMO_SUBREDES} subredes: pediste ${partes.length}.`);
  }
  return partes.map((parte) => {
    if (!/^\d+$/.test(parte) || Number(parte) < 1) {
      throw new ErrorEntrada(`"${parte}" no es una cantidad válida: tiene que ser un número entero mayor que 0.`);
    }
    return Number(parte);
  });
}

// Ubica cada bloque en un plano de 1 x 1, partiendo el espacio a la mitad como se parte una red:
// cada bit más de prefijo es un corte más. El área de cada bloque es proporcional a sus direcciones.
function calcularPlano(bloques, prefijoBase) {
  const porClave = new Map(bloques.map((bloque) => [`${bloque.redNumero}/${bloque.prefijo}`, bloque]));
  const ubicados = [];

  function ubicar(inicio, prefijo, x, y, ancho, alto, cortarAncho) {
    const bloque = porClave.get(`${inicio}/${prefijo}`);
    if (bloque) {
      ubicados.push({ bloque, x, y, ancho, alto });
      return;
    }
    if (prefijo >= 32) throw new Error("Los bloques no cubren toda la red");
    const mitad = 2 ** (31 - prefijo);
    if (cortarAncho) {
      ubicar(inicio, prefijo + 1, x, y, ancho / 2, alto, false);
      ubicar(inicio + mitad, prefijo + 1, x + ancho / 2, y, ancho / 2, alto, false);
    } else {
      ubicar(inicio, prefijo + 1, x, y, ancho, alto / 2, true);
      ubicar(inicio + mitad, prefijo + 1, x, y + alto / 2, ancho, alto / 2, true);
    }
  }

  const redBase = Math.min(...bloques.map((bloque) => bloque.redNumero));
  ubicar(redBase, prefijoBase, 0, 0, 1, 1, true);
  return ubicados;
}

// ----- Modo práctica -----

const TIPOS_EJERCICIO = ["red", "broadcast", "hosts", "misma-red"];

// Entero al azar entre min y max, incluidos. azar devuelve un número en [0, 1), como Math.random.
function enteroAzar(min, max, azar) {
  return min + Math.floor(azar() * (max - min + 1));
}

// Elige una subred de tamaño razonable, con primer octeto de clase A, B o C y sin loopback
function subredAzar(azar) {
  const prefijo = enteroAzar(8, 30, azar);
  let primerOcteto = enteroAzar(1, 223, azar);
  if (primerOcteto === 127) primerOcteto = 128;
  const numero = octetosANumero([
    primerOcteto,
    enteroAzar(0, 255, azar),
    enteroAzar(0, 255, azar),
    enteroAzar(0, 255, azar),
  ]);
  const red = (numero & prefijoAMascara(prefijo)) >>> 0;
  return { prefijo, red, tamano: 2 ** (32 - prefijo) };
}

// Elige una dirección de host al azar: ni la de red ni la de broadcast
function hostAzar(red, tamano, azar) {
  return red + enteroAzar(1, tamano - 2, azar);
}

function generarEjercicio(tipoPedido, azar = Math.random) {
  const tipo = tipoPedido === "todos" ? TIPOS_EJERCICIO[enteroAzar(0, 3, azar)] : tipoPedido;
  const { prefijo, red, tamano } = subredAzar(azar);
  const ipNumero = hostAzar(red, tamano, azar);
  const ipOctetos = numeroAOctetos(ipNumero);
  const ip = octetosATexto(ipOctetos);
  const subred = calcularSubred(ipOctetos, prefijo);
  const base = { tipo, ip, ipOctetos, prefijo, mascara: subred.mascara, subred };

  if (tipo === "red") {
    return { ...base, enunciado: `¿Cuál es la dirección de red de ${ip}/${prefijo}?`, respuesta: subred.red };
  }
  if (tipo === "broadcast") {
    return { ...base, enunciado: `¿Cuál es la dirección de broadcast de ${ip}/${prefijo}?`, respuesta: subred.broadcast };
  }
  if (tipo === "hosts") {
    return {
      ...base,
      enunciado: `¿Cuántos hosts utilizables tiene una subred con máscara ${subred.mascara}?`,
      respuesta: String(subred.hosts),
    };
  }

  // ¿Misma red? La otra IP sale de la misma subred o de una vecina, para que sea difícil a simple vista
  const iguales = azar() < 0.5;
  let otraNumero;
  if (iguales) {
    // Sumar un desplazamiento dentro de los hosts garantiza que sea otra dirección
    const hosts = tamano - 2;
    const desplazamiento = ipNumero - red;
    otraNumero = red + 1 + ((desplazamiento - 1 + enteroAzar(1, hosts - 1, azar)) % hosts);
  } else {
    const vecina = red + tamano < 2 ** 32 ? red + tamano : red - tamano;
    otraNumero = hostAzar(vecina, tamano, azar);
  }
  const otraOctetos = numeroAOctetos(otraNumero);
  const otraIP = octetosATexto(otraOctetos);
  return {
    ...base,
    otraIP,
    otraOctetos,
    enunciado: `Con máscara /${prefijo}, ¿${ip} y ${otraIP} están en la misma red?`,
    respuesta: iguales ? "si" : "no",
  };
}

// Explica paso a paso cómo se resuelve. Se muestra siempre, también al acertar.
function explicarEjercicio(ej) {
  const { subred, prefijo } = ej;
  if (ej.tipo === "hosts") {
    return `La máscara ${subred.mascara} es un /${prefijo}, que deja ${subred.bitsHost} bits de host: 2^${subred.bitsHost} − 2 = ${subred.hosts.toLocaleString("es-AR")}. Se restan la dirección de red y la de broadcast.`;
  }
  if (ej.tipo === "misma-red") {
    const redUna = octetosATexto(calcularRed(ej.ipOctetos, prefijo));
    const redOtra = octetosATexto(calcularRed(ej.otraOctetos, prefijo));
    return redUna === redOtra
      ? `Con /${prefijo}, las dos IP dan la misma red: ${redUna}.`
      : `Con /${prefijo}, ${ej.ip} está en la red ${redUna} y ${ej.otraIP} está en la red ${redOtra}.`;
  }

  // Red y broadcast: se resuelven con el salto del primer octeto que no es 255 en la máscara
  const mascara = subred.mascaraOctetos;
  const indice = mascara.findIndex((octeto) => octeto !== 255);
  const salto = 256 - mascara[indice];
  const valor = ej.ipOctetos[indice];
  const inicio = Math.floor(valor / salto) * salto;
  const fin = inicio + salto - 1;
  const introduccion = `Con /${prefijo}, la máscara es ${subred.mascara}. En el octeto ${indice + 1}, el salto es 256 − ${mascara[indice]} = ${salto}, así que el ${valor} cae en el bloque de ${inicio} a ${fin}.`;
  const hayOctetosDespues = indice < 3;
  if (ej.tipo === "red") {
    const resto = hayOctetosDespues ? " Los octetos siguientes quedan en 0." : "";
    return `${introduccion}${resto} La red es ${subred.red}.`;
  }
  const resto = hayOctetosDespues ? " Los octetos siguientes quedan en 255." : "";
  return `${introduccion}${resto} El broadcast es ${subred.broadcast}.`;
}

// Busca qué confusión explica una respuesta incorrecta de red o broadcast
function diagnosticarDireccion(ej, respuesta, octetos) {
  const { subred } = ej;
  const nombreEsperado = ej.tipo === "red" ? "la dirección de red" : "el broadcast";
  if (respuesta === subred.broadcast) return "Esa es la dirección de broadcast: tiene los bits de host en 1. La de red los tiene en 0.";
  if (respuesta === subred.red) return "Esa es la dirección de red: tiene los bits de host en 0. El broadcast los tiene en 1.";
  if (respuesta === ej.ip) return `Esa es la IP original: para sacar ${nombreEsperado} hay que cambiar sus bits de host.`;
  if (respuesta === subred.primerHost) return `Ese es el primer host, no ${nombreEsperado}.`;
  if (respuesta === subred.ultimoHost) return `Ese es el último host, no ${nombreEsperado}.`;
  const correctos = ej.respuesta.split(".").map(Number);
  const distinto = octetos.findIndex((octeto, i) => octeto !== correctos[i]);
  return `El octeto ${distinto + 1} no da: pusiste ${octetos[distinto]} y es ${correctos[distinto]}.`;
}

function diagnosticarHosts(ej, cantidad) {
  const total = 2 ** ej.subred.bitsHost;
  if (cantidad === total) return "Ese es el total de direcciones: te faltó restar la de red y la de broadcast.";
  if (cantidad === total - 1) return "Restaste 1, pero hay que restar 2: la dirección de red y la de broadcast.";
  return `Con ${ej.subred.bitsHost} bits de host, el cálculo es 2^${ej.subred.bitsHost} − 2.`;
}

// Corrige una respuesta. valida es false si no se entiende: en ese caso no cuenta como intento.
function corregirEjercicio(ej, respuestaTexto) {
  const texto = respuestaTexto.trim();
  const explicacion = explicarEjercicio(ej);

  if (ej.tipo === "misma-red") {
    const correcta = texto === ej.respuesta;
    return {
      valida: true,
      correcta,
      diagnostico: correcta ? "" : `La respuesta es "${ej.respuesta === "si" ? "sí" : "no"}".`,
      explicacion,
    };
  }

  if (texto === "") {
    return { valida: false, mensaje: "Escribí una respuesta antes de corregir." };
  }

  if (ej.tipo === "hosts") {
    // Acepta "1.022" como separador de miles
    const limpio = /^\d{1,3}(\.\d{3})+$/.test(texto) ? texto.replaceAll(".", "") : texto;
    if (!/^\d+$/.test(limpio)) {
      return { valida: false, mensaje: "Respondé con un número entero, como 62." };
    }
    const cantidad = Number(limpio);
    const correcta = cantidad === ej.subred.hosts;
    return { valida: true, correcta, diagnostico: correcta ? "" : diagnosticarHosts(ej, cantidad), explicacion };
  }

  // También acepta la dirección con su prefijo, como 192.168.1.128/26
  const direccion = texto.replace(/\/\d+$/, "");
  let octetos;
  try {
    octetos = textoAOctetos(direccion, "La respuesta");
  } catch (problema) {
    if (!(problema instanceof ErrorEntrada)) throw problema;
    return { valida: false, mensaje: problema.message };
  }
  const respuesta = octetosATexto(octetos);
  const correcta = respuesta === ej.respuesta;
  return {
    valida: true,
    correcta,
    diagnostico: correcta ? "" : diagnosticarDireccion(ej, respuesta, octetos),
    explicacion,
  };
}

function puntajeInicial() {
  return { aciertos: 0, intentos: 0, racha: 0, mejorRacha: 0 };
}

function actualizarPuntaje(puntaje, correcta) {
  const racha = correcta ? puntaje.racha + 1 : 0;
  return {
    aciertos: puntaje.aciertos + (correcta ? 1 : 0),
    intentos: puntaje.intentos + 1,
    racha,
    mejorRacha: Math.max(puntaje.mejorRacha, racha),
  };
}
