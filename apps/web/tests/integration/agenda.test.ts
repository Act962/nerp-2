import { call } from "@orpc/server";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getAgenda } from "@/app/router/agenda/get";
import { cancelAppointment } from "@/app/router/agenda/cancel-appointment";
import { createAgenda } from "@/app/router/agenda/create";
import { createAppointment } from "@/app/router/agenda/create-appointment";
import { listAppointments } from "@/app/router/agenda/list-appointments";
import { bookPublicAgenda } from "@/app/router/agenda/public/book";
import { cancelPublicAppointment } from "@/app/router/agenda/public/cancel-appointment";
import { listPublicSlots } from "@/app/router/agenda/public/list-slots";
import { setAvailability } from "@/app/router/agenda/set-availability";
import { setDateOverride } from "@/app/router/agenda/set-date-override";
import { updateAgenda } from "@/app/router/agenda/update";
import { createFunnel } from "@/app/router/crm/create-funnel";
import {
  diaDaSemanaDaData,
  paredeParaUtc,
} from "@/features/agenda/lib/horarios";
import type { Organization, User } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import {
  createMember,
  createOrg,
  createUser,
  resetDb,
  s2sContext,
} from "./helpers";

/**
 * Agenda — grade, link público e marcação.
 *
 * O que estes testes fixam: o horário oferecido vem da grade e some quando
 * ocupa; a mesma regra vale para o cliente e para o atendente; e duas pessoas
 * disputando o mesmo encaixe não terminam as duas marcadas.
 */

let org: Organization;
let outraOrg: Organization;
let dono: User;
let vizinho: User;
let agendaId: string;

/** Uma quarta-feira suficientemente à frente para nada estar no passado. */
const DIA = (() => {
  const daqui = new Date(Date.now() + 30 * 86_400_000);
  while (daqui.getUTCDay() !== 3) daqui.setUTCDate(daqui.getUTCDate() + 1);
  return daqui.toISOString().slice(0, 10);
})();

const ctx = () => ({ context: s2sContext(dono, org) });

/**
 * Contexto das procedures públicas: só os cabeçalhos, sem sessão nem
 * organização — é exatamente o que a rota HTTP entrega para elas.
 */
const publico = { context: { headers: new Headers() } };

async function novaAgenda(nome: string): Promise<string> {
  const funil = await call(
    createFunnel,
    { name: `Funil ${nome}` },
    { context: s2sContext(dono, org) },
  );
  const agenda = await call(
    createAgenda,
    { name: nome, funnelId: funil.id, slotDuration: 60 },
    { context: s2sContext(dono, org) },
  );
  await call(
    setAvailability,
    {
      agendaId: agenda.id,
      semana: [
        {
          dayOfWeek: diaDaSemanaDaData(DIA),
          isActive: true,
          faixas: [{ startTime: "08:00", endTime: "11:00" }],
        },
      ],
    },
    { context: s2sContext(dono, org) },
  );
  return agenda.id;
}

beforeAll(async () => {
  await resetDb();
  org = await createOrg("Loja com agenda");
  outraOrg = await createOrg("Loja vizinha");
  dono = await createUser();
  vizinho = await createUser();
  await createMember(dono, org);
  await createMember(vizinho, outraOrg);
});

beforeEach(async () => {
  await prisma.appointment.deleteMany({ where: { organizationId: org.id } });
  agendaId = await novaAgenda(
    `Consultoria ${Math.random().toString(36).slice(2, 7)}`,
  );
});

async function slugs(): Promise<{ orgSlug: string; agendaSlug: string }> {
  const agenda = await prisma.agenda.findUniqueOrThrow({
    where: { id: agendaId },
    select: { slug: true },
  });
  return { orgSlug: org.slug, agendaSlug: agenda.slug };
}

describe("horários oferecidos", () => {
  it("quebra a faixa da grade em encaixes da duração da agenda", async () => {
    const { horarios } = await call(
      listPublicSlots,
      {
        ...(await slugs()),
        date: DIA,
      },
      publico,
    );
    expect(horarios.map((h) => h.hora)).toEqual(["08:00", "09:00", "10:00"]);
  });

  it("não oferece nada num dia sem grade", async () => {
    const outroDia = new Date(`${DIA}T00:00:00.000Z`);
    outroDia.setUTCDate(outroDia.getUTCDate() + 1); // quinta, sem faixa

    const { horarios } = await call(
      listPublicSlots,
      {
        ...(await slugs()),
        date: outroDia.toISOString().slice(0, 10),
      },
      publico,
    );
    expect(horarios).toEqual([]);
  });

  it("data bloqueada fecha o dia mesmo com grade semanal", async () => {
    await call(
      setDateOverride,
      { agendaId, date: DIA, isBlocked: true },
      ctx(),
    );

    const { horarios } = await call(
      listPublicSlots,
      {
        ...(await slugs()),
        date: DIA,
      },
      publico,
    );
    expect(horarios).toEqual([]);

    // E liberar devolve o dia à grade, sem precisar recadastrar horário.
    await call(
      setDateOverride,
      { agendaId, date: DIA, isBlocked: false },
      ctx(),
    );
    const depois = await call(
      listPublicSlots,
      {
        ...(await slugs()),
        date: DIA,
      },
      publico,
    );
    expect(depois.horarios).toHaveLength(3);
  });

  it("disponibilidade cadastrada para a data vence a grade da semana", async () => {
    const disponibilidade = await prisma.agendaDateAvailability.create({
      data: { agendaId, date: DIA },
    });
    await prisma.agendaDateAvailabilitySlot.create({
      data: {
        dateAvailabilityId: disponibilidade.id,
        startTime: "15:00",
        endTime: "17:00",
        order: 0,
      },
    });

    const { horarios } = await call(
      listPublicSlots,
      {
        ...(await slugs()),
        date: DIA,
      },
      publico,
    );
    // É assim que "nesse dia atendo só à tarde" funciona sem mexer nas outras
    // quartas-feiras.
    expect(horarios.map((h) => h.hora)).toEqual(["15:00", "16:00"]);
  });
});

describe("marcação pelo link público", () => {
  it("cria o lead no funil e some com o horário", async () => {
    const endereco = await slugs();
    const marcado = await call(
      bookPublicAgenda,
      {
        ...endereco,
        date: DIA,
        time: "09:00",
        name: "Joana Ribeiro",
        phone: "(11) 98888-7777",
      },
      publico,
    );

    expect(marcado.appointmentId).toBeTruthy();

    const lead = await prisma.crmLead.findFirstOrThrow({
      where: { organizationId: org.id, phone: "+5511988887777" },
      select: { name: true, source: true },
    });
    expect(lead.name).toBe("Joana Ribeiro");
    expect(lead.source).toBe("AGENDA");

    const { horarios } = await call(
      listPublicSlots,
      {
        ...endereco,
        date: DIA,
      },
      publico,
    );
    expect(horarios.map((h) => h.hora)).toEqual(["08:00", "10:00"]);
  });

  it("recusa horário que não existe na grade", async () => {
    await expect(
      call(
        bookPublicAgenda,
        {
          ...(await slugs()),
          date: DIA,
          time: "13:00",
          name: "Fora da grade",
          phone: "(11) 98888-1111",
        },
        publico,
      ),
    ).rejects.toThrow(/não está disponível/i);
  });

  it("recusa telefone que não é celular com WhatsApp", async () => {
    await expect(
      call(
        bookPublicAgenda,
        {
          ...(await slugs()),
          date: DIA,
          time: "09:00",
          name: "Fixo",
          phone: "(11) 3222-1000",
        },
        publico,
      ),
    ).rejects.toThrow(/celular com WhatsApp/i);
  });

  it("liga o lead ao cliente do ERP quando o telefone bate", async () => {
    const cliente = await prisma.customer.create({
      data: {
        organizationId: org.id,
        name: "Mercearia do Zé",
        phone: "(85) 99123-4567",
      },
      select: { id: true },
    });

    const marcado = await call(
      bookPublicAgenda,
      {
        ...(await slugs()),
        date: DIA,
        time: "08:00",
        name: "Zé",
        phone: "85991234567",
      },
      publico,
    );

    const compromisso = await prisma.appointment.findUniqueOrThrow({
      where: { id: marcado.appointmentId },
      select: { lead: { select: { customerId: true } } },
    });
    // É o que faz a venda e o financeiro do cliente aparecerem no painel de
    // quem chega pela agenda.
    expect(compromisso.lead?.customerId).toBe(cliente.id);
  });

  it("segura o mesmo telefone depois de três horários futuros", async () => {
    const endereco = await slugs();
    const telefone = "(11) 97777-0000";

    for (const hora of ["08:00", "09:00", "10:00"]) {
      await call(
        bookPublicAgenda,
        {
          ...endereco,
          date: DIA,
          time: hora,
          name: "Insistente",
          phone: telefone,
        },
        publico,
      );
    }

    const outraAgenda = await slugsDeOutraAgenda();
    await expect(
      call(
        bookPublicAgenda,
        {
          ...outraAgenda,
          date: DIA,
          time: "08:00",
          name: "Insistente",
          phone: telefone,
        },
        publico,
      ),
    ).resolves.toBeTruthy(); // o limite é por agenda, não global

    await expect(
      call(
        bookPublicAgenda,
        {
          ...endereco,
          date: DIA,
          time: "08:00",
          name: "Insistente",
          phone: telefone,
        },
        publico,
      ),
    ).rejects.toThrow();
  });

  it("não marca dois no mesmo encaixe, nem em cliques simultâneos", async () => {
    const endereco = await slugs();

    const resultados = await Promise.allSettled([
      call(
        bookPublicAgenda,
        {
          ...endereco,
          date: DIA,
          time: "10:00",
          name: "Primeiro",
          phone: "(11) 96666-0001",
        },
        publico,
      ),
      call(
        bookPublicAgenda,
        {
          ...endereco,
          date: DIA,
          time: "10:00",
          name: "Segundo",
          phone: "(11) 96666-0002",
        },
        publico,
      ),
    ]);

    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);

    const marcados = await prisma.appointment.count({
      where: { agendaId, status: { not: "CANCELLED" } },
    });
    expect(marcados).toBe(1);
  });

  it("cancelar libera o horário de volta", async () => {
    const endereco = await slugs();
    const marcado = await call(
      bookPublicAgenda,
      {
        ...endereco,
        date: DIA,
        time: "08:00",
        name: "Vai desmarcar",
        phone: "(11) 95555-0001",
      },
      publico,
    );

    await call(
      cancelPublicAppointment,
      {
        appointmentId: marcado.appointmentId,
      },
      publico,
    );

    const { horarios } = await call(
      listPublicSlots,
      {
        ...endereco,
        date: DIA,
      },
      publico,
    );
    expect(horarios.map((h) => h.hora)).toContain("08:00");

    // Cancelar duas vezes não é erro silencioso — a segunda diz que já foi.
    await expect(
      call(
        cancelPublicAppointment,
        { appointmentId: marcado.appointmentId },
        publico,
      ),
    ).rejects.toThrow();
  });
});

describe("marcação pelo ERP", () => {
  it("passa pelas mesmas regras da página pública", async () => {
    await call(
      setDateOverride,
      { agendaId, date: DIA, isBlocked: true },
      ctx(),
    );

    // A porta interna não pode furar o dia que o operador fechou.
    await expect(
      call(
        createAppointment,
        {
          agendaId,
          date: DIA,
          time: "09:00",
          name: "Encaixe do balcão",
          phone: "(11) 94444-0001",
          meetingType: "IN_PERSON",
        },
        ctx(),
      ),
    ).rejects.toThrow(/não está disponível/i);
  });

  it("grava o atendente responsável", async () => {
    const marcado = await call(
      createAppointment,
      {
        agendaId,
        date: DIA,
        time: "09:00",
        name: "Cliente do balcão",
        phone: "(11) 94444-0002",
        meetingType: "IN_PERSON",
      },
      ctx(),
    );

    const compromisso = await prisma.appointment.findUniqueOrThrow({
      where: { id: marcado.appointmentId },
      select: { userId: true, meetingType: true },
    });
    expect(compromisso.userId).toBe(dono.id);
    expect(compromisso.meetingType).toBe("IN_PERSON");
  });
});

describe("isolamento entre organizações", () => {
  it("a org vizinha não abre nem edita a agenda", async () => {
    const doVizinho = { context: s2sContext(vizinho, outraOrg) };

    await expect(call(getAgenda, { agendaId }, doVizinho)).rejects.toThrow(
      /não encontrada/i,
    );
    await expect(
      call(updateAgenda, { agendaId, name: "Sequestrada" }, doVizinho),
    ).rejects.toThrow(/não encontrada/i);
    await expect(
      call(
        setDateOverride,
        { agendaId, date: DIA, isBlocked: true },
        doVizinho,
      ),
    ).rejects.toThrow(/não encontrada/i);
  });

  it("a org vizinha não cancela nem enxerga o compromisso", async () => {
    const marcado = await call(
      bookPublicAgenda,
      {
        ...(await slugs()),
        date: DIA,
        time: "08:00",
        name: "Da casa",
        phone: "(11) 93333-0001",
      },
      publico,
    );
    const doVizinho = { context: s2sContext(vizinho, outraOrg) };

    await expect(
      call(
        cancelAppointment,
        { appointmentId: marcado.appointmentId },
        doVizinho,
      ),
    ).rejects.toThrow(/não encontrado/i);

    const lista = await call(
      listAppointments,
      { de: DIA, ate: DIA },
      doVizinho,
    );
    expect(lista.compromissos).toHaveLength(0);

    // E continua marcado do lado de cá.
    const daCasa = await call(listAppointments, { de: DIA, ate: DIA }, ctx());
    expect(daCasa.compromissos.map((c) => c.id)).toContain(
      marcado.appointmentId,
    );
  });
});

/** Uma segunda agenda da mesma org, para separar limite por agenda de global. */
async function slugsDeOutraAgenda(): Promise<{
  orgSlug: string;
  agendaSlug: string;
}> {
  const outra = await novaAgenda(
    `Segunda ${Math.random().toString(36).slice(2, 7)}`,
  );
  const agenda = await prisma.agenda.findUniqueOrThrow({
    where: { id: outra },
    select: { slug: true },
  });
  return { orgSlug: org.slug, agendaSlug: agenda.slug };
}

/**
 * Agenda com grade larga e encaixe curto, para os testes que precisam de
 * muitos horários no mesmo dia.
 */
async function agendaLarga(
  faixas: { startTime: string; endTime: string }[],
): Promise<{
  id: string;
  funnelId: string;
  orgSlug: string;
  agendaSlug: string;
}> {
  const funil = await call(
    createFunnel,
    { name: `Funil largo ${Math.random().toString(36).slice(2, 7)}` },
    ctx(),
  );
  const agenda = await call(
    createAgenda,
    {
      name: `Larga ${Math.random().toString(36).slice(2, 7)}`,
      funnelId: funil.id,
      slotDuration: 60,
    },
    ctx(),
  );
  await call(
    setAvailability,
    {
      agendaId: agenda.id,
      semana: [{ dayOfWeek: diaDaSemanaDaData(DIA), isActive: true, faixas }],
    },
    ctx(),
  );
  const linha = await prisma.agenda.findUniqueOrThrow({
    where: { id: agenda.id },
    select: { slug: true },
  });
  return {
    id: agenda.id,
    funnelId: funil.id,
    orgSlug: org.slug,
    agendaSlug: linha.slug,
  };
}

describe("freios do formulário público", () => {
  it("recusa marcação longe demais no futuro", async () => {
    const endereco = await slugs();
    const daquiAUmAno = new Date(Date.now() + 365 * 86_400_000)
      .toISOString()
      .slice(0, 10);

    // Sem teto, a regex de data aceitava `9999-12-31` e a grade semanal gerava
    // encaixe para qualquer dia útil de qualquer ano.
    await expect(
      call(
        bookPublicAgenda,
        {
          ...endereco,
          date: daquiAUmAno,
          time: "08:00",
          name: "Muito Antecipado",
          phone: "(11) 96666-0001",
        },
        publico,
      ),
    ).rejects.toThrow(/antecedência/i);
  });

  it("segura a enxurrada mesmo com um telefone novo a cada marcação", async () => {
    // A regressão: o limite por telefone é chaveado pelo número que quem
    // chama informa, então um script que varia o número passava por ele e
    // enchia a agenda inteira.
    const endereco = await agendaLarga([
      { startTime: "06:00", endTime: "23:00" },
    ]);

    for (let i = 0; i < 15; i += 1) {
      await call(
        bookPublicAgenda,
        {
          orgSlug: endereco.orgSlug,
          agendaSlug: endereco.agendaSlug,
          date: DIA,
          time: `${String(6 + i).padStart(2, "0")}:00`,
          name: `Robô ${i}`,
          phone: `(11) 95${String(i).padStart(3, "0")}-0000`,
        },
        publico,
      );
    }

    await expect(
      call(
        bookPublicAgenda,
        {
          orgSlug: endereco.orgSlug,
          agendaSlug: endereco.agendaSlug,
          date: DIA,
          time: "21:00",
          name: "Robô 15",
          phone: "(11) 95999-0000",
        },
        publico,
      ),
    ).rejects.toThrow(/marcações seguidas/i);
  });

  it("o freio de enxurrada não atinge quem marca pelo ERP", async () => {
    const endereco = await agendaLarga([
      { startTime: "06:00", endTime: "23:00" },
    ]);

    for (let i = 0; i < 15; i += 1) {
      await call(
        bookPublicAgenda,
        {
          orgSlug: endereco.orgSlug,
          agendaSlug: endereco.agendaSlug,
          date: DIA,
          time: `${String(6 + i).padStart(2, "0")}:00`,
          name: `Robô ${i}`,
          phone: `(11) 94${String(i).padStart(3, "0")}-0000`,
        },
        publico,
      );
    }

    // O atendente precisa continuar marcando: o freio conta só o que veio do
    // formulário aberto (`userId: null`).
    await expect(
      call(
        createAppointment,
        {
          agendaId: endereco.id,
          date: DIA,
          time: "21:00",
          name: "Cliente do balcão",
          phone: "(11) 94888-0000",
        },
        ctx(),
      ),
    ).resolves.toBeTruthy();
  });
});

describe("compromisso que atravessa a meia-noite", () => {
  it("não oferece nem aceita encaixe ocupado por compromisso da véspera", async () => {
    // A regressão: a consulta de ocupados filtrava por `startsAt` dentro do
    // dia, então o compromisso que começou ontem e termina hoje não bloqueava
    // nada — o encaixe das 00:00 saía livre e a agenda aceitava dois
    // sobrepostos.
    const endereco = await agendaLarga([
      { startTime: "00:00", endTime: "03:00" },
    ]);

    const vespera = new Date(`${DIA}T00:00:00Z`);
    vespera.setUTCDate(vespera.getUTCDate() - 1);
    const dataDaVespera = vespera.toISOString().slice(0, 10);

    // Lead próprio: depender de um criado por outro teste torna este
    // dependente da ordem de execução.
    const etapa = await prisma.crmStage.findFirstOrThrow({
      where: { funnelId: endereco.funnelId },
      orderBy: { order: "asc" },
      select: { id: true },
    });
    const lead = await prisma.crmLead.create({
      data: {
        organizationId: org.id,
        funnelId: endereco.funnelId,
        stageId: etapa.id,
        name: "Cliente da véspera",
        phone: "5511922220000",
      },
      select: { id: true },
    });

    // 23:00 da véspera até 00:30 de hoje, na parede da loja.
    await prisma.appointment.create({
      data: {
        organizationId: org.id,
        agendaId: endereco.id,
        leadId: lead.id,
        title: "Vira a noite",
        startsAt: paredeParaUtc(dataDaVespera, 23 * 60),
        endsAt: paredeParaUtc(DIA, 30),
      },
    });

    const { horarios } = await call(
      listPublicSlots,
      {
        orgSlug: endereco.orgSlug,
        agendaSlug: endereco.agendaSlug,
        date: DIA,
      },
      publico,
    );
    expect(horarios.map((h) => h.hora)).not.toContain("00:00");
    // O 01:00 continua livre: o bloqueio é do encaixe que colide, não do dia.
    expect(horarios.map((h) => h.hora)).toContain("01:00");

    await expect(
      call(
        bookPublicAgenda,
        {
          orgSlug: endereco.orgSlug,
          agendaSlug: endereco.agendaSlug,
          date: DIA,
          time: "00:00",
          name: "Madrugador",
          phone: "(11) 93333-0000",
        },
        publico,
      ),
    ).rejects.toThrow();
  });
});
