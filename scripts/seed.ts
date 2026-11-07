import { loadEnvConfig } from "@next/env";
import { inArray, sql } from "drizzle-orm";

import { createDb, type Db } from "@/db/client";
import { esBaseLocal } from "@/db/local";
import { asignaciones, compradores, movimientos, organizadores, pedidos } from "@/db/schema";
import {
  apartarNumeros,
  confirmarPago,
  liberarAsignaciones,
  type Asignacion,
} from "@/server/asignaciones";
import { crearAuth } from "@/server/auth-config";
import { crearRifa } from "@/server/rifas";
import { crearUsuario } from "@/server/usuarios";

loadEnvConfig(process.cwd());

// Datos de demostración: siempre los mismos (generador con semilla fija) para que el demo sea repetible.
const NOMBRES = [
  "Ana", "Luis", "María", "José", "Carmen", "Jorge", "Laura", "Miguel", "Sofía", "Carlos",
  "Fernanda", "Ricardo", "Daniela", "Alejandro", "Patricia", "Juan", "Gabriela", "Roberto",
  "Verónica", "Eduardo", "Mónica", "Francisco", "Adriana", "Raúl", "Claudia", "Sergio",
];
const APELLIDOS = [
  "García", "Hernández", "López", "Martínez", "González", "Pérez", "Rodríguez", "Sánchez",
  "Ramírez", "Cruz", "Flores", "Gómez", "Morales", "Vázquez", "Reyes", "Jiménez", "Torres",
];

type Metas = { vendidos: number; apartados: number; vencidos: number; liberados: number };

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Falta DATABASE_URL. Copia .env.example como .env.");
  }

  // El seed borra todo y crea datos de prueba: nunca debe correr contra la base de la nube por accidente.
  const host = new URL(url).hostname;
  if (!esBaseLocal(url) && process.env.ALLOW_REMOTE_SEED !== "true") {
    throw new Error(
      `DATABASE_URL apunta a "${host}", que no es local. ` +
        "Si de verdad quieres sembrar esa base, ejecuta con ALLOW_REMOTE_SEED=true.",
    );
  }

  const db = createDb(url);
  try {
    console.log(`Sembrando ${host} (se reemplazan todos los datos)…`);
    await db.execute(
      sql`truncate movimientos, premios, asignaciones, pedidos, numeros, compradores, rifas,
          intentos_publicos, sesiones, cuentas, verificaciones, limites_de_solicitudes, usuarios,
          organizadores restart identity cascade`,
    );

    const azar = generadorConSemilla(20261026);
    const [organizador] = await db
      .insert(organizadores)
      .values({ nombre: "Organizador demo" })
      .returning();

    // Credenciales de desarrollo definidas en .env (ver .env.example).
    const auth = crearAuth(db);
    const admin = await crearUsuario(auth, {
      email: process.env.SEED_ADMIN_EMAIL ?? "admin@perindio.test",
      nombre: process.env.SEED_ADMIN_NOMBRE ?? "Administrador demo",
      password: requerida("SEED_ADMIN_PASSWORD"),
      rol: "admin",
      organizadorId: organizador.id,
    });
    const operador = process.env.SEED_OPERADOR_PASSWORD
      ? await crearUsuario(auth, {
          email: process.env.SEED_OPERADOR_EMAIL ?? "operador@perindio.test",
          nombre: process.env.SEED_OPERADOR_NOMBRE ?? "Operador demo",
          password: process.env.SEED_OPERADOR_PASSWORD,
          rol: "operador",
          organizadorId: organizador.id,
        })
      : null;

    const nuevos = Array.from({ length: 60 }, (_, i) => ({
      organizadorId: organizador.id,
      nombre: `${azar.elegir(NOMBRES)} ${azar.elegir(APELLIDOS)} ${azar.elegir(APELLIDOS)}`,
      telefono: i % 2 === 0 ? `55 0000 ${String(i).padStart(4, "0")}` : null,
    }));
    const compradorIds = (
      await db.insert(compradores).values(nuevos).returning({ id: compradores.id })
    ).map((c) => c.id);

    const principal = await crearRifa(db, {
      organizadorId: organizador.id,
      nombre: "Rifa Pro Fondos 2026",
      slug: "pro-fondos-2026",
      publica: true,
      descripcion: "Rifa de demostración con 2,000 números.",
      cantidadNumeros: 2000,
      precioNumero: "100.00",
      plazoApartadoHoras: 48,
      liberacionAutomatica: false,
      fechaSorteo: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10),
    });
    await poblarRifa(db, azar, principal, compradorIds, admin.id, {
      vendidos: 380,
      apartados: 140,
      vencidos: 18,
      liberados: 12,
    });

    const express = await crearRifa(db, {
      organizadorId: organizador.id,
      nombre: "Rifa Express",
      slug: "rifa-express",
      publica: true,
      descripcion: "Rifa corta con liberación automática de apartados vencidos.",
      cantidadNumeros: 100,
      precioNumero: "50.00",
      plazoApartadoHoras: 24,
      liberacionAutomatica: true,
    });
    await poblarRifa(db, azar, express, compradorIds, admin.id, {
      vendidos: 30,
      apartados: 10,
      vencidos: 5,
      liberados: 0,
    });

    const resumen = await db.execute<{
      rifa: string;
      disponibles: number;
      apartados: number;
      vencidos: number;
      vendidos: number;
    }>(sql`
      select r.nombre as rifa,
             count(*) filter (where n.estado = 'disponible')::int as disponibles,
             count(*) filter (where n.estado = 'apartado' and not n.vencido)::int as apartados,
             count(*) filter (where n.vencido)::int as vencidos,
             count(*) filter (where n.estado = 'vendido')::int as vendidos
      from numeros_estado n join rifas r on r.id = n.rifa_id
      group by r.nombre, r.creado_en order by r.creado_en
    `);
    console.table(resumen.map((fila) => ({ ...fila })));
    console.log(`Entra con ${admin.email} y la contraseña SEED_ADMIN_PASSWORD de tu .env.`);
    if (operador) {
      console.log(`Operador: ${operador.email} con SEED_OPERADOR_PASSWORD.`);
    }
  } finally {
    await db.$client.end();
  }
}

/** Crea ventas, apartados vigentes, apartados vencidos y liberaciones con fechas repartidas en el pasado. */
async function poblarRifa(
  db: Db,
  azar: Azar,
  rifa: { id: string; numeroInicial: number; cantidadNumeros: number; plazoApartadoHoras: number },
  compradorIds: string[],
  usuarioId: string,
  metas: Metas,
) {
  const libres = azar.barajar(
    Array.from({ length: rifa.cantidadNumeros }, (_, i) => rifa.numeroInicial + i),
  );
  const plazoMin = rifa.plazoApartadoHoras * 60;

  // Cada compra es de 1 a 4 números para un mismo comprador.
  async function porCompras(total: number, comprar: (numeros: number[]) => Promise<void>) {
    for (let restantes = total; restantes > 0; ) {
      const cantidad = Math.min(restantes, azar.entero(1, 4));
      await comprar(libres.splice(0, cantidad));
      restantes -= cantidad;
    }
  }
  const apartar = (numeros: number[], pagoConfirmado = false) =>
    apartarNumeros(db, {
      rifaId: rifa.id,
      numeros,
      comprador: { id: azar.elegir(compradorIds) },
      pagoConfirmado,
      usuarioId,
    });

  await porCompras(metas.vendidos, async (numeros) => {
    const ventaDirecta = azar.siguiente() < 0.4;
    const asignadas = await apartar(numeros, ventaDirecta);
    if (!ventaDirecta) await confirmarPago(db, { asignacionIds: asignadas.map((a) => a.id), usuarioId });
    const hace = azar.entero(60, 20 * 24 * 60);
    await envejecer(db, asignadas, hace, ventaDirecta ? 0 : azar.entero(0, Math.min(hace, plazoMin)));
  });

  await porCompras(metas.apartados, async (numeros) => {
    await envejecer(db, await apartar(numeros), azar.entero(5, plazoMin - 60));
  });

  await porCompras(metas.vencidos, async (numeros) => {
    await envejecer(db, await apartar(numeros), azar.entero(plazoMin + 60, plazoMin + 48 * 60));
  });

  // Apartados que vencieron y el organizador ya liberó: quedan en el historial y el número vuelve a estar libre.
  await porCompras(metas.liberados, async (numeros) => {
    const asignadas = await apartar(numeros);
    await envejecer(db, asignadas, azar.entero(plazoMin + 120, plazoMin + 72 * 60));
    await liberarAsignaciones(db, { asignacionIds: asignadas.map((a) => a.id), usuarioId });
    libres.push(...numeros);
  });
}

/**
 * Mueve al pasado las fechas de unas asignaciones y de sus movimientos.
 * El pago (si lo hay) queda `minutosHastaPago` después de la asignación.
 */
async function envejecer(db: Db, lista: Asignacion[], minutos: number, minutosHastaPago = 0) {
  const ids = lista.map((a) => a.id);
  const atras = sql`make_interval(mins => ${minutos}::int)`;
  const atrasPago = sql`make_interval(mins => ${minutos - minutosHastaPago}::int)`;

  await db
    .update(asignaciones)
    .set({
      creadoEn: sql`${asignaciones.creadoEn} - ${atras}`,
      fechaLimite: sql`${asignaciones.fechaLimite} - ${atras}`,
      fechaPago: sql`${asignaciones.fechaPago} - ${atrasPago}`,
    })
    .where(inArray(asignaciones.id, ids));

  await db
    .update(movimientos)
    .set({
      creadoEn: sql`${movimientos.creadoEn} - case when ${movimientos.tipo} = 'pago_confirmado' then ${atrasPago} else ${atras} end`,
    })
    .where(inArray(movimientos.asignacionId, ids));

  // El pedido tiene la fecha de su primer apartado.
  await db
    .update(pedidos)
    .set({ creadoEn: sql`${pedidos.creadoEn} - ${atras}` })
    .where(inArray(pedidos.id, [...new Set(lista.map((a) => a.pedidoId))]));

  // El historial guarda la fecha límite con la que se apartó; se recorre igual que la del apartado.
  await db.execute(sql`
    update movimientos m
    set detalle = jsonb_set(m.detalle, '{fechaLimite}', to_jsonb(a.fecha_limite))
    from asignaciones a
    where a.id = m.asignacion_id
      and m.asignacion_id in ${ids}
      and a.fecha_limite is not null
      and m.detalle ? 'fechaLimite'
  `);
}

function requerida(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta ${nombre} en .env (ver .env.example).`);
  return valor;
}

type Azar = ReturnType<typeof generadorConSemilla>;

// mulberry32: generador pseudoaleatorio pequeño y reproducible.
function generadorConSemilla(semilla: number) {
  let estado = semilla >>> 0;
  const siguiente = () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const entero = (min: number, max: number) => min + Math.floor(siguiente() * (max - min + 1));
  const elegir = <T>(lista: T[]) => lista[Math.floor(siguiente() * lista.length)];
  const barajar = <T>(lista: T[]) => {
    for (let i = lista.length - 1; i > 0; i--) {
      const j = Math.floor(siguiente() * (i + 1));
      [lista[i], lista[j]] = [lista[j], lista[i]];
    }
    return lista;
  };
  return { siguiente, entero, elegir, barajar };
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
