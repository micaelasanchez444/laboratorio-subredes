"use strict";

const resultadosPruebas = [];

function probar(nombre, funcion) {
  try {
    funcion();
    resultadosPruebas.push({ nombre, ok: true });
  } catch (problema) {
    resultadosPruebas.push({ nombre, ok: false, detalle: problema.message });
  }
}

function esperarIgual(obtenido, esperado) {
  if (obtenido !== esperado) {
    throw new Error(`se esperaba ${esperado} y dio ${obtenido}`);
  }
}

// Verifica que una entrada se rechace con un mensaje que contenga cierto texto
function esperarError(entrada, textoEsperado) {
  try {
    interpretarEntrada(entrada);
  } catch (problema) {
    if (!(problema instanceof ErrorEntrada)) throw problema;
    if (!problema.message.includes(textoEsperado)) {
      throw new Error(`mensaje inesperado: ${problema.message}`);
    }
    return;
  }
  throw new Error(`"${entrada}" se aceptó y tendría que rechazarse`);
}

function subredDe(entrada) {
  const { ipOctetos, prefijo } = interpretarEntrada(entrada);
  return calcularSubred(ipOctetos, prefijo);
}

// ----- Binario -----
const casosBinario = [[0, "00000000"], [10, "00001010"], [192, "11000000"], [255, "11111111"]];
for (const [numero, esperado] of casosBinario) {
  probar(`${numero} en binario`, () => esperarIgual(numeroABinario(numero), esperado));
}

// ----- Subredes con resultado conocido -----
const casosSubred = [
  { entrada: "192.168.1.10/24", mascara: "255.255.255.0", red: "192.168.1.0", broadcast: "192.168.1.255", primero: "192.168.1.1", ultimo: "192.168.1.254", hosts: 254 },
  { entrada: "192.168.1.130/26", mascara: "255.255.255.192", red: "192.168.1.128", broadcast: "192.168.1.191", primero: "192.168.1.129", ultimo: "192.168.1.190", hosts: 62 },
  { entrada: "172.16.5.4 255.255.240.0", mascara: "255.255.240.0", red: "172.16.0.0", broadcast: "172.16.15.255", primero: "172.16.0.1", ultimo: "172.16.15.254", hosts: 4094 },
  { entrada: "10.1.2.3/255.0.0.0", mascara: "255.0.0.0", red: "10.0.0.0", broadcast: "10.255.255.255", primero: "10.0.0.1", ultimo: "10.255.255.254", hosts: 16777214 },
  // Bordes: /30 es el último con broadcast; /31 y /32 no tienen
  { entrada: "10.0.0.5/30", mascara: "255.255.255.252", red: "10.0.0.4", broadcast: "10.0.0.7", primero: "10.0.0.5", ultimo: "10.0.0.6", hosts: 2 },
  { entrada: "10.0.0.5/31", mascara: "255.255.255.254", red: "10.0.0.4", broadcast: null, primero: "10.0.0.4", ultimo: "10.0.0.5", hosts: 2 },
  { entrada: "10.0.0.5/32", mascara: "255.255.255.255", red: "10.0.0.5", broadcast: null, primero: "10.0.0.5", ultimo: "10.0.0.5", hosts: 1 },
  // Bordes: /0 rompe si el desplazamiento no se trata aparte; /1 si se pierde el "sin signo"
  { entrada: "8.8.8.8/0", mascara: "0.0.0.0", red: "0.0.0.0", broadcast: "255.255.255.255", primero: "0.0.0.1", ultimo: "255.255.255.254", hosts: 4294967294 },
  { entrada: "200.1.1.1/1", mascara: "128.0.0.0", red: "128.0.0.0", broadcast: "255.255.255.255", primero: "128.0.0.1", ultimo: "255.255.255.254", hosts: 2147483646 },
];

for (const caso of casosSubred) {
  probar(`subred ${caso.entrada}`, () => {
    const s = subredDe(caso.entrada);
    esperarIgual(s.mascara, caso.mascara);
    esperarIgual(s.red, caso.red);
    esperarIgual(s.broadcast, caso.broadcast);
    esperarIgual(s.primerHost, caso.primero);
    esperarIgual(s.ultimoHost, caso.ultimo);
    esperarIgual(s.hosts, caso.hosts);
  });
}

// ----- Tipo de IP, incluidos los límites de cada rango -----
const casosTipo = [
  ["9.255.255.255", "Pública"],
  ["10.0.0.0", "Privada"],
  ["10.255.255.255", "Privada"],
  ["11.0.0.0", "Pública"],
  ["172.15.255.255", "Pública"],
  ["172.16.0.0", "Privada"],
  ["172.31.255.255", "Privada"],
  ["172.32.0.0", "Pública"],
  ["192.167.255.255", "Pública"],
  ["192.168.0.0", "Privada"],
  ["192.169.0.0", "Pública"],
  ["8.8.8.8", "Pública"],
  ["127.0.0.1", "Especial"],
  ["169.254.1.1", "Especial"],
  ["100.64.0.1", "Especial"],
  ["224.0.0.1", "Especial"],
  ["255.255.255.255", "Especial"],
];
for (const [ip, esperado] of casosTipo) {
  probar(`${ip} es ${esperado}`, () => {
    esperarIgual(tipoDeIP(textoAOctetos(ip, "La IP")).tipo, esperado);
  });
}

// ----- Clase histórica, en los límites -----
const casosClase = [[0, "A"], [127, "A"], [128, "B"], [191, "B"], [192, "C"], [223, "C"], [224, "D"], [239, "D"], [240, "E"], [255, "E"]];
for (const [octeto, esperada] of casosClase) {
  probar(`primer octeto ${octeto} es clase ${esperada}`, () => esperarIgual(claseDeIP(octeto), esperada));
}

// ----- Errores de entrada -----
const casosError = [
  ["", "Escribí una dirección"],
  ["192.168.1.10", "Falta la máscara"],
  ["192.168.1.256/24", "El octeto 256 no es válido, tiene que estar entre 0 y 255"],
  ["192.168.1/24", "4 octetos"],
  ["192.168.1.1.1/24", "4 octetos"],
  ["192.168..1/24", "El octeto \"\""],
  ["192.168.a.1/24", "El octeto \"a\""],
  ["192.168.01.1/24", "ceros a la izquierda"],
  ["192.168.1.1/33", "El prefijo /33"],
  ["192.168.1.1/abc", "El prefijo /abc"],
  ["192.168.1.1/-1", "El prefijo /-1"],
  ["192.168.1.1 255.0.255.0", "todos los unos"],
  ["192.168.1.1 255.255.255.256", "El octeto 256"],
  ["192.168.1.1/24/24", "solo una IP"],
];
for (const [entrada, texto] of casosError) {
  probar(`rechaza "${entrada}"`, () => esperarError(entrada, texto));
}

// ----- ¿Llega el paquete? -----
function analizar(a, b, gateway) {
  return analizarPaquete(
    interpretarEntrada(a),
    interpretarEntrada(b),
    gateway ? textoAOctetos(gateway, "El gateway") : null
  );
}

probar("AND de 192.168.1.130/26", () => {
  esperarIgual(octetosATexto(calcularRed([192, 168, 1, 130], 26)), "192.168.1.128");
});
probar("dirección de red reservada", () => esperarIgual(direccionReservada([192, 168, 1, 0], 24), "red"));
probar("dirección de broadcast reservada", () => esperarIgual(direccionReservada([192, 168, 1, 255], 24), "broadcast"));
probar("dirección de host no reservada", () => esperarIgual(direccionReservada([192, 168, 1, 1], 24), null));
probar("/31 no tiene direcciones reservadas", () => esperarIgual(direccionReservada([10, 0, 0, 4], 31), null));

const casosPaquete = [
  { nombre: "misma red", a: "192.168.1.10/24", b: "192.168.1.20/24", gateway: "", resultado: "directo", llega: true },
  { nombre: "misma red y gateway ajeno", a: "192.168.1.10/24", b: "192.168.1.20/24", gateway: "10.0.0.1", resultado: "directo", llega: true },
  { nombre: "otra red con gateway", a: "192.168.1.10/24", b: "192.168.2.20/24", gateway: "192.168.1.1", resultado: "gateway", llega: true },
  { nombre: "otra red sin gateway", a: "192.168.1.10/24", b: "192.168.2.20/24", gateway: "", resultado: "sin-gateway", llega: false },
  { nombre: "gateway fuera de la red", a: "192.168.1.10/24", b: "192.168.2.20/24", gateway: "10.0.0.1", resultado: "gateway-fuera", llega: false },
  { nombre: "gateway igual a PC A", a: "192.168.1.10/24", b: "192.168.2.20/24", gateway: "192.168.1.10", resultado: "gateway-invalido", llega: false },
  { nombre: "gateway dirección de red", a: "192.168.1.10/24", b: "192.168.2.20/24", gateway: "192.168.1.0", resultado: "gateway-invalido", llega: false },
  { nombre: "gateway dirección de broadcast", a: "192.168.1.10/24", b: "192.168.2.20/24", gateway: "192.168.1.255", resultado: "gateway-invalido", llega: false },
  { nombre: "misma IP", a: "192.168.1.10/24", b: "192.168.1.10/24", gateway: "", resultado: "misma-ip", llega: false },
  { nombre: "/26 separa redes con el mismo /24", a: "192.168.1.10/26", b: "192.168.1.100/26", gateway: "192.168.1.1", resultado: "gateway", llega: true },
  { nombre: "A decide con su propia máscara", a: "192.168.1.10/16", b: "192.168.2.20/24", gateway: "", resultado: "directo", llega: true },
  { nombre: "/31 en el mismo enlace", a: "10.0.0.4/31", b: "10.0.0.5/31", gateway: "", resultado: "directo", llega: true },
  { nombre: "/32 no alcanza a nadie directo", a: "10.0.0.4/32", b: "10.0.0.5/32", gateway: "", resultado: "sin-gateway", llega: false },
];
for (const caso of casosPaquete) {
  probar(`paquete: ${caso.nombre}`, () => {
    const analisis = analizar(caso.a, caso.b, caso.gateway);
    esperarIgual(analisis.resultado, caso.resultado);
    esperarIgual(analisis.llega, caso.llega);
  });
}

probar("paquete: máscaras distintas generan advertencia", () => {
  const analisis = analizar("192.168.1.10/16", "192.168.2.20/24", "");
  esperarIgual(analisis.advertencias.length, 1);
});
probar("paquete: máscaras iguales no generan advertencia", () => {
  esperarIgual(analizar("192.168.1.10/24", "192.168.1.20/24", "").advertencias.length, 0);
});
probar("paquete: destino con dirección de broadcast genera advertencia", () => {
  const analisis = analizar("192.168.1.10/24", "192.168.1.255/24", "");
  esperarIgual(analisis.advertencias.length, 1);
});
probar("paquete: red de B según su máscara y según la de A", () => {
  const analisis = analizar("192.168.1.10/16", "192.168.2.20/24", "");
  esperarIgual(analisis.redB, "192.168.2.0");
  esperarIgual(analisis.redBSegunA, "192.168.0.0");
});

// ----- Mostrar el resumen -----
const fallas = resultadosPruebas.filter((resultado) => !resultado.ok);
const resumen = `${resultadosPruebas.length - fallas.length} de ${resultadosPruebas.length} pruebas correctas`;

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("resumen-pruebas").textContent = resumen;
  const lista = document.getElementById("lista-pruebas");
  for (const resultado of resultadosPruebas) {
    const item = document.createElement("li");
    item.className = resultado.ok ? "prueba-ok" : "prueba-falla";
    item.textContent = resultado.ok ? resultado.nombre : `${resultado.nombre}: ${resultado.detalle}`;
    lista.append(item);
  }
});
