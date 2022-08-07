import { Types } from "./index.js";
import { LogRecord_Level } from "./generated/mesh.js";
import { IMeshDevice } from "./iMeshDevice.js";
import type { HTTPConnectionParameters } from "./types.js";
import { typedArrayToBuffer } from "./utils/general.js";

/**
 * Allows to connect to a Meshtastic device over HTTP(S)
 */
export class IHTTPConnection extends IMeshDevice {
  /**
   * Defines the connection type as http
   */
  connType: string;

  /**
   * URL of the device that is to be connected to.
   */
  url: string;

  /**
   * Enables receiving messages all at once, versus one per request
   */
  receiveBatchRequests: boolean;

  readLoop: ReturnType<typeof setInterval> | null;

  peningRequest: boolean;

  abortController: AbortController;

  constructor(configId?: number) {
    super(configId);

    this.connType = "http";
    this.url = "http://meshtastic.local";
    this.receiveBatchRequests = false;
    this.readLoop = null;
    this.peningRequest = false;
    this.abortController = new AbortController();
  }

  /**
   * Initiates the connect process to a Meshtastic device via HTTP(S)
   * @param parameters http connection parameters
   */
  public async connect(parameters: HTTPConnectionParameters): Promise<void> {
    this.updateDeviceStatus(Types.DeviceStatusEnum.DEVICE_CONNECTING);

    this.receiveBatchRequests = !!parameters.receiveBatchRequests;

    this.url = `${parameters.tls ? "https://" : "http://"}${
      parameters.address
    }`;

    if (
      this.deviceStatus === Types.DeviceStatusEnum.DEVICE_CONNECTING &&
      (await this.ping())
    ) {
      this.log(
        Types.EmitterScope.iHttpConnection,
        Types.Emitter.connect,
        `Ping succeeded, starting configuration and request timer.`,
        LogRecord_Level.DEBUG
      );
      this.configure();
      this.readLoop = setInterval(
        () => {
          this.readFromRadio().catch((e: Error) => {
            this.log(
              Types.EmitterScope.iHttpConnection,
              Types.Emitter.connect,
              e.message,
              LogRecord_Level.ERROR
            );
          });
        },
        parameters.fetchInterval ? parameters.fetchInterval : 5000
      );
    } else {
      if (this.deviceStatus !== Types.DeviceStatusEnum.DEVICE_DISCONNECTED) {
        setTimeout(() => {
          void this.connect({
            address: parameters.address,
            fetchInterval: parameters.fetchInterval,
            receiveBatchRequests: parameters.receiveBatchRequests,
            tls: parameters.tls
          });
        }, 10000);
      }
    }
  }

  /**
   * Disconnects from the Meshtastic device
   */
  public disconnect(): void {
    this.abortController.abort();
    this.updateDeviceStatus(Types.DeviceStatusEnum.DEVICE_DISCONNECTED);
    if (this.readLoop) {
      clearInterval(this.readLoop);
      this.complete();
    }
  }

  /**
   * Pings device to check if it is avaliable
   */
  public async ping(): Promise<boolean> {
    this.log(
      Types.EmitterScope.iHttpConnection,
      Types.Emitter.ping,
      `Attempting device ping.`,
      LogRecord_Level.DEBUG
    );

    const { signal } = this.abortController;

    let pingSuccessful = false;

    await fetch(`${this.url}/hotspot-detect.html`, { signal })
      .then(() => {
        pingSuccessful = true;
        this.updateDeviceStatus(Types.DeviceStatusEnum.DEVICE_CONNECTED);
      })
      .catch(({ message }: { message: string }) => {
        pingSuccessful = false;
        this.log(
          Types.EmitterScope.iHttpConnection,
          Types.Emitter.ping,
          message,
          LogRecord_Level.ERROR
        );
        this.updateDeviceStatus(Types.DeviceStatusEnum.DEVICE_RECONNECTING);
      });
    return pingSuccessful;
  }

  /**
   * Reads any avaliable protobuf messages from the radio
   */
  protected async readFromRadio(): Promise<void> {
    if (this.peningRequest) {
      return;
    }
    let readBuffer = new ArrayBuffer(1);
    const { signal } = this.abortController;

    while (readBuffer.byteLength > 0) {
      this.peningRequest = true;
      await fetch(
        `${this.url}/api/v1/fromradio?all=${
          this.receiveBatchRequests ? "true" : "false"
        }`,
        {
          signal,
          method: "GET",
          headers: {
            Accept: "application/x-protobuf"
          }
        }
      )
        .then(async (response) => {
          this.peningRequest = false;
          this.updateDeviceStatus(Types.DeviceStatusEnum.DEVICE_CONNECTED);

          readBuffer = await response.arrayBuffer();

          if (readBuffer.byteLength > 0) {
            await this.handleFromRadio(new Uint8Array(readBuffer, 0));
          }
        })
        .catch(({ message }: { message: string }) => {
          this.peningRequest = false;
          this.log(
            Types.EmitterScope.iHttpConnection,
            Types.Emitter.readFromRadio,
            message,
            LogRecord_Level.ERROR
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

    await fetch(`${this.url}/api/v1/toradio`, {
      signal,
      method: "PUT",
      headers: {
        "Content-Type": "application/x-protobuf"
      },
      body: typedArrayToBuffer(data)
    })
      .then(async () => {
        this.updateDeviceStatus(Types.DeviceStatusEnum.DEVICE_CONNECTED);

        await this.readFromRadio().catch((e: Error) => {
          this.log(
            Types.EmitterScope.iHttpConnection,
            Types.Emitter.writeToRadio,
            e.message,
            LogRecord_Level.ERROR
          );
        });
      })
      .catch(({ message }: { message: string }) => {
        this.log(
          Types.EmitterScope.iHttpConnection,
          Types.Emitter.writeToRadio,
          message,
          LogRecord_Level.ERROR
        );
        this.updateDeviceStatus(Types.DeviceStatusEnum.DEVICE_RECONNECTING);
      });
  }
}
