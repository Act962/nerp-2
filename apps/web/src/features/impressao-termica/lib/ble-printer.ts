import { chunkBytes } from "./chunk";
import {
  type BluetoothCharacteristic,
  type BluetoothDeviceLike,
  getBluetooth,
} from "./web-bluetooth";

/**
 * Serviços onde as térmicas Bluetooth de 58mm costumam expor a porta serial.
 *
 * Não há padrão: cada fabricante escolhe o seu. Estes cinco cobrem quase todo o
 * mercado brasileiro de bobina pequena — HM-10, a família PT-210/MTP, a
 * genérica 0xFF00 e o UART da Nordic.
 *
 * TODO serviço que a página for tocar precisa estar aqui: fora desta lista, o
 * `getPrimaryServices` lança `SecurityError` mesmo com o aparelho já pareado.
 * É o erro número um de quem implementa isto pela primeira vez.
 */
export const SERVICOS_CONHECIDOS = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "0000ffe0-0000-1000-8000-00805f9b34fb",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "0000ae30-0000-1000-8000-00805f9b34fb",
  "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
];

export type EstadoImpressora =
  | "sem-suporte"
  | "desconectada"
  | "conectando"
  | "conectada"
  | "erro";

export type OpcoesTransporte = {
  /** Bytes por escrita. Começa baixo; o usuário sobe se o aparelho aguentar. */
  tamanhoDoBloco?: number;
  /** Pausa entre blocos, em ms. Sem ela o buffer transborda e o cupom pica. */
  pausaMs?: number;
};

const PADRAO: Required<OpcoesTransporte> = { tamanhoDoBloco: 20, pausaMs: 30 };

function espera(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Conexão com a impressora térmica por Web Bluetooth.
 *
 * Três coisas moldam esta classe, e nenhuma é escolha nossa:
 *
 * 1. `requestDevice` só roda dentro de um gesto do usuário. Por isso o objeto
 *    do aparelho é obtido UMA vez, no botão "Conectar", e guardado: reconectar
 *    e imprimir depois não pedem gesto novo. Recarregar a página perde o
 *    objeto — aí o dono toca "Conectar" de novo, e a tela avisa isso.
 * 2. A escrita é serializada por uma fila. Dois cupons ao mesmo tempo
 *    intercalariam bytes e sairiam como um cupom corrompido.
 * 3. A queda é normal e silenciosa: o `gattserverdisconnected` religa sozinho
 *    com espera crescente, senão o dono descobre que caiu pelo pedido que não
 *    imprimiu.
 */
export class ImpressoraBluetooth {
  private device: BluetoothDeviceLike | null = null;
  private caracteristica: BluetoothCharacteristic | null = null;
  private fila: Promise<void> = Promise.resolve();
  private religando = false;
  private tentativas = 0;
  private opcoes: Required<OpcoesTransporte>;

  constructor(
    private readonly aoMudarEstado: (
      estado: EstadoImpressora,
      detalhe?: string,
    ) => void,
    opcoes: OpcoesTransporte = {},
  ) {
    this.opcoes = { ...PADRAO, ...opcoes };
  }

  get nome(): string | null {
    return this.device?.name ?? null;
  }

  get conectada(): boolean {
    return Boolean(this.device?.gatt?.connected && this.caracteristica);
  }

  ajustar(opcoes: OpcoesTransporte) {
    this.opcoes = { ...this.opcoes, ...opcoes };
  }

  /** Precisa ser chamado de dentro de um clique — exigência da API. */
  async conectar(): Promise<void> {
    const bluetooth = getBluetooth();
    if (!bluetooth) {
      this.aoMudarEstado("sem-suporte");
      throw new Error(
        "Este navegador não fala Bluetooth. Use o Chrome no Android.",
      );
    }

    this.aoMudarEstado("conectando");

    // `acceptAllDevices` porque impressora genérica raramente anuncia o
    // serviço no advertisement — filtrar por serviço esconderia o aparelho da
    // lista e o dono nunca acharia a própria impressora.
    const device = await bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: SERVICOS_CONHECIDOS,
    });

    this.device = device;
    device.addEventListener("gattserverdisconnected", this.aoCair);

    await this.abrirGatt();
  }

  private aoCair = () => {
    this.caracteristica = null;
    this.aoMudarEstado("desconectada", "Conexão caiu. Tentando religar…");
    void this.religar();
  };

  private async religar() {
    if (this.religando || !this.device) return;
    this.religando = true;

    while (this.device && !this.conectada) {
      // 1s, 2s, 4s… com teto de 30s: insistir de segundo em segundo drena a
      // bateria do celular sem aumentar a chance de sucesso.
      const espera_ms = Math.min(30_000, 1000 * 2 ** this.tentativas);
      this.tentativas += 1;
      await espera(espera_ms);

      try {
        await this.abrirGatt();
      } catch {
        // Segue tentando: a impressora pode estar simplesmente desligada.
      }
    }

    this.religando = false;
  }

  private async abrirGatt(): Promise<void> {
    const gatt = this.device?.gatt;
    if (!gatt) throw new Error("Aparelho sem GATT");

    this.aoMudarEstado("conectando");
    const server = gatt.connected ? gatt : await gatt.connect();

    const caracteristica = await this.acharCaracteristica(server);
    if (!caracteristica) {
      this.aoMudarEstado(
        "erro",
        "Aparelho conectado, mas sem porta de impressão reconhecida.",
      );
      throw new Error("Nenhuma característica de escrita encontrada");
    }

    this.caracteristica = caracteristica;
    this.tentativas = 0;
    this.aoMudarEstado("conectada");
  }

  private async acharCaracteristica(server: {
    getPrimaryServices(): Promise<
      { getCharacteristics(): Promise<BluetoothCharacteristic[]> }[]
    >;
  }): Promise<BluetoothCharacteristic | null> {
    const servicos = await server.getPrimaryServices();

    for (const servico of servicos) {
      const caracteristicas = await servico.getCharacteristics();
      const escrevivel = caracteristicas.find(
        (c) => c.properties.write || c.properties.writeWithoutResponse,
      );
      if (escrevivel) return escrevivel;
    }

    return null;
  }

  /** Enfileira a impressão. Resolve quando o último byte saiu. */
  imprimir(bytes: Uint8Array): Promise<void> {
    const proxima = this.fila.then(() => this.escrever(bytes));
    // A fila não pode morrer por causa de um cupom que falhou.
    this.fila = proxima.catch(() => undefined);
    return proxima;
  }

  private async escrever(bytes: Uint8Array): Promise<void> {
    const caracteristica = this.caracteristica;
    if (!caracteristica) throw new Error("Impressora não conectada");

    // Com resposta é mais lento, mas ganha controle de fluxo de graça; sem
    // resposta a gente compensa com a pausa entre blocos.
    const comResposta = caracteristica.properties.write;

    for (const bloco of chunkBytes(bytes, this.opcoes.tamanhoDoBloco)) {
      if (comResposta && caracteristica.writeValueWithResponse) {
        await caracteristica.writeValueWithResponse(bloco);
      } else if (caracteristica.writeValueWithoutResponse) {
        await caracteristica.writeValueWithoutResponse(bloco);
      } else {
        await caracteristica.writeValue(bloco);
      }
      if (this.opcoes.pausaMs > 0) await espera(this.opcoes.pausaMs);
    }
  }

  desconectar() {
    this.device?.removeEventListener("gattserverdisconnected", this.aoCair);
    this.device?.gatt?.disconnect();
    this.device = null;
    this.caracteristica = null;
    this.tentativas = 0;
    this.aoMudarEstado("desconectada");
  }
}
