// Tipos mínimos do Web Bluetooth.
//
// A API não está no lib.dom do TypeScript e o pacote de tipos oficial traria a
// especificação inteira para usar quatro métodos. Aqui fica só o recorte que o
// transporte realmente toca — e, como `any` é proibido no projeto, é este
// recorte que mantém a coisa tipada de ponta a ponta.

export interface BluetoothCharacteristic {
  readonly uuid: string;
  readonly properties: {
    readonly write: boolean;
    readonly writeWithoutResponse: boolean;
  };
  // A API aceita BufferSource; declaramos Uint8Array porque é só isso que o
  // transporte manda, e assim o tipo fecha sem o atrito de ArrayBufferLike.
  writeValue(value: Uint8Array): Promise<void>;
  writeValueWithResponse?(value: Uint8Array): Promise<void>;
  writeValueWithoutResponse?(value: Uint8Array): Promise<void>;
}

export interface BluetoothService {
  readonly uuid: string;
  getCharacteristics(): Promise<BluetoothCharacteristic[]>;
}

export interface BluetoothServer {
  readonly connected: boolean;
  connect(): Promise<BluetoothServer>;
  disconnect(): void;
  getPrimaryServices(): Promise<BluetoothService[]>;
}

export interface BluetoothDeviceLike {
  readonly id: string;
  readonly name?: string;
  readonly gatt?: BluetoothServer;
  addEventListener(type: "gattserverdisconnected", listener: () => void): void;
  removeEventListener(
    type: "gattserverdisconnected",
    listener: () => void,
  ): void;
}

export interface BluetoothApi {
  requestDevice(options: {
    acceptAllDevices?: boolean;
    filters?: { services?: string[] }[];
    optionalServices?: string[];
  }): Promise<BluetoothDeviceLike>;
}

export function getBluetooth(): BluetoothApi | null {
  if (typeof navigator === "undefined") return null;
  const bluetooth = (navigator as Navigator & { bluetooth?: BluetoothApi })
    .bluetooth;
  return bluetooth ?? null;
}

export function bluetoothDisponivel(): boolean {
  return getBluetooth() !== null;
}
