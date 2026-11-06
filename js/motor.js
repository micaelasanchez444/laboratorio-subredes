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
