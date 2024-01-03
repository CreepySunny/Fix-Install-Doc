import { MeshDevice } from "../meshDevice.js";
import * as Types from "../types.js";
import { typedArrayToBuffer } from "../utils/index.js";

/** Allows to connect to a Meshtastic device over HTTP(S) */
export class HttpConnection extends MeshDevice {
  /** Defines the connection type as http */
  public connType: Types.ConnectionTypeName;

  /** URL of the device that is to be connected to. */
  protected portId: string;

  /** Enables receiving messages all at once, versus one per request */
  private receiveBatchRequests: boolean;

  private readLoop: ReturnType<typeof setInterval> | null;

  private pendingRequest: boolean;

  private abortController: AbortController;

  constructor(configId?: number) {
    super(configId);

    this.log = this.log.getSubLogger({ name: "HttpConnection" });

    this.connType = "http";
    this.portId = "";
    this.receiveBatchRequests = false;
    this.readLoop = null;
    this.pendingRequest = false;
    this.abortController = new AbortController();

    this.log.debug(
      Types.Emitter[Types.Emitter.constructor],
      "🔷 HttpConnection instantiated",
    );
  }

  /**
   * Initiates the connect process to a Meshtastic device via HTTP(S)
   */
  public async connect({
    address,
    fetchInterval = 3000,
    receiveBatchRequests = false,
    tls = false,
  }: Types.HttpConnectionParameters): Promise<void> {
    this.updateDeviceStatus(Types.DeviceStatusEnum.DEVICE_CONNECTING);

    this.receiveBatchRequests = receiveBatchRequests;

    this.portId = `${tls ? "https://" : "http://"}${address}`;

    if (
      this.deviceStatus === Types.DeviceStatusEnum.DEVICE_CONNECTING &&
      (await this.ping())
    ) {
      this.log.debug(
        Types.Emitter[Types.Emitter.connect],
        "Ping succeeded, starting configuration and request timer.",
      );
      this.configure().catch(() => {
        // TODO: FIX, workaround for `wantConfigId` not getting acks.
      });
      this.readLoop = setInterval(() => {
        this.readFromRadio().catch((e: Error) => {
          this.log.error(
            Types.Emitter[Types.Emitter.connect],
            `❌ ${e.message}`,
          );
        });
      }, fetchInterval);
    } else if (
      this.deviceStatus !== Types.DeviceStatusEnum.DEVICE_DISCONNECTED
    ) {
      setTimeout(() => {
        this.connect({
          address: address,
          fetchInterval: fetchInterval,
          receiveBatchRequests: receiveBatchRequests,
          tls: tls,
        });
      }, 10000);
    }
  }

  /** Disconnects from the Meshtastic device */
  public disconnect(): void {
    this.abortController.abort();
    this.updateDeviceStatus(Types.DeviceStatusEnum.DEVICE_DISCONNECTED);
    if (this.readLoop) {
      clearInterval(this.readLoop);
      this.complete();
    }
  }

  /** Pings device to check if it is avaliable */
  public async ping(): Promise<boolean> {
    this.log.debug(
      Types.Emitter[Types.Emitter.ping],
      "Attempting device ping.",
    );

    const { signal } = this.abortController;

    let pingSuccessful = false;

    await fetch(`${this.portId}/hotspot-detect.html`, {
      signal,
      mode: "no-cors",
    })
      .then(() => {
        pingSuccessful = true;
        this.updateDeviceStatus(Types.DeviceStatusEnum.DEVICE_CONNECTED);
      })
      .catch((e: Error) => {
        pingSuccessful = false;
        this.log.error(Types.Emitter[Types.Emitter.ping], `❌ ${e.message}`);
        this.updateDeviceStatus(Types.DeviceStatusEnum.DEVICE_RECONNECTING);
      });
    return pingSuccessful;
  }

  /** Reads any avaliable protobuf messages from the radio */
  protected async readFromRadio(): Promise<void> {
    if (this.pendingRequest) {
      return;
    }
    let readBuffer = new ArrayBuffer(1);
    const { signal } = this.abortController;

    while (readBuffer.byteLength > 0) {
      this.pendingRequest = true;
      await fetch(
        `${this.portId}/api/v1/fromradio?all=${
          this.receiveBatchRequests ? "true" : "false"
        }`,
        {
          signal,
          method: "GET",
          headers: {
            Accept: "application/x-protobuf",
          },
        },
      )
        .then(async (response) => {
          this.pendingRequest = false;
          this.updateDeviceStatus(Types.DeviceStatusEnum.DEVICE_CONNECTED);

          readBuffer = await response.arrayBuffer();

          if (readBuffer.byteLength > 0) {
            this.handleFromRadio(new Uint8Array(readBuffer));
          }
        })
        .catch((e: Error) => {
          this.pendingRequest = false;
          this.log.error(
            Types.Emitter[Types.Emitter.readFromRadio],
            `❌ ${e.message}`,
          );

          this.updateDeviceStatus(Types.DeviceStatusEnum.DEVICE_RECONNECTING);
        });
    }
  }

  /**
   * Sends supplied protobuf message to the radio
   */
  protected async writeToRadio(data: Uint8Array): Promise<void> {
    const { signal } = this.abortController;

    await fetch(`${this.portId}/api/v1/toradio`, {
      signal,
      method: "PUT",
      headers: {
        "Content-Type": "application/x-protobuf",
      },
      body: typedArrayToBuffer(data),
    })
      .then(async () => {
        this.updateDeviceStatus(Types.DeviceStatusEnum.DEVICE_CONNECTED);

        await this.readFromRadio().catch((e: Error) => {
          this.log.error(
            Types.Emitter[Types.Emitter.writeToRadio],
            `❌ ${e.message}`,
          );
        });
      })
      .catch((e: Error) => {
        this.log.error(
          Types.Emitter[Types.Emitter.writeToRadio],
          `❌ ${e.message}`,
        );
        this.updateDeviceStatus(Types.DeviceStatusEnum.DEVICE_RECONNECTING);
      });
  }
}
