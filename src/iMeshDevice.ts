import { SubEvent } from "sub-events";

import { BROADCAST_NUM, MIN_FW_VERSION } from "./constants.js";
import { AdminMessage } from "./generated/admin.js";
import type { Channel } from "./generated/channel.js";
import {
  Data,
  FromRadio,
  LogRecord_Level,
  MeshPacket,
  MyNodeInfo,
  Position,
  Routing,
  ToRadio,
  User
} from "./generated/mesh.js";
import { PortNum } from "./generated/portnums.js";
import { Protobuf, Types } from "./index.js";
import type { ConnectionParameters, LogEventPacket } from "./types.js";
import { log } from "./utils/logging.js";
import { Queue } from "./utils/queue.js";

/**
 * Base class for connection methods to extend
 */
export abstract class IMeshDevice {
  /**
   * Abstract property that states the connection type
   */
  protected abstract connType: string;

  /**
   * Logs to the console and the logging event emitter
   */
  protected log: (
    scope: Types.EmitterScope,
    emitter: Types.Emitter,
    message: string,
    level: Protobuf.LogRecord_Level,
    packet?: Uint8Array
  ) => void;

  /**
   * Describes the current state of the device
   */
  protected deviceStatus: Types.DeviceStatusEnum;

  /**
   * Describes the current state of the device
   */
  protected isConfigured: boolean;

  /**
   * Device's node number
   */
  private myNodeInfo: MyNodeInfo;

  /**
   * Randomly generated number to ensure confiuration lockstep
   */
  public configId: number;

  /**
   * Keeps track of all requests sent to the radio that have callbacks
   * TODO: Update description
   */
  public queue: Queue;

  constructor(configId?: number) {
    this.log = (scope, emitter, message, level, packet): void => {
      log(scope, emitter, message, level);
      this.onLogEvent.emit({
        scope,
        emitter,
        message,
        level,
        packet,
        date: new Date()
      });
    };

    this.deviceStatus = Types.DeviceStatusEnum.DEVICE_DISCONNECTED;
    this.isConfigured = false;
    this.myNodeInfo = MyNodeInfo.create();
    this.configId = configId ?? this.generateRandId();
    this.queue = new Queue();

    this.onDeviceStatus.subscribe((status) => {
      this.deviceStatus = status;
      if (status === Types.DeviceStatusEnum.DEVICE_CONFIGURED)
        this.isConfigured = true;
      else if (status === Types.DeviceStatusEnum.DEVICE_CONFIGURING)
        this.isConfigured = false;
    });

    this.onMyNodeInfo.subscribe((myNodeInfo) => {
      this.myNodeInfo = myNodeInfo;
    });
  }

  /**
   * Abstract method that writes data to the radio
   */
  protected abstract writeToRadio(data: Uint8Array): Promise<void>;

  /**
   * Abstract method that connects to the radio
   */
  protected abstract connect(parameters: ConnectionParameters): Promise<void>;

  /**
   * Abstract method that disconnects from the radio
   */
  protected abstract disconnect(): void;

  /**
   * Abstract method that pings the radio
   */
  protected abstract ping(): Promise<boolean>;

  /**
   * Fires when a new FromRadio message has been received from the device
   * @event
   */
  public readonly onLogEvent: SubEvent<LogEventPacket> = new SubEvent();

  /**
   * Fires when a new FromRadio message has been received from the device
   * @event
   */
  public readonly onFromRadio: SubEvent<Protobuf.FromRadio> = new SubEvent();

  /**
   * Fires when a new FromRadio message containing a Data packet has been received from the device
   * @event
   */
  public readonly onMeshPacket: SubEvent<Protobuf.MeshPacket> = new SubEvent();

  /**
   * Fires when a new MyNodeInfo message has been received from the device
   */
  public readonly onMyNodeInfo: SubEvent<Protobuf.MyNodeInfo> = new SubEvent();

  /**
   * Fires when a new MeshPacket message containing a NodeInfo packet has been received from device
   * @event
   */
  public readonly onNodeInfoPacket: SubEvent<Types.NodeInfoPacket> =
    new SubEvent();

  /**
   * Fires when a new MeshPacket message containing a User packet has been received from device
   * @event
   */
  public readonly onUserPacket: SubEvent<Types.UserPacket> = new SubEvent();

  /**
   * Fires when a new Channel message is recieved
   * @event
   */
  public readonly onChannelPacket: SubEvent<Types.ChannelPacket> =
    new SubEvent();

  /**
   * Fires when a new Config message is recieved
   * @event
   */
  public readonly onConfigPacket: SubEvent<Types.ConfigPacket> = new SubEvent();

  /**
   * Fires when a new ModuleConfig message is recieved
   * @event
   */
  public readonly onModuleConfigPacket: SubEvent<Types.ModuleConfigPacket> =
    new SubEvent();

  /**
   * Fires when a new MeshPacket message containing a Ping packet has been received from device
   * @event
   */
  public readonly onPingPacket: SubEvent<Types.PingPacket> = new SubEvent();

  /**
   * Fires when a new MeshPacket message containing a IP Tunnel packet has been received from device
   * @event
   */
  public readonly onIpTunnelPacket: SubEvent<Types.IpTunnelPacket> =
    new SubEvent();

  /**
   * Fires when a new MeshPacket message containing a Serial packet has been received from device
   * @event
   */
  public readonly onSerialPacket: SubEvent<Types.SerialPacket> = new SubEvent();
  /**
   * Fires when a new MeshPacket message containing a Store and Forward packet has been received from device
   * @event
   */
  public readonly onStoreForwardPacket: SubEvent<Types.StoreForwardPacket> =
    new SubEvent();

  /**
   * Fires when a new MeshPacket message containing a Store and Forward packet has been received from device
   * @event
   */
  public readonly onRangeTestPacket: SubEvent<Types.RangeTestPacket> =
    new SubEvent();

  /**
   * Fires when a new MeshPacket message containing a Telemetry packet has been received from device
   * @event
   */
  public readonly onTelemetryPacket: SubEvent<Types.TelemetryPacket> =
    new SubEvent();

  /**
   * Fires when a new MeshPacket message containing a Private packet has been received from device
   * @event
   */
  public readonly onPrivatePacket: SubEvent<Types.PrivatePacket> =
    new SubEvent();

  /**
   * Fires when a new MeshPacket message containing a ATAK packet has been received from device
   * @event
   */
  public readonly onAtakPacket: SubEvent<Types.AtakPacket> = new SubEvent();

  /**
   * Fires when a new MeshPacket message containing a Routing packet has been received from device
   * @event
   */
  public readonly onRoutingPacket: SubEvent<Types.RoutingPacket> =
    new SubEvent();

  /**
   * Fires when a new MeshPacket message containing a Position packet has been received from device
   * @event
   */
  public readonly onPositionPacket: SubEvent<Types.PositionPacket> =
    new SubEvent();

  /**
   * Fires when a new MeshPacket message containing a Text packet has been received from device
   * @event
   */
  public readonly onTextPacket: SubEvent<Types.TextPacket> = new SubEvent();

  /**
   * Fires when a new MeshPacket message containing a Remote Hardware packet has been received from device
   * @event
   */
  public readonly onRemoteHardwarePacket: SubEvent<Types.RemoteHardwarePacket> =
    new SubEvent();

  /**
   * Fires when the devices connection or configuration status changes
   * @event
   */
  public readonly onDeviceStatus: SubEvent<Types.DeviceStatusEnum> =
    new SubEvent();

  /**
   * Fires when a new FromRadio message containing a Text packet has been received from device
   * @event
   */
  public readonly onLogRecord: SubEvent<Protobuf.LogRecord> = new SubEvent();

  /**
   * Fires when the device receives a meshPacket, returns a timestamp
   * @event
   */
  public readonly onMeshHeartbeat: SubEvent<Date> = new SubEvent();

  /**
   * Sends a text over the radio
   * @param text
   * @param destinationNum Node number of the destination node
   * @param wantAck Whether or not acknowledgement is wanted
   * @param callback If wantAck is true, callback is called when the ack is received
   */
  public sendText(
    text: string,
    destinationNum?: number,
    wantAck = false,
    channel = 0,
    callback?: (id: number) => Promise<void>
  ): Promise<void> {
    this.log(
      Types.EmitterScope.iMeshDevice,
      Types.Emitter.sendText,
      `Sending message to ${
        destinationNum ?? "broadcast"
      } on channel ${channel}`,
      LogRecord_Level.DEBUG
    );

    const enc = new TextEncoder();

    return this.sendPacket(
      enc.encode(text),
      PortNum.TEXT_MESSAGE_APP,
      destinationNum,
      wantAck,
      channel,
      undefined,
      true,
      callback
    );
  }

  /**
   * Sends a text over the radio
   * @param location Location to send
   * @param destinationNum Node number of the destination node
   * @param wantAck Whether or not acknowledgement is wanted
   * @param callback If wantAck is true, callback is called when the ack is received
   */
  public sendLocation(
    location: Protobuf.Location,
    destinationNum?: number,
    wantAck = false,
    channel = 0,
    callback?: (id: number) => Promise<void>
  ): Promise<void> {
    this.log(
      Types.EmitterScope.iMeshDevice,
      Types.Emitter.sendLocation,
      `Sending location to ${
        destinationNum ?? "broadcast"
      } on channel ${channel}`,
      LogRecord_Level.DEBUG
    );

    return this.sendPacket(
      new Uint8Array(),
      PortNum.TEXT_MESSAGE_APP,
      destinationNum,
      wantAck,
      channel,
      undefined,
      true,
      callback,
      undefined,
      location
    );
  }

  /**
   * Sends packet over the radio
   * @param byteData
   * @param portNum dataType Enum of protobuf data type
   * @param destinationNum Node number of the destination node
   * @param wantAck Whether or not acknowledgement is wanted
   * @param wantResponse Used for testing, requests recpipient to respond in kind with the same type of request
   * @param echoResponse Sends event back to client
   * @param callback If wantAck is true, callback is called when the ack is received
   */
  public async sendPacket(
    byteData: Uint8Array,
    portNum: PortNum,
    destinationNum?: number,
    wantAck = false,
    channel = 0,
    wantResponse = false,
    echoResponse = false,
    callback?: (id: number) => Promise<void>,
    emoji = 0,
    location?: Protobuf.Location,
    replyId = 0
  ): Promise<void> {
    this.log(
      Types.EmitterScope.iMeshDevice,
      Types.Emitter.sendPacket,
      `Sending ${Protobuf.PortNum[portNum] ?? "Unknown"} to ${
        destinationNum ?? "broadcast"
      }`,
      LogRecord_Level.TRACE
    );

    const meshPacket = MeshPacket.create({
      payloadVariant: {
        decoded: {
          payload: byteData,
          portnum: portNum,
          wantResponse,
          location,
          emoji,
          replyId,
          dest: 0, //change this!
          requestId: 0, //change this!
          source: 0 //change this!
        },
        oneofKind: "decoded"
      },
      from: this.myNodeInfo.myNodeNum,
      to: destinationNum ? destinationNum : BROADCAST_NUM,
      id: this.generateRandId(),
      wantAck: wantAck,
      channel
    });

    const toRadio = ToRadio.toBinary(
      ToRadio.create({
        payloadVariant: {
          packet: meshPacket,
          oneofKind: "packet"
        }
      })
    );

    if (echoResponse) {
      await this.handleMeshPacket(meshPacket);
    }
    await this.sendRaw(meshPacket.id, toRadio, callback);
  }

  /**
   * Sends raw packet over the radio
   * @param toRadio binary data to send
   */
  public async sendRaw(
    id: number,
    toRadio: Uint8Array,
    callback?: (id: number) => Promise<void>
  ): Promise<void> {
    if (toRadio.length > 512) {
      this.log(
        Types.EmitterScope.iMeshDevice,
        Types.Emitter.sendRaw,
        `Message longer than 512 bytes, it will not be sent!`,
        LogRecord_Level.WARNING
      );
    } else {
      this.queue.push({
        id,
        data: toRadio,
        callback:
          callback ??
          (async () => {
            return Promise.resolve();
          }),
        waitingAck: false
      });

      await this.queue.processQueue(async (data) => {
        await this.writeToRadio(data);
      });
    }
  }

  /**
   * Writes config to device
   * @param config config object
   * @param callback If wantAck is true, callback is called when the ack is received
   */
  public async setConfig(
    config: Protobuf.Config,
    callback?: (id: number) => Promise<void>
  ): Promise<void> {
    this.log(
      Types.EmitterScope.iMeshDevice,
      Types.Emitter.setConfig,
      `Setting config ${callback ? "with" : "without"} callback`,
      LogRecord_Level.DEBUG
    );

    let configType: Protobuf.AdminMessage_ConfigType;

    switch (config.payloadVariant.oneofKind) {
      case "device":
        configType = Protobuf.AdminMessage_ConfigType.DEVICE_CONFIG;
        break;

      case "display":
        configType = Protobuf.AdminMessage_ConfigType.DISPLAY_CONFIG;
        break;

      case "lora":
        configType = Protobuf.AdminMessage_ConfigType.LORA_CONFIG;
        break;

      case "position":
        configType = Protobuf.AdminMessage_ConfigType.POSITION_CONFIG;
        break;

      case "power":
        configType = Protobuf.AdminMessage_ConfigType.POWER_CONFIG;
        break;

      case "wifi":
        configType = Protobuf.AdminMessage_ConfigType.WIFI_CONFIG;
        break;
    }

    const setRadio = AdminMessage.toBinary(
      AdminMessage.create({
        variant: {
          oneofKind: "setConfig",
          setConfig: config
        }
      })
    );

    await this.sendPacket(
      setRadio,
      PortNum.ADMIN_APP,
      this.myNodeInfo.myNodeNum,
      true,
      0,
      true,
      false,
      async (id: number) => {
        await this.getConfig(configType);
        callback && callback(id);
      }
    );
  }

  /**
   * Writes module config to device
   * @param config module config object
   * @param callback If wantAck is true, callback is called when the ack is received
   */
  public async setModuleConfig(
    config: Protobuf.ModuleConfig,
    callback?: (id: number) => Promise<void>
  ): Promise<void> {
    this.log(
      Types.EmitterScope.iMeshDevice,
      Types.Emitter.setModuleConfig,
      `Setting module config ${callback ? "with" : "without"} callback`,
      LogRecord_Level.DEBUG
    );

    let configType: Protobuf.AdminMessage_ModuleConfigType;

    switch (config.payloadVariant.oneofKind) {
      case "mqtt":
        configType = Protobuf.AdminMessage_ModuleConfigType.MQTT_CONFIG;
        break;

      case "serial":
        configType = Protobuf.AdminMessage_ModuleConfigType.SERIAL_CONFIG;
        break;

      case "externalNotification":
        configType = Protobuf.AdminMessage_ModuleConfigType.EXTNOTIF_CONFIG;
        break;

      case "storeForward":
        configType = Protobuf.AdminMessage_ModuleConfigType.STOREFORWARD_CONFIG;
        break;

      case "rangeTest":
        configType = Protobuf.AdminMessage_ModuleConfigType.RANGETEST_CONFIG;
        break;

      case "telemetry":
        configType = Protobuf.AdminMessage_ModuleConfigType.TELEMETRY_CONFIG;
        break;

      case "cannedMessage":
        configType = Protobuf.AdminMessage_ModuleConfigType.CANNEDMSG_CONFIG;
        break;
    }

    const setRadio = AdminMessage.toBinary(
      AdminMessage.create({
        variant: {
          oneofKind: "setModuleConfig",
          setModuleConfig: config
        }
      })
    );

    await this.sendPacket(
      setRadio,
      PortNum.ADMIN_APP,
      this.myNodeInfo.myNodeNum,
      true,
      0,
      true,
      false,
      async (id: number) => {
        await this.getModuleConfig(configType);
        callback && callback(id);
      }
    );
  }

  /**
   * Confirms the currently set config, and prevents changes from reverting after 10 minutes.
   * @param callback If wantAck is true, callback is called when the ack is received
   */
  public async confirmSetConfig(
    callback?: (id: number) => Promise<void>
  ): Promise<void> {
    this.log(
      Types.EmitterScope.iMeshDevice,
      Types.Emitter.confirmSetConfig,
      `Confirming config ${callback ? "with" : "without"} callback`,
      LogRecord_Level.DEBUG
    );

    const confirmSetRadio = AdminMessage.toBinary(
      AdminMessage.create({
        variant: {
          confirmSetRadio: true,
          oneofKind: "confirmSetRadio"
        }
      })
    );

    await this.sendPacket(
      confirmSetRadio,
      PortNum.ADMIN_APP,
      this.myNodeInfo.myNodeNum,
      true,
      0,
      true,
      false,
      callback
    );
  }

  /**
   * Sets devices owner data
   * @param owner Owner data to apply to the device
   * @param callback If wantAck is true, callback is called when the ack is received
   */
  public async setOwner(
    owner: User,
    callback?: (id: number) => Promise<void>
  ): Promise<void> {
    this.log(
      Types.EmitterScope.iMeshDevice,
      Types.Emitter.setOwner,
      `Setting owner ${callback ? "with" : "without"} callback`,
      LogRecord_Level.DEBUG
    );

    const setOwner = AdminMessage.toBinary(
      AdminMessage.create({
        variant: {
          setOwner: owner,
          oneofKind: "setOwner"
        }
      })
    );

    await this.sendPacket(
      setOwner,
      PortNum.ADMIN_APP,
      this.myNodeInfo.myNodeNum,
      true,
      0,
      true,
      false,
      async (id: number) => {
        await this.getOwner();
        callback && callback(id);
      }
    );
  }

  /**
   * Sets devices ChannelSettings
   * @param channel Channel data to be set
   * @param callback If wantAck is true, callback is called when the ack is received
   */
  public async setChannel(
    channel: Channel,
    callback?: (id: number) => Promise<void>
  ): Promise<void> {
    this.log(
      Types.EmitterScope.iMeshDevice,
      Types.Emitter.setChannel,
      `Setting Channel: ${channel.index} ${
        callback ? "with" : "without"
      } callback`,
      LogRecord_Level.DEBUG
    );

    const setChannel = AdminMessage.toBinary(
      AdminMessage.create({
        variant: {
          setChannel: channel,
          oneofKind: "setChannel"
        }
      })
    );

    await this.sendPacket(
      setChannel,
      PortNum.ADMIN_APP,
      this.myNodeInfo.myNodeNum,
      true,
      0,
      true,
      false,
      async (id: number) => {
        await this.getChannel(channel.index);
        callback && callback(id);
      }
    );
  }

  /**
   * Confirms the currently set channels, and prevents changes from reverting after 10 minutes.
   * @param callback If wantAck is true, callback is called when the ack is received
   */
  public async confirmSetChannel(
    callback?: (id: number) => Promise<void>
  ): Promise<void> {
    this.log(
      Types.EmitterScope.iMeshDevice,
      Types.Emitter.confirmSetChannel,
      `Confirming Channel config ${callback ? "with" : "without"} callback`,
      LogRecord_Level.DEBUG
    );

    const confirmSetChannel = AdminMessage.toBinary(
      AdminMessage.create({
        variant: {
          confirmSetRadio: true,
          oneofKind: "confirmSetRadio"
        }
      })
    );

    await this.sendPacket(
      confirmSetChannel,
      PortNum.ADMIN_APP,
      this.myNodeInfo.myNodeNum,
      true,
      0,
      true,
      false,
      callback
    );
  }

  /**
   * Deletes specific channel via index
   * @param index Channel index to be deleted
   * @param callback If wantAck is true, callback is called when the ack is received
   */
  public async deleteChannel(
    index: number,
    callback?: (id: number) => Promise<void>
  ): Promise<void> {
    this.log(
      Types.EmitterScope.iMeshDevice,
      Types.Emitter.deleteChannel,
      `Deleting Channel ${callback ? "with" : "without"} callback`,
      LogRecord_Level.DEBUG
    );

    const channel = Protobuf.Channel.create({
      index,
      role: Protobuf.Channel_Role.DISABLED
    });
    const setChannel = AdminMessage.toBinary(
      AdminMessage.create({
        variant: {
          setChannel: channel,
          oneofKind: "setChannel"
        }
      })
    );

    await this.sendPacket(
      setChannel,
      PortNum.ADMIN_APP,
      this.myNodeInfo.myNodeNum,
      true,
      0,
      true,
      false,
      async (id: number) => {
        await this.getChannel(channel.index);
        callback && callback(id);
      }
    );
  }

  /**
   * Gets specified channel information from the radio
   * @param index Channel index to be retrieved
   * @param callback If wantAck is true, callback is called when the ack is received
   */
  public async getChannel(
    index: number,
    callback?: (id: number) => Promise<void>
  ): Promise<void> {
    this.log(
      Types.EmitterScope.iMeshDevice,
      Types.Emitter.getChannel,
      `Requesting Channel: ${index} ${callback ? "with" : "without"} callback`,
      LogRecord_Level.DEBUG
    );

    const getChannelRequest = AdminMessage.toBinary(
      AdminMessage.create({
        variant: {
          getChannelRequest: index + 1,
          oneofKind: "getChannelRequest"
        }
      })
    );

    await this.sendPacket(
      getChannelRequest,
      PortNum.ADMIN_APP,
      this.myNodeInfo.myNodeNum,
      true,
      0,
      true,
      false,
      callback
    );
  }

  /**
   * Gets all of the devices channels
   * @param callback If wantAck is true, callback is called when the ack is received
   */
  public async getAllChannels(callback?: () => Promise<void>): Promise<void> {
    this.log(
      Types.EmitterScope.iMeshDevice,
      Types.Emitter.getAllChannels,
      `Requesting all Channels ${callback ? "with" : "without"} callback`,
      LogRecord_Level.DEBUG
    );

    // TODO: Use device queue now.
    const queue: Array<() => Promise<void>> = [];
    for (let i = 0; i <= this.myNodeInfo.maxChannels; i++) {
      queue.push(async (): Promise<void> => {
        return await Promise.resolve();
      });
      await this.getChannel(i, queue[i]);
    }
    await Promise.all(queue);
    callback && callback();
  }

  /**
   * Gets devices config
   * @param callback If wantAck is true, callback is called when the ack is received
   */
  public async getConfig(
    configType: Protobuf.AdminMessage_ConfigType,
    callback?: (id: number) => Promise<void>
  ): Promise<void> {
    this.log(
      Types.EmitterScope.iMeshDevice,
      Types.Emitter.getConfig,
      `Requesting config ${callback ? "with" : "without"} callback`,
      LogRecord_Level.DEBUG
    );

    const getRadioRequest = AdminMessage.toBinary(
      AdminMessage.create({
        variant: {
          oneofKind: "getConfigRequest",
          getConfigRequest: configType
        }
      })
    );

    await this.sendPacket(
      getRadioRequest,
      PortNum.ADMIN_APP,
      this.myNodeInfo.myNodeNum,
      true,
      0,
      true,
      false,
      callback
    );
  }

  /**
   * Gets devices config
   * @param callback If wantAck is true, callback is called when the ack is received
   */
  public async getModuleConfig(
    configType: Protobuf.AdminMessage_ModuleConfigType,
    callback?: (id: number) => Promise<void>
  ): Promise<void> {
    this.log(
      Types.EmitterScope.iMeshDevice,
      Types.Emitter.getModuleConfig,
      `Requesting module config ${callback ? "with" : "without"} callback`,
      LogRecord_Level.DEBUG
    );

    const getRadioRequest = AdminMessage.toBinary(
      AdminMessage.create({
        variant: {
          oneofKind: "getModuleConfigRequest",
          getModuleConfigRequest: configType
        }
      })
    );

    await this.sendPacket(
      getRadioRequest,
      PortNum.ADMIN_APP,
      this.myNodeInfo.myNodeNum,
      true,
      0,
      true,
      false,
      callback
    );
  }

  /**
   * Gets devices Owner
   * @param callback If wantAck is true, callback is called when the ack is received
   */
  public async getOwner(
    callback?: (id: number) => Promise<void>
  ): Promise<void> {
    this.log(
      Types.EmitterScope.iMeshDevice,
      Types.Emitter.getOwner,
      `Requesting owner ${callback ? "with" : "without"} callback`,
      LogRecord_Level.DEBUG
    );

    const getOwnerRequest = AdminMessage.toBinary(
      AdminMessage.create({
        variant: {
          getOwnerRequest: true,
          oneofKind: "getOwnerRequest"
        }
      })
    );

    await this.sendPacket(
      getOwnerRequest,
      PortNum.ADMIN_APP,
      this.myNodeInfo.myNodeNum,
      true,
      0,
      true,
      false,
      callback
    );
  }

  /**
   * Triggers the device configure process
   */
  public configure(): void {
    this.log(
      Types.EmitterScope.iMeshDevice,
      Types.Emitter.configure,
      `Reading device configuration`,
      LogRecord_Level.DEBUG
    );
    this.updateDeviceStatus(Types.DeviceStatusEnum.DEVICE_CONFIGURING);

    const toRadio = ToRadio.toBinary(
      ToRadio.create({
        payloadVariant: {
          wantConfigId: this.configId,
          oneofKind: "wantConfigId"
        }
      })
    );

    setTimeout(() => {
      void this.sendRaw(0, toRadio);
    }, 500);
  }

  /**
   * Updates the device status eliminating duplicate status events
   * @param status
   */
  public updateDeviceStatus(status: Types.DeviceStatusEnum): void {
    if (status !== this.deviceStatus) {
      this.onDeviceStatus.emit(status);
    }
  }

  /**
   * Generates random packet identifier
   */
  private generateRandId(): number {
    return Math.floor(Math.random() * 1e9);
  }

  /**
   * Gets called whenever a fromRadio message is received from device, returns fromRadio data
   * @param fromRadio Uint8Array containing raw radio data
   */
  protected async handleFromRadio(fromRadio: Uint8Array): Promise<void> {
    const decodedMessage = FromRadio.fromBinary(fromRadio);

    this.onFromRadio.emit(decodedMessage);

    /**
     * @todo add map here when `all=true` gets fixed.
     */
    switch (decodedMessage.payloadVariant.oneofKind) {
      case "packet":
        await this.handleMeshPacket(decodedMessage.payloadVariant.packet);
        break;

      case "myInfo":
        if (
          parseFloat(decodedMessage.payloadVariant.myInfo.firmwareVersion) <
          MIN_FW_VERSION
        ) {
          this.log(
            Types.EmitterScope.iMeshDevice,
            Types.Emitter.handleFromRadio,
            `Device firmware outdated. Min supported: ${MIN_FW_VERSION} got : ${decodedMessage.payloadVariant.myInfo.firmwareVersion}`,
            LogRecord_Level.CRITICAL
          );
        }
        this.onMyNodeInfo.emit(decodedMessage.payloadVariant.myInfo);
        this.log(
          Types.EmitterScope.iMeshDevice,
          Types.Emitter.handleFromRadio,
          "Received onMyNodeInfo",
          LogRecord_Level.TRACE
        );
        break;

      case "nodeInfo":
        this.log(
          Types.EmitterScope.iMeshDevice,
          Types.Emitter.handleFromRadio,
          "Received onNodeInfoPacket",
          LogRecord_Level.TRACE
        );

        this.onNodeInfoPacket.emit({
          packet: MeshPacket.create({
            id: decodedMessage.id
          }),
          data: decodedMessage.payloadVariant.nodeInfo
        });

        if (decodedMessage.payloadVariant.nodeInfo.position) {
          this.onPositionPacket.emit({
            packet: MeshPacket.create({
              id: decodedMessage.id,
              from: decodedMessage.payloadVariant.nodeInfo.num
            }),
            data: decodedMessage.payloadVariant.nodeInfo.position
          });
        }

        if (decodedMessage.payloadVariant.nodeInfo.user) {
          this.onUserPacket.emit({
            packet: MeshPacket.create({
              id: decodedMessage.id,
              from: decodedMessage.payloadVariant.nodeInfo.num
            }),
            data: decodedMessage.payloadVariant.nodeInfo.user
          });
        }
        break;

      case "config":
        this.log(
          Types.EmitterScope.iMeshDevice,
          Types.Emitter.handleFromRadio,
          "Received onConfigPacket",
          LogRecord_Level.TRACE
        );

        this.onConfigPacket.emit({
          packet: MeshPacket.create({
            id: decodedMessage.id
          }),
          data: decodedMessage.payloadVariant.config
        });
        break;

      case "logRecord":
        this.log(
          Types.EmitterScope.iMeshDevice,
          Types.Emitter.handleFromRadio,
          "Received onLogRecord",
          LogRecord_Level.TRACE
        );
        this.onLogRecord.emit(decodedMessage.payloadVariant.logRecord);
        break;

      case "configCompleteId":
        if (decodedMessage.payloadVariant.configCompleteId !== this.configId) {
          this.log(
            Types.EmitterScope.iMeshDevice,
            Types.Emitter.handleFromRadio,
            `Invalid config id reveived from device, exptected ${this.configId} but received ${decodedMessage.payloadVariant.configCompleteId}`,
            LogRecord_Level.ERROR
          );
        }

        await this.sendRaw(
          0,
          ToRadio.toBinary(
            ToRadio.create({
              payloadVariant: {
                peerInfo: {
                  appVersion: 1,
                  mqttGateway: false
                },
                oneofKind: "peerInfo"
              }
            })
          )
        );

        // await this.getConfig(async () => {
        await this.getAllChannels(async () => {
          await Promise.resolve();
        });
        // });

        this.updateDeviceStatus(Types.DeviceStatusEnum.DEVICE_CONFIGURED);
        break;

      case "rebooted":
        this.configure();
        break;

      case "moduleConfig":
        this.log(
          Types.EmitterScope.iMeshDevice,
          Types.Emitter.handleFromRadio,
          "Received onModuleConfigPacket",
          LogRecord_Level.TRACE
        );

        this.onModuleConfigPacket.emit({
          packet: MeshPacket.create({
            id: decodedMessage.id
          }),
          data: decodedMessage.payloadVariant.moduleConfig
        });
        break;
    }
  }

  /**
   * Completes all SubEvents
   */
  public complete(): void {
    this.onLogEvent.cancelAll();
    this.onFromRadio.cancelAll();
    this.onMeshPacket.cancelAll();
    this.onMyNodeInfo.cancelAll();
    this.onNodeInfoPacket.cancelAll();
    this.onUserPacket.cancelAll();
    this.onChannelPacket.cancelAll();
    this.onConfigPacket.cancelAll();
    this.onModuleConfigPacket.cancelAll();
    this.onPingPacket.cancelAll();
    this.onIpTunnelPacket.cancelAll();
    this.onSerialPacket.cancelAll();
    this.onStoreForwardPacket.cancelAll();
    this.onRangeTestPacket.cancelAll();
    this.onTelemetryPacket.cancelAll();
    this.onPrivatePacket.cancelAll();
    this.onAtakPacket.cancelAll();
    this.onRoutingPacket.cancelAll();
    this.onPositionPacket.cancelAll();
    this.onTextPacket.cancelAll();
    this.onRemoteHardwarePacket.cancelAll();
    this.onDeviceStatus.cancelAll();
    this.onLogRecord.cancelAll();
    this.onMeshHeartbeat.cancelAll();
    this.queue.clear();
  }

  /**
   * Gets called when a MeshPacket is received from device
   * @param meshPacket
   */
  private async handleMeshPacket(meshPacket: MeshPacket): Promise<void> {
    this.onMeshPacket.emit(meshPacket);
    if (meshPacket.from !== this.myNodeInfo.myNodeNum) {
      /**
       * @todo, this shouldn't be called unless the device interracts with the mesh, currently it does.
       */
      this.onMeshHeartbeat.emit(new Date());
    }

    switch (meshPacket.payloadVariant.oneofKind) {
      case "decoded":
        await this.queue.processAck(
          meshPacket.payloadVariant.decoded.requestId
        );
        this.handleDataPacket(meshPacket.payloadVariant.decoded, meshPacket);
        break;

      case "encrypted":
        this.log(
          Types.EmitterScope.iMeshDevice,
          Types.Emitter.handleMeshPacket,
          "Device received encrypted data packet, ignoring.",
          LogRecord_Level.DEBUG
        );
        break;
    }
  }

  private handleDataPacket(dataPacket: Data, meshPacket: MeshPacket) {
    let adminMessage: AdminMessage | undefined = undefined;
    switch (dataPacket.portnum) {
      case PortNum.TEXT_MESSAGE_APP:
        this.log(
          Types.EmitterScope.iMeshDevice,
          Types.Emitter.handleMeshPacket,
          "Received onTextPacket",
          LogRecord_Level.TRACE,
          dataPacket.payload
        );
        this.onTextPacket.emit({
          packet: meshPacket,
          data: new TextDecoder().decode(dataPacket.payload)
        });
        break;

      case PortNum.REMOTE_HARDWARE_APP:
        this.log(
          Types.EmitterScope.iMeshDevice,
          Types.Emitter.handleMeshPacket,
          "Received onRemoteHardwarePacket",
          LogRecord_Level.TRACE,
          dataPacket.payload
        );
        this.onRemoteHardwarePacket.emit({
          packet: meshPacket,
          data: Protobuf.HardwareMessage.fromBinary(dataPacket.payload)
        });
        break;

      case PortNum.POSITION_APP:
        this.log(
          Types.EmitterScope.iMeshDevice,
          Types.Emitter.handleMeshPacket,
          "Received onPositionPacket",
          LogRecord_Level.TRACE,
          dataPacket.payload
        );
        this.onPositionPacket.emit({
          packet: meshPacket,
          data: Position.fromBinary(dataPacket.payload)
        });
        break;

      case PortNum.NODEINFO_APP:
        /**
         * @todo, workaround for NODEINFO_APP plugin sending a User protobuf instead of a NodeInfo protobuf
         */
        this.log(
          Types.EmitterScope.iMeshDevice,
          Types.Emitter.handleMeshPacket,
          "Received onUserPacket",
          LogRecord_Level.TRACE,
          dataPacket.payload
        );
        this.onUserPacket.emit({
          packet: meshPacket,
          data: User.fromBinary(dataPacket.payload)
        });
        break;

      case PortNum.ROUTING_APP:
        this.log(
          Types.EmitterScope.iMeshDevice,
          Types.Emitter.handleMeshPacket,
          "Received onRoutingPacket",
          LogRecord_Level.TRACE,
          dataPacket.payload
        );
        this.onRoutingPacket.emit({
          packet: meshPacket,
          data: Routing.fromBinary(dataPacket.payload)
        });
        break;

      case PortNum.ADMIN_APP:
        this.log(
          Types.EmitterScope.iMeshDevice,
          Types.Emitter.handleMeshPacket,
          "Received onAdminPacket",
          LogRecord_Level.TRACE,
          dataPacket.payload
        );
        adminMessage = AdminMessage.fromBinary(dataPacket.payload);
        switch (adminMessage.variant.oneofKind) {
          case "getChannelResponse":
            this.onChannelPacket.emit({
              packet: meshPacket,
              data: adminMessage.variant.getChannelResponse
            });
            break;
          case "getOwnerResponse":
            this.onUserPacket.emit({
              packet: meshPacket,
              data: adminMessage.variant.getOwnerResponse
            });
            break;
          case "getConfigResponse":
            this.onConfigPacket.emit({
              packet: meshPacket,
              data: adminMessage.variant.getConfigResponse
            });
            break;
          case "getModuleConfigResponse":
            this.onModuleConfigPacket.emit({
              packet: meshPacket,
              data: adminMessage.variant.getModuleConfigResponse
            });
            break;
        }
        break;

      case PortNum.REPLY_APP:
        this.log(
          Types.EmitterScope.iMeshDevice,
          Types.Emitter.handleMeshPacket,
          "Received onPingPacket",
          LogRecord_Level.TRACE,
          dataPacket.payload
        );
        this.onPingPacket.emit({
          packet: meshPacket,
          data: dataPacket.payload
        });
        break;

      case PortNum.IP_TUNNEL_APP:
        this.log(
          Types.EmitterScope.iMeshDevice,
          Types.Emitter.handleMeshPacket,
          "Received onIpTunnelPacket",
          LogRecord_Level.TRACE,
          dataPacket.payload
        );
        this.onIpTunnelPacket.emit({
          packet: meshPacket,
          data: dataPacket.payload
        });
        break;

      case PortNum.SERIAL_APP:
        this.log(
          Types.EmitterScope.iMeshDevice,
          Types.Emitter.handleMeshPacket,
          "Received onSerialPacket",
          LogRecord_Level.TRACE,
          dataPacket.payload
        );
        this.onSerialPacket.emit({
          packet: meshPacket,
          data: dataPacket.payload
        });
        break;

      case PortNum.STORE_FORWARD_APP:
        this.log(
          Types.EmitterScope.iMeshDevice,
          Types.Emitter.handleMeshPacket,
          "Received onStoreForwardPacket",
          LogRecord_Level.TRACE,
          dataPacket.payload
        );
        this.onStoreForwardPacket.emit({
          packet: meshPacket,
          data: dataPacket.payload
        });
        break;

      case PortNum.RANGE_TEST_APP:
        this.log(
          Types.EmitterScope.iMeshDevice,
          Types.Emitter.handleMeshPacket,
          "Received onRangeTestPacket",
          LogRecord_Level.TRACE,
          dataPacket.payload
        );
        this.onRangeTestPacket.emit({
          packet: meshPacket,
          data: dataPacket.payload
        });
        break;

      case PortNum.TELEMETRY_APP:
        this.log(
          Types.EmitterScope.iMeshDevice,
          Types.Emitter.handleMeshPacket,
          "Received onTelemetryPacket",
          LogRecord_Level.TRACE,
          dataPacket.payload
        );
        this.onTelemetryPacket.emit({
          packet: meshPacket,
          data: Protobuf.Telemetry.fromBinary(dataPacket.payload)
        });
        break;

      case PortNum.PRIVATE_APP:
        this.log(
          Types.EmitterScope.iMeshDevice,
          Types.Emitter.handleMeshPacket,
          "Received onPrivatePacket",
          LogRecord_Level.TRACE,
          dataPacket.payload
        );
        this.onPrivatePacket.emit({
          packet: meshPacket,
          data: dataPacket.payload
        });
        break;

      case PortNum.ATAK_FORWARDER:
        this.log(
          Types.EmitterScope.iMeshDevice,
          Types.Emitter.handleMeshPacket,
          "Received onAtakPacket",
          LogRecord_Level.TRACE,
          dataPacket.payload
        );
        this.onAtakPacket.emit({
          packet: meshPacket,
          data: dataPacket.payload
        });
        break;

      default:
        this.log(
          Types.EmitterScope.iMeshDevice,
          Types.Emitter.handleMeshPacket,
          `Unhandled PortNum: ${PortNum[dataPacket.portnum] ?? "Unknown"}`,
          LogRecord_Level.WARNING,
          dataPacket.payload
        );
        break;
    }
  }
}
